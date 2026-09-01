<script setup lang="ts">
// ── 404 页面不存在页（薄包装，统一走 ErrorPage） ──
import ErrorPage from './ErrorPage.vue'
</script>

<template>
  <ErrorPage code="404" desc="抱歉，您访问的页面不存在" tone="warning" />
</template>
