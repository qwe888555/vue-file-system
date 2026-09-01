import { test, expect } from '@playwright/test'

test.describe('移动端 FAQ', () => {
  test.describe('移动端', () => {
    test('游客可浏览 FAQ 列表', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/faq')
      await expect(page.locator('.f-title')).toHaveText('常见问题', { timeout: 15000 })
      // 种子 10 条已发布
      await expect(page.locator('.f-item')).toHaveCount(10, { timeout: 15000 })
    })

    test('分类 chips：全部 + 4 个分类', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/faq')
      await expect(page.locator('.f-cat')).toHaveCount(5, { timeout: 15000 })
    })

    test('点击分类过滤（校园网络 → 3 条）', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/faq')
      const cat = page.locator('.f-cat', { hasText: '校园网络' })
      await expect(cat).toBeVisible({ timeout: 15000 })
      await cat.click()
      await expect(page.locator('.f-item')).toHaveCount(3, { timeout: 10000 })
      await expect(cat).toHaveClass(/active/)
    })

    test('搜索关键词过滤（VPN → 1 条）', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/faq')
      await expect(page.locator('.f-item').first()).toBeVisible({ timeout: 15000 })
      await page.locator('.f-input').fill('VPN')
      await expect(page.locator('.f-item')).toHaveCount(1, { timeout: 10000 })
      await expect(page.locator('.f-q-text')).toContainText('校外如何访问图书馆资源')
    })

    test('搜索无结果 → 空态 + 去智能问答 CTA', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/faq')
      await expect(page.locator('.f-item').first()).toBeVisible({ timeout: 15000 })
      await page.locator('.f-input').fill('不存在的关键词xyz')
      await expect(page.locator('.f-empty')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('.f-empty-text')).toHaveText('暂无相关问题')
    })

    test('FAQ 条目展开收起', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/faq')
      const item = page.locator('.f-item').first()
      await expect(item).toBeVisible({ timeout: 15000 })
      await item.locator('.f-q').click()
      await expect(item).toHaveClass(/expanded/)
      await expect(item.locator('.f-a')).toBeVisible()
      await expect(item.locator('.f-a')).not.toBeEmpty()
      await item.locator('.f-q').click()
      await expect(item).not.toHaveClass(/expanded/)
    })

    test('底部 CTA 跳转智能问答', async ({ page, isMobile }) => {
      test.skip(!isMobile)
      await page.goto('/mobile/faq')
      await expect(page.locator('.f-cta-text')).toHaveText('没找到想要的答案？', { timeout: 15000 })
      await page.locator('button:has-text("去智能问答提问")').first().click()
      await expect(page).toHaveURL('/mobile/chat', { timeout: 10000 })
    })
  })
})
