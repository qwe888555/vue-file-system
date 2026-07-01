<script setup lang="ts">
// ── Layout 布局外壳 ──
// 人员 A 实现
//
// 功能：侧边栏 Sidebar + 顶部 Header + 面包屑 + 主体容器 <router-view />
// 样式统一使用全局 Design Token，禁止硬编码色值

import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
</script>

<template>
  <div class="layout-container">
    <!-- 左侧边栏 -->
    <Sidebar />

    <div class="layout-main">
      <!-- 顶部栏 -->
      <Header />

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
  height: 100vh;
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
