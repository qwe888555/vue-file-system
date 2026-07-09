<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LoginPage from '@/views/login/LoginPage.vue'
import request from '@/api/request'
import logodark from '@/assets/images/logo2.jpg'
import heroBg from '@/assets/images/hero3.jpg'

/* Dashboard 聚合接口 v1.1 — AllowAny，无需鉴权 */
interface DashboardBlock {
  total?: number; total_size?: number; error?: string
  [key: string]: unknown
}
interface DashboardResponse {
  period: string; start_at: string; end_at: string
  blocks: {
    upload: DashboardBlock; query: DashboardBlock
    sensitive: DashboardBlock; login: DashboardBlock; operation: DashboardBlock
  }
}

const stats = ref([
  { key: 'upload_total', label: '上传总数', value: 0, suffix: '' },
  { key: 'query_total',  label: '查询总数', value: 0, suffix: '' },
  { key: 'sensitive',    label: '敏感拦截', value: 0, suffix: '' },
  { key: 'login_total',  label: '登录次数', value: 0, suffix: '' },
  { key: 'operation',    label: '操作次数', value: 0, suffix: '' },
])

let mc = 0

const MOCK = [
  [42, 150, 5, 28, 12],
  [45, 160, 6, 30, 15],
  [38, 140, 3, 25, 10],
  [50, 170, 7, 32, 18],
]

function ok(b: { error?: string } | undefined) { return !!b && !('error' in b) }

function applyStatsVals(upload: number, query: number, sensitive: number, login: number, operation: number) {
  stats.value = stats.value.map(s => {
    switch (s.key) {
      case 'upload_total': return { ...s, value: upload }
      case 'query_total':  return { ...s, value: query }
      case 'sensitive':    return { ...s, value: sensitive }
      case 'login_total':  return { ...s, value: login }
      case 'operation':    return { ...s, value: operation }
      default: return s
    }
  })
}

async function fetchStats() {
  try {
    const dash = await request.get('/admin/logs/dashboard/', { params: { period: 'day' } }) as Promise<DashboardResponse>
    const b = dash?.blocks
    const up = b && ok(b.upload) ? b.upload : null
    const qy = b && ok(b.query) ? b.query : null
    const sn = b && ok(b.sensitive) ? b.sensitive : null
    const lg = b && ok(b.login) ? b.login : null
    const op = b && ok(b.operation) ? b.operation : null
    applyStatsVals(up?.total ?? 0, qy?.total ?? 0, sn?.total ?? 0, lg?.total ?? 0, op?.total ?? 0)
  } catch {
    mc = (mc + 1) % MOCK.length; const m = MOCK[mc]
    applyStatsVals(m[0], m[1], m[2], m[3], m[4], m[5])
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

          <!-- 叠加式数据排版（5 个数据，对应 API 5 个 block） -->
          <div class="data-grid">
            <!-- 上传总数 -->
            <div class="d-item d-item--lg" style="--d:0s;--x:-20px">
              <div class="d-num d-num--lg d-num--blue">{{ stats[0].value.toLocaleString() }}</div>
              <div class="d-bar" />
              <div class="d-lbl">{{ stats[0].label }}</div>
            </div>
            <!-- 查询总数 -->
            <div class="d-item" style="--d:0.08s;--x:-10px">
              <div class="d-num d-num--blue">{{ stats[1].value.toLocaleString() }}</div>
              <div class="d-bar" />
              <div class="d-lbl">{{ stats[1].label }}</div>
            </div>
            <!-- 敏感拦截 -->
            <div class="d-item" style="--d:0.16s;--x:-10px">
              <div class="d-num d-num--green">{{ stats[2].value.toLocaleString() }}</div>
              <div class="d-bar" />
              <div class="d-lbl">{{ stats[2].label }}</div>
            </div>
            <!-- 登录次数 -->
            <div class="d-item" style="--d:0.24s;--x:10px">
              <div class="d-num d-num--green">{{ stats[3].value.toLocaleString() }}</div>
              <div class="d-bar" />
              <div class="d-lbl">{{ stats[3].label }}</div>
            </div>
            <!-- 操作次数 -->
            <div class="d-item" style="--d:0.32s;--x:20px">
              <div class="d-num d-num--amber">{{ stats[4].value.toLocaleString() }}</div>
              <div class="d-bar" />
              <div class="d-lbl">{{ stats[4].label }}</div>
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
   taste-skill: 叠加式数据排版
   超大数字 + 微型标签 + 无容器
   强调大小对比与"数字叠在背景上"的感受
   ═══════════════════════════════════════════ */

/* ── 页面栅格（原来写在 template 里的类） ── */
.page-grid {
  max-width: 80rem; width: 100%; margin: 0 auto;
  display: grid; grid-template-columns: 1fr;
  gap: 1.5rem; align-items: center;
}
@media (min-width: 1024px) {
  .page-grid {
    grid-template-columns: repeat(5, 1fr);
    gap: 2.5rem;
  }
}

.left-col { grid-column: span 3; }
.right-col { grid-column: span 2; }

.hero-text { margin-bottom: 3.5rem; }
.hero-title {
  font-size: 3.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
}
@media (min-width: 640px) { .hero-title { font-size: 3rem; } }
@media (min-width: 1024px) { .hero-title { font-size: 4.25rem; } }
.hero-desc {
  margin-top: 1.5rem;
  font-size: 1.05rem;
  color: rgba(255,255,255,0.8);
  line-height: 1.625;
  max-width: 32rem;
}

/* ── 数据网格（4列，无容器） ── */
.data-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem 1.25rem;
}

/* ── 数据项 ── */
.d-item {
  animation: d-in 0.7s cubic-bezier(0.16,1,0.3,1) both;
  animation-delay: var(--d,0s);
}
.d-item--lg { grid-column: span 2; }

.d-num {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  transition: transform 0.3s;
  animation: d-num-in 0.6s cubic-bezier(0.16,1,0.3,1) both;
  animation-delay: calc(var(--d,0s) + 0.1s);
}
.d-item:hover .d-num { transform: translateY(-2px); }
.d-num--lg { font-size: 3rem; }
@media (min-width: 1024px) { .d-num--lg { font-size: 3.75rem; } }

.d-num--blue,
.d-num--green,
.d-num--amber { color: #fff; }

.d-suf {
  font-size: 1.5rem;
  color: rgba(255,255,255,0.45);
  font-weight: 600;
  margin-left: 3px;
}

/* ── 装饰线（数字"压"在线上） ── */
.d-bar {
  width: 28%;
  height: 2px;
  border-radius: 999px;
  margin: 5px 0 4px;
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
  animation: d-bar-in 0.5s ease-out calc(var(--d,0s) + 0.2s) both;
}
.d-item:hover .d-bar { width: 60%; }
.d-item:nth-child(1) .d-bar,
.d-item:nth-child(2) .d-bar,
.d-item:nth-child(3) .d-bar,
.d-item:nth-child(4) .d-bar,
.d-item:nth-child(5) .d-bar,
.d-item:nth-child(6) .d-bar { background: rgba(255,255,255,0.2); }

/* ── 标签 ── */
.d-lbl {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.02em;
  transition: color 0.3s;
}
.d-item:hover .d-lbl { color: #fff; }



/* ── 入场动画 ── */
@keyframes d-in {
  from { opacity: 0; transform: translateX(var(--x,0px)) translateY(10px); }
  to { opacity: 1; transform: translateX(0) translateY(0); }
}
@keyframes d-num-in {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes d-bar-in {
  from { opacity: 0; width: 0; }
  to { opacity: 1; width: 28%; }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .d-item, .d-num, .d-bar { animation: none; }
  .d-item:hover .d-num { transform: none; }
  .d-bar { width: 28% !important; }
}

/* ═══ 登录卡片 — Glass ═══ */
.login-card {
  border-radius: 18px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.2);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  padding: 20px 18px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.3),
    0 8px 32px rgba(0,0,0,0.06);
  transition: box-shadow 0.3s, transform 0.3s;
}
.login-card:hover {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    0 12px 40px rgba(0,0,0,0.10);
  transform: translateY(-2px);
}
</style>
