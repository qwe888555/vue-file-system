<script setup lang="ts">
// ── 手机端底部 Tab 导航 ──
// 顶部一级导航：智能问答 / 常见问题
import { useRoute } from 'vue-router'
import { computed } from 'vue'
// 与桌面端侧边栏保持同一套图标（智能问答 ChatLineSquare / 常见问题 ChatDotSquare）
import { ChatLineSquare, ChatDotSquare } from '@element-plus/icons-vue'

const route = useRoute()

const tabs = [
  {
    path: '/mobile/chat',
    name: 'chat',
    label: '智能问答',
    icon: 'chat',
  },
  {
    path: '/mobile/faq',
    name: 'faq',
    label: '常见问题',
    icon: 'faq',
  },
]

const activeTab = computed(() => route.path)
</script>

<template>
  <nav class="m-tabbar" aria-label="主导航">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.path"
      class="m-tab"
      :class="{ active: activeTab === tab.path }"
    >
      <el-icon :size="22" aria-hidden="true">
        <ChatLineSquare v-if="tab.icon === 'chat'" />
        <ChatDotSquare v-else />
      </el-icon>
      <span class="m-tab-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.m-tabbar {
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  height: 56px;
  padding-bottom: constant(safe-area-inset-bottom); /* iOS 11.0 */
  padding-bottom: env(safe-area-inset-bottom); /* iOS 11.2+ */
  background: #fff;
  border-top: 1px solid #e6eaf2;
  z-index: 100;
}

.m-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 48px;
  color: var(--color-text-secondary, #64748b);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s ease;
}
.m-tab:active {
  color: var(--color-primary-deep, #2563eb);
}
.m-tab.active {
  color: var(--color-primary-deep, #2563eb);
}

.m-tab-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}
.m-tab.active .m-tab-label {
  font-weight: 600;
}
</style>
