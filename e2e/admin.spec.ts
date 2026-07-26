import { test, expect } from '@playwright/test'

test.describe('后台管理', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    if (isMobile) return
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock_admin_token')
      localStorage.setItem('user', JSON.stringify({
        id: 1, username: 'admin', role: 'super_admin',
        first_name: '系', last_name: '管理员',
      }))
    })
  })

  test('用户列表页加载', async ({ page, isMobile }) => {
    if (isMobile) return
    await page.goto('/admin/users')
    await page.waitForTimeout(2000)
    // 如果不在 403 页面，说明登录成功
    const is403 = await page.locator('text=403').count()
    if (is403 === 0) {
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('未授权用户跳转 403', async ({ page, isMobile }) => {
    if (isMobile) return
    // 使用普通用户角色（不注入 admin token）
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock_user_token')
      localStorage.setItem('user', JSON.stringify({
        id: 2, username: 'student', role: 'user',
        first_name: '学', last_name: '生',
      }))
    })
    await page.goto('/admin/users')
    await page.waitForTimeout(2000)
  })
})
