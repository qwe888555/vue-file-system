<script setup lang="ts">
// ── 日志管理（只读） ──
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

interface LogItem {
  id: number
  user: string
  action: string
  target: string
  detail: string
  ip: string
  created_at: string
}

const logs = ref<LogItem[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 15

async function fetchLogs() {
  loading.value = true
  try {
    const res = await request.get('/admin/logs/', { params: { page: page.value, page_size: pageSize } })
    logs.value = res.results || res
    total.value = res.count || (Array.isArray(res) ? res.length : 0)
  } catch {
    ElMessage.error('获取日志失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchLogs)
</script>

<template>
  <div class="log-page">
    <h2 class="log-title">日志管理</h2>
    <el-table :data="logs" v-loading="loading" border stripe style="width:100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="user" label="操作用户" width="140" />
      <el-table-column prop="action" label="操作类型" width="120" />
      <el-table-column prop="target" label="操作对象" width="160" />
      <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
      <el-table-column prop="ip" label="IP 地址" width="140" />
      <el-table-column prop="created_at" label="操作时间" width="180" />
    </el-table>
    <div v-if="total > pageSize" class="log-pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="fetchLogs"
      />
    </div>
  </div>
</template>

<style scoped>
.log-page { padding: 24px; }
.log-title { font-size: 20px; font-weight: 600; color: #1a2332; margin: 0 0 20px; }
.log-pagination { margin-top: 16px; display: flex; justify-content: center; }
</style>
