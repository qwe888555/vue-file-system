<script setup lang="ts">
// ── 404 页面不存在页 ──
// 人员 A 实现

import { useRouter } from 'vue-router'
const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="error-page">
    <h1 class="error-code">404</h1>
    <p class="error-desc">抱歉，您访问的页面不存在</p>
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
  color: var(--color-warning);
  margin: 0;
  line-height: 1;
}
.error-desc {
  font-size: var(--font-size-lg);
  color: var(--color-gray);
  margin: 16px 0 24px;
}
</style>
