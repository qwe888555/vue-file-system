<script setup lang="ts">
// ── 500 服务异常页（薄包装，统一走 ErrorPage） ──
// 注：当前路由未引用，保留以便复用
import ErrorPage from './ErrorPage.vue'
</script>

<template>
  <ErrorPage code="500" desc="服务异常，请稍后重试" tone="danger" show-refresh />
</template>
