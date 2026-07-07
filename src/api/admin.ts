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
  role?: string
  college?: number
  keyword?: string
}): Promise<{ count: number; results: Account[] }> {
  return request.get('/admin/users/', {
    params: {
      page: params.page,
      page_size: params.pageSize,
      role: params.role || undefined,
      college_id: params.college || undefined,
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

// ══════════════════════════════════════
//  部门管理 — /api/admin/departments/
// ══════════════════════════════════════

export interface Department {
  id: number
  name: string
  parent: number | null
  sort_order: number
  children: Department[]
}

export function getDepartmentsApi(params?: {
  college_id?: number
}): Promise<{ count: number; results: Department[] }> {
  return request.get('/admin/departments/', { params })
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
