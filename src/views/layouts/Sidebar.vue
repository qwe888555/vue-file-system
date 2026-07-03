<script setup lang="ts">
// ── 侧边栏 ──
// 功能：Logo + 菜单导航（按角色动态过滤）+ 底部用户信息

import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import { ElMessageBox } from 'element-plus'
import logoImg from '@/assets/logo.png'
import PersonalCenter from '@/components/common/PersonalCenter.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const showPersonalCenter = ref(false)

// 按角色动态生成菜单项
const menuItems = computed(() => {
  return permissionStore.permissionMenus.map((item) => ({
    path: item.children?.[0]?.path ?? item.path,
    label: item.title,
    icon: item.icon || '',
  }))
})

// 按路径前缀匹配高亮
const activeMenu = computed(() => {
  const matched = menuItems.value.find((item) => route.path.startsWith(item.path))
  return matched ? matched.path : route.path
})

const isLoggedIn = computed(() => !!userStore.token)
const userDisplayRole = computed(() => {
  if (userStore.role === 'admin') return '普通管理员'
  return userStore.userInfo?.role_display || ''
})

function handleSelect(path: string) {
  router.push(path)
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示')
    userStore.logout()
    router.push('/login')
  } catch {
    // 取消操作
  }
}
</script>

<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-logo">
      <img :src="logoImg" alt="成都东软学院" class="sidebar-logo-img" />
    </div>

    <div class="sidebar-divider" />

    <!-- 菜单 -->
    <el-menu
      :default-active="activeMenu"
      @select="handleSelect"
      class="sidebar-menu"
    >
      <el-menu-item
        v-for="item in menuItems"
        :key="item.path"
        :index="item.path"
      >
        <el-icon class="menu-icon">
          <component :is="item.icon" />
        </el-icon>
        <span class="menu-label">{{ item.label }}</span>
      </el-menu-item>
    </el-menu>

    <!-- 个人中心（管理员和普通用户） -->
    <div v-if="isLoggedIn && userStore.role !== 'super_admin'" class="sidebar-pc" @click="showPersonalCenter = true">
      <el-icon class="menu-icon"><User /></el-icon>
      <span class="menu-label">个人中心</span>
    </div>

    <!-- 底部用户 -->
    <div v-if="isLoggedIn" class="sidebar-user" @click="handleLogout">
      <div class="su-avatar">
        <span class="su-avatar-text">{{ (userDisplayRole || userStore.userInfo?.username || '?').charAt(0).toUpperCase() }}</span>
      </div>
      <div class="su-info">
        <span class="su-name">{{ userStore.userInfo?.username || '' }}</span>
        <span class="su-role">{{ userDisplayRole }}</span>
      </div>
      <span class="su-status">已登录</span>
    </div>
    <div v-else class="sidebar-user" @click="router.push('/login')">
      <div class="su-avatar">
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
        </svg>
      </div>
      <span class="su-name">未登录</span>
    </div>
    <PersonalCenter v-if="showPersonalCenter" @close="showPersonalCenter = false" />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 222px;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
  box-shadow: 1px 0 0 rgba(0, 0, 0, 0.06);
  z-index: 10;
}

/* ── Logo 区域 ── */
.sidebar-logo {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  flex-shrink: 0;
}

.sidebar-logo-img {
  height: 40px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

/* ── 分割线 ── */
.sidebar-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #e8ecf1, transparent);
  margin: 0 16px;
  flex-shrink: 0;
}

/* ── 菜单 ── */
.sidebar-menu {
  border-right: none;
  flex: 1;
  padding: 12px 12px;
  background: transparent;
}

.sidebar-menu .el-menu-item {
  height: 48px;
  margin-bottom: 4px;
  border-radius: 10px;
  padding: 0 14px;
  color: #5a6070;
  font-size: 14px;
  font-weight: 450;
  letter-spacing: 0.01em;
  transition: all 0.2s ease;
}

.sidebar-menu .el-menu-item .menu-icon {
  font-size: 20px;
  margin-right: 10px;
  color: #8e95a6;
  transition: color 0.2s ease;
}

.sidebar-menu .el-menu-item .menu-label {
  line-height: 1.5;
}

.sidebar-menu .el-menu-item:hover {
  background-color: #f0f4fa;
  color: #2c3e50;
}

.sidebar-menu .el-menu-item:hover .menu-icon {
  color: #5a7cf0;
}

.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(135deg, #eef3fe 0%, #e6edfe 100%);
  color: #2b5fd9;
  font-weight: 550;
  box-shadow: inset 3px 0 0 #2b5fd9;
}

.sidebar-menu .el-menu-item.is-active .menu-icon {
  color: #2b5fd9;
}

/* ── 个人中心 ── */
.sidebar-pc {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 26px;
  cursor: pointer;
  color: #5a6070;
  font-size: 14px;
  font-weight: 450;
  transition: all 0.2s ease;
  border-top: 1px solid #f0f0f0;
}
.sidebar-pc:hover {
  background-color: #f0f4fa;
  color: #2b5fd9;
}
.sidebar-pc .menu-icon {
  font-size: 20px;
  color: #8e95a6;
  transition: color 0.2s ease;
}
.sidebar-pc:hover .menu-icon { color: #2b5fd9; }

/* ── 底部用户（与智能问答保持一致）── */
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
