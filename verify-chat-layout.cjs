// 一次性验证脚本：问答页双侧边栏（rail + 聊天侧栏）方案
// 通过 mock /api 接口模拟登录态，验证：
//  A. 常驻 rail（64px + hover 浮层 + 用户按钮）
//  B. 顶栏：移除「退出问答」、新增「正在回答…」chip 与「教研知识库 · RAG」标签
//  C. keep-alive：切走草稿保留、SSE 后台继续生成、完成亮红点、切回清除
//
// 注意：mock 必须用 pathname 前缀匹配（/api/...），
//   不能写 `**/api/**` glob —— 那会误伤 Vite 源码模块 /src/api/*.ts。
const { chromium } = require('playwright')
const path = require('path')

const BASE = 'http://localhost:5173'
const OUT = path.join(__dirname, '..', 'verify-chat-')
let fails = 0
const ok = (name, cond) => {
  console.log(`${cond ? '✅' : '❌'} ${name}`)
  if (!cond) fails++
}

const sseBody = [
  'event: start\ndata: {"message_id": 777}\n\n',
  'event: msg\ndata: {"content":"这是一段在后台生成完成的回答内容，用于验证 keep-alive 与红点。"}\n\n',
  'event: references\ndata: {"count": 0, "summary": ""}\n\n',
  'event: done\ndata: {}\n\n',
].join('')

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
  // 预置登录态 + 跳过蜂巢入场动画
  await ctx.addInitScript(() => {
    localStorage.setItem('access_token', 'mock-token')
    localStorage.setItem('refresh_token', 'mock-refresh')
    sessionStorage.setItem('hasPlayHomeAnimation', 'true')
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  ⚠ pageerror:', e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  ⚠ console.error:', m.text().slice(0, 120))
  })

  // ── mock /api ──（只匹配真实接口 pathname，避免误伤 /src/api/*.ts）
  const json = (obj) => ({ contentType: 'application/json', body: JSON.stringify(obj) })

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = route.request().url()
      const method = route.request().method()
      const pathname = new URL(url).pathname

      if (/^\/api\/auth\/me\/$/.test(pathname)) {
        return route.fulfill(json({
          id: 1, username: 'sso_dept_admin', role: 'dept_admin', role_display: '部门管理员',
          first_name: '部', last_name: '门', email: 'a@b.com', phone: '', avatar: '',
        }))
      }
      if (/^\/api\/chat\/conversations\/\d+\/$/.test(pathname)) {
        return route.fulfill(json({ id: 1, title: '旧会话', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', messages: [] }))
      }
      if (/^\/api\/chat\/conversations\/$/.test(pathname)) {
        if (method === 'POST') {
          return route.fulfill(json({ id: 1, title: '', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }))
        }
        return route.fulfill(json({ results: [] }))
      }
      if (/^\/api\/chat\/hot-questions\/$/.test(pathname)) {
        return route.fulfill(json([{ question: '如何撰写课程标准中的课程目标', count: 12 }, { question: '1+X 证书如何与现有课程融通', count: 9 }]))
      }
      if (/^\/api\/chat\/ask\/$/.test(pathname)) {
        // SSE：延迟 3.5s 返回，模拟「切走后仍在后台生成」
        await new Promise((r) => setTimeout(r, 3500))
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseBody })
      }
      if (pathname.startsWith('/api/knowledge/')) {
        return route.fulfill(json({ results: [], count: 0 }))
      }
      // 兜底
      return route.fulfill(json({}))
    },
  )

  try {
    // ═══ A. 问答页渲染 ═══
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('.app-rail', { timeout: 15000 })
    await page.waitForSelector('.chat-welcome', { timeout: 15000 })

    const railW = await page.$eval('.app-rail', (el) => el.getBoundingClientRect().width)
    ok(`rail 宽度 = 64px（实际 ${railW}px）`, Math.round(railW) === 64)

    const railLabels = await page.$$eval('.rail-item .rail-pop', (els) => els.map((e) => e.textContent.trim()))
    ok(`rail 菜单（dept_admin 角色）= 知识库管理/教研问答/FAQ管理/部门管理`, JSON.stringify(railLabels) === JSON.stringify(['知识库管理', '教研问答', 'FAQ 管理', '部门管理']))

    const railActive = await page.$eval('.rail-item.is-active .rail-pop', (el) => el.textContent.trim())
    ok(`当前高亮 = 教研问答`, railActive === '教研问答')

    ok(`rail 用户按钮存在`, await page.$('.rail-user-btn') !== null)
    ok(`聊天侧栏存在`, await page.$('.chat-sidebar') !== null)

    // ═══ B. 顶栏 ═══
    ok(`「退出问答」按钮已移除`, (await page.$$('.topbar-exit-btn')).length === 0)
    const kbChip = await page.$eval('.kb-chip', (el) => el.textContent.trim())
    ok(`kb-chip 显示「教研知识库 · RAG」`, kbChip.includes('教研知识库 · RAG'))
    ok(`「正在回答…」chip 默认隐藏`, !(await page.$('.chip-stream')))
    const title = await page.$eval('.topbar-title', (el) => el.textContent.trim())
    ok(`顶栏标题 = 教研问答（无会话）`, title === '教研问答')

    await page.screenshot({ path: `${OUT}1-chat-page.png` })

    // ═══ A2. rail hover 浮层 ═══
    await page.hover('.rail-item[title="知识库管理"]')
    await page.waitForTimeout(250)
    const popVisible = await page.$eval('.rail-item[title="知识库管理"] .rail-pop', (el) => getComputedStyle(el).opacity)
    ok(`hover 显示浮层（opacity=${popVisible}）`, parseFloat(popVisible) === 1)
    await page.screenshot({ path: `${OUT}2-rail-hover.png` })

    // ═══ C. keep-alive：草稿保留 ═══
    const input = page.locator('.input-field')
    await input.fill('这是一条草稿')
    // 点击 rail「知识库管理」切走
    await page.click('.rail-item[title="知识库管理"]')
    await page.waitForSelector('.layout-container .sidebar', { timeout: 15000 })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}3-knowledge-page.png` })
    ok(`切走后 Layout 侧边栏显示`, await page.$('.layout-container .sidebar .el-menu') !== null)
    ok(`切走后 rail 不再显示（问答页专属）`, !(await page.$('.app-rail')))

    // 切回问答页，草稿应保留
    await page.click('.sidebar .el-menu-item:has-text("教研问答")')
    await page.waitForSelector('.chat-app .app-rail', { timeout: 15000 })
    await page.waitForTimeout(400)
    const draft = await page.$eval('.input-field', (el) => el.value)
    ok(`切回后草稿保留（=${draft.slice(0, 10)}…）`, draft === '这是一条草稿')
    await page.screenshot({ path: `${OUT}4-return-draft.png` })

    // ═══ C2. 后台生成 + 红点 ═══
    // 清空草稿，发送问题（SSE 延迟 3.5s），随后切走
    await input.fill('如何撰写课程目标')
    await page.click('.send-fab')
    await page.waitForTimeout(400)
    ok(`发送后显示「正在回答…」chip`, await page.$('.chip-stream') !== null)
    await page.screenshot({ path: `${OUT}5-streaming-chip.png` })
    // 切走
    await page.click('.rail-item[title="知识库管理"]')
    await page.waitForSelector('.layout-container .sidebar', { timeout: 15000 })
    await page.waitForTimeout(1200) // 此时 SSE 尚未完成
    ok(`生成完成前侧边栏无红点`, !(await page.$('.menu-badge-dot')))
    await page.screenshot({ path: `${OUT}6-away-before-done.png` })
    // 等 SSE 完成
    await page.waitForTimeout(3500)
    await page.waitForSelector('.menu-badge-dot', { timeout: 10000 })
    ok(`后台生成完成后侧边栏亮红点`, true)
    await page.screenshot({ path: `${OUT}7-sidebar-reddot.png` })

    // 切回问答页 → 红点清除 + 消息已追加
    await page.click('.sidebar .el-menu-item:has-text("教研问答")')
    await page.waitForSelector('.chat-app .app-rail', { timeout: 15000 })
    await page.waitForTimeout(500)
    const aiMsg = await page.$$eval('.msg-bubble-ai', (els) => els.map((e) => e.textContent.trim()).join('|'))
    ok(`切回后 AI 回答已追加`, aiMsg.includes('后台生成完成的回答内容'))
    ok(`切回后不再有未读红点（rail 聊天项）`, !(await page.$('.rail-item[title="教研问答"] .badge-dot')))
    const topTitle = await page.$eval('.topbar-title', (el) => el.textContent.trim())
    ok(`顶栏标题更新为会话标题（=${topTitle.slice(0, 8)}…）`, topTitle.length > 0 && topTitle !== '教研问答')
    await page.screenshot({ path: `${OUT}8-back-with-answer.png` })

    console.log(fails === 0 ? '\n全部通过 ✅' : `\n${fails} 项未通过 ❌`)
  } catch (e) {
    console.log('\n检查中断:', e.message)
    fails++
  } finally {
    await browser.close()
  }
  process.exit(fails === 0 ? 0 : 1)
})()
