import { test, expect } from '@playwright/test'
import { ssoLogin } from './helpers'

test.describe('日志管理', () => {
  test.describe('桌面端', () => {
    test('超管：日志页加载概览区块', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      await expect(page.locator('h2.log-title')).toHaveText('日志管理', { timeout: 15000 })
      // Tab 条：概览/上传/查询/敏感/登录/操作
      await expect(page.locator('.log-tabs button')).toHaveCount(6)
      // Dashboard 5 个数据块（上传/查询/敏感/登录/操作）
      await expect(page.locator('.db-block')).toHaveCount(5, { timeout: 15000 })
    })

    test('上传日志块渲染真实总数', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      // 上传块（种子 9 条）非错误且总数显示
      const uploadBlock = page.locator('.db-block', { hasText: '上传' }).first()
      await expect(uploadBlock).toBeVisible({ timeout: 15000 })
      await expect(uploadBlock.locator('.db-error')).not.toBeVisible()
      // 数字在 .db-stat strong 内（外层含"总数"标签文本）
      await expect(uploadBlock.locator('.db-stat strong').first()).toHaveText('9')
    })

    test('查询日志块渲染真实总数', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      const queryBlock = page.locator('.db-block', { hasText: '查询' }).first()
      await expect(queryBlock.locator('.db-error')).not.toBeVisible({ timeout: 15000 })
      // 种子 10 条 + chat 测试提问写入的查询日志 → 总数 ≥ 10
      const statText = await queryBlock.locator('.db-stat strong').first().innerText()
      expect(parseInt(statText, 10)).toBeGreaterThanOrEqual(10)
    })

    test('登录块：环境无时区表时优雅降级为错误态', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      const loginBlock = page.locator('.db-block', { hasText: '登录' }).first()
      await expect(loginBlock).toBeVisible({ timeout: 15000 })
      // 本地 MySQL 时区表为空 → 登录统计返回错误 → 显示"数据获取失败"（不崩溃）
      await expect(loginBlock.locator('.db-error')).toBeVisible()
    })

    test('上传日志 Tab：列表渲染种子数据', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      await page.locator('.log-tabs button', { hasText: '上传日志' }).click()
      await expect(page.locator('.filter-bar')).toBeVisible({ timeout: 15000 })
      // 种子 9 条上传日志，pageSize=10 → 全部显示
      await expect(page.locator('.table-body .el-table__row')).toHaveCount(9, { timeout: 15000 })
    })

    test('查询日志 Tab：列表渲染种子数据', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      await page.locator('.log-tabs button', { hasText: '查询日志' }).click()
      await expect(page.locator('.filter-bar')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.table-body .el-table__row')).toHaveCount(10, { timeout: 15000 })
    })

    test('操作日志 Tab：列表渲染种子数据', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'super_admin')
      await page.goto('/logs')
      await page.locator('.log-tabs button', { hasText: '操作日志' }).click()
      await expect(page.locator('.filter-bar')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.table-body .el-table__row')).toHaveCount(5, { timeout: 15000 })
    })

    test('RBAC：admin 访问 /logs → 403', async ({ page, isMobile }) => {
      test.skip(isMobile)
      await ssoLogin(page, 'admin')
      await page.goto('/logs')
      await expect(page).toHaveURL('/403', { timeout: 15000 })
      await expect(page.locator('.error-code', { hasText: '403' })).toBeVisible()
    })
  })
})
