/**
 * 阿里云 OSS 大文件分片直传工具
 *
 * 解决大文件（如 10GB 视频）经过后端中转导致 nginx 60s 超时的问题。
 *
 * 完整流程：
 *   1. 计算文件 MD5（用于后端秒传校验和 STS 凭证申请）
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
import CryptoJS from 'crypto-js'
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
function parseRegionFromEndpoint(endpoint: string): string {
  const match = endpoint.match(/oss-[a-z0-9-]+/)
  if (!match) {
    throw new Error(`无法从 endpoint 解析 region: ${endpoint}`)
  }
  return match[0]
}

/**
 * 从 endpoint URL 解析 bucket（后端未单独返回时的兜底方案）
 * 例：https://my-bucket.oss-cn-beijing.aliyuncs.com → my-bucket
 */
function parseBucketFromEndpoint(endpoint: string): string | null {
  const match = endpoint.match(/\/\/([^.]+)\./)
  return match ? match[1] : null
}

/**
 * 计算文件 MD5（分片读取，支持大文件，不会内存溢出）
 *
 * 使用 crypto-js 的增量 MD5 计算，每块 2MB，通过 FileReader 异步读取。
 *
 * @param file 要计算哈希的文件
 * @param onProgress 可选的进度回调（0~100）
 * @returns 文件的 MD5 十六进制字符串
 */
export function calculateFileMd5(file: File, onProgress?: Md5ProgressCallback): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 2 * 1024 * 1024 // 每块 2MB
    const chunks = Math.ceil(file.size / chunkSize)
    // 创建增量 MD5 哈希器
    const hasher = CryptoJS.algo.MD5.create()
    const fileReader = new FileReader()
    let currentChunk = 0

    fileReader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('文件读取失败'))
        return
      }
      // 将 ArrayBuffer 转换为 CryptoJS WordArray 并增量更新
      const wordArray = CryptoJS.lib.WordArray.create(e.target.result as ArrayBuffer)
      hasher.update(wordArray)
      currentChunk++

      // 报告 MD5 计算进度
      if (onProgress) {
        const percent = Math.round((currentChunk / chunks) * 100)
        onProgress(percent)
      }

      if (currentChunk < chunks) {
        loadNextChunk()
      } else {
        // 计算完成，返回十六进制 MD5 字符串
        resolve(hasher.finalize().toString(CryptoJS.enc.Hex))
      }
    }

    fileReader.onerror = () => {
      reject(new Error('文件读取失败，无法计算 MD5'))
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

  // ── 第1步：计算文件 MD5（后端 STS 接口必填参数） ──
  const md5 = await calculateFileMd5(file, onMd5Progress)

  // ── 第2步：获取 STS 临时凭证 ──
  const credential = await getUploadCredentialApi({
    file_name: file.name,
    file_size: file.size,
    md5,
  })

  // 字段读取（后端返回 snake_case）
  const accessKeyId = credential.access_key_id
  const accessKeySecret = credential.access_key_secret
  const stsToken = credential.security_token
  const region = credential.region || parseRegionFromEndpoint(credential.endpoint)
  const bucket = credential.bucket || parseBucketFromEndpoint(credential.endpoint)
  const objectKey = credential.object_key

  // 凭证完整性校验
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
