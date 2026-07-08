<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const props = defineProps<{
  tab: string
  endpoint: string
  statsEndpoint: string | null
}>()

const allData = ref<any[]>([])
const allCount = ref(0)
const statsData = ref<any>(null)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const detailVisible = ref(false)
const detailData = ref<any>(null)
const detailLoading = ref(false)
const filters = ref<Record<string, any>>({})
const localFilters = ref<Record<string, any>>({})

const keywordPlaceholder = computed(() => {
  const map: Record<string, string> = {
    upload: '请输入文件名',
    query: '请输入问题',
    sensitive: '请输入问题',
    login: '请输入登录方式',
    operation: '请输入操作',
  }
  return map[props.tab] || '关键字搜索'
})

/** 前端关键词过滤后的数据 */
const filteredData = computed(() => {
  if (!filters.value.keyword) return allData.value
  const kw = filters.value.keyword.toLowerCase()
  return allData.value.filter((item: any) => {
    const searchFields = [
      item.user_name, item.username, item.question, item.file_name,
      item.login_type_display, item.action_display, item.target_type_display,
      item.ip_address, item.operator_name, item.operator_username,
      item.fail_reason, item.status, item.college_name,
    ]
    return searchFields.some((f) => f && String(f).toLowerCase().includes(kw))
  })
})

const pagedResults = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

async function fetchStats() {
  if (!props.statsEndpoint) return
  try {
    const res = await request.get(props.statsEndpoint)
    statsData.value = res
  } catch { statsData.value = null }
}

async function fetchList() {
  loading.value = true
  try {
    const res: any = await request.get(props.endpoint, {
      params: { ...filters.value, page_size: 9999 },
    })
    allData.value = res.results || []
    allCount.value = res.count || allData.value.length
  } catch (e: any) {
    if (e?.response?.status !== 404) ElMessage.error('获取日志列表失败')
  } finally { loading.value = false }
}

watch(() => props.endpoint, () => {
  page.value = 1
  allData.value = []
  allCount.value = 0
  statsData.value = null
  fetchList()
  fetchStats()
}, { immediate: true })

function applyFilters() {
  filters.value = { ...localFilters.value }
  page.value = 1
  fetchList()
}

function resetFilters() {
  localFilters.value = {}
  filters.value = {}
  page.value = 1
  fetchList()
}

async function openDetail(id: number) {
  detailLoading.value = true
  detailVisible.value = true
  try {
    const res = await request.get(`${props.endpoint}${id}/`)
    detailData.value = res
  } catch (e: any) {
    if (e?.response?.status !== 404) ElMessage.error('获取详情失败')
    detailData.value = null
  } finally { detailLoading.value = false }
}

function closeDetail() { detailVisible.value = false; detailData.value = null }

function handlePageChange(p: number) {
  page.value = p
}

function handleSizeChange() {
  page.value = 1
}
</script>

<template>
  <div v-if="tab !== 'dashboard'">
    <div class="filter-bar">
      <el-input v-model="localFilters.keyword" :placeholder="keywordPlaceholder" clearable class="fi kw" @keyup.enter="applyFilters" />
      <el-date-picker v-model="localFilters.date_from" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" class="fi dt" />
      <el-date-picker v-model="localFilters.date_to" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" class="fi dt" />
      <el-select v-if="tab === 'upload'" v-model="localFilters.status" placeholder="状态" clearable class="fi sl">
        <el-option label="成功" value="success" /><el-option label="失败" value="failed" /><el-option label="处理中" value="pending" />
      </el-select>
      <el-select v-if="tab === 'login'" v-model="localFilters.login_type" placeholder="登录方式" clearable class="fi sl">
        <el-option label="账号密码" value="jwt" /><el-option label="SSO" value="sso" /><el-option label="SSO Mock" value="sso_mock" />
      </el-select>
      <el-select v-if="tab === 'login'" v-model="localFilters.success" placeholder="结果" clearable class="fi sl--sm">
        <el-option label="成功" :value="true" /><el-option label="失败" :value="false" />
      </el-select>
      <el-button type="primary" size="small" @click="applyFilters" class="fi-btn">筛选</el-button>
      <el-button size="small" @click="resetFilters" class="fi-btn">重置</el-button>
      <el-button size="small" @click="fetchList(); fetchStats()" class="fi-btn">刷新</el-button>
    </div>

    <el-table :data="pagedResults" v-loading="loading" border stripe size="small" class="table-body" @row-click="(row: any) => openDetail(row.id)">
      <template v-if="tab === 'upload'">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="user_name" label="上传用户" width="140" />
        <el-table-column prop="file_name" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="file_type" label="类型" width="80" />
        <el-table-column prop="file_size" label="大小" width="100" :formatter="(r:any) => r.file_size ? (r.file_size / 1024).toFixed(1) + 'KB' : '-'" />
        <el-table-column prop="college_name" label="学院" width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP" width="140" />
        <el-table-column prop="created_at" label="时间" width="300" />
      </template>

      <template v-if="tab === 'query'">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="user_name" label="查询用户" width="140" />
        <el-table-column prop="question" label="问题" min-width="250" show-overflow-tooltip />
        <el-table-column prop="hit_count" label="命中" width="100" />
        <el-table-column prop="response_ms" label="耗时" width="100" :formatter="(r:any) => r.response_ms + 'ms'" />
        <el-table-column prop="user_feedback" label="反馈" width="100">
          <template #default="{ row }">
            <span v-if="row.user_feedback === 1" class="feedback-like">赞</span>
            <span v-else-if="row.user_feedback === 0" class="feedback-dislike">踩</span>
            <span v-else class="feedback-none">无反馈</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="300" />
      </template>

      <template v-if="tab === 'sensitive'">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="user_name" label="用户" width="140" />
        <el-table-column prop="question" label="问题" min-width="250" show-overflow-tooltip />
        <el-table-column prop="matched_rules" label="匹配规则" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="r in row.matched_rules" :key="r.rule" size="small" type="danger" class="tag-gap">{{ r.rule }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="300" />
      </template>

      <template v-if="tab === 'login'">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="login_type_display" label="登录方式" width="140" />
        <el-table-column prop="success" label="结果" width="80">
          <template #default="{ row }"><el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="失败原因" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="fail-reason" :style="{ color: row.fail_reason ? 'inherit' : '#b0b8c8' }">{{ row.fail_reason || '无' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP" width="140" />
        <el-table-column prop="created_at" label="时间" width="300" />
      </template>

      <template v-if="tab === 'operation'">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="operator_name" label="操作人" width="140" />
        <el-table-column prop="action_display" label="操作" width="100" />
        <el-table-column prop="target_type_display" label="对象类型" width="100" />
        <el-table-column prop="target_repr" label="对象描述" min-width="250" show-overflow-tooltip />
        <el-table-column prop="ip_address" label="IP" width="140" />
        <el-table-column prop="created_at" label="时间" width="300" />
      </template>
    </el-table>

    <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="filteredData.length" :page-sizes="[10, 15, 20]" layout="total, sizes, prev, pager, next, jumper" class="log-pagination" @current-change="handlePageChange" @size-change="handleSizeChange" />

    <el-dialog v-model="detailVisible" title="日志详情" width="700px" :close-on-click-modal="false" @close="closeDetail">
      <div v-loading="detailLoading" class="detail-loading">
        <template v-if="detailData">
          <el-descriptions v-if="tab === 'upload'" :column="2" border size="small">
            <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
            <el-descriptions-item label="上传用户">{{ detailData.user_name }}</el-descriptions-item>
            <el-descriptions-item label="文件名" :span="2">{{ detailData.file_name }}</el-descriptions-item>
            <el-descriptions-item label="文件类型">{{ detailData.file_type }}</el-descriptions-item>
            <el-descriptions-item label="大小">{{ detailData.file_size ? (detailData.file_size / 1024).toFixed(1) + 'KB' : '-' }}</el-descriptions-item>
            <el-descriptions-item label="学院">{{ detailData.college_name }}</el-descriptions-item>
            <el-descriptions-item label="状态"><el-tag :type="detailData.status === 'success' ? 'success' : detailData.status === 'failed' ? 'danger' : 'warning'" size="small">{{ detailData.status }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="IP">{{ detailData.ip_address }}</el-descriptions-item>
            <el-descriptions-item label="User-Agent" :span="2" show-overflow-tooltip>{{ detailData.user_agent }}</el-descriptions-item>
            <el-descriptions-item v-if="detailData.error_message" label="错误信息" :span="2"><span class="err-text">{{ detailData.error_message }}</span></el-descriptions-item>
            <el-descriptions-item label="上传时间">{{ detailData.created_at }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ detailData.completed_at || '-' }}</el-descriptions-item>
          </el-descriptions>
          <el-descriptions v-if="tab === 'query'" :column="2" border size="small">
            <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item><el-descriptions-item label="用户">{{ detailData.user_name }}</el-descriptions-item>
            <el-descriptions-item label="问题" :span="2" show-overflow-tooltip>{{ detailData.question }}</el-descriptions-item>
            <el-descriptions-item label="耗时">{{ detailData.response_ms }}ms</el-descriptions-item><el-descriptions-item label="反馈"><span v-if="detailData.user_feedback === 1" class="feedback-like">赞</span><span v-else-if="detailData.user_feedback === 0" class="feedback-dislike">踩</span><span v-else class="feedback-none">无反馈</span></el-descriptions-item>
            <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
          </el-descriptions>
          <el-descriptions v-if="tab === 'sensitive'" :column="2" border size="small">
            <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item><el-descriptions-item label="用户">{{ detailData.user_name }}</el-descriptions-item>
            <el-descriptions-item label="问题" :span="2" show-overflow-tooltip>{{ detailData.question }}</el-descriptions-item>
            <el-descriptions-item label="匹配规则" :span="2"><el-tag v-for="r in detailData.matched_rules" :key="r.rule" size="small" type="danger" class="tag-gap">{{ r.rule }}: {{ r.desc }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
          </el-descriptions>
          <el-descriptions v-if="tab === 'login'" :column="2" border size="small">
            <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item><el-descriptions-item label="用户名">{{ detailData.username }}</el-descriptions-item>
            <el-descriptions-item label="方式">{{ detailData.login_type_display }}</el-descriptions-item><el-descriptions-item label="结果"><el-tag :type="detailData.success ? 'success' : 'danger'" size="small">{{ detailData.success ? '成功' : '失败' }}</el-tag></el-descriptions-item>
            <el-descriptions-item v-if="!detailData.success" label="失败原因">{{ detailData.fail_reason || '无' }}</el-descriptions-item>
            <el-descriptions-item label="IP">{{ detailData.ip_address }}</el-descriptions-item><el-descriptions-item label="User-Agent" show-overflow-tooltip>{{ detailData.user_agent }}</el-descriptions-item>
            <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
          </el-descriptions>
          <el-descriptions v-if="tab === 'operation'" :column="2" border size="small">
            <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item><el-descriptions-item label="操作人">{{ detailData.operator_name }}</el-descriptions-item>
            <el-descriptions-item label="操作">{{ detailData.action_display }}</el-descriptions-item><el-descriptions-item label="对象类型">{{ detailData.target_type_display }}</el-descriptions-item>
            <el-descriptions-item label="对象" :span="2" show-overflow-tooltip>{{ detailData.target_repr }}</el-descriptions-item>
            <el-descriptions-item label="IP">{{ detailData.ip_address }}</el-descriptions-item><el-descriptions-item label="User-Agent" show-overflow-tooltip>{{ detailData.user_agent }}</el-descriptions-item>
            <el-descriptions-item label="时间">{{ detailData.created_at }}</el-descriptions-item>
            <el-descriptions-item v-if="detailData.after" label="操作后快照" :span="2"><pre class="snapshot-pre">{{ JSON.stringify(detailData.after, null, 2) }}</pre></el-descriptions-item>
          </el-descriptions>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.stats-bar {
  display: flex; gap: 14px; flex-wrap: wrap;
  margin-bottom: 20px; padding: 10px 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px; border: 1px solid #e2e8f0;
}
.stats-item {
  font-size: 13px; color: #64748b; font-weight: 500;
}
.stats-item strong {
  font-size: 14px; color: #0f172a; font-weight: 700;
  margin-left: 6px; font-variant-numeric: tabular-nums;
}

.filter-bar {
  display: flex; gap: 10px; flex-wrap: wrap;
  margin-bottom: 20px; align-items: center;
}

/* ── 筛选控件统一样式 ── */
:deep(.fi) { --fi-h: 36px; }
:deep(.fi .el-input__wrapper),
:deep(.fi .el-select__wrapper) {
  border-radius: 4px !important; box-shadow: 0 0 0 1px #e2e8f0 !important;
  transition: box-shadow 0.2s ease;
}
:deep(.fi .el-input__wrapper:hover),
:deep(.fi .el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd5e1 !important;
}
:deep(.fi .el-input__wrapper.is-focus),
:deep(.fi .el-select__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(37,99,235,0.15) !important;
}
:deep(.fi .el-input__inner) {
  height: 34px; font-size: 13px; color: #0f172a;
}
:deep(.fi .el-input__inner::placeholder) {
  color: #94a3b8;
}
:deep(.fi .el-date-editor .el-input__wrapper) {
  width: 100%;
}
:deep(.kw) { width: 200px; }
:deep(.dt) { width: 140px; }
:deep(.sl) { width: 140px; }
:deep(.sl--sm) { width: 100px; }

/* ── 筛选按钮 ── */
:deep(.fi-btn) {
  border-radius: 4px !important; font-weight: 500 !important;
  padding: 6px 16px !important; height: 32px !important;
}
:deep(.fi-btn.el-button--primary) {
  border: none !important;
}
:deep(.fi-btn.el-button--primary:hover) {
  box-shadow: 0 4px 12px rgba(37,99,235,0.25);
}

/* ── 表格 ── */
:deep(.el-table) {
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
:deep(.el-table th.el-table__cell) {
  background: #f8fafc; font-weight: 600;
  color: #475569; font-size: 13px;
}
:deep(.el-table .el-table__body tr:hover > td) {
  background: #f0f4fe;
}

/* ── 表格游标 ── */
.table-body { cursor: pointer; }

/* ── 反馈颜色 ── */
.feedback-like { color: #67c23a; }
.feedback-dislike { color: #e74c3c; }
.feedback-none { color: #b0b8c8; }

/* ── 标签间距 ── */
.tag-gap { margin: 2px; }

/* ── 分页 ── */
.log-pagination { margin-top: 20px; }
:deep(.el-pagination) {
  margin-top: 24px; justify-content: center;
}

/* ── 详情加载 ── */
.detail-loading { min-height: 100px; }

/* ── 错误文本 ── */
.err-text { color: #e74c3c; }

/* ── 快照 pre ── */
.snapshot-pre {
  max-height: 200px; overflow: auto; font-size: 12px;
  background: #f8fafc; padding: 8px; border-radius: 4px;
}
</style>
