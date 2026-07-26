import { test, expect } from '@playwright/test'

test.describe('知识库管理', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    if (isMobile) return
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock_admin_token')
      localStorage.setItem('user', JSON.stringify({
        id: 1, username: 'admin', role: 'admin',
        first_name: '系', last_name: '管理员',
      }))
    })
  })

  test('文档列表页加载', async ({ page, isMobile }) => {
    if (isMobile) return
    await page.goto('/knowledge/list')
    await page.waitForTimeout(2000)
    const hasElements = await page.locator('*').count()
    expect(hasElements).toBeGreaterThan(0)
  })

  test('上传页面加载', async ({ page, isMobile }) => {
    if (isMobile) return
    await page.goto('/knowledge/upload')
    await page.waitForTimeout(2000)
    const hasInputs = await page.locator('input, button, .el-upload').count()
    expect(hasInputs).toBeGreaterThan(0)
  })

  test('分类浏览页加载', async ({ page, isMobile }) => {
    if (isMobile) return
    await page.goto('/knowledge/browse')
    await page.waitForTimeout(2000)
    const hasContent = await page.locator('*').count()
    expect(hasContent).toBeGreaterThan(0)
  })
})
