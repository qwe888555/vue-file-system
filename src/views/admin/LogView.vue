<script setup lang="ts">
// ── 日志管理（超级管理员专用） ──
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

type TabType = 'dashboard' | 'upload' | 'query' | 'sensitive' | 'login' | 'operation'
const activeTab = ref<TabType>('dashboard')
const loading = ref(false)

// ── Dashboard ──
const dashboardData = ref<any>(null)
const dashboardPeriod = ref<'day' | 'week' | 'month'>('day')

async function fetchDashboard() {
  loading.value = true
  try {
    const { data } = await request.get('/admin/logs/dashboard/', { params: { period: dashboardPeriod.value } })
    dashboardData.value = data
  } catch (e: any) {
    if (e?.response?.status !== 404) ElMessage.error('获取 Dashboard 失败')
    dashboardData.value = { blocks: {} }
  }
  finally { loading.value = false }
}

watch(dashboardPeriod, fetchDashboard)

// ── 通用列表 ──
interface PageData { count: number; results: any[] }
const listData = ref<Record<string, PageData>>({})
const listParams = ref<Record<string, any>>({})
const page = ref(1)
const pageSize = 20

function getEndpoint(): string {
  const map: Record<TabType, string> = {
    dashboard: '', upload: '/admin/logs/upload/', query: '/admin/logs/query/',
    sensitive: '/admin/logs/sensitive/', login: '/admin/logs/login/', operation: '/admin/logs/operation/',
  }
  return map[activeTab.value] || ''
}

async function fetchList() {
  if (activeTab.value === 'dashboard' || !getEndpoint()) return
  loading.value = true
  try {
    const { data } = await request.get(getEndpoint(), { params: { page: page.value, page_size: pageSize, ...listParams.value[activeTab.value] } })
    listData.value[activeTab.value] = data
  } catch (e: any) {
    if (e?.response?.status !== 404) ElMessage.error('获取日志列表失败')
  }
  finally { loading.value = false }
}

watch(activeTab, () => { page.value = 1; fetchList() })

// ── 详情弹窗 ──
const detailVisible = ref(false)
const detailData = ref<any>(null)
const detailLoading = ref(false)

async function openDetail(id: number) {
  const ep = getEndpoint()
  if (!ep) return
  detailLoading.value = true
  detailVisible.value = true
  try {
    const { data } = await request.get(`${ep}${id}/`)
    detailData.value = data
  } catch (e: any) {
    if (e?.response?.status !== 404) ElMessage.error('获取详情失败')
    detailData.value = null
  } finally { detailLoading.value = false }
}
function closeDetail() { detailVisible.value = false; detailData.value = null }

// ── 统计（上传/查询/登录/操作） ──
const statsData = ref<any>(null)

async function fetchStats() {
  const statsEndpoint: Partial<Record<TabType, string>> = {
    upload: '/admin/logs/upload/stats/',
    query: '/admin/logs/query/stats/',
    login: '/admin/logs/login/stats/',
    operation: '/admin/logs/operation/stats/',
  }
  const ep = statsEndpoint[activeTab.value]
  if (!ep) return
  try {
    const { data } = await request.get(ep)
    statsData.value = data
  } catch { statsData.value = null }
}

watch(activeTab, () => { statsData.value = null; fetchStats() })

onMounted(() => { fetchDashboard() })

// ── 筛选 ──
const filters = ref<Record<string, any>>({
  upload: {}, query: {}, sensitive: {}, login: {}, operation: {},
})
const localFilters = ref<Record<string, any>>({
  upload: {}, query: {}, sensitive: {}, login: {}, operation: {},
})
function applyFilters() {
  const tab = activeTab.value
  filters.value[tab] = { ...localFilters.value[tab] }
  page.value = 1
  fetchList()
}
function resetFilters() {
  const tab = activeTab.value
  localFilters.value[tab] = {}
  filters.value[tab] = {}
  page.value = 1
  fetchList()
}

// ── 块错误渲染辅助 ──
function hasError(block: any) { return block && block.error }
</script>

<template>
  <div class="log-page">
    <h2 class="log-title">日志管理</h2>

    <!-- 选项卡 -->
    <div class="log-tabs">
      <button :class="{ active: activeTab === 'dashboard' }" @click="activeTab = 'dashboard'">概览</button>
      <button :class="{ active: activeTab === 'upload' }" @click="activeTab = 'upload'">上传日志</button>
      <button :class="{ active: activeTab === 'query' }" @click="activeTab = 'query'">查询日志</button>
      <button :class="{ active: activeTab === 'sensitive' }" @click="activeTab = 'sensitive'">敏感内容</button>
      <button :class="{ active: activeTab === 'login' }" @click="activeTab = 'login'">登录日志</button>
      <button :class="{ active: activeTab === 'operation' }" @click="activeTab = 'operation'">操作日志</button>
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

    <!-- ══════ 列表 + 统计 ══════ -->
    <template v-if="activeTab !== 'dashboard'">
      <!-- 统计卡片 -->
      <div v-if="statsData" class="stats-bar">
        <div class="stats-item">总数: <strong>{{ statsData.total ?? 0 }}</strong></div>
        <div class="stats-item">今日: <strong>{{ statsData.today ?? '-' }}</strong></div>
        <div class="stats-item">本周: <strong>{{ statsData.this_week ?? '-' }}</strong></div>
        <div class="stats-item">本月: <strong>{{ statsData.this_month ?? '-' }}</strong></div>
        <div v-if="statsData.avg_response_ms != null" class="stats-item">平均响应: <strong>{{ statsData.avg_response_ms }}ms</strong></div>
        <div v-if="statsData.like_rate != null" class="stats-item">点赞率: <strong>{{ (statsData.like_rate * 100).toFixed(1) }}%</strong></div>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-input :model-value="localFilters[activeTab]?.keyword || ''" @update:model-value="(v: string) => { if (!localFilters[activeTab]) localFilters[activeTab] = {}; localFilters[activeTab].keyword = v }" placeholder="关键字搜索" clearable style="width:200px" @keyup.enter="applyFilters" />
        <el-date-picker :model-value="localFilters[activeTab]?.date_from || ''" @update:model-value="(v: any) => { if (!localFilters[activeTab]) localFilters[activeTab] = {}; localFilters[activeTab].date_from = v }" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:140px" />
        <el-date-picker :model-value="localFilters[activeTab]?.date_to || ''" @update:model-value="(v: any) => { if (!localFilters[activeTab]) localFilters[activeTab] = {}; localFilters[activeTab].date_to = v }" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width:140px" />
        <el-select v-if="activeTab === 'upload'" :model-value="localFilters[activeTab]?.status || ''" @update:model-value="(v: string) => { if (!localFilters[activeTab]) localFilters[activeTab] = {}; localFilters[activeTab].status = v }" placeholder="状态" clearable style="width:120px">
          <el-option label="成功" value="success" /><el-option label="失败" value="failed" /><el-option label="处理中" value="pending" />
        </el-select>
        <el-select v-if="activeTab === 'login'" :model-value="localFilters[activeTab]?.login_type || ''" @update:model-value="(v: string) => { if (!localFilters[activeTab]) localFilters[activeTab] = {}; localFilters[activeTab].login_type = v }" placeholder="登录方式" clearable style="width:140px">
          <el-option label="账号密码" value="jwt" /><el-option label="SSO" value="sso" /><el-option label="SSO Mock" value="sso_mock" />
        </el-select>
        <el-select v-if="activeTab === 'login'" :model-value="localFilters[activeTab]?.success" @update:model-value="(v: any) => { if (!localFilters[activeTab]) localFilters[activeTab] = {}; localFilters[activeTab].success = v }" placeholder="结果" clearable style="width:100px">
          <el-option label="成功" :value="true" /><el-option label="失败" :value="false" />
        </el-select>
        <el-button type="primary" size="small" @click="applyFilters">筛选</el-button>
        <el-button size="small" @click="resetFilters">重置</el-button>
        <el-button size="small" @click="fetchList(); fetchStats()">刷新</el-button>
      </div>

      <!-- 表格 -->
      <el-table :data="listData[activeTab]?.results || []" v-loading="loading" border stripe style="width:100%;cursor:pointer" size="small" @row-click="(row: any) => openDetail(row.id)">
        <!-- 上传日志 -->
        <template v-if="activeTab === 'upload'">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="user_name" label="上传用户" width="100" />
          <el-table-column prop="file_name" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column prop="file_type" label="类型" width="70" />
          <el-table-column prop="file_size" label="大小" width="80" :formatter="(r:any) => r.file_size ? (r.file_size / 1024).toFixed(1) + 'KB' : '-'" />
          <el-table-column prop="college_name" label="学院" width="120" />
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ip_address" label="IP" width="130" />
          <el-table-column prop="created_at" label="时间" width="160" />
        </template>

        <!-- 查询日志 -->
        <template v-if="activeTab === 'query'">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="user_name" label="用户" width="100" />
          <el-table-column prop="question" label="问题" min-width="250" show-overflow-tooltip />
          <el-table-column prop="hit_count" label="命中" width="60" />
          <el-table-column prop="response_ms" label="耗时" width="80" :formatter="(r:any) => r.response_ms + 'ms'" />
          <el-table-column prop="user_feedback" label="反馈" width="60">
            <template #default="{ row }">
              <span v-if="row.user_feedback === 1">👍</span>
              <span v-else-if="row.user_feedback === 0">👎</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="时间" width="160" />
        </template>

        <!-- 敏感内容 -->
        <template v-if="activeTab === 'sensitive'">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="user_name" label="用户" width="100" />
          <el-table-column prop="question" label="问题" min-width="250" show-overflow-tooltip />
          <el-table-column prop="matched_rules" label="匹配规则" min-width="200">
            <template #default="{ row }">
              <el-tag v-for="r in row.matched_rules" :key="r.rule" size="small" type="danger" style="margin:2px">{{ r.rule }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="时间" width="160" />
        </template>

        <!-- 登录日志 -->
        <template v-if="activeTab === 'login'">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="username" label="用户名" width="120" />
          <el-table-column prop="login_type_display" label="登录方式" width="120" />
          <el-table-column prop="success" label="结果" width="60">
            <template #default="{ row }"><el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="fail_reason" label="失败原因" min-width="200" show-overflow-tooltip />
          <el-table-column prop="ip_address" label="IP" width="130" />
          <el-table-column prop="created_at" label="时间" width="160" />
        </template>

        <!-- 操作日志 -->
        <template v-if="activeTab === 'operation'">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="operator_name" label="操作人" width="100" />
          <el-table-column prop="action_display" label="操作" width="80" />
          <el-table-column prop="target_type_display" label="对象类型" width="80" />
          <el-table-column prop="target_repr" label="对象描述" min-width="250" show-overflow-tooltip />
          <el-table-column prop="ip_address" label="IP" width="130" />
          <el-table-column prop="created_at" label="时间" width="160" />
        </template>
      </el-table>

      <!-- 分页 -->
      <div v-if="listData[activeTab]?.count > pageSize" class="log-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="listData[activeTab]?.count || 0" layout="prev, pager, next" @current-change="fetchList" />
      </div>
    </template>

    <!-- ══════ 详情弹窗 ══════ -->
    <el-dialog v-model="detailVisible" title="日志详情" width="700px" :close-on-click-modal="false" @close="closeDetail">
      <div v-loading="detailLoading" style="min-height:100px">
        <template v-if="detailData">
          <!-- 上传日志 -->
          <template v-if="activeTab === 'upload'">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
              <el-descriptions-item label="上传用户">{{ detailData.user_name }}</el-descriptions-item>
              <el-descriptions-item label="文件名" :span="2">{{ detailData.file_name }}</el-descriptions-item>
              <el-descriptions-item label="文件类型">{{ detailData.file_type }}</el-descriptions-item>
              <el-descriptions-item label="大小">{{ detailData.file_size ? (detailData.file_size / 1024).toFixed(1) + 'KB' : '-' }}</el-descriptions-item>
              <el-descriptions-item label="学院">{{ detailData.college_name }}</el-descriptions-item>
              <el-descriptions-item label="状态"><el-tag :type="detailData.status === 'success' ? 'success' : detailData.status === 'failed' ? 'danger' : 'warning'" size="small">{{ detailData.status }}</el-tag></el-descriptions-item>
              <el-descriptions-item label="IP">{{ detailData.ip_address }}</el-descriptions-item>
              <el-descriptions-item label="User-Agent" :span="2" show-overflow-tooltip>{{ detailData.user_agent }}</el-descriptions-item>
              <el-descriptions-item v-if="detailData.error_message" label="错误信息" :span="2"><span style="color:#e74c3c">{{ detailData.error_message }}</span></el-descriptions-item>
              <el-descriptions-item label="上传时间">{{ detailData.created_at }}</el-descriptions-item>
              <el-descriptions-item label="完成时间">{{ detailData.completed_at || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>
          <!-- 查询日志 -->
          <template v-if="activeTab === 'query'">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
              <el-descriptions-item label="用户">{{ detailData.user_name }}</el-descriptions-item>
              <el-descriptions-item label="会话">{{ detailData.conversation }}</el-descriptions-item>
              <el-descriptions-item label="命中">{{ detailData.hit_count }}</el-descriptions-item>
              <el-descriptions-item label="问题" :span="2" show-overflow-tooltip>{{ detailData.question }}</el-descriptions-item>
              <el-descriptions-item label="耗时">{{ detailData.response_ms }}ms</el-descriptions-item>
              <el-descriptions-item label="反馈"><span v-if="detailData.user_feedback === 1">👍 赞</span><span v-else-if="detailData.user_feedback === 0">👎 踩</span><span v-else>-</span></el-descriptions-item>
              <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
              <el-descriptions-item label="筛选条件" :span="2" show-overflow-tooltip>{{ JSON.stringify(detailData.parsed_filters) }}</el-descriptions-item>
              <el-descriptions-item label="命中文档" :span="2">{{ detailData.top_doc_ids?.join(', ') || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>
          <!-- 敏感内容 -->
          <template v-if="activeTab === 'sensitive'">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
              <el-descriptions-item label="用户">{{ detailData.user_name }}</el-descriptions-item>
              <el-descriptions-item label="问题" :span="2" show-overflow-tooltip>{{ detailData.question }}</el-descriptions-item>
              <el-descriptions-item label="拒绝文案" :span="2" show-overflow-tooltip>{{ detailData.refuse_message }}</el-descriptions-item>
              <el-descriptions-item label="命中文本" :span="2">{{ detailData.matched_texts?.join(', ') || '-' }}</el-descriptions-item>
              <el-descriptions-item label="匹配规则" :span="2"><el-tag v-for="r in detailData.matched_rules" :key="r.rule" size="small" type="danger" style="margin:2px">{{ r.rule }}: {{ r.desc }}</el-tag></el-descriptions-item>
              <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
            </el-descriptions>
          </template>
          <!-- 登录日志 -->
          <template v-if="activeTab === 'login'">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
              <el-descriptions-item label="用户名">{{ detailData.username }}</el-descriptions-item>
              <el-descriptions-item label="用户 ID">{{ detailData.user ?? '匿名' }}</el-descriptions-item>
              <el-descriptions-item label="方式">{{ detailData.login_type_display }}</el-descriptions-item>
              <el-descriptions-item label="结果"><el-tag :type="detailData.success ? 'success' : 'danger'" size="small">{{ detailData.success ? '成功' : '失败' }}</el-tag></el-descriptions-item>
              <el-descriptions-item v-if="!detailData.success" label="失败原因">{{ detailData.fail_reason }}</el-descriptions-item>
              <el-descriptions-item label="IP">{{ detailData.ip_address }}</el-descriptions-item>
              <el-descriptions-item label="User-Agent" :span="2" show-overflow-tooltip>{{ detailData.user_agent }}</el-descriptions-item>
              <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
            </el-descriptions>
          </template>
          <!-- 操作日志 -->
          <template v-if="activeTab === 'operation'">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
              <el-descriptions-item label="操作人">{{ detailData.operator_name }} ({{ detailData.operator_username }})</el-descriptions-item>
              <el-descriptions-item label="操作">{{ detailData.action_display }}</el-descriptions-item>
              <el-descriptions-item label="对象类型">{{ detailData.target_type_display }}</el-descriptions-item>
              <el-descriptions-item label="对象 ID">{{ detailData.target_id ?? '-' }}</el-descriptions-item>
              <el-descriptions-item label="对象" :span="2" show-overflow-tooltip>{{ detailData.target_repr }}</el-descriptions-item>
              <el-descriptions-item label="IP">{{ detailData.ip_address }}</el-descriptions-item>
              <el-descriptions-item label="User-Agent" show-overflow-tooltip>{{ detailData.user_agent }}</el-descriptions-item>
              <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
              <el-descriptions-item v-if="detailData.after" label="操作后快照" :span="2"><pre style="max-height:200px;overflow:auto;font-size:12px;background:#f8fafc;padding:8px;border-radius:4px;">{{ JSON.stringify(detailData.after, null, 2) }}</pre></el-descriptions-item>
            </el-descriptions>
          </template>
        </template>
      </div>
    </el-dialog>
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

/* 统计栏 */
.stats-bar { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; }
.stats-item { font-size: 13px; color: #5a6070; }
.stats-item strong { color: #1a2332; }

/* 筛选栏 */
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.log-pagination { margin-top: 16px; display: flex; justify-content: center; }
</style>
