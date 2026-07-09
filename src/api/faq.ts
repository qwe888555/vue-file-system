// ── FAQ 接口 ──
// 后端路径：/api/faq/*
import request from './request'

export interface FaqCategory {
  id: number
  name: string
  icon: string
  sort_order: number
}

export interface FaqItem {
  id: number
  question: string
  answer: string
  category: number
  category_name: string
  college: number | null
  college_name: string | null
  tags: string[]
  frequency: number
  created_at: string
}

/** 获取 FAQ 分类 */
export function getFaqCategoriesApi(): Promise<FaqCategory[]> {
  return request.get('/faq/categories/')
}

/** 获取已发布的 FAQ 列表（支持按分类筛选 + 分页） */
export function getFaqItemsApi(params?: {
  category?: number
  page?: number
  page_size?: number
}): Promise<{ count: number; results: FaqItem[] }> {
  return request.get('/faq/items/', { params })
}

/** 获取 FAQ 详情 */
export function getFaqDetailApi(id: number): Promise<FaqItem> {
  return request.get(`/faq/items/${id}/`)
}

// ══════════════════════════════════════
//  管理端接口 — /api/faq/manage/ & /api/faq/drafts/
// ══════════════════════════════════════

export interface FaqManageItem {
  id: number
  question: string
  answer: string
  category: number
  category_name: string
  college: number | null
  college_name: string | null
  tags: string[]
  frequency: number
  status: 'draft' | 'published' | 'rejected'
  created_at: string
  updated_at: string
}

/** 管理端全部 FAQ 列表 */
export function getFaqManageItemsApi(params?: {
  page?: number
  page_size?: number
  status?: string
  college_id?: number
  search?: string
}): Promise<{ count: number; results: FaqManageItem[] }> {
  return request.get('/faq/manage/items/', { params })
}

/** 删除 FAQ */
export function deleteFaqItemApi(id: number): Promise<void> {
  return request.delete(`/faq/manage/items/${id}/`)
}

/** 草稿列表 */
export function getFaqDraftsApi(params?: {
  page?: number
  page_size?: number
  college_id?: number
}): Promise<{ count: number; results: FaqManageItem[] }> {
  return request.get('/faq/drafts/', { params })
}

/** 草稿详情 */
export function getFaqDraftDetailApi(id: number): Promise<FaqManageItem> {
  return request.get(`/faq/drafts/${id}/`)
}

/** 编辑草稿 */
export function updateFaqDraftApi(
  id: number,
  data: { question?: string; answer?: string; category?: number; college?: number; tags?: string[] },
): Promise<FaqManageItem> {
  return request.patch(`/faq/drafts/${id}/`, data)
}

/** 发布/驳回草稿 */
export function actionFaqDraftApi(
  id: number,
  action: 'publish' | 'reject',
): Promise<{ detail: string; status: string; reviewed_at: string }> {
  return request.post(`/faq/drafts/${id}/action/`, { action })
}

// ══════════════════════════════════════
//  FAQ 自动生成 — /api/faq/generate/ & /api/faq/generation-logs/
// ══════════════════════════════════════

export interface FaqGenerationLog {
  id: number
  status: 'running' | 'success' | 'failed'
  total_questions: number
  clusters_found: number
  drafts_generated: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
}

/** 触发 FAQ 自动生成 */
export function triggerFaqGenerationApi(): Promise<{ detail: string }> {
  return request.post('/faq/generate/')
}

/** 获取生成日志列表 */
export function getFaqGenerationLogsApi(params?: {
  page?: number
  page_size?: number
}): Promise<{ count: number; results: FaqGenerationLog[] }> {
  return request.get('/faq/generation-logs/', { params })
}

/** 获取单条生成日志详情 */
export function getFaqGenerationLogDetailApi(id: number): Promise<FaqGenerationLog> {
  return request.get(`/faq/generation-logs/${id}/`)
}
