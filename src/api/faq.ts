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

/** 获取已发布的 FAQ 列表（支持按分类筛选） */
export function getFaqItemsApi(params?: {
  category?: number
}): Promise<FaqItem[]> {
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
  category?: number
  keyword?: string
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
  category?: number
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
  data: { question?: string; answer?: string; category?: number; tags?: string[] },
): Promise<FaqManageItem> {
  return request.patch(`/faq/drafts/${id}/`, data)
}

/** 发布/驳回草稿 */
export function actionFaqDraftApi(
  id: number,
  action: 'publish' | 'reject',
): Promise<{ status: string; faq_id: number; new_status: string }> {
  return request.post(`/faq/drafts/${id}/action/`, { action })
}
