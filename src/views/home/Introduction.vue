<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LoginPage from '@/views/login/LoginPage.vue'
import request from '@/api/request'
import logodark from '@/assets/images/logo2.jpg'
import heroBg from '@/assets/images/hero3.jpg'

/* 首页公开统计 v1.0 — GET /api/platform/stats/（AllowAny、完全不认证、无参数、全量累计）
   字段：users 用户总数 / storage_bytes 存储总量(字节) / docs 资料总数
        queries 查询总数 / avg_response_sec 平均响应时长(秒) / sensitive_blocks 敏感拦截 / logins 登录次数
   单项计算失败 → 该项为 null（其余照常）；整库不可用（全部为 null）→ HTTP 503 */
interface PublicStats {
  users: number | null
  storage_bytes: number | null
  docs: number | null
  queries: number | null
  avg_response_sec: number | null
  sensitive_blocks: number | null
  logins: number | null
}

/* ── 7 项统计指标（index 0~6）：存储总量为左上主打大数字，其余 6 项入次级网格 ── */
const stats = ref([
  { key: 'users',        label: '用户总数',   caption: '注册师生账号',        value: 0, suffix: '' },
  { key: 'storage',      label: '存储总量',   caption: '文档与附件占用空间',  value: 0, suffix: 'GB' },
  { key: 'docs',         label: '资料总数',   caption: '知识库收录文档',      value: 0, suffix: '' },
  { key: 'queries',      label: '查询总数',   caption: 'AI 问答累计次数',     value: 0, suffix: '' },
  { key: 'avg_resp',     label: '平均响应时长', caption: 'AI 问答平均响应时长', value: 0, suffix: 's' },
  { key: 'sensitive',    label: '敏感拦截',   caption: '命中敏感词拦截',      value: 0, suffix: '' },
  { key: 'logins',       label: '登录次数',   caption: '平台累计登录',        value: 0, suffix: '' },
])

/** 右上角口径标注：公开统计为全平台累计，无周期概念 */
const statPeriodLabel = '全平台累计'

// ── 数字滚动动画（尊重 prefers-reduced-motion） ──
const displayVals = ref<number[]>([])
let animFrame = 0

function animateNumbers(targets: number[]) {
  cancelAnimationFrame(animFrame)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayVals.value = targets
    return
  }
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
function applyStatsVals(users: number, sizeBytes: number, docs: number, queries: number, avgSec: number, sensitive: number, logins: number) {
  const f = fmtSize(sizeBytes)
  const vals = [users, f.v, docs, queries, avgSec, sensitive, logins]
  stats.value = stats.value.map((s, i) => ({ ...s, value: vals[i], suffix: i === 1 ? f.s : s.suffix }))
  animateNumbers([users, f.v, docs, queries, avgSec, sensitive, logins])
}

/** 统计数据状态：loading 加载中 / ready 已就绪 / error 获取失败 */
const statsState = ref<'loading' | 'ready' | 'error'>('loading')

async function fetchStats() {
  // 首页「平台数据概览」对所有人开放（含游客）：走独立公开接口 /api/platform/stats/
  // （公开白名单强制不携带 Token）。单项为 null 时按 0 展示其余照常；
  // 整库不可用返回 503 → 仅展示「加载失败」错误态
  try {
    const s = await request.get('/platform/stats/') as PublicStats
    applyStatsVals(
      s.users ?? 0,
      s.storage_bytes ?? 0,
      s.docs ?? 0,
      s.queries ?? 0,
      s.avg_response_sec ?? 0,
      s.sensitive_blocks ?? 0,
      s.logins ?? 0,
    )
    statsState.value = 'ready'
  } catch {
    statsState.value = 'error'
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<template>
  <div class="page-root">
    <!-- ═══ 背景图 + 原始黑色压层 ═══ -->
    <img :src="heroBg" alt="" class="bg-img" />
    <div class="bg-overlay" />

    <!-- ═══ Logo ═══ -->
    <header class="header-bar">
      <img :src="logodark" alt="成都东软学院" class="header-logo" />
    </header>

    <!-- ═══ 主体 ═══ -->
    <main class="main-area">
      <div class="page-grid">
        <!-- 标题区 -->
        <div class="hero-text">
          <h1 class="hero-title">NeuHub资源系统</h1>
          <p class="hero-desc">成都东软学院一站式智能知识库系统</p>
        </div>

        <!-- 左：平台数据概览（纯排版，中小屏自动隐藏） -->
        <div class="left-col">
          <section class="stats-panel" aria-label="平台数据概览">
            <div class="stats-head">
              <h2 class="stats-title">
                <span class="title-tick" aria-hidden="true"></span>平台数据概览
              </h2>
              <span class="stats-meta">{{ statPeriodLabel }} · 平台数据</span>
            </div>

            <template v-if="statsState === 'ready'">
              <!-- 主导指标：存储总量 -->
              <div class="stat-feature">
                <div class="stat-feature-main">
                  <span class="stat-feature-label">{{ stats[1].label }}</span>
                  <div class="stat-feature-value">
                    <span class="sf-num">{{ (displayVals[1] ?? 0).toLocaleString() }}</span>
                    <span class="sf-unit">{{ stats[1].suffix }}</span>
                  </div>
                </div>
                <span class="stat-feature-caption">{{ stats[1].caption }}</span>
              </div>

              <!-- 次级指标网格 -->
              <div class="stat-grid">
                <div v-for="i in [0, 2, 3, 4, 5, 6]" :key="stats[i].key" class="stat-cell">
                  <span class="stat-cell-num">
                    {{ (displayVals[i] ?? 0).toLocaleString() }}
                    <span v-if="stats[i].suffix" class="stat-cell-unit">{{ stats[i].suffix }}</span>
                  </span>
                  <span class="stat-cell-label">{{ stats[i].label }}</span>
                </div>
              </div>
            </template>

            <!-- 加载失败：明确提示，不静默显示 0 -->
            <div v-else-if="statsState === 'error'" class="stats-empty">
              <span class="stats-empty-text">统计数据加载失败，请稍后重试</span>
            </div>
          </section>
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
   首页 — 高校知识库 · 无面板纯排版
   关键视觉决策：
   - 背景保留原图黑色压层（rgba(0,0,0,0.35)）
   - 数据区无容器、无卡片、无边框：纯白排版直接落在压暗照片上，
     用文字投影保证可读；蓝撞蓝问题彻底消除
   - 层级完全由字号驱动：主导 3.4rem → 网格 1.7rem → 标签 0.8rem
   - 数字全部 tabular-nums，宽度稳定不跳动
   ═══════════════════════════════════════════ */

.page-root {
  /* ── 组件设计 Token（纯排版体系） ── */
  --st-radius-lg: 14px;                       /* 登录卡圆角 */
  --st-shadow-container: 0 24px 64px rgba(2, 10, 26, 0.45);  /* 登录卡投影 */
  --st-ink-1: #ffffff;
  --st-ink-2: rgba(255, 255, 255, 0.75);
  --st-ink-3: rgba(255, 255, 255, 0.55);
  --st-num-xl: clamp(2.4rem, 5.5vh, 3.4rem);  /* 主导指标数字 */
  --st-num-md: clamp(1.3rem, 2.8vh, 1.7rem);  /* 网格数字 */
  --st-num-sm: 1.1rem;                        /* 单位字号 */
  --st-label: 0.8rem;
  --st-caption: 0.75rem;
  --st-text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);  /* 照片上文字可读 */

  position: relative;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #fff;
  font-family: var(--font-sans, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif);
  -webkit-font-smoothing: antialiased;
  background-color: #081a36; /* 图片加载失败的兜底色 */
}
.bg-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
/* 原始黑色压层：保证整页白色内容可读 */
.bg-overlay {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.header-bar {
  position: relative; z-index: 10;
  display: flex; align-items: center;
  padding: 14px 28px;
}
.header-logo {
  height: 44px; width: auto;
  border-radius: 6px;
}

.main-area {
  position: relative; z-index: 10;
  flex: 1;
  padding: 6px 28px 28px;
  display: flex; align-items: center;
}

/* ── 页面栅格 ── */
.page-grid {
  width: 100%; max-width: 72rem; margin: 0 auto;
  display: grid; grid-template-columns: 1fr;
  gap: 1rem; align-items: start;
}
@media (min-width: 1024px) {
  .page-grid { grid-template-columns: repeat(5, 1fr); gap: clamp(1.5rem, 3.5vh, 2.5rem); align-items: center; }
}
.left-col { grid-column: span 3; }
.right-col { grid-column: span 2; align-self: center; }

/* ── Hero 文字 ── */
.hero-text {
  grid-column: 1 / -1;
  text-align: center;
  margin-bottom: clamp(0.5rem, 1.5vh, 1rem);
}
.hero-title {
  margin: 0;
  /* 更大、更重、更紧——大气主标题：桌面最大 4.5rem，窄屏随视口收紧 */
  font-size: clamp(2.4rem, 5.5vw, 4.5rem);
  font-weight: 800;
  letter-spacing: 0.03em; line-height: 1.12;
  color: #fff;
  text-shadow:
    0 2px 10px rgba(4, 14, 32, 0.45),
    0 14px 44px rgba(4, 14, 32, 0.35);
}
.hero-desc {
  margin: 18px auto 0;
  font-size: clamp(1rem, 1.5vw, 1.3rem);
  color: rgba(255, 255, 255, 0.86);
  letter-spacing: 0.05em;
  line-height: 1.7;
  max-width: 30rem;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
}

/* ═══ 平台数据概览 — 纯排版，无容器 ═══ */
.stats-panel {
  width: 100%;
}

.stats-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: clamp(20px, 4vh, 42px);
}
.stats-title {
  margin: 0;
  display: flex; align-items: center;
  font-size: 1.1rem; font-weight: 600;
  color: var(--st-ink-1); letter-spacing: 0.08em;
  text-shadow: var(--st-text-shadow);
}
/* 标题前白色刻度 —— 公文/政务标识，纯白体系 */
.title-tick {
  width: 4px; height: 16px;
  margin-right: 10px;
  border-radius: 2px;
  background: #fff; opacity: 0.9;
}
.stats-meta {
  font-size: var(--st-caption);
  color: var(--st-ink-2);
  letter-spacing: 0.02em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

/* ── 主导指标：存储总量 ── */
.stat-feature {
  display: flex; align-items: flex-end; gap: 16px;
  margin-bottom: clamp(22px, 4.5vh, 46px);
}
.stat-feature-main { display: flex; flex-direction: column; gap: 10px; }
.stat-feature-label {
  font-size: 0.9rem; font-weight: 500;
  color: var(--st-ink-2); letter-spacing: 0.08em;
  text-shadow: var(--st-text-shadow);
}
.stat-feature-value { display: inline-flex; align-items: baseline; }
.sf-num {
  font-size: var(--st-num-xl); font-weight: 700; line-height: 1;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: var(--st-ink-1);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}
.sf-unit {
  font-size: var(--st-num-sm); font-weight: 600;
  color: var(--st-ink-2);
  margin-left: 6px;
}
.stat-feature-caption {
  margin-left: auto;
  align-self: flex-end;
  font-size: var(--st-caption);
  color: var(--st-ink-3);
  letter-spacing: 0.02em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

/* ── 次级指标网格 ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(20px, 3.6vh, 36px) 12px;
}
.stat-cell {
  text-align: center;
  min-width: 0;
}
.stat-cell-num {
  display: block;
  font-size: var(--st-num-md); font-weight: 700; line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--st-ink-1);
  text-shadow: var(--st-text-shadow);
}
.stat-cell-unit {
  font-size: 0.85rem; font-weight: 600;
  color: var(--st-ink-2);
  margin-left: 4px;
}
.stat-cell-label {
  display: block;
  margin-top: 9px;
  font-size: var(--st-label);
  color: var(--st-ink-2);
  letter-spacing: 0.06em;
  text-shadow: var(--st-text-shadow);
}

/* 无权限/失败的空态 */
.stats-empty {
  padding: 40px 0;
  text-align: center;
}
.stats-empty-text {
  font-size: var(--st-label);
  color: var(--st-ink-2);
  letter-spacing: 0.04em;
  text-shadow: var(--st-text-shadow);
}

/* ═══ 登录卡 — 纯白实体卡 · 标准登录样式 ═══
   最小高度 ≥ 账号表单自然高度（约 555px），内容区纵向撑满：
   扫码视图填入同一高度，账号/扫码两模式外框恒定不变 */
.login-card {
  border-radius: var(--st-radius-lg);
  min-height: min(580px, calc(100dvh - 300px));
  overflow-y: auto;
  background: #fff;
  padding: 28px 26px;
  box-shadow: var(--st-shadow-container);
  display: flex;
  flex-direction: column;
}
/* 内容区撑满卡片：扫码视图在剩余高度中垂直居中，外框不因切换而变 */
.login-card :deep(.login-card-w) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ── 窄屏：隐藏统计模块，仅保留登录弹窗 ── */
@media (max-width: 1023.98px) {
  .left-col { display: none; }
  .right-col { grid-column: 1; justify-self: center; width: 100%; max-width: 460px; }
}

@media (max-width: 640px) {
  .main-area { padding: 4px 16px 20px; }
  .login-card { padding: 22px 18px; }
}
</style>
