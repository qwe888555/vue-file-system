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

let mc = 0

const MOCK = [
  [1234, 524288000, 42, 150, 5, 28, 12],
  [1240, 534288000, 45, 160, 6, 30, 15],
  [1228, 514288000, 38, 140, 3, 25, 10],
  [1250, 544288000, 50, 170, 7, 32, 18],
]

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
  stats.value = stats.value.map(s => {
    switch (s.key) {
      case 'users_total':   return { ...s, value: users }
      case 'total_storage': return { ...s, value: f.v, suffix: f.s }
      case 'upload_total':  return { ...s, value: upload }
      case 'query_total':   return { ...s, value: query }
      case 'sensitive':     return { ...s, value: sensitive }
      case 'login_total':   return { ...s, value: login }
      case 'operation':     return { ...s, value: operation }
      default: return s
    }
  })
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
  } catch {
    mc = (mc + 1) % MOCK.length; const m = MOCK[mc]
    applyStatsVals(m[0], m[1], m[2], m[3], m[4], m[5], m[6])
  }
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
    <header class="relative z-10 pt-6 px-6">
      <div class="max-w-7xl mx-auto">
        <img :src="logodark" alt="成都东软学院" class="h-16 w-auto rounded-md" />
      </div>
    </header>

    <!-- ═══ 主体 ═══ -->
    <main class="relative z-10 flex-1 flex items-center px-6 pt-2 pb-4">
      <div class="page-grid">
        <!-- 左：品牌文案 + 数据 -->
        <div class="left-col">
          <div class="hero-text">
            <h1 class="hero-title">
              NISU-CD资源系统<br class="sm:hidden" />
            </h1>
            <p class="hero-desc">成都东软学院一站式智能知识库系统</p>
          </div>

          <!-- 方案一：Hero + 3x2 网格 -->
          <div class="s1-layout">
            <div class="s1-hero" style="--d:0s">
              <span class="s1-hero-num">{{ stats[1].value.toLocaleString() }}</span>
              <span class="s1-hero-suf">{{ stats[1].suffix }}</span>
              <span class="s1-hero-lbl">{{ stats[1].label }}</span>
            </div>
            <div class="s1-grid">
              <div class="s1-cell" style="--d:0.12s">
                <span class="s1-num">{{ stats[0].value.toLocaleString() }}</span>
                <span class="s1-lbl">{{ stats[0].label }}</span>
              </div>
              <div class="s1-cell" style="--d:0.2s">
                <span class="s1-num">{{ stats[2].value.toLocaleString() }}</span>
                <span class="s1-lbl">{{ stats[2].label }}</span>
              </div>
              <div class="s1-cell" style="--d:0.28s">
                <span class="s1-num">{{ stats[3].value.toLocaleString() }}</span>
                <span class="s1-lbl">{{ stats[3].label }}</span>
              </div>
              <div class="s1-cell" style="--d:0.36s">
                <span class="s1-num">{{ stats[4].value.toLocaleString() }}</span>
                <span class="s1-lbl">{{ stats[4].label }}</span>
              </div>
              <div class="s1-cell" style="--d:0.44s">
                <span class="s1-num">{{ stats[5].value.toLocaleString() }}</span>
                <span class="s1-lbl">{{ stats[5].label }}</span>
              </div>
              <div class="s1-cell" style="--d:0.52s">
                <span class="s1-num">{{ stats[6].value.toLocaleString() }}</span>
                <span class="s1-lbl">{{ stats[6].label }}</span>
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
  max-width: 80rem; width: 100%; margin: 0 auto;
  display: grid; grid-template-columns: 1fr;
  gap: 1.5rem; align-items: center;
}
@media (min-width: 1024px) {
  .page-grid { grid-template-columns: repeat(5, 1fr); gap: 2.5rem; }
}
.left-col { grid-column: span 3; }
.right-col { grid-column: span 2; }

/* ── Hero 文字 ── */
.hero-text { margin-bottom: 4rem; }
.hero-title {
  font-size: 2.8rem; font-weight: 700;
  letter-spacing: -0.025em; line-height: 1.15;
}
@media (min-width: 640px) { .hero-title { font-size: 3rem; } }
@media (min-width: 1024px) { .hero-title { font-size: 3.5rem; } }
.hero-desc {
  margin-top: 0.75rem; font-size: 0.95rem;
  color: rgba(255,255,255,0.7); line-height: 1.6; max-width: 28rem;
}

/* ═══ 方案一：Hero + 3x2 网格 ═══ */
.s1-layout {
  display: flex; flex-direction: column;
  gap: 2.2rem;
  padding: 4px 0;
}

.s1-hero {
  animation: s1-in 0.6s ease-out both;
  animation-delay: calc(var(--d,0s) + 0.1s);
}
.s1-hero-num {
  font-size: 3.2rem; font-weight: 700;
  letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
  line-height: 1; color: #fff;
  display: inline-block;
  animation: s1-num-in 0.5s cubic-bezier(0.16,1,0.3,1) calc(var(--d,0s) + 0.2s) both,
             s1-sway 3.5s ease-in-out calc(var(--d,0s) + 1.5s) infinite;
}
.s1-hero-suf {
  font-size: 1.2rem; font-weight: 600;
  color: rgba(255,255,255,0.45);
  margin-left: 4px;
}
.s1-hero-lbl {
  display: block;
  font-size: 0.85rem; font-weight: 500;
  color: rgba(255,255,255,0.4);
  margin-top: 6px;
}

.s1-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.6rem 2rem;
}
.s1-cell {
  animation: s1-in 0.5s ease-out both;
  animation-delay: var(--d,0s);
  transition: transform 0.3s;
}
.s1-cell:hover { transform: translateY(-3px); }

.s1-num {
  display: inline-block;
  font-size: 2rem; font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1; color: #fff;
  animation: s1-num-in 0.4s cubic-bezier(0.16,1,0.3,1) calc(var(--d,0s) + 0.1s) both,
             s1-sway 3s ease-in-out calc(var(--d,0s) + 1.5s) infinite;
}
.s1-lbl {
  display: block;
  font-size: 0.75rem; font-weight: 500;
  color: rgba(255,255,255,0.35);
  margin-top: 2px;
  white-space: nowrap;
}

@keyframes s1-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes s1-num-in {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes s1-sway {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1) rotate(0.8deg); }
  75% { transform: scale(1) rotate(-0.8deg); }
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
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.15);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
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
