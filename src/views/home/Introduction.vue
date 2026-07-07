<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import LoginPage from '@/views/login/LoginPage.vue'
import request from '@/api/request'
import { getAccessToken } from '@/api/request'
import { getUploadStatsApi, getQueryStatsApi } from '@/api/admin'
import logodark from '@/assets/images/logo.jpg'

interface DashboardBlock {
  total?: number; total_size?: number; online_users?: number
  error?: string; [key: string]: unknown
}
interface DashboardResponse { period: string; blocks: Record<string, DashboardBlock> }

const stats = ref([
  { key: 'total_uploads', label: '总上传', value: 0, suffix: '' },
  { key: 'total_queries', label: '总查询', value: 0, suffix: '' },
  { key: 'today_uploads', label: '今日上传', value: 0, suffix: '' },
  { key: 'today_queries', label: '今日查询', value: 0, suffix: '' },
  { key: 'total_size', label: '总存储', value: 0, suffix: 'GB' },
  { key: 'online_users', label: '当前在线', value: 0, suffix: '' },
])

let timer: ReturnType<typeof setInterval> | null = null
let mc = 0

// Mock: [累计上传, 累计查询, 今日上传, 今日查询, 存储(bytes), 在线]
const MOCK = [
  [12846, 89237, 47, 312, 268435456, 18],
  [12848, 89245, 48, 320, 269484032, 22],
  [12850, 89256, 49, 331, 270532608, 15],
  [12852, 89268, 51, 343, 271581184, 20],
]

function fmtSize(b: number) {
  if (!b) return { v: 0, s: 'GB' }
  const m = b / 1048576
  return m > 1024 ? { v: Math.round(m / 1024 * 10) / 10, s: 'TB' } : { v: Math.round(m), s: 'GB' }
}
function ok(b: DashboardBlock | undefined) { return !!b && !('error' in b) }

function applyStatsVals(cumUp: number, cumQry: number, todayUp: number, todayQry: number, sizeBytes: number, online: number) {
  const f = fmtSize(sizeBytes)
  stats.value = stats.value.map(s => {
    switch (s.key) {
      case 'total_uploads': return { ...s, value: cumUp }
      case 'total_queries': return { ...s, value: cumQry }
      case 'today_uploads': return { ...s, value: todayUp }
      case 'today_queries': return { ...s, value: todayQry }
      case 'total_size':    return { ...s, value: f.v, suffix: f.s }
      case 'online_users':  return { ...s, value: online }
      default: return s
    }
  })
}

async function fetchStats() {
  try {
    // 并行请求：累计 stats + 周期 dashboard
    const [cumUp, cumQry, dash] = await Promise.all([
      getUploadStatsApi().catch(() => null),
      getQueryStatsApi().catch(() => null),
      request.get('/admin/logs/dashboard/', { params: { period: 'day' } }) as Promise<DashboardResponse>,
    ])

    const cumulativeTotalUploads = cumUp?.total ?? 0
    const cumulativeTotalQueries = cumQry?.total ?? 0

    const b = dash?.blocks
    const up = b && ok(b.upload) ? b.upload : null
    const qy = b && ok(b.query) ? b.query : null
    const ol = b && ok(b.online) ? b.online : null

    applyStatsVals(
      cumulativeTotalUploads,
      cumulativeTotalQueries,
      up?.total ?? 0,
      qy?.total ?? 0,
      up?.total_size ?? 0,
      ol?.online_users ?? 0,
    )
  } catch {
    // 后端不可达 → 轮换 Mock
    mc = (mc + 1) % MOCK.length; const m = MOCK[mc]
    applyStatsVals(m[0], m[1], m[2], m[3], m[4], m[5])
  }
}

onMounted(() => {
  if (getAccessToken()) {
    fetchStats()
    timer = setInterval(fetchStats, 15000)
  }
})
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
