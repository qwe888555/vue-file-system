<script setup lang="ts">
// ── 手机端底部 Tab 导航 ──
// 顶部一级导航：智能问答 / 常见问题
import { useRoute } from 'vue-router'
import { computed } from 'vue'

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
      <!-- 智能问答 -->
      <svg v-if="tab.icon === 'chat'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2.1-5.7A8.5 8.5 0 1121 11.5z" />
      </svg>
      <!-- 常见问题 -->
      <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.2 9.3a2.8 2.8 0 015.5 1c0 1.6-2.2 2-2.2 3.4" />
        <path d="M12 17h.01" />
      </svg>
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
  padding-bottom: env(safe-area-inset-bottom);      /* iOS 11.2+ */
  background: #fff;
  border-top: 1px solid #eceff3;
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
.m-tab:active { color: #409eff; }
.m-tab.active { color: #409eff; }

.m-tab-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}
.m-tab.active .m-tab-label { font-weight: 600; }
</style>
