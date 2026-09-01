// 一次性验证脚本：移动端欢迎页布局检查（多视口高度）
const { chromium } = require('playwright')

const URL = process.env.CHECK_URL || 'http://8.156.65.242/mobile'
const HEIGHTS = [560, 600, 640, 680, 727, 800, 851]

;(async () => {
  const browser = await chromium.launch()
  for (const h of HEIGHTS) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: h }, locale: 'zh-CN', isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    try {
      await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForSelector('.m-hot-questions', { timeout: 20000 })
      await page.waitForTimeout(400)

      const r = await page.evaluate(() => {
        const doc = document.documentElement
        const vw = doc.clientWidth, vh = doc.clientHeight
        const vOverflow = Math.max(doc.scrollHeight, document.body.scrollHeight) - vh
        const hOverflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - vw
        const rect = (s) => {
          const el = document.querySelector(s)
          if (!el) return null
          const b = el.getBoundingClientRect()
          return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }
        }
        const topbar = rect('.m-topbar')
        const icon = rect('.m-welcome-icon')
        const btns = [...document.querySelectorAll('.m-q-btn')]
        const lastBtn = btns.length ? document.querySelectorAll('.m-q-btn')[btns.length - 1].getBoundingClientRect() : null
        const input = rect('.m-input-area')
        return {
          vh, vOverflow, hasVScroll: vOverflow > 1,
          hOverflow, hasHScroll: hOverflow > 1,
          topGap: topbar && icon ? icon.top - topbar.bottom : null,
          btnOut: btns.filter((b) => b.getBoundingClientRect().right > vw + 1).length,
          blankBelow: lastBtn && input ? input.top - lastBtn.bottom : null,
        }
      })

      const flag = (ok) => (ok ? '✅' : '❌')
      console.log(`H=${String(h).padStart(4)} | 视口高 ${r.vh} | 上下滚动 ${flag(!r.hasVScroll)}(${r.vOverflow}px) | 左右 ${flag(!r.hasHScroll)}(${r.hOverflow}px) | 顶栏→icon ${r.topGap}px | 问题区下空白 ${r.blankBelow}px | 按钮出界 ${r.btnOut}`)
    } catch (e) {
      console.log(`H=${String(h).padStart(4)} | 检查失败: ${e.message}`)
    }
    await ctx.close()
  }
  await browser.close()
})()
