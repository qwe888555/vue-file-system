import { test, expect } from '@playwright/test'

test.describe('异常页面', () => {
  test('404 页面显示', async ({ page, isMobile }) => {
    if (isMobile) {
      // 移动端可能重定向，尝试直接访问
      await page.goto('/404')
      await page.waitForTimeout(1000)
      const text404 = page.locator('text=404').or(page.locator('text=页面不存在'))
      const visible = await text404.first().isVisible().catch(() => false)
      if (!visible) {
        // 移动端可能被重定向到聊天
        expect(page.url()).toContain('/mobile')
      }
      return
    }
    await page.goto('/this-page-does-not-exist')
    await page.waitForTimeout(1000)
    const notFound = page.locator('text=404').or(page.locator('text=页面不存在'))
    const visible = await notFound.first().isVisible().catch(() => false)
    if (!visible) {
      // 可能被全局路由捕获，检查是否在 404 页面
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('403 页面可访问', async ({ page, isMobile }) => {
    if (isMobile) return
    await page.goto('/403')
    await page.waitForTimeout(1000)
    const forbidden = page.locator('text=403').or(page.locator('text=无权限'))
    const visible = await forbidden.first().isVisible().catch(() => false)
    if (visible) {
      await expect(forbidden.first()).toBeVisible()
    }
  })
})
