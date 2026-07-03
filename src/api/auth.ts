// ── 登录 / SSO / 用户信息接口 ──
// 后端路径：/api/auth/*
import request from './request'
import type { LoginParams, LoginResult, UserInfo, RefreshParams, RefreshResult } from '@/types'

/** JWT 兜底登录 */
export function loginApi(params: LoginParams): Promise<LoginResult> {
  return request.post('/auth/login/', params)
}

/** 刷新 access token */
export function refreshTokenApi(params: RefreshParams): Promise<RefreshResult> {
  return request.post('/auth/refresh/', params)
}

/** 获取当前用户信息 */
export function getUserInfoApi(): Promise<UserInfo> {
  return request.get('/auth/me/')
}

/** 更新个人资料 */
export function updateProfileApi(data: Partial<UserInfo>): Promise<UserInfo> {
  return request.put('/auth/me/', data)
}

/** 修改密码 */
export function changePasswordApi(data: { old_password: string; new_password: string }): Promise<{ detail: string }> {
  return request.post('/auth/change-password/', data)
}

/** SSO 登录接口地址 */
export function ssoLoginUrl(): string {
  const base = import.meta.env.VITE_SSO_BASE_URL || import.meta.env.VITE_API_URL || ''
  // VITE_API_URL 已包含 /api 前缀，无需再拼
  // 开发环境：/api/auth/sso/login/ → Vite 代理 → 后端
  // 生产环境：http://后端/auth/sso/login/ → 直连后端
  return `${base}/auth/sso/login/`
}

/** SSO 回调：用选中的 code 换取 JWT 令牌 */
export function ssoCallbackApi(code: string): Promise<LoginResult> {
  return request.post('/auth/sso/callback/', { code })
}
