<script setup lang="ts">
// ── 封面页 Landing Page ──
// 设计：浅色学术风 + 实时数据大盘 + 嵌入式登录 + 滚动分段布局
import { ref, onMounted, onUnmounted } from 'vue'
import LoginPage from '@/views/login/LoginPage.vue'
import request from '@/api/request'

import logodark from '@/assets/images/logo.jpg'

// ── Dashboard API 类型 ──
interface DashboardBlock {
  total?: number
  total_size?: number
  online_users?: number
  error?: string
  [key: string]: unknown
}
interface DashboardResponse {
  period: string
  blocks: Record<string, DashboardBlock>
}

// ── 实时统计数据 ──
const stats = ref([
  { key: 'total_uploads', label: '总上传文件', value: 12846, icon: 'upload', suffix: '' },
  { key: 'total_queries', label: '总查询次数', value: 89237, icon: 'search', suffix: '' },
  { key: 'today_uploads', label: '今日上传', value: 0, icon: 'today_up', suffix: '' },
  { key: 'today_queries', label: '今日查询', value: 0, icon: 'today_qry', suffix: '' },
  { key: 'total_size', label: '总存储量', value: 0, icon: 'storage', suffix: 'GB' },
  { key: 'online_users', label: '当前在线', value: 0, icon: 'online', suffix: '' },
])

let timer: ReturnType<typeof setInterval> | null = null
let mockCounter = 0

// ── 工具：字节格式化 ──
function formatSize(bytes: number): { value: number; suffix: string } {
  if (!bytes) return { value: 0, suffix: 'GB' }
  const mb = bytes / 1048576
  if (mb > 1024) return { value: Math.round(mb / 1024 * 10) / 10, suffix: 'TB' }
  return { value: Math.round(mb), suffix: 'GB' }
}

// ── 工具：单块降级检查 ──
function blockOk(b: DashboardBlock | undefined): boolean {
  return !!b && !('error' in b)
}

// ── Mock 数据（后端不可达时使用） ──
const MOCK_DATA = [
  { up: 12846, qry: 89237, sz: 268435456, on: 18 },
  { up: 12848, qry: 89245, sz: 269484032, on: 22 },
  { up: 12850, qry: 89256, sz: 270532608, on: 15 },
  { up: 12852, qry: 89268, sz: 271581184, on: 20 },
]

async function fetchStats() {
  try {
    const res = await request.get('/admin/logs/dashboard/', { params: { period: 'day' } }) as unknown as DashboardResponse
    const blocks = res?.blocks
    if (!blocks) throw new Error('no blocks')

    const upload  = blockOk(blocks.upload)  ? blocks.upload  : null
    const query   = blockOk(blocks.query)   ? blocks.query   : null
    const online  = blockOk(blocks.online)  ? blocks.online  : null

    const upTotal = upload?.total ?? 0
    const qyTotal = query?.total ?? 0
    const size    = upload?.total_size ?? 0
    const onUsers = online?.online_users ?? 0

    const fmt = formatSize(size)

    stats.value = stats.value.map(s => {
      switch (s.key) {
        case 'total_uploads': return { ...s, value: upTotal }
        case 'total_queries': return { ...s, value: qyTotal }
        case 'today_uploads': return { ...s, value: upTotal }
        case 'today_queries': return { ...s, value: qyTotal }
        case 'total_size':    return { ...s, value: fmt.value, suffix: fmt.suffix }
        case 'online_users':  return { ...s, value: onUsers }
        default: return s
      }
    })
  } catch {
    // 后端不可达 → 轮换 Mock 数据模拟实时更新
    mockCounter = (mockCounter + 1) % MOCK_DATA.length
    const m = MOCK_DATA[mockCounter]
    const fmt = formatSize(m.sz)
    stats.value = stats.value.map(s => {
      switch (s.key) {
        case 'total_uploads': return { ...s, value: m.up }
        case 'total_queries': return { ...s, value: m.qry }
        case 'today_uploads': return { ...s, value: m.up }
        case 'today_queries': return { ...s, value: m.qry }
        case 'total_size':    return { ...s, value: fmt.value, suffix: fmt.suffix }
        case 'online_users':  return { ...s, value: m.on }
        default: return s
      }
    })
  }
}

onMounted(() => {
  fetchStats()
  timer = setInterval(fetchStats, 15000)
  window.addEventListener('scroll', onScroll, { passive: true })

  // Scroll reveal
  const rev = document.querySelectorAll('.reveal')
  if (rev.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target) }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' })
    rev.forEach(el => io.observe(el))
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('scroll', onScroll)
})

// ── 滚动状态 ──
const scrolled = ref(false)
const loginBounce = ref(false)

function onScroll() { scrolled.value = window.scrollY > 60 }

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function jumpToLogin() {
  loginBounce.value = true
  setTimeout(() => { loginBounce.value = false }, 500)
}

</script>

<template>
  <div class="bg-[#f5f7fa] text-[#303133] font-sans antialiased selection:bg-[#409eff]/20">
    <!-- ═══ 导航栏 ═══ -->
    <header
      class="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      :class="scrolled ? 'bg-white/95 backdrop-blur-lg shadow-sm' : 'bg-transparent'"
    >
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" @click="scrollTo('hero')">
          <img :src="logodark" alt="成都东软学院" class="h-8 w-auto rounded-md" />
        </div>
        <nav class="hidden sm:flex items-center gap-1">
          <button class="px-4 py-2 text-sm text-[#606266] hover:text-[#409eff] transition-colors rounded-lg hover:bg-[#409eff]/5" @click="scrollTo('stats')">数据大盘</button>
          <button
            class="ml-3 px-5 py-2 text-sm font-semibold rounded-lg bg-[#409eff] text-white hover:bg-[#3a8ee6] shadow-sm active:scale-[0.97] transition-all duration-200"
            @click="scrollTo('login-section')"
          >登录系统</button>
        </nav>
        <button class="sm:hidden p-2 text-[#606266] hover:text-[#409eff]" @click="scrollTo('login-section')">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    </header>

    <!-- ═══ HERO ═══ -->
    <section id="hero" class="relative pt-16 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-[#409eff]/5 via-white to-[#e8f4fd]/50 pointer-events-none" />
      <div class="relative max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div class="grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          <!-- 品牌文案 -->
          <div class="lg:col-span-3 space-y-6 reveal visible">
            <div>
              <p class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#409eff]/10 text-[#409eff] text-xs font-medium mb-5">
                NISU-CD 资源系统
              </p>
              <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#1a2332] leading-[1.1]">
                NISU-CD<br class="hidden sm:block" />
                <span class="text-[#409eff]">资源系统</span>
              </h1>
              <p class="mt-5 text-base lg:text-lg text-[#606266] leading-relaxed max-w-xl">
                为师生打造的一站式智能知识库系统，让课件、论文、行政文档的检索与问答更加高效
              </p>
            </div>
            <div class="flex flex-wrap gap-4">
              <button
                class="px-8 py-3.5 rounded-lg bg-[#409eff] text-white font-semibold text-base shadow-md shadow-[#409eff]/20 hover:shadow-lg hover:shadow-[#409eff]/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all duration-200"
                @click="jumpToLogin"
              >
                开始使用
                <svg class="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

          <!-- 登录区 -->
          <div id="login-section" class="lg:col-span-2 reveal" style="transition-delay: 200ms">
            <div class="rounded-xl bg-white border border-[#e4e7ed] shadow-sm p-6 sm:p-8" :class="{ 'animate-bounce-in': loginBounce }">
              <LoginPage embedded />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 实时数据大盘 ═══ -->
    <section id="stats" class="max-w-7xl mx-auto px-6 -mt-6 pb-8 scroll-mt-24">
      <div class="reveal visible">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[#67c23a] animate-pulse" />
            <span class="text-xs text-[#909399] font-medium">实时数据 · 每 15 秒更新</span>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            v-for="(stat, i) in stats"
            :key="stat.key"
            class="bg-white rounded-xl border border-[#e4e7ed] p-4 lg:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            :style="{ transitionDelay: `${i * 60}ms` }"
          >
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-[#409eff]/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-[#409eff]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
              </div>
              <span class="text-[11px] text-[#909399] font-medium tracking-wide">{{ stat.label }}</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl lg:text-3xl font-bold text-[#1a2332] tracking-tight">{{ stat.value.toLocaleString() }}</span>
              <span v-if="stat.suffix" class="text-xs text-[#909399] font-medium">{{ stat.suffix }}</span>
            </div>
            <div class="mt-1 h-0.5 rounded-full bg-[#e4e7ed] overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-1000"
                :class="i < 2 ? 'bg-[#409eff]' : i < 4 ? 'bg-[#67c23a]' : 'bg-[#e6a23c]'"
                :style="{ width: Math.min(100, (stat.value / (i < 2 ? 100000 : i < 4 ? 500 : 50)) * 100) + '%' }"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ Footer ═══ -->
    <footer class="py-10 bg-[#1a2332]">
      <div class="max-w-7xl mx-auto px-6 text-center">
        <p class="text-white/40 text-xs">NISU-CD 资源系统</p>
        <p class="mt-5 text-white/20 text-[11px] border-t border-white/10 pt-5">&copy; 2026 NISU-CD</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Scroll reveal ── */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}

/* ── Login bounce animation ── */
.animate-bounce-in {
  animation: bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes bounce-in {
  0% { transform: scale(1); }
  30% { transform: scale(1.03); }
  60% { transform: scale(0.98); }
  100% { transform: scale(1); }
}
</style>
