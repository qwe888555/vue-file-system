// ── 后台账号管理接口 ──
// 对接后端路径：/api/admin/*
import request from './request'
import type { Account, College } from '@/types'

// ══════════════════════════════════════
//  用户管理 — /api/admin/users/
// ══════════════════════════════════════

/** 获取用户列表（后端 DRF 分页格式） */
export function getAccountsApi(params: {
  page?: number
  pageSize?: number
  role?: string | string[]
  college?: number
  department_id?: number
  search?: string
}): Promise<{ count: number; results: Account[] }> {
  return request.get('/admin/users/', {
    params: {
      page: params.page,
      page_size: params.pageSize,
      role: params.role || undefined,
      college_id: params.college || undefined,
      department_id: params.department_id || undefined,
      search: params.search || undefined,
    },
  })
}

/** 新建用户 */
export function createAccountApi(data: {
  username: string
  email: string
  password: string
  password_confirm: string
  first_name?: string
  last_name?: string
  role?: string
  college?: number
  department?: number
  phone?: string
}): Promise<Account> {
  return request.post('/admin/users/', data)
}

/** 编辑用户 */
export function updateAccountApi(
  id: number,
  data: {
    email?: string
    first_name?: string
    last_name?: string
    role?: string
    college?: number
    department?: number
    phone?: string
    is_active?: boolean
  },
): Promise<Account> {
  return request.put(`/admin/users/${id}/`, data)
}

/** 删除用户 */
export function deleteAccountApi(id: number): Promise<{ detail: string }> {
  return request.delete(`/admin/users/${id}/`)
}

/** 重置单个密码 */
export function resetPasswordApi(
  id: number,
  data: { new_password: string; password_confirm: string },
): Promise<{ detail: string }> {
  return request.post(`/admin/users/${id}/reset_password/`, data)
}

/** 批量重置密码 */
export function batchResetPasswordApi(data: {
  user_ids: number[]
  new_password: string
}): Promise<{
  detail: string
  success_count: number
  fail_count: number
  fail_reasons: Array<{ id: number; username?: string; reason: string }> | null
}> {
  return request.post('/admin/users/batch_reset_password/', data)
}

/** 批量删除用户 */
export function batchDeleteAccountsApi(data: {
  user_ids: number[]
}): Promise<{
  detail: string
  success_count: number
  fail_count: number
  fail_reasons: Array<{ id: number; username?: string; reason: string }> | null
}> {
  return request.post('/admin/users/batch_delete/', data)
}

// ══════════════════════════════════════
//  学院管理 — /api/admin/colleges/
// ══════════════════════════════════════

/** 获取学院列表 */
export function getCollegesApi(): Promise<{ count: number; results: College[] }> {
  return request.get('/admin/colleges/')
}

/** 新建学院 */
export function createCollegeApi(data: {
  name: string
  code?: string
  sort_order?: number
}): Promise<College> {
  return request.post('/admin/colleges/', data)
}

/** 编辑学院 */
export function updateCollegeApi(
  id: number,
  data: { name?: string; code?: string; sort_order?: number },
): Promise<College> {
  return request.put(`/admin/colleges/${id}/`, data)
}

/** 删除学院 */
export function deleteCollegeApi(id: number): Promise<{ detail: string }> {
  return request.delete(`/admin/colleges/${id}/`)
}

// ══════════════════════════════════════
//  部门管理 — /api/admin/departments/
// ══════════════════════════════════════

export interface Department {
  id: number
  name: string
  parent: number | null
  children: Department[]
}

/**
 * 获取部门列表（树形）
 * 后端返回扁平数组且二级部门既嵌在父级 children 中又平铺在数组里，
 * 此处归一化为「仅一级部门 + children」的干净树，避免前端重复渲染二级部门。
 */
export async function getDepartmentsApi(params?: {
  college_id?: number
}): Promise<Department[]> {
  const res: any = await request.get('/admin/departments/', { params })
  // 兼容三种返回：扁平数组（文档 v1.0）/ { results } 分页 / { data } 包装
  const flat: Department[] = Array.isArray(res)
    ? res
    : (res?.results || res?.data || [])
  const byId = new Map<number, Department>()
  for (const d of flat) {
    byId.set(d.id, { ...d, children: [] })
  }
  const roots: Department[] = []
  for (const d of byId.values()) {
    if (d.parent != null && byId.has(d.parent)) {
      byId.get(d.parent)!.children.push(d)
    } else {
      roots.push(d)
    }
  }
  // 后端已按 sort_order ASC, id ASC 返回；归一化不改变同级顺序
  return roots
}

/** 新建部门 */
export function createDepartmentApi(data: {
  name: string
  parent?: number | null
}): Promise<Department> {
  return request.post('/admin/departments/', data)
}

/** 编辑部门 */
export function updateDepartmentApi(
  id: number,
  data: { name?: string; parent?: number | null },
): Promise<Department> {
  return request.put(`/admin/departments/${id}/`, data)
}

/** 删除部门 */
export function deleteDepartmentApi(id: number): Promise<{ detail: string }> {
  return request.delete(`/admin/departments/${id}/`)
}

// ══════════════════════════════════════
//  统计累计接口 — /api/admin/logs/*/stats/
// ══════════════════════════════════════

/** 全平台历史累计上传总条数 */
export function getUploadStatsApi(): Promise<{ total: number }> {
  return request.get('/admin/logs/upload/stats/')
}

/** 全平台历史累计查询总条数 */
export function getQueryStatsApi(): Promise<{ total: number }> {
  return request.get('/admin/logs/query/stats/')
}
