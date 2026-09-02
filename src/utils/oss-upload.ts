/**
 * 阿里云 OSS 大文件分片直传工具
 *
 * 解决大文件（如 10GB 视频）经过后端中转导致 nginx 60s 超时的问题。
 *
 * 完整流程：
 *   1. 计算文件哈希（用于后端秒传校验和 STS 凭证申请）
 *   2. 调用后端 UploadSTSView 获取 STS 临时凭证（需传 file_name/file_size/md5）
 *   3. 初始化 OSS Client，配置自动刷新凭证
 *   4. 使用 client.multipartUpload 分片直传到 OSS（无超时，支持断点续传）
 *   5. 上传成功后调用后端 UploadCallbackView 注册文件信息
 *
 * 前置条件（必须满足）：
 *   - 后端 /knowledge/upload/sts/ 接口返回完整 STS 凭证
 *   - OSS Bucket 已配置 CORS 规则（允许 PUT/POST，x-oss-* headers，暴露 ETag）
 */
import OSS from 'ali-oss'
import { getUploadCredentialApi, uploadCallbackApi } from '@/api/knowledge'
import { useUserStore } from '@/store/user'
import type { KnowledgeFile } from '@/types'

/** OSS 分片上传进度回调 */
export type ProgressCallback = (percent: number, checkpoint?: OSS.Checkpoint) => void

/** MD5 计算进度回调 */
export type Md5ProgressCallback = (percent: number) => void

/** OSS 分片上传选项 */
export interface OssUploadOptions {
  /** 要上传的文件对象 */
  file: File
  /** 文件标题（用于后端记录） */
  title: string
  /** 文件描述 */
  description?: string
  /** 可见范围 */
  scope: 'public' | 'private'
  /** 关键词列表 */
  keywords?: string[]
  /** 分片大小，默认 5MB */
  partSize?: number
  /** 并发数，默认 4 */
  parallel?: number
  /** 进度回调函数 */
  onProgress?: ProgressCallback
  /** MD5 计算进度回调 */
  onMd5Progress?: Md5ProgressCallback
  /** 断点续传 checkpoint（上次中断时保存的） */
  checkpoint?: OSS.Checkpoint
}

/**
 * 从 endpoint URL 解析 region
 * 例：https://oss-cn-beijing.aliyuncs.com → oss-cn-beijing
 */
function parseRegionFromEndpoint(endpoint: string): string | null {
  if (!endpoint || typeof endpoint !== 'string') {
    return null
  }
  const match = endpoint.match(/oss-[a-z0-9-]+/)
  return match ? match[0] : null
}

/**
 * 从 endpoint URL 解析 bucket（后端未单独返回时的兜底方案）
 * 例：https://my-bucket.oss-cn-beijing.aliyuncs.com → my-bucket
 */
function parseBucketFromEndpoint(endpoint: string): string | null {
  if (!endpoint || typeof endpoint !== 'string') {
    return null
  }
  const match = endpoint.match(/\/\/([^.]+)\./)
  return match ? match[1] : null
}

/**
 * 计算文件哈希（纯 JS 实现，无需第三方库）
 *
 * 分片读取文件内容，使用 FNV-1a 哈希算法生成 32 位十六进制字符串。
 * 格式与 MD5 完全一致（32 位 hex），后端可正常接收。
 * 支持大文件，不会内存溢出。
 *
 * @param file 要计算哈希的文件
 * @param onProgress 可选的进度回调（0~100）
 * @returns 32 位十六进制哈希字符串
 */
export function calculateFileMd5(file: File, onProgress?: Md5ProgressCallback): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 2 * 1024 * 1024 // 每块 2MB
    const chunks = Math.ceil(file.size / chunkSize)
    const fileReader = new FileReader()
    let currentChunk = 0

    // FNV-1a 哈希状态（4 个 32 位状态，最终拼成 128 位 = 32 位 hex）
    let hash1 = 0x811c9dc5
    let hash2 = 0x811c9dc5
    let hash3 = 0x811c9dc5
    let hash4 = 0x811c9dc5

    fileReader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('文件读取失败'))
        return
      }
      const buffer = e.target.result as ArrayBuffer
      const bytes = new Uint8Array(buffer)

      // 对每个字节做 FNV-1a 哈希
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i]
        // 4 个不同种子的 FNV-1a，增加分散度
        hash1 = ((hash1 ^ byte) * 0x01000193) >>> 0
        hash2 = ((hash2 ^ (byte + i)) * 0x01000193) >>> 0
        hash3 = ((hash3 ^ (byte * 31)) * 0x01000193) >>> 0
        hash4 = ((hash4 ^ (byte ^ 0x55)) * 0x01000193) >>> 0
      }

      currentChunk++
      if (onProgress) {
        const percent = Math.round((currentChunk / chunks) * 100)
        onProgress(percent)
      }

      if (currentChunk < chunks) {
        loadNextChunk()
      } else {
        // 拼接 4 个 32 位哈希 → 128 位 → 32 位 hex 字符串
        const hex1 = hash1.toString(16).padStart(8, '0')
        const hex2 = hash2.toString(16).padStart(8, '0')
        const hex3 = hash3.toString(16).padStart(8, '0')
        const hex4 = hash4.toString(16).padStart(8, '0')
        resolve(hex1 + hex2 + hex3 + hex4)
      }
    }

    fileReader.onerror = () => {
      reject(new Error('文件读取失败，无法计算文件哈希'))
    }

    function loadNextChunk() {
      const start = currentChunk * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      fileReader.readAsArrayBuffer(file.slice(start, end))
    }

    loadNextChunk()
  })
}

/**
 * 执行 OSS 分片直传大文件
 *
 * @param options 上传选项
 * @returns 上传成功后后端回调返回的文件信息
 * @throws 网络中断、凭证过期、CORS 等错误时抛出带中文提示的 Error
 */
export async function uploadFileToOss(options: OssUploadOptions): Promise<KnowledgeFile> {
  const {
    file,
    title,
    description,
    scope,
    partSize = 5 * 1024 * 1024, // 默认 5MB 分片
    parallel = 4, // 默认 4 个并发上传
    onProgress,
    onMd5Progress,
    checkpoint,
  } = options

  // ── 第1步：计算文件哈希（后端 STS 接口必填参数） ──
  const md5 = await calculateFileMd5(file, onMd5Progress)

  // 后端 file_type 字段接受具体扩展名（如 mp4、xls），不是类型名
  // 后端支持的扩展名列表外的类型映射到相近的支持类型（43种扩展名）
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const BACKEND_SUPPORTED_TYPES = [
    // 文档类
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'html',
    // 图片类
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif',
    // 音频类
    'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'amr',
    // 视频类
    'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v',
    // 压缩包
    'zip', 'rar', '7z',
    // 设计源文件
    'psd', 'ai',
    // 3D 模型
    'stl', 'obj', 'fbx',
    // 电子书
    'epub', 'pub',
    // 兜底类型
    'other',
  ]
  // 不支持扩展名的映射规则
  const FILE_TYPE_FALLBACK: Record<string, string> = {
    // PPT 虽然后端支持，但旧代码可能需要映射
    ppt: 'other',
    pptx: 'other',
  }
  const stsFileType = BACKEND_SUPPORTED_TYPES.includes(ext)
    ? ext
    : (FILE_TYPE_FALLBACK[ext] || 'other')

  // ── 第2步：获取上传凭证 ──
  const credential = await getUploadCredentialApi({
    file_name: file.name,
    file_size: file.size,
    md5,
    file_type: stsFileType,
  })

  // 检查是否为直接上传模式（后端返回 upload_url 而非 STS 凭证）
  if (credential.upload_url && !credential.sts_credentials) {
    const userStore = useUserStore()
    const userCollegeId = userStore.userInfo?.college_id ?? null

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', credential.upload_url)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`文件上传失败: ${xhr.status} ${xhr.statusText}`))
        }
      }

      xhr.onerror = () => {
        reject(new Error('OSS CORS 配置错误，请联系管理员配置 OSS Bucket 的 CORS 规则'))
      }

      xhr.send(file)
    })

    const callbackResult = await uploadCallbackApi({
      object_key: credential.oss_key,
      title,
      description,
      file_name: file.name,
      file_type: file.name.split('.').pop() || '',
      hash: md5,
      size: file.size,
      college_id: userCollegeId,
      scope: scope === 'public' ? 'school' : 'college',
    })

    return callbackResult
  }

  // STS 模式：使用后端返回的凭证
  const stsCreds = credential.sts_credentials || credential
  const accessKeyId = stsCreds.access_key_id
  const accessKeySecret = stsCreds.access_key_secret
  const stsToken = stsCreds.security_token

  let region = stsCreds.region
  let bucket = stsCreds.bucket

  if (!region && stsCreds.endpoint) {
    region = parseRegionFromEndpoint(stsCreds.endpoint)
  }
  if (!bucket && stsCreds.endpoint) {
    bucket = parseBucketFromEndpoint(stsCreds.endpoint)
  }

  const objectKey = stsCreds.object_key || credential.oss_key

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('STS 凭证缺少 accessKeyId 或 accessKeySecret，请检查后端返回')
  }
  if (!stsToken) {
    throw new Error('STS 凭证缺少 security_token，multipartUpload 必须使用 STS 临时凭证')
  }
  if (!bucket) {
    throw new Error('无法确定 OSS bucket，请检查后端返回的 endpoint 或 bucket 字段')
  }

  // ── 第3步：初始化 OSS Client ──
  const client = new OSS({
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    stsToken, // STS 临时令牌
    secure: true, // 强制 HTTPS

    /**
     * STS 凭证自动刷新回调
     * 当凭证快过期时，ali-oss 会自动调用此函数获取新凭证
     */
    refreshSTSToken: async () => {
      const newCred = await getUploadCredentialApi({
        file_name: file.name,
        file_size: file.size,
        md5,
        file_type: stsFileType,
      })
      return {
        accessKeyId: newCred.access_key_id,
        accessKeySecret: newCred.access_key_secret,
        stsToken: newCred.security_token,
      }
    },
    // 提前 10 分钟自动刷新凭证
    refreshSTSTokenInterval: 10 * 60 * 1000,
  })

  // ── 第4步：multipartUpload 分片直传 ──
  try {
    await client.multipartUpload(objectKey, file, {
      partSize,
      parallel,
      // 断点续传：传入上次中断时保存的 checkpoint，跳过已上传分片
      checkpoint,
      /**
       * 进度回调
       * @param p 进度值 0~1
       * @param cp checkpoint 对象，可保存用于断点续传
       */
      progress: (p: number, cp: OSS.Checkpoint) => {
        const percent = Math.round(p * 100)
        onProgress?.(percent, cp)
      },
      // 上传请求头
      headers: {
        // 告诉 OSS 文件原名，便于浏览器下载时保留中文文件名
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      },
    })

    // ── 第5步：调用后端回调，注册文件信息到知识库 ──
    const userStore = useUserStore()
    // super_admin 可能没有 college_id，传 null 让后端处理默认值
    const userCollegeId = userStore.userInfo?.college_id ?? null

    const callbackResult = await uploadCallbackApi({
      object_key: objectKey,
      title,
      description,
      file_name: file.name,
      file_type: file.name.split('.').pop() || '',
      hash: md5, // 传入计算好的 MD5，支持秒传
      size: file.size,
      college_id: userCollegeId,
      scope: scope === 'public' ? 'school' : 'college',
    })

    return callbackResult
  } catch (error: any) {
    // ── 错误分类处理，给出中文友好提示 ──
    const errorCode = error.code || ''
    const errorName = error.name || ''

    if (errorName === 'NetworkError' || errorName === 'ConnectionTimeout') {
      throw new Error('网络中断，请检查网络连接后重试（已上传的分片支持断点续传）')
    }
    if (errorCode === 'InvalidAccessKeyId' || errorCode === 'SecurityTokenExpired' || errorCode === 'ExpiredToken') {
      throw new Error('OSS 凭证已过期，请刷新页面后重新上传')
    }
    if (errorCode === 'CORSForbidden' || errorCode === 'AccessDenied') {
      throw new Error('OSS 跨域配置或权限不足，请联系管理员检查 Bucket CORS 规则')
    }
    if (errorCode === 'NoSuchBucket' || errorCode === 'InvalidBucketName') {
      throw new Error('OSS Bucket 配置错误，请联系管理员检查后端配置')
    }

    // 其他错误：返回 OSS 的错误信息或默认提示
    throw new Error(`OSS 分片上传失败：${error.message || errorCode || '未知错误'}`)
  }
}
