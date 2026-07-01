<script setup lang="ts">
// ── 500 服务异常页 ──
// 人员 A 实现

import { useRouter } from 'vue-router'
const router = useRouter()

function reload() {
  window.location.reload()
}
function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="error-page">
    <h1 class="error-code">500</h1>
    <p class="error-desc">服务异常，请稍后重试</p>
    <div class="error-actions">
      <el-button @click="reload">刷新页面</el-button>
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
  color: var(--color-danger);
  margin: 0;
  line-height: 1;
}
.error-desc {
  font-size: var(--font-size-lg);
  color: var(--color-gray);
  margin: 16px 0 24px;
}
.error-actions {
  display: flex;
  gap: 12px;
}
</style>
