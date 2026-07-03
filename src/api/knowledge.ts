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
  return request.get(`/knowledge/docs/${id}/`)
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

/** 文件上传 */
export function uploadFileApi(data: FormData): Promise<KnowledgeFile> {
  return request.post('/knowledge/upload/file/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 编辑文档 */
export function updateDocApi(id: number, data: Partial<KnowledgeFile>): Promise<void> {
  return request.put(`/api/knowledge/docs/${id}/`, data)
}

/** 删除文档 */
export function deleteDocApi(id: number): Promise<void> {
  return request.delete(`/knowledge/docs/${id}/delete`)
}

/** 下载文档 */
export function downloadDocApi(id: number): Promise<Blob> {
  return request.get(`/knowledge/docs/${id}/download/`, {
    responseType: 'blob',
  })
}

/** 文件预览 */
export function previewDocApi(id: number): Promise<{ content: string; content_type: string }> {
  return request.get(`/knowledge/docs/${id}/preview/`)
}

/** 录入文本 */
export function uploadTextApi(data: {
  title: string
  content: string
  description?: string
  college_id?: number
  discipline_id?: number
  keywords?: string[]
  visibility?: string
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
export function addKeywordApi(docId: number, keywords: string[]): Promise<void> {
  return request.post(`/knowledge/docs/${docId}/keywords/create/`, {
    keywords,
    match_type: 'exact',
    weight: 1,
  })
}
export function updateKeywordApi(id: number, data: { phrase: string; match_type: string; weight: number }): Promise<void> {
  return request.put(`/knowledge/keywords/${id}/`, data)
}
export function deleteKeywordApi(id: number): Promise<void> {
  return request.delete(`/knowledge/keywords/${id}/delete/`)
}

/** 三级分类树形数据 */
export function getCategoryTreeApi(): Promise<any[]> {
  return request.get('/knowledge/categories/tree')
}
