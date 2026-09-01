<script setup lang="ts">
// ── 通用异常页（403 / 404 / 500 共用） ──
// 统一三件套：大号状态码 + 描述 + 返回/刷新动作
import { useRouter } from 'vue-router'

withDefaults(defineProps<{
  code: string
  desc: string
  /** 状态色：warning=橙（404 不存在）、danger=红（403/500 错误） */
  tone?: 'warning' | 'danger'
  showRefresh?: boolean
}>(), {
  tone: 'danger',
  showRefresh: false,
})

const router = useRouter()

function goHome() {
  router.push('/')
}
function reload() {
  window.location.reload()
}
</script>

<template>
  <div class="error-page">
    <h1 class="error-code" :class="`tone-${tone}`">{{ code }}</h1>
    <p class="error-desc">{{ desc }}</p>
    <div class="error-actions">
      <el-button v-if="showRefresh" @click="reload">刷新页面</el-button>
      <el-button type="primary" @click="goHome">回到首页</el-button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
}
.error-code {
  font-size: 120px;
  margin: 0;
  line-height: 1;
}
.tone-warning { color: var(--color-warning, #e6a23c); }
.tone-danger { color: var(--color-danger, #f56c6c); }
.error-desc {
  font-size: var(--font-size-lg, 16px);
  color: var(--color-text-secondary, #64748b);
  margin: 16px 0 24px;
}
.error-actions {
  display: flex;
  gap: 12px;
}
</style>
