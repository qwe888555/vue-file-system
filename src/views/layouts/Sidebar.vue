<script setup lang="ts">
// ── 动态侧边栏 ──
// 人员 A 实现
//
// 功能：根据 usePermissionStore 动态渲染菜单列表
//       使用 Element Plus el-menu 组件
//       不同角色展示不同菜单项

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissionStore } from '@/store/permission'

const route = useRoute()
const router = useRouter()
const permissionStore = usePermissionStore()

const menus = computed(() => permissionStore.permissionMenus)
const activeMenu = computed(() => route.path)

function handleSelect(path: string) {
  router.push(path)
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <h2>NISU-CD</h2>
    </div>
    <el-menu
      :default-active="activeMenu"
      :router="false"
      @select="handleSelect"
      class="sidebar-menu"
    >
      <template v-for="item in menus" :key="item.path">
        <!-- 有子菜单 -->
        <el-sub-menu v-if="item.children?.length" :index="item.path">
          <template #title>
            <el-icon v-if="item.icon">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.title }}</span>
          </template>
          <el-menu-item
            v-for="child in item.children"
            :key="child.path"
            :index="child.path"
          >
            {{ child.title }}
          </el-menu-item>
        </el-sub-menu>
        <!-- 无子菜单 -->
        <el-menu-item v-else :index="item.path">
          <el-icon v-if="item.icon">
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </template>
    </el-menu>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  height: 100%;
  background: var(--color-bg-sidebar, #304156);
  color: #fff;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-logo h2 {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
}

.sidebar-menu {
  border-right: none;
}
</style>
