<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const props = defineProps<{
  tab: string
  endpoint: string
  statsEndpoint?: string | null
}>()

const tableData = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const statsData = ref<any>(null)

const labelMap: Record<string, string> = {
  upload: '上传日志', query: '查询日志', sensitive: '敏感内容',
  login: '登录日志', operation: '操作日志',
}

function formatTime(val: string) {
  if (!val) return '-'
  return new Date(val).toLocaleString('zh-CN')
}

async function fetchData() {
  loading.value = true
  try {
    const res = await request.get(props.endpoint, {
      params: { page: page.value, page_size: pageSize.value },
    })
    if (res && res.results) {
      tableData.value = res.results
      total.value = res.count || 0
    } else if (Array.isArray(res)) {
      tableData.value = res
      total.value = res.length
    } else {
      tableData.value = []
      total.value = 0
    }
  } catch (e: any) {
    if (e?.response?.status !== 404) {
      ElMessage.error('获取数据失败')
    }
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  if (!props.statsEndpoint) return
  try {
    const res = await request.get(props.statsEndpoint)
    statsData.value = res
  } catch {
    statsData.value = null
  }
}

watch([() => props.endpoint, page], () => { fetchData() })
onMounted(() => { fetchData(); fetchStats() })
</script>

<template>
  <div class="log-list-wrap">
    <h3>{{ labelMap[tab] || tab }}</h3>

    <div v-if="statsData" class="stats-bar">
      <span>总数: <strong>{{ statsData.total ?? 0 }}</strong></span>
    </div>

    <el-table v-loading="loading" :data="tableData" stripe border style="width:100%">
      <el-table-column type="index" label="#" width="60" />
      <el-table-column prop="user_name" label="用户" min-width="120" />
      <el-table-column prop="action" label="操作" min-width="140" />
      <el-table-column prop="status" label="状态" width="90" />
      <el-table-column prop="ip_address" label="IP" width="140" />
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        background
        small
      />
    </div>
  </div>
</template>

<style scoped>
.log-list-wrap { padding: 0; }
.log-list-wrap h3 { font-size: 16px; font-weight: 600; color: #1a2332; margin: 0 0 12px; }
.stats-bar { padding: 10px 16px; background: #f0f4ff; border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: #666; }
.stats-bar strong { color: #2b5fd9; }
.pagination-wrap { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
