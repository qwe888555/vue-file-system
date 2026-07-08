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

async function fetchDashboard() {
  try {
    const res = await request.get('/admin/logs/dashboard/', { params: { period: dashboardPeriod.value } })
    dashboardData.value = res
  } catch (e: any) {
    if (e?.response?.status !== 404) ElMessage.error('获取 Dashboard 失败')
    dashboardData.value = { blocks: {} }
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
      <div class="db-period">
        <el-radio-group v-model="dashboardPeriod" size="small">
          <el-radio-button value="day">今天</el-radio-button>
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="!dashboardData" class="db-empty">加载中...</div>
      <div v-else class="db-blocks">
        <div v-for="(block, name) in dashboardData.blocks" :key="name" class="db-block">
          <h4>{{ { upload: '上传', query: '查询', sensitive: '敏感内容', login: '登录', operation: '操作' }[name] || name }}</h4>
          <div v-if="hasError(block)" class="db-error">数据获取失败</div>
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
  background: #fff; color: #2563eb; font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── Period 选择器 ── */
.db-period { margin-bottom: 20px; }
.db-period :deep(.el-radio-group) {
  background: #f1f5f9; border-radius: 10px; padding: 3px; border: none;
  display: inline-flex;
}
.db-period :deep(.el-radio-button__inner) {
  border: none !important; background: transparent !important;
  border-radius: 8px !important; padding: 6px 16px;
  font-size: 13px; font-weight: 500; color: #64748b;
  box-shadow: none !important; transition: all 0.2s ease;
}
.db-period :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #fff !important; color: #2564ebc2 !important; font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
}
.db-period :deep(.el-radio-button:not(:first-child) .el-radio-button__inner) {
  border-left: none !important;
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
  margin: 0 0 16px; font-size: 13px; font-weight: 600;
  color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
}

/* ── 统计数据 ── */
.db-stats { display: flex; flex-wrap: wrap; gap: 16px; }
.db-stat { display: flex; flex-direction: column; gap: 4px; }
.db-stat span {
  font-size: 12px; font-weight: 00; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.db-stat strong {
  font-size: 18px; font-weight: 700; color: #0f172a;
  letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
}
.db-error { color: #ef4444; font-size: 13px; padding: 8px 0; }
.db-empty { color: #94a3b8; padding: 60px 0; text-align: center; font-size: 14px; }
</style>
