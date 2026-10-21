// ── E2E 测试辅助：真实登录 + 状态注入 ──
// 路由守卫会调用 getUserInfo() 校验 token，mock token 一律失效，
// 因此所有"已登录"测试都走真实后端登录（SSO Mock 回调 或 账号密码 JWT）。
import { expect, request as pwRequest, type Page } from '@playwright/test'

export const API_BASE = 'http://localhost:3000'
export const FRONT_BASE = 'http://localhost:5173'
export const PASSWORD = 'Admin@123456'

/** SSO Mock 码 → 后端用户映射（与 MOCK_SSO_USERS 一致） */
export const SSO_CODES: Record<string, string> = {
  super_admin: 'mock_super_admin',
  admin: 'mock_admin',
  college_admin: 'mock_college_admin',
  dept_admin: 'mock_dept_admin',
  teacher: 'mock_teacher',
  student: 'mock_student',
}

/** 后端默认 SSO_MOCK_ALLOW_PRIVILEGED=False，高权限 mock code 会被 401 拒绝；
 *  E2E 改用 seed_e2e.py 已设置密码的种子账号登录，不依赖被隐藏的 code。 */
const PRIVILEGED_USERS: Record<string, string> = {
  super_admin: 'sso_super_admin',
  admin: 'sso_admin',
}

/** 通过后端 SSO Mock 回调换取真实 token（node 侧直连，无 CORS） */
export async function fetchSsoToken(code: string) {
  const ctx = await pwRequest.newContext({ baseURL: API_BASE })
  const res = await ctx.post('/api/auth/sso/callback/', { data: { code } })
  const body = await res.json()
  await ctx.dispose()
  if (!body.access) throw new Error(`SSO 登录失败 (${code}): ${JSON.stringify(body).slice(0, 200)}`)
  return body as { access: string; refresh: string; user: Record<string, unknown> }
}

/** 用种子账号密码换取真实 token（高权限角色使用） */
export async function fetchPasswordToken(username: string, password: string = PASSWORD) {
  const ctx = await pwRequest.newContext({ baseURL: API_BASE })
  const res = await ctx.post('/api/auth/login/', { data: { username, password } })
  const body = await res.json()
  if (!body.access) {
    await ctx.dispose()
    throw new Error(`密码登录失败 (${username}): ${JSON.stringify(body).slice(0, 200)}`)
  }
  // 登录接口只返回 access/refresh，user 需另取，保持与 SSO 回调返回结构一致
  const me = await ctx.get('/api/auth/me/', {
    headers: { Authorization: `Bearer ${body.access}` },
  })
  const user = me.ok() ? await me.json() : null
  await ctx.dispose()
  return { access: body.access, refresh: body.refresh, user } as {
    access: string
    refresh: string
    user: Record<string, unknown> | null
  }
}

/** 用真实 token 预注入 localStorage，再让路由守卫用真实 token 拉取用户信息 */
export async function ssoLogin(page: Page, role: keyof typeof SSO_CODES) {
  const t = PRIVILEGED_USERS[role]
    ? await fetchPasswordToken(PRIVILEGED_USERS[role])
    : await fetchSsoToken(SSO_CODES[role])
  await page.addInitScript(({ access, refresh, user }) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    localStorage.setItem('user', JSON.stringify(user))
  }, t)
  return t
}

/** 桌面端 UI 真实登录（首页嵌入式登录卡） */
export async function uiLogin(page: Page, username: string, password: string = PASSWORD) {
  await page.goto('/')
  await expect(page.locator('input[placeholder="请输入工号或学号"]')).toBeVisible({ timeout: 15000 })
  await page.locator('input[placeholder="请输入工号或学号"]').fill(username)
  await page.locator('input[placeholder="请输入密码"]').fill(password)
  await page.locator('button.login-btn').click()
}

/** 移动端 UI 真实登录 */
export async function mobileUiLogin(page: Page, username: string, password: string = PASSWORD) {
  await page.goto('/mobile/login')
  await expect(page.locator('input[placeholder="账号"]')).toBeVisible()
  await page.locator('input[placeholder="账号"]').fill(username)
  await page.locator('input[placeholder="密码"]').fill(password)
  await page.locator('button:has-text("登 录")').click()
}

/** 桌面端 SSO 弹窗登录（点击统一认证 → 弹窗选账号） */
export async function ssoUiLogin(page: Page, username: string) {
  await page.goto('/')
  await expect(page.locator('button.sso-btn')).toBeVisible({ timeout: 15000 })
  await page.locator('button.sso-btn').click()
  const account = page.locator('.sso-acct', { hasText: username })
  await expect(account).toBeVisible({ timeout: 10000 })
  await account.click()
}

/** 退出登录（通过侧边栏用户区） */
export async function logoutFromSidebar(page: Page) {
  await page.locator('.sidebar-user').click().catch(async () => {
    await page.locator('.topbar-btn[title]').first().click().catch(() => {})
  })
}
