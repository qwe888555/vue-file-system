<script setup lang="ts">
// ── 403 无权限访问页（薄包装，统一走 ErrorPage） ──
import ErrorPage from './ErrorPage.vue'
</script>

<template>
  <ErrorPage code="403" desc="抱歉，您没有权限访问该页面" tone="danger" />
</template>
