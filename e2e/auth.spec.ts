import { test, expect } from '@playwright/test'
import { ssoLogin, uiLogin, mobileUiLogin, ssoUiLogin, PASSWORD } from './helpers'

test.describe('登录与认证', () => {
  test.describe('桌面端', () => {
    test('首页加载：标题 + 登录卡 + 数据概览', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'NeuHub资源系统' })).toBeVisible()
      await expect(page.locator('text=成都东软学院一站式智能知识库系统')).toBeVisible()
      await expect(page.locator('input[placeholder="请输入工号或学号"]')).toBeVisible()
    })

    test('账号密码登录成功（admin → 跳转知识库管理）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await uiLogin(page, 'admin')
      await expect(page).toHaveURL(/\/knowledge\/list/, { timeout: 15000 })
      await expect(page.locator('h2.page-title', { hasText: '知识库管理' })).toBeVisible({ timeout: 15000 })
    })

    test('错误密码显示错误提示且不跳转', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await uiLogin(page, 'admin', 'wrong-password-123')
      await expect(page.locator('.err-msg')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('.err-msg')).toHaveText(/密码|账号|不正确|失败|找不到|凭据/)
      // 仍在首页
      await expect(page.getByRole('heading', { name: 'NeuHub资源系统' })).toBeVisible()
    })

    test('普通用户登录成功（student → 跳转智能问答）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await uiLogin(page, 'student')
      await expect(page).toHaveURL(/\/chat$/, { timeout: 15000 })
    })

    test('SSO 统一认证弹窗登录（mock_admin）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoUiLogin(page, 'sso_admin')
      await expect(page).toHaveURL(/\/knowledge\/list/, { timeout: 15000 })
    })

    test('未登录访问受保护页 → 重定向首页', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/chat')
      await expect(page).toHaveURL('/')
      await page.goto('/admin/users')
      await expect(page).toHaveURL('/')
    })

    test('登录后刷新页面 token 仍有效', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/knowledge/list')
      await expect(page.locator('h2.page-title', { hasText: '知识库管理' })).toBeVisible({ timeout: 15000 })
      await page.reload()
      await expect(page.locator('h2.page-title', { hasText: '知识库管理' })).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('移动端', () => {
    test('访问首页 → 自动重定向移动端聊天', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/')
      await expect(page).toHaveURL('/mobile/chat', { timeout: 15000 })
    })

    test('移动端登录页加载', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/login')
      await expect(page.locator('text=欢迎回来')).toBeVisible()
      await expect(page.locator('text=登录后使用智能问答服务')).toBeVisible()
    })

    test('移动端账号密码登录（student → 跳转聊天）', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await mobileUiLogin(page, 'student')
      await expect(page).toHaveURL('/mobile/chat', { timeout: 15000 })
    })

    test('移动端错误密码显示错误', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await mobileUiLogin(page, 'student', 'bad-password')
      await expect(page.locator('.m-login-error')).toBeVisible({ timeout: 10000 })
    })

    test('移动端返回首页按钮', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/login')
      await page.locator('button:has-text("返回首页")').click()
      await expect(page).toHaveURL('/mobile/chat')
    })

    test('游客在聊天页提问 → 提示登录', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/chat')
      await page.locator('input[placeholder*="输入你的问题"]').fill('什么是知识库')
      await page.locator('button.m-send-btn').click()
      // 未登录会弹出登录提示并跳转登录页
      await expect(page).toHaveURL('/mobile/login', { timeout: 15000 })
    })
  })
})
