<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'
import LogList from '@/components/logs/loglist.vue'

type TabType = 'dashboard' | 'upload' | 'query' | 'sensitive' | 'login' | 'operation'
const activeTab = ref<TabType>('dashboard')
const loadedTabs = ref<Set<string>>(new Set(['dashboard']))

function onTabClick(key: TabType) {
  activeTab.value = key
  loadedTabs.value.add(key)
}

// ── Dashboard ──
const dashboardData = ref<any>(null)
const dashboardPeriod = ref<'day' | 'week' | 'month'>('day')

/** 概览周期 Tab 选项：切换后整页统计口径随之刷新 */
const periodOptions: Array<{ value: 'day' | 'week' | 'month'; label: string }> = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
]

async function fetchDashboard() {
  try {
    const res = await request.get('/admin/logs/dashboard/', { params: { period: dashboardPeriod.value } })
    dashboardData.value = res
  } catch (e: any) {
    if (e?.response?.status !== 404) ElMessage.error('获取 Dashboard 失败')
    dashboardData.value = { blocks: {} }
  }
  // 概览「登录」块对接独立统计接口；dashboard 登录聚合异常时先置为加载态，避免闪现"数据获取失败"
  const login = dashboardData.value?.blocks?.login
  if (login && login.error) {
    dashboardData.value = {
      ...dashboardData.value,
      blocks: { ...dashboardData.value.blocks, login: { loading: true } },
    }
  }
  fetchLoginBlock()
}

/** 登录块数据来源：dashboard 登录聚合正常时优先用其周期数据，异常/缺失时回退独立统计接口 */
async function fetchLoginBlock() {
  try {
    const s = await request.get('/admin/logs/login/stats/')
    if (!s || !dashboardData.value) return
    const blocks = dashboardData.value.blocks || {}
    const login = blocks.login
    // dashboard 登录块有周期数据（total 非空且无 error）→ 以 dashboard 为准
    if (login && !login.error && login.total != null) return
    blocks.login = {
      total: s.total ?? 0,
      success_count: s.success_count ?? 0,
      fail_count: s.fail_count ?? 0,
    }
    dashboardData.value = { ...dashboardData.value, blocks }
  } catch {
    // 独立接口也失败时恢复错误态，避免一直停留在"加载中"
    if (dashboardData.value) {
      const blocks = dashboardData.value.blocks || {}
      blocks.login = { error: true }
      dashboardData.value = { ...dashboardData.value, blocks }
    }
  }
}

function hasError(block: any) { return block && block.error }

onMounted(() => { fetchDashboard() })
watch(dashboardPeriod, () => { fetchDashboard() })

const logTabs = [
  { key: 'upload', label: '上传日志', endpoint: '/admin/logs/upload/', stats: '/admin/logs/upload/stats/' },
  { key: 'query', label: '查询日志', endpoint: '/admin/logs/query/', stats: '/admin/logs/query/stats/' },
  { key: 'sensitive', label: '敏感内容', endpoint: '/admin/logs/sensitive/', stats: null },
  { key: 'login', label: '登录日志', endpoint: '/admin/logs/login/', stats: '/admin/logs/login/stats/' },
  { key: 'operation', label: '操作日志', endpoint: '/admin/logs/operation/', stats: '/admin/logs/operation/stats/' },
]
</script>

<template>
  <div class="log-page">
    <h2 class="log-title">日志管理</h2>

    <!-- 选项卡 -->
    <div class="log-tabs">
      <button :class="{ active: activeTab === 'dashboard' }" @click="onTabClick('dashboard')">概览</button>
      <button v-for="tab in logTabs" :key="tab.key" :class="{ active: activeTab === tab.key }" @click="onTabClick(tab.key as TabType)">{{ tab.label }}</button>
    </div>

    <!-- ══════ 概览 Dashboard ══════ -->
    <div v-if="activeTab === 'dashboard'" class="db-wrap">
      <!-- 周期 Tab 栏：今天/本周/本月，点击切换整页统计口径 -->
      <div class="db-period" role="tablist" aria-label="统计周期">
        <button
          v-for="p in periodOptions"
          :key="p.value"
          role="tab"
          :aria-selected="dashboardPeriod === p.value"
          :class="{ active: dashboardPeriod === p.value }"
          @click="dashboardPeriod = p.value"
        >
          {{ p.label }}
        </button>
      </div>
      <div v-if="!dashboardData" class="db-empty">加载中...</div>
      <div v-else class="db-blocks">
        <div v-for="(block, name) in dashboardData.blocks" :key="name" class="db-block">
          <h4>{{ { upload: '上传', query: '查询', sensitive: '敏感内容', login: '登录', operation: '操作' }[name] || name }}</h4>
          <div v-if="hasError(block)" class="db-error">数据获取失败</div>
          <div v-else-if="block.loading" class="db-error">加载中...</div>
          <div v-else class="db-stats">
            <div class="db-stat"><span>总数</span><strong>{{ block.total ?? 0 }}</strong></div>
            <div v-if="block.total_size != null" class="db-stat"><span>总大小</span><strong>{{ (block.total_size / 1048576).toFixed(1) }}MB</strong></div>
            <div v-if="block.avg_response_ms != null" class="db-stat"><span>平均响应</span><strong>{{ block.avg_response_ms }}ms</strong></div>
            <div v-if="block.like_rate != null" class="db-stat"><span>点赞率</span><strong>{{ (block.like_rate * 100).toFixed(1) }}%</strong></div>
            <div v-if="block.success_count != null" class="db-stat"><span>成功</span><strong>{{ block.success_count }}</strong></div>
            <div v-if="block.fail_count != null" class="db-stat"><span>失败</span><strong>{{ block.fail_count }}</strong></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ 各 Tab 内容 ══════ -->
    <template v-for="t in logTabs" :key="t.key">
      <LogList
        v-if="loadedTabs.has(t.key)"
        v-show="activeTab === t.key"
        :tab="t.key"
        :endpoint="t.endpoint"
        :stats-endpoint="t.stats"
      />
    </template>
  </div>
</template>

<style scoped>
.log-page { padding: 32px; max-width: 1440px; margin: 0 auto; }

.log-title {
  font-size: 24px; font-weight: 700; color: #0f172a;
  margin: 0 0 24px; letter-spacing: -0.02em;
}

/* ── Pill 式 Tab 切换 ── */
.log-tabs {
  display: flex; gap: 4px; margin-bottom: 24px;
  background: #f1f5f9; border-radius: 12px; padding: 6px; border: none;
}
.log-tabs button {
  padding: 8px 20px; border: none; border-radius: 9px;
  font-size: 14px; font-weight: 500; color: #64748b;
  background: transparent; cursor: pointer;
  transition: all 0.2s ease;
}
.log-tabs button:hover { color: #334155; }
.log-tabs button.active {
  background: #fff; color: var(--color-primary-deep, #2563eb); font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── 概览周期 Tab 栏（与顶部 Tab 同款胶囊式，点击切换更直观） ── */
.db-period {
  display: inline-flex; gap: 4px; margin-bottom: 20px;
  background: #f1f5f9; border-radius: 10px; padding: 4px; border: none;
}
.db-period button {
  padding: 6px 16px; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 500; color: #64748b;
  background: transparent; cursor: pointer;
  transition: all 0.2s ease;
}
.db-period button:hover { color: #334155; }
.db-period button.active {
  background: #fff; color: var(--color-primary-deep, #2563eb); font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── Dashboard 卡片 ── */
.db-blocks {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}
.db-block {
  background: #fff; border-radius: 14px; padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s ease;
}
.db-block:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.db-block h4 {
  margin: 0 0 16px; font-size: 15px; font-weight: 600;
  color: #64748b; letter-spacing: 0.05em;
}

/* ── 统计数据 ── */
.db-stats { display: flex; flex-wrap: wrap; gap: 16px; }
.db-stat { display: flex; flex-direction: column; gap: 4px; }
.db-stat span {
  font-size: 12px; font-weight: 600; color: var(--color-text-secondary, #64748b);
  letter-spacing: 0.03em;
}
.db-stat strong {
  font-size: 18px; font-weight: 700; color: #0f172a;
  letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
}
.db-error { color: #ef4444; font-size: 13px; padding: 8px 0; }
.db-empty { color: var(--color-text-secondary, #64748b); padding: 60px 0; text-align: center; font-size: 14px; }
</style>
