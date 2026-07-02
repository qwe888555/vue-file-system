<script setup lang="ts">
// ── 403 无权限访问页 ──

import { useRouter } from 'vue-router'
const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="error-page">
    <h1 class="error-code">403</h1>
    <p class="error-desc">抱歉，您没有权限访问该页面</p>
    <el-button type="primary" @click="goHome">回到首页</el-button>
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
  color: var(--color-danger, #f56c6c);
  margin: 0;
  line-height: 1;
}
.error-desc {
  font-size: var(--font-size-lg, 16px);
  color: var(--color-gray, #909399);
  margin: 16px 0 24px;
}
</style>
