// ── 登录 / SSO / 用户信息接口 ──
// 人员 A 实现
import request from './request'
import type { LoginParams, LoginResult, UserInfo } from '@/types'

/** 账号密码登录 */
export function loginApi(params: LoginParams): Promise<LoginResult> {
  return request.post('/auth/login', params)
}

/** SSO 登录（接收授权码换 Token） */
export function ssoLoginApi(code: string): Promise<LoginResult> {
  return request.post('/auth/sso', { code })
}

/** 获取当前用户信息 */
export function getUserInfoApi(): Promise<UserInfo> {
  return request.get('/auth/userinfo')
}

/** 登出 */
export function logoutApi(): Promise<void> {
  return request.post('/auth/logout')
}

/** 修改密码 */
export function changePasswordApi(data: { oldPassword: string; newPassword: string }): Promise<void> {
  return request.put('/auth/password', data)
}

/** 修改个人资料 */
export function updateProfileApi(data: Partial<UserInfo>): Promise<void> {
  return request.put('/auth/profile', data)
}
