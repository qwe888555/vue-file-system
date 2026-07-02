<script setup lang="ts">
// ── 侧边栏用户菜单组件（已登录状态弹出） ──
import { computed } from 'vue'
import { useUserStore } from '@/store/user'

const emit = defineEmits<{
  close: []
  logout: []
}>()

const userStore = useUserStore()
const displayName = computed(() => userStore.username || '用户')
const roleLabel = computed(() => {
  const r = userStore.role
  if (r === 'superadmin') return '超级管理员'
  if (r === 'admin') return '管理员'
  return '用户'
})
</script>

<template>
  <div class="user-menu-overlay" @click.self="emit('close')">
    <Transition name="sidebar-menu">
      <div v-if="props.show" class="user-menu">
        <div class="user-menu-header">
          <div class="um-avatar">
            <span>{{ displayName.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="um-info">
            <span class="um-name">{{ displayName }}</span>
            <span class="um-role">{{ roleLabel }}</span>
          </div>
        </div>
        <div class="user-menu-body">
          <div class="um-item logout" @click="emit('logout')">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path d="M3 3h8v1.5H4.5v11H11V17H3V3zm11.5 2.5L17 10l-2.5 4.5L13 13.5 15 10l-2-3.5 1.5-1z" />
              <path d="M7 9.25h7.5v1.5H7v-1.5z" />
            </svg>
            <span>退出登录</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.user-menu-overlay {
  position: fixed; inset: 0; z-index: 300;
}
.user-menu {
  position: fixed;
  bottom: 72px;
  left: var(--spacing-md, 12px);
  width: 220px;
  background: #fff;
  border-radius: var(--radius-lg, 8px);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
  overflow: hidden;
}
.user-menu-header {
  display: flex; align-items: center; gap: var(--spacing-md, 12px);
  padding: var(--spacing-lg, 16px);
  border-bottom: 1px solid var(--color-border, #e4e7ed);
}
.um-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(64, 158, 255, 0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--font-size-lg, 16px); font-weight: 700;
  color: var(--color-primary, #409eff); flex-shrink: 0;
}
.um-info {
  display: flex; flex-direction: column; gap: 2px; overflow: hidden;
}
.um-name {
  font-size: var(--font-size-base, 14px); font-weight: 600;
  color: var(--color-text, #303133);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.um-role {
  font-size: var(--font-size-xs, 12px); color: var(--color-info, #909399);
}
.user-menu-body {
  padding: var(--spacing-sm, 8px);
}
.um-item {
  display: flex; align-items: center; gap: var(--spacing-md, 12px);
  padding: var(--spacing-md, 12px);
  border-radius: var(--radius-base, 6px);
  cursor: pointer; font-size: var(--font-size-sm, 13px);
  transition: background 0.2s ease;
}
.um-item.logout { color: var(--color-danger, #f56c6c); }
.um-item.logout:hover { background: rgba(245, 108, 108, 0.06); }

/* 过渡动画 */
.sidebar-menu-enter-active,
.sidebar-menu-leave-active { transition: all 0.2s ease; }
.sidebar-menu-enter-from,
.sidebar-menu-leave-to { opacity: 0; transform: translateY(8px); }
</style>
