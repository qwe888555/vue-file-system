<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LoginPage from '@/views/login/LoginPage.vue'
import request from '@/api/request'
import logodark from '@/assets/images/logo2.jpg'
import heroBg from '@/assets/images/hero3.jpg'

/* Dashboard 聚合接口 v1.7 — AllowAny + totals + period=all */
interface DashboardBlock {
  total?: number; total_size?: number; error?: string
  [key: string]: unknown
}
interface DashboardTotals { users: number; upload_total_size: number; error?: string }
interface DashboardResponse {
  period: string; start_at: string; end_at: string
  totals?: DashboardTotals
  blocks: {
    upload: DashboardBlock; query: DashboardBlock
    sensitive: DashboardBlock; login: DashboardBlock; operation: DashboardBlock
  }
}

const stats = ref([
  { key: 'users_total',   label: '用户总数', value: 0, suffix: '' },
  { key: 'total_storage', label: '存储总量', value: 0, suffix: 'GB' },
  { key: 'upload_total',  label: '资料总数', value: 0, suffix: '' },
  { key: 'query_total',   label: '查询总数', value: 0, suffix: '' },
  { key: 'sensitive',     label: '敏感拦截', value: 0, suffix: '' },
  { key: 'login_total',   label: '登录次数', value: 0, suffix: '' },
  { key: 'operation',     label: '访问次数', value: 0, suffix: '' },
])

// ── 数字滚动动画 ──
const displayVals = ref<number[]>([])
let animFrame = 0

function animateNumbers(targets: number[]) {
  cancelAnimationFrame(animFrame)
  const from = displayVals.value.length ? displayVals.value : targets.map(() => 0)
  const start = performance.now()
  const dur = 1000
  function tick(now: number) {
    const p = Math.min((now - start) / dur, 1)
    const e = 1 - Math.pow(1 - p, 3)
    displayVals.value = from.map((f, i) => {
      const val = f + (targets[i] - f) * e
      return targets[i] % 1 !== 0 ? Math.round(val * 10) / 10 : Math.round(val)
    })
    if (p < 1) animFrame = requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}




function fmtSize(b: number) {
  if (!b) return { v: 0, s: 'GB' }
  const kb = b / 1024
  if (kb < 1024) return { v: Math.round(kb), s: 'KB' }
  const mb = kb / 1024
  if (mb < 1024) return { v: Math.round(mb * 10) / 10, s: 'MB' }
  const gb = mb / 1024
  return gb < 1024 ? { v: Math.round(gb * 10) / 10, s: 'GB' } : { v: Math.round(gb / 1024 * 10) / 10, s: 'TB' }
}
function ok(b: { error?: string } | undefined) { return !!b && !('error' in b) }

function applyStatsVals(users: number, sizeBytes: number, upload: number, query: number, sensitive: number, login: number, operation: number) {
  const f = fmtSize(sizeBytes)
  const vals = [users, f.v, upload, query, sensitive, login, operation]
  stats.value = stats.value.map((s, i) => ({ ...s, value: vals[i], suffix: i === 1 ? f.s : s.suffix }))
  animateNumbers([users, f.v, upload, query, sensitive, login, operation])
}

async function fetchStats() {
  try {
    const dash = await request.get('/admin/logs/dashboard/', { params: { period: 'all' } }) as DashboardResponse
    const t = dash?.totals && ok(dash.totals) ? dash.totals : null
    const b = dash?.blocks
    const up = b && ok(b.upload) ? b.upload : null
    const qy = b && ok(b.query) ? b.query : null
    const sn = b && ok(b.sensitive) ? b.sensitive : null
    const lg = b && ok(b.login) ? b.login : null
    const op = b && ok(b.operation) ? b.operation : null
    applyStatsVals(t?.users ?? 0, t?.upload_total_size ?? 0, up?.total ?? 0, qy?.total ?? 0, sn?.total ?? 0, lg?.total ?? 0, op?.total ?? 0)
  } catch { /* 接口不可用时保留默认值 0 */ }
}

onMounted(() => {
  fetchStats()
})

</script>

<template>
  <div class="relative min-h-[100dvh] flex flex-col overflow-hidden text-white font-sans antialiased">
    <!-- ═══ 背景图 + 浅色叠加 ═══ -->
    <img :src="heroBg" alt="" class="absolute inset-0 w-full h-full object-cover" />
    <div class="absolute inset-0 bg-black/35" />

    <!-- ═══ Logo ═══ -->
    <header class="relative z-10 pt-3 px-6 flex items-center gap-3">
      <img :src="logodark" alt="成都东软学院" class="h-12 w-auto rounded-md" />
    </header>

    <!-- ═══ 主体 ═══ -->
    <main class="relative z-10 flex-1 px-6 pt-4 pb-4">
      <div class="page-grid max-w-7xl mx-auto">
        <!-- 标题区 — 居中于六边形和登录上方 -->
        <div class="hero-text col-span-full">
          <h1 class="hero-title">
            NeuHub资源系统<br class="sm:hidden" />
          </h1>
          <p class="hero-desc">成都东软学院一站式智能知识库系统</p>
        </div>

        <!-- 左：六边形数据 -->
        <div class="left-col">
          <!-- 六边形排版 -->
          <div class="hex-wrap">
            <div class="hex-ring">
              <!-- 上层 -->
              <div class="hex-node" style="grid-area:a">
                <span class="h-num">{{ (displayVals[0] ?? 0).toLocaleString() }}</span>
                <span class="h-lbl">{{ stats[0].label }}</span>
              </div>
              <div class="hex-node" style="grid-area:b">
                <span class="h-num">{{ (displayVals[2] ?? 0).toLocaleString() }}</span>
                <span class="h-lbl">{{ stats[2].label }}</span>
              </div>
              <!-- 中层 -->
              <div class="hex-node" style="grid-area:c">
                <span class="h-num">{{ (displayVals[3] ?? 0).toLocaleString() }}</span>
                <span class="h-lbl">{{ stats[3].label }}</span>
              </div>
              <div class="hex-center">
                <span class="hc-num">{{ (displayVals[1] ?? 0).toLocaleString() }}</span>
                <span class="hc-suf">{{ stats[1].suffix }}</span>
                <span class="hc-lbl">{{ stats[1].label }}</span>
              </div>
              <div class="hex-node" style="grid-area:d">
                <span class="h-num">{{ (displayVals[4] ?? 0).toLocaleString() }}</span>
                <span class="h-lbl">{{ stats[4].label }}</span>
              </div>
              <!-- 下层 -->
              <div class="hex-node" style="grid-area:e">
                <span class="h-num">{{ (displayVals[5] ?? 0).toLocaleString() }}</span>
                <span class="h-lbl">{{ stats[5].label }}</span>
              </div>
              <div class="hex-node" style="grid-area:f">
                <span class="h-num">{{ (displayVals[6] ?? 0).toLocaleString() }}</span>
                <span class="h-lbl">{{ stats[6].label }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- 右：登录 -->
        <div class="right-col">
          <div class="login-card">
            <LoginPage embedded />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════
   taste-skill: 非对称数据仪表盘
   超大 hero 数字 + 卡片网格 + 玻璃质感
   ═══════════════════════════════════════════ */

/* ── 页面栅格 ── */
.page-grid {
  width: 100%;
  display: grid; grid-template-columns: 1fr;
  gap: 1.5rem; align-items: start;
}
@media (min-width: 1024px) {
  .page-grid { grid-template-columns: repeat(5, 1fr); gap: 4rem; align-items: start; }
}
.left-col { grid-column: span 3; align-self: start; }
.right-col { grid-column: span 2; margin-top: -3rem; min-height: 500px; align-self: start; }

/* ── Hero 文字 ── */
.hero-text {
  text-align: center;
  margin-bottom: 2.5rem;
}
.hero-title {
  font-size: 3rem; font-weight: 700;
  letter-spacing: -0.025em; line-height: 1.15;
}
@media (min-width: 640px) { .hero-title { font-size: 3.2rem; } }
@media (min-width: 1024px) { .hero-title { font-size: 3.8rem; } }
.hero-desc {
  margin: 0.6rem auto 0;
  font-size: 1.05rem;
  color: rgba(255,255,255,0.6);
  line-height: 1.6; max-width: 28rem;
}
.col-span-full { grid-column: 1 / -1; }

/* ═══ 六边形排版 ═══ */
.hex-wrap { padding: 4px 0; margin-top: 2rem; margin-left: -3rem; }
.hex-ring {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: auto auto auto;
  grid-template-areas:
    ". a . b ."
    "c . CENTER . d"
    ". e . f .";
  gap: 2.5rem 1rem;
  align-items: center;
  justify-items: center;
  max-width: 100%;
}
.hex-node {
  text-align: center;
  animation: s1-in 0.5s ease-out both;
  transition: transform 0.3s;
  padding: 14px 6px;
  width: 100%;
}
.hex-node:hover { transform: translateY(-2px); }
.hex-node:hover .h-lbl { color: rgba(255,255,255,0.7); }
.h-num {
  display: block;
  font-size: 2.1rem; font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1; color: #fff;
  animation: h-float 4s ease-in-out 0s infinite;
}
.h-lbl {
  display: block;
  font-size: 0.9rem; font-weight: 500;
  color: rgba(255,255,255,0.45);
  margin-top: 2px;
  white-space: nowrap;
}

/* 中心大数字 */
.hex-center {
  grid-area: CENTER;
  text-align: center;
  padding: 28px 16px;
  animation: s1-in 0.6s ease-out 0.1s both;
  width: 100%;
}
.hex-center:hover .hc-lbl { color: rgba(255,255,255,0.7); }
.hex-center:hover .hc-num { text-shadow: 0 0 24px rgba(255,255,255,0.15); }
.hc-num {
  font-size: 3.6rem; font-weight: 700;
  letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
  line-height: 1; color: #fff;
  display: inline;
  animation: h-float 5s ease-in-out 0s infinite;
}
.hc-suf {
  font-size: 1.3rem; font-weight: 600;
  color: rgba(255,255,255,0.45);
  margin-left: 4px;
  display: inline;
}
.hc-lbl {
  display: block;
  font-size: 1.2rem; font-weight: 500;
  color: rgba(255,255,255,0.4);
  margin-top: 6px;
}

@keyframes s1-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes s1-num-in {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes h-float {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-5px) scale(1.04); }
  50% { transform: translateY(0) scale(1); }
  75% { transform: translateY(4px) scale(0.96); }
}

@media (prefers-reduced-motion: reduce) {
  .s1-hero, .s1-cell { animation: none !important; opacity: 1 !important; }
  .s1-hero-num, .s1-num { animation: none !important; }
  .s1-cell:hover { transform: none !important; }
}

@keyframes g322-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes g322-num-in {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .g322-cell { animation: none !important; }
  .g322-num { animation: none !important; }
  .g322-cell:hover { filter: none; }
}

/* ═══ 登录卡片 — Glass ═══ */
.login-card {
  border-radius: 18px;
  min-height: 420px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.15);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  /* 兜底：不支持 backdrop-filter 时用更实底色 */
  @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
    background: rgba(255,255,255,0.25);
  }
  padding: 18px 16px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.2),
    0 8px 32px rgba(0,0,0,0.08);
  transition: box-shadow 0.3s, transform 0.3s;
}
.login-card:hover {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.25),
    0 12px 40px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}
</style>
