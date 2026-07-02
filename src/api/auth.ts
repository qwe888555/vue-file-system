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
export function changePasswordApi(data: { oldPassword: string; newPassword: string }): Promise<void> {
  return request.post('/auth/change-password/', data)
}

/** SSO 登录接口地址 */
export function ssoLoginUrl(): string {
  const base = import.meta.env.VITE_SSO_BASE_URL || import.meta.env.VITE_API_URL || ''
  // fetch GET 到该地址后：
  //   Mock 模式 → 返回 JSON（含 mock_codes 数组），前端弹窗选账号
  //   正式模式 → 302 重定向到学校真实认证页
  return `${base}/api/auth/sso/login/`
}

/** SSO 回调：用选中的 code 换取 JWT 令牌 */
export function ssoCallbackApi(code: string): Promise<LoginResult> {
  return request.post('/auth/sso/callback/', { code })
}
