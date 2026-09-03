<script setup lang="ts">
// ── Layout 模块内容外壳 ──
//
// 原 222px 文字侧边栏 Sidebar 已由 App.vue 的全局常驻 rail 取代，
// 此处仅保留模块内容的灰底 + 内边距 + 滚动容器（各模块子页依赖这层观感）。
// 高度从 100vh 改为 100%：填充全局 rail 外壳右侧的内容舞台。
</script>

<template>
  <div class="layout-container">
    <div class="layout-main">
      <!-- 主体内容 -->
      <main class="layout-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout-container {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg, #f5f7fa);
}

.layout-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}
</style>
