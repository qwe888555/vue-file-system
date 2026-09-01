import { test, expect } from '@playwright/test'
import { ssoLogin } from './helpers'

test.describe('常见问题（FAQ）', () => {
  test.describe('桌面端', () => {
    test('游客可浏览 FAQ 列表（已发布条目）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/faq')
      await expect(page.locator('.faq-header-title')).toHaveText('常见问题', { timeout: 15000 })
      // 种子数据 10 条已发布，pageSize=10 → 首页 10 张卡片
      await expect(page.locator('.faq-card')).toHaveCount(10, { timeout: 15000 })
      await expect(page.locator('.faq-card .faq-q-text', { hasText: '如何重置账号密码' })).toBeVisible()
    })

    test('分类标签：全部 + 4 个分类', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/faq')
      await expect(page.locator('.faq-categories .category-pill')).toHaveCount(5, { timeout: 15000 })
      await expect(page.locator('.faq-categories')).toContainText('账号与登录')
      await expect(page.locator('.faq-categories')).toContainText('生活服务')
    })

    test('点击分类过滤列表（账号与登录 → 2 条）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/faq')
      const cat = page.locator('.category-pill', { hasText: '账号与登录' })
      await expect(cat).toBeVisible({ timeout: 15000 })
      await cat.click()
      await expect(page.locator('.faq-card')).toHaveCount(2, { timeout: 10000 })
      await expect(cat).toHaveClass(/active/)
    })

    test('搜索关键词过滤', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/faq')
      // 先等初始列表渲染完成，再触发搜索（避免并发加载竞态）
      await expect(page.locator('.faq-card')).toHaveCount(10, { timeout: 15000 })
      const input = page.locator('input[placeholder="搜索问题..."]')
      await expect(input).toBeVisible()
      await input.fill('VPN')
      await page.keyboard.press('Enter')
      await expect(page.locator('.faq-card')).toHaveCount(1, { timeout: 10000 })
      await expect(page.locator('.faq-card .faq-q-text')).toContainText('校外如何访问图书馆资源')
    })

    test('搜索无结果 → 空状态', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/faq')
      await expect(page.locator('.faq-card')).toHaveCount(10, { timeout: 15000 })
      await page.locator('input[placeholder="搜索问题..."]').fill('不存在的关键词xyz')
      await page.keyboard.press('Enter')
      await expect(page.locator('.faq-empty')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('.faq-empty-text')).toHaveText('暂无相关问题')
    })

    test('FAQ 卡片展开/收起答案', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await page.goto('/faq')
      const card = page.locator('.faq-card').first()
      await expect(card).toBeVisible({ timeout: 15000 })
      await card.locator('.faq-question').click()
      await expect(card).toHaveClass(/expanded/)
      await expect(card.locator('.faq-answer-text')).toBeVisible()
      // 收起
      await card.locator('.faq-question').click()
      await expect(card).not.toHaveClass(/expanded/)
    })

    test('管理员 FAQ 管理页：全部条目含草稿/驳回', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/faq-manage')
      await expect(page.locator('.fm-title')).toHaveText('FAQ 管理', { timeout: 15000 })
      // 状态 Tabs：全部/草稿/已发布/已驳回
      await expect(page.locator('.fm-tab')).toHaveCount(4)
      // 全部 = 12 条（10 published + 1 draft + 1 rejected），pageSize=10 → 首屏 10 张
      await expect(page.locator('.fm-card')).toHaveCount(10, { timeout: 15000 })
    })

    test('管理员：草稿 Tab 可见草稿条目', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/faq-manage')
      await page.locator('.fm-tab', { hasText: '草稿' }).click()
      await expect(page.locator('.fm-card')).toHaveCount(1, { timeout: 10000 })
      await expect(page.locator('.fm-card').first()).toContainText('内部测试草稿问题')
      await expect(page.locator('.fm-card').first()).toContainText('草稿')
    })

    test('管理员：已驳回 Tab 可见驳回条目', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/faq-manage')
      await page.locator('.fm-tab', { hasText: '已驳回' }).click()
      await expect(page.locator('.fm-card')).toHaveCount(1, { timeout: 10000 })
      await expect(page.locator('.fm-card').first()).toContainText('已驳回的旧问题')
    })

    test('RBAC：学生访问 /faq-manage → 403', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'student')
      await page.goto('/faq-manage')
      await expect(page).toHaveURL('/403', { timeout: 15000 })
      await expect(page.locator('.error-code', { hasText: '403' })).toBeVisible()
    })
  })
})
