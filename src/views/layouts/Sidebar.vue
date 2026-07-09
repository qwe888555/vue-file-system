<script setup lang="ts">
// ── 侧边栏 ──
// 功能：Logo + 菜单导航（按角色动态过滤）+ 底部用户信息

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissionStore } from '@/store/permission'
import SidebarUser from '@/components/common/SidebarUser.vue'

const route = useRoute()
const router = useRouter()
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

</script>

<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-logo">
      <span class="sidebar-logo-text">NeuHub</span>
      <span class="sidebar-logo-sub">资源系统</span>
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

    <SidebarUser @login="router.push('/')" />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 222px;
  height: 100%;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', Roboto, sans-serif;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  flex-shrink: 0;
  gap: 2px;
}
.sidebar-logo-text {
  font-size: 22px;
  font-weight: 700;
  color: #2b5fd9;
  letter-spacing: 2px;
  line-height: 1.2;
}
.sidebar-logo-sub {
  font-size: 13px;
  font-weight: 500;
  color: #8e95a6;
  letter-spacing: 4px;
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
}

.sidebar-menu .el-menu-item.is-active .menu-icon {
  color: #2b5fd9;
}

/* ── 个人中心 ── */
/* ── 底部用户区域（含上拉菜单）── */
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
