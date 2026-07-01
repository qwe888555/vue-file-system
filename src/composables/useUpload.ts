// ── 文件上传 Composable ──
// 人员 C 实现
//
// 功能：封装 OSS 直传 + MD5 秒传 + 进度监听
//
// 使用示例：
//   const { uploading, progress, upload, calcFileHash } = useUpload()
//   const file = event.target.files[0]
//   const result = await upload(file, { title: 'xx', category: 'teaching' })
import { ref } from 'vue'
import { checkFileHashApi, getUploadCredentialApi, uploadDocApi } from '@/api/knowledge'
import { ElMessage } from 'element-plus'

export function useUpload() {
  const uploading = ref(false)
  const progress = ref(0)

  /** 计算文件 MD5（使用浏览器 Web Crypto） */
  async function calcFileHash(file: File): Promise<string> {
    // TODO: 使用 spark-md5 或 crypto.subtle 计算文件 hash
    // 示例返回，需替换为真实实现
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        // 实际项目中引入 spark-md5 计算完整文件 hash
        resolve(`hash_${file.name}_${file.size}_${Date.now()}`)
      }
      reader.readAsArrayBuffer(file.slice(0, 1024 * 1024)) // 读前 1MB 示例
    })
  }

  /** 执行上传流程：秒传校验 → OSS 直传 → 提交元数据 */
  async function upload(file: File, metadata: Record<string, any>): Promise<boolean> {
    uploading.value = true
    progress.value = 0
    try {
      // 1. MD5 秒传校验
      const hash = await calcFileHash(file)
      const hashCheck = await checkFileHashApi(hash)
      if (hashCheck.exists) {
        ElMessage.success('文件已存在，秒传成功')
        return true
      }

      // 2. 获取 OSS 凭证
      await getUploadCredentialApi()
      // TODO: 使用 OSS SDK 直传文件到阿里云 OSS，监听进度
      // const ossClient = new OSS(credential)
      // await ossClient.put(file.name, file, { progress: (p) => { progress.value = p * 90 } })

      // 3. 提交文件元数据到后端
      const formData = new FormData()
      formData.append('file', file)
      formData.append('hash', hash)
      Object.entries(metadata).forEach(([key, val]) => {
        formData.append(key, String(val))
      })
      await uploadDocApi(formData)

      progress.value = 100
      ElMessage.success('上传成功')
      return true
    } catch (e: any) {
      ElMessage.error(e?.message || '上传失败')
      return false
    } finally {
      uploading.value = false
    }
  }

  return { uploading, progress, upload, calcFileHash }
}
