// ── 后台账号管理接口 ──
// 人员 D 实现
import request from './request'
import type { Account, College, Discipline, ResourceCategory, PaginatedResult } from '@/types'

/** 用户账号 CRUD */
export function getAccountsApi(params: {
  page: number
  pageSize: number
  role?: string
  collegeId?: number
  keyword?: string
}): Promise<PaginatedResult<Account>> {
  return request.get('/admin/accounts', { params })
}
export function createAccountApi(data: Partial<Account>): Promise<void> {
  return request.post('/admin/accounts', data)
}
export function updateAccountApi(id: number, data: Partial<Account>): Promise<void> {
  return request.put(`/admin/accounts/${id}`, data)
}
export function resetPasswordApi(id: number): Promise<void> {
  return request.put(`/admin/accounts/${id}/reset-password`)
}
export function deleteAccountApi(id: number): Promise<void> {
  return request.delete(`/admin/accounts/${id}`)
}

/** 学院/部门管理 */
export function getCollegesApi(): Promise<College[]> {
  return request.get('/admin/colleges')
}
export function createCollegeApi(data: Partial<College>): Promise<void> {
  return request.post('/admin/colleges', data)
}
export function updateCollegeApi(id: number, data: Partial<College>): Promise<void> {
  return request.put(`/admin/colleges/${id}`, data)
}
export function deleteCollegeApi(id: number): Promise<void> {
  return request.delete(`/admin/colleges/${id}`)
}

/** 学科管理 */
export function getDisciplinesApi(params?: { collegeId?: number }): Promise<Discipline[]> {
  return request.get('/admin/disciplines', { params })
}
export function createDisciplineApi(data: Partial<Discipline>): Promise<void> {
  return request.post('/admin/disciplines', data)
}
export function updateDisciplineApi(id: number, data: Partial<Discipline>): Promise<void> {
  return request.put(`/admin/disciplines/${id}`, data)
}
export function deleteDisciplineApi(id: number): Promise<void> {
  return request.delete(`/admin/disciplines/${id}`)
}

/** 资源类型管理 */
export function getCategoriesApi(): Promise<ResourceCategory[]> {
  return request.get('/admin/categories')
}
export function createCategoryApi(data: Partial<ResourceCategory>): Promise<void> {
  return request.post('/admin/categories', data)
}
export function updateCategoryApi(id: number, data: Partial<ResourceCategory>): Promise<void> {
  return request.put(`/admin/categories/${id}`, data)
}
export function deleteCategoryApi(id: number): Promise<void> {
  return request.delete(`/admin/categories/${id}`)
}

/** 兜底问答（待回答列表） */
export function getPendingFeedbackApi(params: {
  page: number
  pageSize: number
}): Promise<PaginatedResult<any>> {
  return request.get('/admin/feedback/pending', { params })
}
export function submitAnswerApi(id: number, answer: string): Promise<void> {
  return request.put(`/admin/feedback/${id}/answer`, { answer })
}
