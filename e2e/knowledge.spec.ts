import { test, expect } from '@playwright/test'
import { ssoLogin, fetchSsoToken, API_BASE } from './helpers'

test.describe('知识库管理', () => {
  test.describe('桌面端', () => {
    test('超管：文档列表展示全部种子文档（11 篇）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/knowledge/list')
      await expect(page.locator('h2.page-title', { hasText: '知识库管理' })).toBeVisible({ timeout: 15000 })
      // file-count 显示总数 11
      await expect(page.locator('.file-count')).toHaveText('11', { timeout: 15000 })
      // 表格第一页 8 行
      await expect(page.locator('.file-table .file-title').first()).toBeVisible({ timeout: 15000 })
      expect(await page.locator('.file-table .file-title').count()).toBe(8)
      // 分页存在（11 条 → 2 页）
      await expect(page.locator('.pagination-wrapper')).toBeVisible()
    })

    test('搜索过滤：搜索"图书馆"只剩 1 条', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/knowledge/list')
      await page.locator('input.search-input input, .search-input input').fill('图书馆')
      await expect(page.locator('.file-table .file-title')).toHaveCount(1, { timeout: 10000 })
      await expect(page.locator('.file-table .file-title').first()).toHaveText(/图书馆/)
    })

    test('搜索无结果 → 显示空状态', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/knowledge/list')
      await page.locator('.search-input input').fill('不存在的文档xyz')
      await expect(page.locator('.empty-state')).toBeVisible({ timeout: 10000 })
    })

    test('点击文档标题 → 打开预览弹窗', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/knowledge/list')
      await expect(page.locator('.file-table .file-title').first()).toBeVisible({ timeout: 15000 })
      await page.locator('.file-table .file-title').first().click()
      // 预览弹窗出现（内容或占位提示）
      await expect(page.locator('.el-dialog')).toBeVisible({ timeout: 10000 })
    })

    test('直接访问文档详情页渲染标题', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      // 动态取一篇已索引文档的 id（docs 接口需鉴权，使用超管 token）
      const t = await fetchSsoToken('mock_super_admin')
      const res = await page.request.get(`${API_BASE}/api/knowledge/docs/`, {
        headers: { Authorization: `Bearer ${t.access}` },
      })
      const data = await res.json()
      const doc = data.results.find((d: any) => d.status === 'indexed')
      expect(doc).toBeTruthy()
      await page.goto(`/knowledge/detail/${doc.id}`)
      await expect(page.locator('.page-title')).toHaveText(doc.title, { timeout: 15000 })
    })

    test('上传区展示文件拖拽控件', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/knowledge/list')
      await expect(page.locator('.upload-area')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.upload-area .upload-dragger')).toBeVisible()
    })

    test('学院管理员：可见校级+本院文档（10 篇）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'college_admin')
      await page.goto('/knowledge/list')
      await expect(page.locator('.file-count')).toHaveText('10', { timeout: 15000 })
    })

    test('普通学生 UI 访问 /knowledge/list → 守卫重定向到 /chat', async ({ page, isMobile }) => {
      test.skip(isMobile)
      // 学生角色（user）不在菜单权限内，路由守卫会跳转角色首页
      await ssoLogin(page, 'student')
      await page.goto('/knowledge/list')
      await expect(page).toHaveURL(/\/chat$/, { timeout: 15000 })
    })

    test('学生通过 API 仅见自己上传的文档（2 篇，作用域过滤）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      const t = await ssoLogin(page, 'student')
      const res = await page.request.get(`${API_BASE}/api/knowledge/docs/`, {
        headers: { Authorization: `Bearer ${t.access}` },
      })
      expect(res.ok()).toBeTruthy()
      const data = await res.json()
      const rows = data.results ?? data
      expect(rows).toHaveLength(2)
      const titles = rows.map((d: any) => d.title).join('|')
      expect(titles).toContain('我的毕业设计选题报告')
      expect(titles).toContain('课堂笔记-操作系统原理')
    })
  })
})
