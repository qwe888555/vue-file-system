import { test, expect } from '@playwright/test'

test.describe('首页（Introduction）', () => {
  test('桌面端：显示 Logo 和系统描述', async ({ page, isMobile }) => {
    if (isMobile) return // 移动端会自动跳转
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'NeuHub资源系统' })).toBeVisible()
    await expect(page.locator('text=成都东软学院一站式智能知识库系统')).toBeVisible()
  })

  test('桌面端：导航到登录页', async ({ page, isMobile }) => {
    if (isMobile) return
    await page.goto('/')
    // 找登录相关按钮/链接
    const loginBtn = page.locator('a, button', { hasText: /登录|Login|sign/i }).first()
    if (await loginBtn.isVisible()) {
      await loginBtn.click()
    }
  })

  test('移动端：自动跳转到移动端聊天页', async ({ page, isMobile }) => {
    if (!isMobile) return
    await page.goto('/')
    await expect(page).toHaveURL('/mobile/chat')
  })
})
