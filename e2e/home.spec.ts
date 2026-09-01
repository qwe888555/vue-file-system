import { test, expect } from '@playwright/test'

test.describe('首页（Introduction）', () => {
  test.describe('桌面端', () => {
    test('标题、副标题、Logo 展示', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'NeuHub资源系统' })).toBeVisible()
      await expect(page.locator('text=成都东软学院一站式智能知识库系统')).toBeVisible()
      await expect(page.locator('header img')).toBeVisible()
    })

    test('游客也能看到平台数据概览（统计已开放）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/')
      const panel = page.locator('section.stats-panel')
      await expect(panel).toBeVisible({ timeout: 15000 })
      await expect(panel.locator('.stats-title')).toHaveText(/平台数据概览/)
      // 主导指标（存储总量）数字渲染
      await expect(panel.locator('.stat-feature-value')).toBeVisible({ timeout: 15000 })
      // 次级指标网格出现 6 个格子
      await expect(panel.locator('.stat-cell')).toHaveCount(6, { timeout: 15000 })
      // 不应出现"登录管理员账号后可查看平台数据"的占位提示（统计已开放）
      await expect(panel).not.toContainText('登录管理员账号')
    })

    test('统计数字为种子数据真实值（用户总数>0）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/')
      const panel = page.locator('section.stats-panel')
      await expect(panel.locator('.stat-cell')).toHaveCount(6, { timeout: 15000 })
      // 第一个格子 = 用户总数（11）；等待 API 返回真实值（初始渲染为 0）
      const userCount = panel.locator('.stat-cell').first().locator('.stat-cell-num')
      await expect(userCount).not.toHaveText('0', { timeout: 15000 })
      const text = await userCount.innerText()
      expect(parseInt(text, 10)).toBeGreaterThan(0)
    })

    test('统计区间文案显示', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/')
      await expect(page.locator('.stats-meta')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.stats-meta')).toHaveText(/统计区间：/)
    })
  })

  test.describe('移动端', () => {
    test('访问首页自动跳转移动端聊天', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/')
      await expect(page).toHaveURL('/mobile/chat', { timeout: 15000 })
    })
  })
})
