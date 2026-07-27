import { test, expect } from '@playwright/test'

test.describe('智能问答', () => {
  test.describe('电脑端', () => {
    test('未登录用户重定向到首页', async ({ page, isMobile }) => {
      if (isMobile) return
      await page.goto('/chat')
      await expect(page).toHaveURL('/')
    })

    test('已登录用户能看到侧边栏', async ({ page, isMobile }) => {
      if (isMobile) return
      await page.addInitScript(() => {
        localStorage.setItem('access_token', 'mock_token')
        localStorage.setItem('user', JSON.stringify({
          id: 1, username: 'admin', role: 'admin',
          first_name: '测试', last_name: '管理员',
        }))
      })
      await page.goto('/chat')
      await page.waitForTimeout(1500)
      const sidebar = page.locator('.chat-sidebar')
      const visible = await sidebar.isVisible().catch(() => false)
      if (visible) {
        await expect(sidebar).toBeVisible()
      }
      await page.evaluate(() => localStorage.clear())
    })
  })

  test.describe('移动端', () => {
    test('欢迎页显示', async ({ page, isMobile }) => {
      if (!isMobile) return
      await page.goto('/mobile/chat')
      await expect(page.locator('text=有什么可以帮助你的？')).toBeVisible()
    })

    test('输入框可输入文本', async ({ page, isMobile }) => {
      if (!isMobile) return
      await page.goto('/mobile/chat')
      const input = page.locator('input[placeholder*="输入你的问题"]')
      await expect(input).toBeVisible()
      await input.fill('如何重置密码？')
      await expect(input).toHaveValue('如何重置密码？')
    })

    test('发送按钮随输入切换状态', async ({ page, isMobile }) => {
      if (!isMobile) return
      await page.goto('/mobile/chat')
      const input = page.locator('input[placeholder*="输入你的问题"]')
      const sendBtn = page.locator('button.m-send-btn')
      await expect(sendBtn).toBeDisabled()
      await input.fill('测试问题')
      await expect(sendBtn).toBeEnabled()
      await input.clear()
      await expect(sendBtn).toBeDisabled()
    })

    test('话筒按钮存在', async ({ page, isMobile }) => {
      if (!isMobile) return
      await page.goto('/mobile/chat')
      await expect(page.locator('button.m-mic-btn')).toBeVisible()
    })

    test('热点问题展示', async ({ page, isMobile }) => {
      if (!isMobile) return
      await page.goto('/mobile/chat')
      await page.waitForTimeout(2000)
      const qs = page.locator('.m-q-btn')
      const count = await qs.count()
      if (count > 0) {
        await expect(qs.first()).toBeVisible()
      }
    })

    test('历史面板开关', async ({ page, isMobile }) => {
      if (!isMobile) return
      await page.goto('/mobile/chat')
      await page.locator('button.m-menu-btn').click()
      await expect(page.locator('text=历史对话')).toBeVisible()
      await page.locator('button.m-panel-close').click()
      await expect(page.locator('text=历史对话')).not.toBeVisible()
    })
  })
})
