// ── 知识库文件管理接口 ──
// 人员 C 实现
import request from './request'
import type { KnowledgeFile, PaginatedResult } from '@/types'

/** 文档列表（分页 + 筛选） */
export function getDocListApi(params: {
  page: number
  page_size: number
  keyword?: string
  category?: string
  collegeId?: number
  startDate?: string
  endDate?: string
}): Promise<PaginatedResult<KnowledgeFile>> {
  return request.get('/knowledge/docs/', { 
    params: {
      page: params.page,
      page_size: params.page_size,
      keyword: params.keyword,
      category: params.category,
      college_id: params.collegeId,
      start_date: params.startDate,
      end_date: params.endDate,
    }
  })
}

/** 文档详情（JSON 元数据，非 Blob） */
export function getDocDetailApi(id: number): Promise<KnowledgeFile> {
  return request.get(`/knowledge/docs/${id}/`)
}

/** 上传文档（含元数据） */
export function uploadDocApi(data: FormData): Promise<KnowledgeFile> {
  return request.post('/knowledge/files/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 获取 OSS 上传凭证（STS 临时凭证，用于前端直传） */
export function getUploadCredentialApi(data: {
  file_name: string
  file_size: number
  md5: string
}): Promise<{
  // PostObject 凭证（兼容旧接口）
  file_name: string
  file_type: string
  file_size: number
  policy: string
  signature: string
  // STS 临时凭证（multipartUpload 必需）
  access_key_id: string
  access_key_secret: string
  security_token: string
  expire: string
  endpoint: string
  region: string
  bucket: string
  object_key: string
}> {
  // 使用 FormData 发送，Django/DRF 兼容性最好
  const formData = new FormData()
  formData.append('file_name', data.file_name)
  formData.append('file_size', String(data.file_size))
  formData.append('md5', data.md5)
  return request.post('/knowledge/upload/sts/', formData)
}

/** MD5 秒传校验 */
export function checkFileHashApi(hash: string): Promise<{ exists: boolean; fileId?: number; url?: string }> {
  return request.post('/knowledge/files/check-hash/', { hash })
}

/** 文件上传 */
export function uploadFileApi(data: FormData): Promise<KnowledgeFile> {
  return request.post('/knowledge/upload/file/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data, headers) => {
      delete headers['Content-Type']
      return data
    },
    // 大文件上传不限制超时（0 = 无超时），避免音视频等大文件上传被中断
    timeout: 0,
  })
}

/** 上传完成回调 */
export function uploadCallbackApi(data: {
  object_key: string
  title: string
  description?: string
  file_name: string
  file_type: string
  hash: string
  size: number
  college_id?: number | null
  department_id?: number | null
  category_id?: number
  scope?: string
}): Promise<KnowledgeFile> {
  return request.post('/knowledge/upload/callback/', data)
}

/** 编辑文档 */
export function updateDocApi(id: number, data: {
  title?: string
  description?: string
  discipline_id?: number
  college_id?: number
  category_id?: number
  content?: string
}): Promise<void> {
  return request.put(`/knowledge/docs/${id}/`, data)
}

/** 删除文档 */
export function deleteDocApi(id: number): Promise<void> {
  return request.delete(`/knowledge/docs/${id}/delete/`)
}

/** 批量删除文档 */
export function batchDeleteDocsApi(ids: number[]): Promise<void> {
  return request.delete('/knowledge/docs/batch/', { data: { ids } })
}

/** AI提取发布日期 */
export function extractFreshnessApi(id: number): Promise<{ freshness: string }> {
  return request.post(`/knowledge/docs/${id}/extract-freshness/`)
}

/** 下载文档 */
export function downloadDocApi(id: number): Promise<Blob> {
  return request.get(`/knowledge/docs/${id}/download/`, {
    responseType: 'blob',
  })
}

/**
 * 修复后端双重编码导致的乱码（UTF-8 字节被错误当作 Latin-1 解码后又重新编码为 UTF-8）
 * 典型场景：通过"创建文件"录入的中文文本，后端存储时编码出错，预览时返回乱码
 * 修复原理：将乱码字符串按 Latin-1 编码还原为原始字节，再用 UTF-8 正确解码
 */
export function fixMojibake(str: string): string {
  if (!str) return str

  // 第一步：检测是否疑似乱码。乱码字符串的所有字符码点都在 0x00-0xFF 范围内
  // （因为它们是 UTF-8 字节被当作 Latin-1 解读的结果）
  let latin1Count = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    // 如果已经存在 > 0xFF 的字符（如正常中文），说明不是这种类型的乱码
    if (code > 0xFF) return str
    if (code >= 0x80) latin1Count++
  }

  // Latin-1 补充区字符比例太低，不认为是乱码（避免误伤如 "Café" 这类正常文本）
  if (latin1Count < 2 || latin1Count / str.length < 0.05) return str

  // 第二步：按 Latin-1 编码还原为原始字节
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i)
  }

  // 第三步：用 UTF-8 解码原始字节
  const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  // 如果解码结果包含替换字符 U+FFFD，说明不是有效的 UTF-8，放弃修复
  if (fixed.includes('\uFFFD')) return str

  // 如果修复后没有产生任何非 ASCII 字符，放弃修复
  let hasHighChar = false
  for (let i = 0; i < fixed.length; i++) {
    if (fixed.charCodeAt(i) > 0x7F) {
      hasHighChar = true
      break
    }
  }
  if (!hasHighChar) return str

  return fixed
}

/** 文件预览 */
export function previewDocApi(id: number): Promise<{
  preview_type: string
  content: string
  file_type: string
  file_name: string
}> {
  return request.get(`/knowledge/docs/${id}/preview/`).then((result) => {
    if (result && result.content) {
      result.content = fixMojibake(result.content)
    }
    return result
  })
}

/** 获取一级分类列表 */
export function getFirstLevelCategoriesApi(): Promise<{ id: number; name: string }[]> {
  return request.get('/categories/first-level/')
}

/** 获取二级分类列表 */
export function getSecondLevelCategoriesApi(parentId?: number): Promise<{ id: number; name: string; parent_id: number }[]> {
  const params = parentId ? { parent_id: parentId } : {}
  return request.get('/categories/second-level/', { params })
}

/** 录入文本（AI降级模式） */
export function uploadTextApi(data: {
  title?: string
  content: string
  description?: string
  college_id?: number
  category_id?: number
  keywords?: string[]
  visibility?: string
  scope?: 'school' | 'college' | 'department'
}): Promise<KnowledgeFile> {
  return request.post('/knowledge/upload/text/', data)
}

export interface Keyword {
  id: number
  phrase: string
  match_type: string
  weight: number
}

/** 文档关键词 CRUD */
export function getKeywordsApi(docId: number): Promise<Keyword[]> {
  return request.get(`/knowledge/docs/${docId}/keywords/`)
}
export function addKeywordApi(docId: number, phrase: string, match_type: string = 'exact', weight: number = 1): Promise<void> {
  return request.post(`/knowledge/docs/${docId}/keywords/create/`, {
    phrase,
    match_type,
    weight,
  })
}

export async function addKeywordsApi(docId: number, keywords: string[]): Promise<void> {
  for (const phrase of keywords) {
    await addKeywordApi(docId, phrase.trim())
  }
}
export function updateKeywordApi(id: number, data: { phrase: string; match_type: string; weight: number }): Promise<void> {
  return request.put(`/knowledge/keywords/${id}/`, data)
}
export function deleteKeywordApi(id: number): Promise<void> {
  return request.delete(`/knowledge/keywords/${id}/delete/`)
}

/** 三级分类树形数据 */
export function getCategoryTreeApi(): Promise<any[]> {
  return request.get('/knowledge/categories/tree/')
}

/** AI智能分类 */
export function aiClassifyApi(data: FormData | { content: string }): Promise<{
  title: string
  keywords: string[]
  description: string
  scope: string
}> {
  if (data instanceof FormData) {
    return request.post('/knowledge/upload/ai-classify/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data, headers) => {
        delete headers['Content-Type']
        return data
      },
      // AI 分类可能耗时较长（文档提取+AI推理），给 2 分钟超时
      timeout: 120000,
    })
  } else {
    return request.post('/knowledge/upload/ai-classify/', data, {
      // JSON 分类只发文本，但 AI 推理仍可能耗时，给 2 分钟超时
      timeout: 120000,
    })
  }
}
