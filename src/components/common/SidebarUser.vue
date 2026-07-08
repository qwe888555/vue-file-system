<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessageBox } from 'element-plus'
import PersonalCenter from '@/components/common/PersonalCenter.vue'

const emit = defineEmits<{
  (e: 'login'): void
}>()

const router = useRouter()
const userStore = useUserStore()

const showPersonalCenter = ref(false)
const showUserMenu = ref(false)

const isLoggedIn = computed(() => !!userStore.token)
const userDisplayRole = computed(() => {
  if (userStore.role === 'admin' || userStore.role === 'college_admin') return '普通管理员'
  return userStore.userInfo?.role_display || ''
})

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示')
    userStore.logout()
    router.push('/')
  } catch {
    // 取消操作
  }
}
</script>

<template>
  <div v-if="isLoggedIn" class="sidebar-user-area">
    <Transition name="menu-up">
      <div v-if="showUserMenu" class="user-popup">
        <div v-if="!userStore.role?.startsWith('super')" class="user-popup-item" @click="showUserMenu = false; showPersonalCenter = true">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
          <span>个人中心</span>
        </div>
        <div class="user-popup-item" @click="showUserMenu = false; handleLogout()">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M3 3h6v2H5v10h4v2H3V3zm12.5 5H11V6h4.5L19 10l-3.5 4H11v-2h4.5L16 10l-1.5-2z"/></svg>
          <span>退出登录</span>
        </div>
      </div>
    </Transition>
    <div class="sidebar-user" @click="showUserMenu = !showUserMenu">
      <div class="su-avatar">
        <span class="su-avatar-text">{{ (userDisplayRole || userStore.userInfo?.username || '?').charAt(0).toUpperCase() }}</span>
      </div>
      <div class="su-info">
        <span class="su-name">{{ userStore.userInfo?.username || '' }}</span>
        <span class="su-role">{{ userDisplayRole }}</span>
      </div>
      <span class="su-status">已登录</span>
    </div>
    <PersonalCenter v-if="showPersonalCenter" @close="showPersonalCenter = false" />
  </div>
  <div v-else class="sidebar-user" @click="emit('login')">
    <div class="su-avatar">
      <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
      </svg>
    </div>
    <span class="su-name">未登录</span>
  </div>
</template>

<style scoped>
.sidebar-user-area { position: relative; }
.user-popup {
  position: absolute; bottom: calc(100% + 4px); left: 8px; right: 8px;
  background: #fff; border-radius: 10px;
  box-shadow: 0 -2px 16px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);
  overflow: hidden; z-index: 20;
}
.user-popup-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer; font-size: 14px; color: #1a2332;
  transition: background 0.15s;
}
.user-popup-item:hover { background: #f0f4fe; color: #2b5fd9; }
.user-popup-item:first-child { border-bottom: 1px solid #f0f0f0; }
.menu-up-enter-active, .menu-up-leave-active { transition: all 0.2s ease; }
.menu-up-enter-from, .menu-up-leave-to { opacity: 0; transform: translateY(8px); }

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}
.sidebar-user:hover { background: #f0f4fe; }
.su-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(64, 158, 255, 0.15);
  display: flex; align-items: center; justify-content: center;
  color: #409eff; flex-shrink: 0; font-size: 15px; font-weight: 600;
}
.su-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.su-name { font-size: 13px; font-weight: 600; color: #1f1f1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.su-role { font-size: 11px; color: #8e8e93; }
.su-status { font-size: 11px; color: #67c23a; background: #f0f9eb; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
</style>
