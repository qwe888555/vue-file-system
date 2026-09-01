<script setup lang="ts">
// ── 手机端外壳布局 ──
// 固定全屏容器 + 内容区 + 底部 Tab 导航
import MobileTabBar from '@/components/mobile/MobileTabBar.vue'
</script>

<template>
  <div class="mobile-layout">
    <router-view class="mobile-layout-view" />
    <MobileTabBar />
  </div>
</template>

<style scoped>
.mobile-layout {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: var(--font-sans);
  touch-action: manipulation; /* 消除 300ms 点击延迟 */
}

.mobile-layout-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
