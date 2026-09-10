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
  category: number | null
  category_name: string | null
  college: number | null
  college_name: string | null
  tags: string[]
  frequency: number
  status: 'draft' | 'published' | 'rejected'
  created_at: string
  updated_at?: string
}

/** 获取 FAQ 分类 */
export function getFaqCategoriesApi(): Promise<FaqCategory[]> {
  return request.get('/faq/categories/')
}

/**
 * 获取 FAQ 列表 —— 文档 3.2：无分页，返回纯数组，故无 page / page_size 参数。
 * status 仅对 FAQ 管理员生效；普通用户与游客固定只见已发布。
 */
export function getFaqItemsApi(params?: {
  category?: number
  status?: string
  q?: string
  college_id?: number
}): Promise<FaqItem[]> {
  return request.get('/faq/items/', { params })
}

// ══════════════════════════════════════
//  管理端接口 — /api/faq/manage/ & /api/faq/drafts/
// ══════════════════════════════════════

/**
 * 管理端 FAQ 条目
 * 字段对齐文档 3.2（4.1 / 4.4 的响应结构均声明「与 3.2 相同」）：
 * - category / category_name：文档标注 int / null、string / null，
 *   草稿中 AI 无法判定分类的条目（如寒暄类「你好」）确为 null，实测数据印证。
 * - updated_at：3.2 结构不含该字段（仅 3.3 详情、4.2 草稿详情返回），故声明为可选。
 */
export interface FaqManageItem {
  id: number
  question: string
  answer: string
  category: number | null
  category_name: string | null
  college: number | null
  college_name: string | null
  tags: string[]
  frequency: number
  status: 'draft' | 'published' | 'rejected'
  created_at: string
  updated_at?: string
}

/**
 * 管理端全部 FAQ 列表 —— 文档 4.4：标准分页，每页 20 条
 */
export function getFaqManageItemsApi(params?: {
  page?: number
  page_size?: number
  status?: string
  college_id?: number
  search?: string
  category?: number
}): Promise<{ count: number; results: FaqManageItem[] }> {
  return request.get('/faq/manage/items/', { params })
}

/** 删除 FAQ */
export function deleteFaqItemApi(id: number): Promise<void> {
  return request.delete(`/faq/manage/items/${id}/`)
}

/** 编辑草稿 */
export function updateFaqDraftApi(
  id: number,
  // 文档 4.2：category 与 college 的表格类型均为 int / null，传 null 表示清除
  data: { question?: string; answer?: string; category?: number | null; college?: number | null; tags?: string[] },
): Promise<FaqManageItem> {
  return request.patch(`/faq/drafts/${id}/`, data)
}

/** 发布/驳回草稿 —— 文档 4.3 响应：{ status: "ok", faq_id, new_status } */
export function actionFaqDraftApi(
  id: number,
  action: 'publish' | 'reject',
): Promise<{ status: string; faq_id: number; new_status: string }> {
  return request.post(`/faq/drafts/${id}/action/`, { action })
}


// ══════════════════════════════════════
//  FAQ 自动生成 — /api/faq/generate/ & /api/faq/generation-logs/
// ══════════════════════════════════════

export interface FaqGenerationLog {
  id: number
  status: 'running' | 'completed' | 'failed'
  total_questions: number
  clusters_found: number
  drafts_generated: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
}

/**
 * 触发 FAQ 自动生成（聊天记录管线）
 * 文档 5.1：{ log_id, status, task_id, message }；Celery 不可用时降级同步执行，task_id 为 null。
 * 已有任务在跑时后端返回 409 FAQ_GENERATION_RUNNING，由响应拦截器统一提示错误。
 */
export function triggerFaqGenerationApi(): Promise<{
  log_id: number
  status: string
  task_id: string | null
  message: string
}> {
  return request.post('/faq/generate/')
}

/**
 * 获取生成日志列表 —— 文档 5.3：标准分页；status 可选筛选，取值同日志状态枚举
 */
export function getFaqGenerationLogsApi(params?: {
  page?: number
  page_size?: number
  status?: FaqGenerationLog['status']
}): Promise<{ count: number; results: FaqGenerationLog[] }> {
  return request.get('/faq/generation-logs/', { params })
}

/** 获取单条生成日志详情 */
export function getFaqGenerationLogDetailApi(id: number): Promise<FaqGenerationLog> {
  return request.get(`/faq/generation-logs/${id}/`)
}
