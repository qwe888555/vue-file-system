// 一次性验证脚本：移动端欢迎页布局检查（横向溢出 + 顶栏间距）
const { chromium, devices } = require('playwright')

const URL = process.env.CHECK_URL || 'http://8.156.65.242/mobile'

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...devices['Pixel 5'], locale: 'zh-CN' })
  const page = await ctx.newPage()
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('.m-hot-questions', { timeout: 20000 })
    await page.waitForTimeout(600)

    const result = await page.evaluate(() => {
      const doc = document.documentElement
      const vw = doc.clientWidth
      const body = document.body
      const overflow = Math.max(doc.scrollWidth, body.scrollWidth) - vw

      const btns = [...document.querySelectorAll('.m-q-btn')].map((b) => {
        const r = b.getBoundingClientRect()
        return { text: b.textContent.trim().slice(0, 12), right: Math.round(r.right), inView: r.right <= vw + 1, h: Math.round(r.height) }
      })

      const topbar = document.querySelector('.m-topbar')?.getBoundingClientRect()
      const welcome = document.querySelector('.m-welcome')?.getBoundingClientRect()
      // 用户感知的空白 = 顶栏底 → 欢迎区第一个可见元素（icon）顶部的距离
      const first = document.querySelector('.m-welcome-icon')?.getBoundingClientRect()
      const gap = topbar && first ? Math.round(first.top - topbar.bottom) : null

      return {
        viewport: vw,
        hScrollOverflow: overflow,
        hasHScroll: overflow > 1,
        btnOverflowCount: btns.filter((b) => !b.inView).length,
        btns,
        topbarToWelcomeGap: gap,
      }
    })

    console.log('viewport:', result.viewport + 'px')
    console.log('横向溢出 px:', result.hScrollOverflow, '→', result.hasHScroll ? '有横向滚动 ❌' : '无横向滚动 ✅')
    console.log('按钮溢出数:', result.btnOverflowCount, result.btnOverflowCount ? '❌' : '✅')
    result.btns.forEach((b) => console.log('  -', b.text + '…', 'right=' + b.right, 'h=' + b.h + 'px', b.inView ? '' : '❌出界'))
    console.log('顶栏→欢迎区间距:', result.topbarToWelcomeGap + 'px', result.topbarToWelcomeGap && result.topbarToWelcomeGap <= 36 ? '✅' : '（偏大）')
  } catch (e) {
    console.error('检查失败:', e.message)
  } finally {
    await browser.close()
  }
})()
