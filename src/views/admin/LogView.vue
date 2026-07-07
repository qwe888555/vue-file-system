<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'
import LogList from '@/components/logs/loglist.vue'

type TabType = 'dashboard' | 'upload' | 'query' | 'sensitive' | 'login' | 'operation'
const activeTab = ref<TabType>('dashboard')

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
      <button :class="{ active: activeTab === 'dashboard' }" @click="activeTab = 'dashboard'">概览</button>
      <button v-for="tab in logTabs" :key="tab.key" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key as TabType">{{ tab.label }}</button>
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
    <LogList
      v-for="t in logTabs"
      :key="t.key"
      v-show="activeTab === t.key"
      :tab="t.key"
      :endpoint="t.endpoint"
      :stats-endpoint="t.stats"
    />
  </div>
</template>

<style scoped>
.log-page { padding: 24px; }
.log-title { font-size: 20px; font-weight: 600; color: #1a2332; margin: 0 0 20px; }
.log-tabs { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 1px solid #e4e9f0; }
.log-tabs button {
  padding: 10px 20px; border: none; background: none; font-size: 14px; color: #8e8e93; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s;
}
.log-tabs button.active { color: #2b5fd9; border-bottom-color: #2b5fd9; font-weight: 600; }
.log-tabs button:hover { color: #2b5fd9; }

/* Dashboard */
.db-period { margin-bottom: 16px; }
.db-blocks { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.db-block { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.db-block h4 { margin: 0 0 12px; font-size: 15px; color: #1a2332; }
.db-stats { display: flex; flex-wrap: wrap; gap: 12px; }
.db-stat { display: flex; flex-direction: column; gap: 2px; }
.db-stat span { font-size: 11px; color: #8e95a6; }
.db-stat strong { font-size: 18px; color: #1a2332; }
.db-error { color: #e74c3c; font-size: 13px; padding: 8px 0; }
.db-empty { color: #aeaeb2; padding: 40px 0; text-align: center; }
</style>
