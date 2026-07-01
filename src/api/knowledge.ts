// ── 知识库文件管理接口 ──
// 人员 C 实现
import request from './request'
import type { KnowledgeFile, PaginatedResult } from '@/types'

/** 文档列表（分页 + 筛选） */
export function getDocListApi(params: {
  page: number
  pageSize: number
  keyword?: string
  category?: string
  collegeId?: number
  startDate?: string
  endDate?: string
}): Promise<PaginatedResult<KnowledgeFile>> {
  return request.get('/knowledge/files', { params })
}

/** 文档详情 */
export function getDocDetailApi(id: number): Promise<KnowledgeFile> {
  return request.get(`/knowledge/files/${id}`)
}

/** 上传文档（含元数据） */
export function uploadDocApi(data: FormData): Promise<KnowledgeFile> {
  return request.post('/knowledge/files', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 获取 OSS 上传凭证 */
export function getUploadCredentialApi(): Promise<{
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint: string
  expiration: string
}> {
  return request.get('/knowledge/upload/credential')
}

/** MD5 秒传校验 */
export function checkFileHashApi(hash: string): Promise<{ exists: boolean; fileId?: number; url?: string }> {
  return request.post('/knowledge/files/check-hash', { hash })
}

/** 编辑文档 */
export function updateDocApi(id: number, data: Partial<KnowledgeFile>): Promise<void> {
  return request.put(`/knowledge/files/${id}`, data)
}

/** 删除文档 */
export function deleteDocApi(id: number): Promise<void> {
  return request.delete(`/knowledge/files/${id}`)
}

/** 文档关键词 CRUD */
export function getKeywordsApi(fileId: number): Promise<string[]> {
  return request.get(`/knowledge/files/${fileId}/keywords`)
}
export function addKeywordApi(fileId: number, keyword: string): Promise<void> {
  return request.post(`/knowledge/files/${fileId}/keywords`, { keyword })
}
export function deleteKeywordApi(fileId: number, keyword: string): Promise<void> {
  return request.delete(`/knowledge/files/${fileId}/keywords`, { data: { keyword } })
}

/** 三级分类树形数据 */
export function getCategoryTreeApi(): Promise<any[]> {
  return request.get('/knowledge/categories/tree')
}
