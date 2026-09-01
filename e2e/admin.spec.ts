import { test, expect } from '@playwright/test'
import { ssoLogin } from './helpers'

test.describe('后台管理', () => {
  test.describe('桌面端', () => {
    test('超管：账号管理页展示用户列表', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/admin/users')
      await expect(page.locator('.table-title', { hasText: '账号管理' })).toBeVisible({ timeout: 15000 })
      // 账号接口排除超管账号本身 → 9 个可管理账号
      await expect(page.locator('.table-body .el-table__row').first()).toBeVisible({ timeout: 15000 })
      expect(await page.locator('.table-body .el-table__row').count()).toBe(9)
    })

    test('搜索账号过滤', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/admin/users')
      // 先等初始列表渲染完成（9 行），再触发搜索，避免并发加载竞态
      await expect(page.locator('.table-body .el-table__row')).toHaveCount(9, { timeout: 15000 })
      await page.locator('.fi.kw input').fill('cadmin')
      await expect(page.locator('.table-body .el-table__row')).toHaveCount(1, { timeout: 10000 })
      await expect(page.locator('.table-body')).toContainText('cadmin')
    })

    test('角色 Pill 过滤（管理员 = 学院+部门管理员）', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/admin/users')
      // 先等初始列表渲染完成，再点击 Pill
      await expect(page.locator('.table-body .el-table__row')).toHaveCount(9, { timeout: 15000 })
      // 超管可见的角色 Pill：全部 / 普通用户 / 管理员
      const pill = page.locator('.role-pill', { hasText: '管理员' })
      await expect(pill).toBeVisible()
      await pill.click()
      // 管理员 = college_admin(2) + dept_admin(1) = 3 个
      await expect(page.locator('.table-body .el-table__row')).toHaveCount(3, { timeout: 10000 })
    })

    test('所属单位页：学院 + 部门 Tab', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/admin/orgs')
      await expect(page.locator('.org-tabs')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.org-tabs')).toContainText('学院')
      await expect(page.locator('.org-tabs')).toContainText('部门')
    })

    test('日志管理页（仅超管）加载概览', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      await expect(page.locator('h2.log-title', { hasText: '日志管理' })).toBeVisible({ timeout: 15000 })
    })

    test('RBAC：普通学生访问 /admin/users → 403', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'student')
      await page.goto('/admin/users')
      await expect(page).toHaveURL('/403', { timeout: 15000 })
      await expect(page.locator('.error-code', { hasText: '403' })).toBeVisible()
    })

    test('RBAC：普通学生访问 /logs → 403', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'student')
      await page.goto('/logs')
      await expect(page).toHaveURL('/403', { timeout: 15000 })
      await expect(page.locator('.error-code', { hasText: '403' })).toBeVisible()
    })

    test('RBAC：学院管理员访问 /admin/orgs → 403', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'college_admin')
      await page.goto('/admin/orgs')
      await expect(page).toHaveURL('/403', { timeout: 15000 })
      await expect(page.locator('body')).toContainText('403')
    })
  })
})
