import { test, expect } from '@playwright/test'
import { ssoLogin } from './helpers'

test.describe('智能问答', () => {
  test.describe('桌面端', () => {
    test('已登录用户进入问答页：侧边栏 + 欢迎语', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/chat')
      await expect(page.locator('.chat-app')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.sidebar-new-chat')).toBeVisible()
      await expect(page.locator('.welcome-title')).toContainText('你好')
      // 管理员看到"教研问答"入口标题
      await expect(page.locator('.topbar-title')).toHaveText('教研问答')
    })

    test('热点问题加载并展示', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/chat')
      const qq = page.locator('.qq-btn')
      await expect(qq.first()).toBeVisible({ timeout: 20000 })
      expect(await qq.count()).toBeGreaterThan(0)
    })

    test('提问 → SSE 流式回复', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/chat')
      await expect(page.locator('.input-field')).toBeVisible({ timeout: 15000 })
      await page.locator('.input-field').fill('什么是知识库')
      await page.locator('.send-fab').click()
      // 助手消息出现，内容为 Mock LLM 回复
      const aiBubble = page.locator('.msg-row-ai .msg-bubble')
      await expect(aiBubble.first()).toContainText(/Mock LLM Response|知识库|回答|抱歉/, { timeout: 30000 })
    })

    test('提问后侧边栏出现新会话', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/chat')
      await page.locator('.input-field').fill('测试会话创建')
      await page.locator('.send-fab').click()
      await expect(page.locator('.conv-item').first()).toBeVisible({ timeout: 20000 })
    })

    test('新建对话按钮可用', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/chat')
      await page.locator('.sidebar-new-chat').click()
      await expect(page.locator('.welcome-title')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('移动端', () => {
    test('欢迎页显示', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/chat')
      await expect(page.locator('.m-welcome-title')).toHaveText('有什么可以帮助你的？')
    })

    test('输入框可用 + 发送按钮状态切换', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/chat')
      const input = page.locator('.m-input')
      await expect(input).toBeVisible()
      await expect(page.locator('.m-send-btn')).toBeDisabled()
      await input.fill('测试问题')
      await expect(page.locator('.m-send-btn')).toBeEnabled()
      await input.clear()
      await expect(page.locator('.m-send-btn')).toBeDisabled()
    })

    test('登录后提问收到回复', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await ssoLogin(page, 'student')
      await page.goto('/mobile/chat')
      await page.locator('.m-input').fill('移动端提问：知识库是什么')
      await page.locator('.m-send-btn').click()
      const aiBubble = page.locator('.msg-row-ai .msg-bubble')
      await expect(aiBubble.first()).toContainText(/Mock LLM Response|回答|抱歉/, { timeout: 30000 })
    })

    test('历史面板开关', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await ssoLogin(page, 'student')
      await page.goto('/mobile/chat')
      await page.locator('.m-menu-btn').click()
      await expect(page.locator('.m-panel-title')).toHaveText('历史对话')
      await page.locator('.m-panel-close').click()
      await expect(page.locator('.m-panel-title')).not.toBeVisible()
    })

    test('游客模式面板显示去登录', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/chat')
      await page.locator('.m-menu-btn').click()
      await expect(page.locator('.m-panel-login-tip')).toHaveText('去登录')
    })
  })
})
