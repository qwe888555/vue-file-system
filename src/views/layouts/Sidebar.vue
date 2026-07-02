<script setup lang="ts">
// ── 侧边栏 ──
// 功能：Logo 占位 + 菜单导航（按角色动态过滤）

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import logoImg from '@/assets/logo.png'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

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

function handleSelect(path: string) {
  router.push(path)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
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

    <!-- 退出登录 -->
    <div class="sidebar-logout" @click="handleLogout">
      <el-icon class="logout-icon"><SwitchButton /></el-icon>
      <span class="logout-label">退出登录</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
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

/* 菜单项 */
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

/* 图标 */
.sidebar-menu .el-menu-item .menu-icon {
  font-size: 20px;
  margin-right: 10px;
  color: #8e95a6;
  transition: color 0.2s ease;
}

/* 标签 */
.sidebar-menu .el-menu-item .menu-label {
  line-height: 1.5;
}

/* Hover 状态 */
.sidebar-menu .el-menu-item:hover {
  background-color: #f0f4fa;
  color: #2c3e50;
}

.sidebar-menu .el-menu-item:hover .menu-icon {
  color: #5a7cf0;
}

/* 激活状态 */
.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(135deg, #eef3fe 0%, #e6edfe 100%);
  color: #2b5fd9;
  font-weight: 550;
  box-shadow: inset 3px 0 0 #2b5fd9;
}

.sidebar-menu .el-menu-item.is-active .menu-icon {
  color: #2b5fd9;
}

/* ── 退出登录 ── */
.sidebar-logout {
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 26px;
  gap: 10px;
  cursor: pointer;
  border-top: 1px solid #f0f2f5;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.sidebar-logout:hover {
  background: #f8fafc;
}

.sidebar-logout:hover .logout-icon {
  color: #e74c3c;
}

.sidebar-logout:hover .logout-label {
  color: #e74c3c;
}

.logout-icon {
  font-size: 18px;
  color: #8e95a6;
  transition: color 0.2s ease;
}

.logout-label {
  font-size: 14px;
  color: #5a6070;
  font-weight: 450;
  line-height: 1.5;
  transition: color 0.2s ease;
}
</style>
