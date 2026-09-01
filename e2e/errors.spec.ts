import { test, expect } from '@playwright/test'

test.describe('异常页面', () => {
  test.describe('桌面端', () => {
    test('404 页面渲染状态码与描述', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/404')
      await expect(page.locator('.error-page')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.error-code')).toHaveText('404')
      await expect(page.locator('.error-desc')).toHaveText('抱歉，您访问的页面不存在')
    })

    test('任意未知路径重定向到 404', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/this-page-does-not-exist')
      await expect(page).toHaveURL('/404', { timeout: 15000 })
      await expect(page.locator('.error-code')).toHaveText('404')
    })

    test('403 页面渲染状态码与描述', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/403')
      await expect(page.locator('.error-page')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.error-code')).toHaveText('403')
      await expect(page.locator('.error-desc')).toHaveText('抱歉，您没有权限访问该页面')
    })

    test('404 页"回到首页"按钮导航到首页', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/404')
      await page.locator('button:has-text("回到首页")').click()
      await expect(page).toHaveURL('/')
      await expect(page.getByRole('heading', { name: 'NeuHub资源系统' })).toBeVisible()
    })
  })

  test.describe('移动端', () => {
    test('游客访问 /404 被移动端守卫重定向到聊天', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/404')
      await expect(page).toHaveURL('/mobile/chat', { timeout: 15000 })
    })
  })
})
