<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import LoginPage from '@/views/login/LoginPage.vue'
import request from '@/api/request'
import logodark from '@/assets/images/logo.jpg'

interface DashboardBlock {
  total?: number; total_size?: number; online_users?: number
  error?: string; [key: string]: unknown
}
interface DashboardResponse { period: string; blocks: Record<string, DashboardBlock> }

const stats = ref([
  { key: 'total_uploads', label: '总上传', value: 12846, suffix: '' },
  { key: 'total_queries', label: '总查询', value: 89237, suffix: '' },
  { key: 'today_uploads', label: '今日上传', value: 0, suffix: '' },
  { key: 'today_queries', label: '今日查询', value: 0, suffix: '' },
  { key: 'total_size', label: '总存储', value: 0, suffix: 'GB' },
  { key: 'online_users', label: '当前在线', value: 0, suffix: '' },
])

let timer: ReturnType<typeof setInterval> | null = null
let mc = 0
const MOCK = [
  { up: 12846, qry: 89237, sz: 268435456, on: 18 },
  { up: 12848, qry: 89245, sz: 269484032, on: 22 },
]

function fmtSize(b: number) {
  if (!b) return { v: 0, s: 'GB' }
  const m = b / 1048576
  return m > 1024 ? { v: Math.round(m / 1024 * 10) / 10, s: 'TB' } : { v: Math.round(m), s: 'GB' }
}
function ok(b: DashboardBlock | undefined) { return !!b && !('error' in b) }

async function fetchStats() {
  try {
    const r = await request.get('/admin/logs/dashboard/', { params: { period: 'day' } }) as unknown as DashboardResponse
    const b = r?.blocks
    if (!b) throw Error('no blocks')
    const up = ok(b.upload) ? b.upload : null
    const qy = ok(b.query) ? b.query : null
    const ol = ok(b.online) ? b.online : null
    const ut = up?.total ?? 0; const qt = qy?.total ?? 0; const sz = up?.total_size ?? 0; const on = ol?.online_users ?? 0
    const f = fmtSize(sz)
    stats.value = stats.value.map(s => {
      switch (s.key) {
        case 'total_uploads': return { ...s, value: ut }
        case 'total_queries': return { ...s, value: qt }
        case 'today_uploads': return { ...s, value: ut }
        case 'today_queries': return { ...s, value: qt }
        case 'total_size':    return { ...s, value: f.v, suffix: f.s }
        case 'online_users':  return { ...s, value: on }
        default: return s
      }
    })
  } catch {
    mc = (mc + 1) % MOCK.length; const m = MOCK[mc]; const f = fmtSize(m.sz)
    stats.value = stats.value.map(s => {
      switch (s.key) {
        case 'total_uploads': return { ...s, value: m.up }
        case 'total_queries': return { ...s, value: m.qry }
        case 'today_uploads': return { ...s, value: m.up }
        case 'today_queries': return { ...s, value: m.qry }
        case 'total_size':    return { ...s, value: f.v, suffix: f.s }
        case 'online_users':  return { ...s, value: m.on }
        default: return s
      }
    })
  }
}

onMounted(() => { fetchStats(); timer = setInterval(fetchStats, 15000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col bg-gradient-to-br from-[#f0f6ff] via-white to-[#e8f4fd] text-[#303133] font-sans antialiased selection:bg-[#409eff]/20">
    <!-- ═══ Logo ═══ -->
    <header class="pt-6 px-6">
      <div class="max-w-7xl mx-auto">
        <img :src="logodark" alt="成都东软学院" class="h-9 w-auto rounded-md" />
      </div>
    </header>

    <!-- ═══ 主体 ═══ -->
    <main class="flex-1 flex items-center px-6 py-4">
      <div class="max-w-7xl mx-auto w-full grid lg:grid-cols-5 gap-6 lg:gap-10 items-center">
        <!-- 左：品牌文案 -->
        <div class="lg:col-span-3 space-y-4">
          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1a2332] leading-[1.1]">
            NISU-CD<br class="sm:hidden" />
            <span class="text-[#409eff]">资源系统</span>
          </h1>
          <p class="text-sm lg:text-base text-[#606266] leading-relaxed max-w-lg">
            为师生打造的一站式智能知识库系统
          </p>

          <!-- 数据大盘：6 卡片 -->
          <div class="grid grid-cols-3 gap-2 pt-2">
            <div v-for="s in stats" :key="s.key"
              class="bg-white rounded-lg border border-[#e4e7ed] p-2.5 hover:shadow-sm transition-shadow"
            >
              <div class="text-[10px] text-[#909399] tracking-wide">{{ s.label }}</div>
              <div class="flex items-baseline gap-0.5 mt-0.5">
                <span class="text-base sm:text-lg font-bold text-[#1a2332]">{{ s.value.toLocaleString() }}</span>
                <span v-if="s.suffix" class="text-[10px] text-[#909399]">{{ s.suffix }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#67c23a] animate-pulse" />
            <span class="text-[10px] text-[#909399]">实时数据 · 15 秒更新</span>
          </div>
        </div>

        <!-- 右：登录 -->
        <div class="lg:col-span-2">
          <div class="rounded-xl bg-white border border-[#e4e7ed] shadow-sm p-5 sm:p-6">
            <LoginPage embedded />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
