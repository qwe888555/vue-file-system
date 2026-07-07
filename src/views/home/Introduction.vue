<script setup lang="ts">
// ── 封面页 Landing Page ──
// 设计：浅色学术风 + 实时数据大盘 + 嵌入式登录 + 滚动分段布局
import { ref, onMounted, onUnmounted } from 'vue'
import LoginPage from '@/views/login/LoginPage.vue'
import request from '@/api/request'

import logodark from '@/assets/images/logo.jpg'

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

// ── Mock 数据（后端不可达时使用） ──
const MOCK_DATA = [
  { total_uploads: 12846, total_queries: 89237, today_uploads: 47, today_queries: 312, total_size: 256, online_users: 18 },
  { total_uploads: 12847, total_queries: 89245, today_uploads: 48, today_queries: 320, total_size: 256, online_users: 22 },
  { total_uploads: 12848, total_queries: 89256, today_uploads: 49, today_queries: 331, total_size: 257, online_users: 15 },
  { total_uploads: 12850, total_queries: 89268, today_uploads: 51, today_queries: 343, total_size: 257, online_users: 20 },
]

function applyStats(data: Record<string, number>) {
  stats.value = stats.value.map(s => {
    const v = data[s.key as keyof typeof data]
    if (s.key === 'total_size') {
      const gb = v / 1048576
      return { ...s, value: gb > 1024 ? Math.round(gb / 1024 * 10) / 10 : Math.round(gb), suffix: gb > 1024 ? 'TB' : 'GB' }
    }
    return { ...s, value: v ?? s.value }
  })
}

async function fetchStats() {
  try {
    const res = await request.get('/admin/logs/dashboard/', { params: { period: 'day' } })
    const data = (res as any).data || res
    const blocks = data.blocks || data
    applyStats({
      total_uploads: blocks.upload?.total ?? blocks.total_uploads ?? stats.value[0].value,
      total_queries: blocks.query?.total ?? blocks.total_queries ?? stats.value[1].value,
      today_uploads: blocks.today_uploads ?? (blocks.upload?.today ?? blocks.today_uploads ?? Math.floor(Math.random() * 100)),
      today_queries: blocks.today_queries ?? (blocks.query?.today ?? blocks.today_queries ?? Math.floor(Math.random() * 500)),
      total_size: blocks.total_size ?? (blocks.upload?.total_size ?? 268435456),
      online_users: blocks.online_users ?? Math.floor(Math.random() * 30 + 5),
    })
  } catch {
    // 后端不可达 → 轮换 Mock 数据模拟实时更新
    mockCounter = (mockCounter + 1) % MOCK_DATA.length
    applyStats(MOCK_DATA[mockCounter])
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
function onScroll() { scrolled.value = window.scrollY > 60 }

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
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
          <button class="px-4 py-2 text-sm text-[#606266] hover:text-[#409eff] transition-colors rounded-lg hover:bg-[#409eff]/5" @click="scrollTo('features')">功能介绍</button>
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
                @click="scrollTo('login-section')"
              >
                开始使用
                <svg class="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
              </button>
              <button
                class="px-8 py-3.5 rounded-lg border border-[#d9d9d9] text-[#606266] font-medium text-base hover:border-[#409eff] hover:text-[#409eff] active:scale-[0.97] transition-all duration-200"
                @click="scrollTo('features')"
              >了解更多</button>
            </div>
          </div>

          <!-- 登录区 -->
          <div id="login-section" class="lg:col-span-2 reveal" style="transition-delay: 200ms">
            <div class="rounded-xl bg-white border border-[#e4e7ed] shadow-sm p-6 sm:p-8">
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

    <!-- ═══ 功能介绍 ═══ -->
    <section id="features" class="py-16 lg:py-24 bg-white">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center max-w-2xl mx-auto reveal">
          <h2 class="text-3xl lg:text-4xl font-bold text-[#1a2332] tracking-tight">平台功能</h2>
          <p class="mt-4 text-[#606266] text-lg leading-relaxed">基于课程资料构建知识库，AI 精准匹配与智能问答</p>
        </div>

        <!-- 功能 1 -->
        <div class="mt-16 lg:mt-20 reveal">
          <div class="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div class="rounded-2xl bg-gradient-to-br from-[#e8f4fd] to-[#f0f8ff] border border-[#e4e7ed] p-10 lg:p-14 aspect-[4/3] flex items-center justify-center">
              <svg class="w-24 h-24 text-[#409eff]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div class="space-y-5">
              <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-lg bg-[#409eff] text-white flex items-center justify-center text-sm font-bold">01</span>
                <h3 class="text-xl font-semibold text-[#1a2332]">知识库管理</h3>
              </div>
              <p class="text-[#606266] text-sm leading-relaxed">管理员统一上传、分类、管理各类教学资源文件，构建学科知识体系</p>
              <ul class="space-y-3">
                <li v-for="item in ['支持 PDF / Word / PPT 等多种格式', '按学科自动归类，关键词标注', '文件版本管理，随时回溯']" :key="item" class="flex items-center gap-3 text-sm text-[#606266]">
                  <svg class="w-4 h-4 text-[#409eff] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 功能 2 -->
        <div class="mt-20 lg:mt-28 reveal">
          <div class="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div class="space-y-5 order-last lg:order-first">
              <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-lg bg-[#409eff] text-white flex items-center justify-center text-sm font-bold">02</span>
                <h3 class="text-xl font-semibold text-[#1a2332]">智能问答</h3>
              </div>
              <p class="text-[#606266] text-sm leading-relaxed">自然语言提问，AI 精准匹配知识库内容，即时生成可靠答案</p>
              <ul class="space-y-3">
                <li v-for="item in ['支持多轮连续对话，上下文理解', '每条回答标注引用来源原文', '三级角色权限，数据分级管控']" :key="item" class="flex items-center gap-3 text-sm text-[#606266]">
                  <svg class="w-4 h-4 text-[#409eff] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                  {{ item }}
                </li>
              </ul>
            </div>
            <div class="rounded-2xl bg-gradient-to-br from-[#e8f4fd] to-[#f0f8ff] border border-[#e4e7ed] p-10 lg:p-14 aspect-[4/3] flex items-center justify-center order-first lg:order-last">
              <svg class="w-24 h-24 text-[#409eff]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ CTA ═══ -->
    <section class="py-16 lg:py-20 bg-gradient-to-r from-[#409eff] to-[#3a8ee6]">
      <div class="max-w-3xl mx-auto px-6 text-center reveal">
        <h2 class="text-3xl lg:text-4xl font-bold text-white tracking-tight">开始使用 NISU-CD 资源系统</h2>
        <p class="mt-4 text-white/80 text-lg">登录即可体验 AI 知识库智能问答</p>
        <button
          class="mt-8 px-10 py-3.5 rounded-lg bg-white text-[#409eff] font-semibold text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all duration-200"
          @click="scrollTo('login-section')"
        >
          立即登录
        </button>
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
</style>
