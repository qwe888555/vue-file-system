<script setup lang="ts">
// ── 侧边栏 ──
// 功能：Logo 占位 + 菜单导航（智能问答 / 知识库管理 / 账号管理）

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoImg from '@/assets/logo.png'

const route = useRoute()
const router = useRouter()

const menuItems = [
  { path: '/chat', label: '智能问答', icon: 'ChatLineSquare' },
  { path: '/knowledge', label: '知识库管理', icon: 'Folder' },
  { path: '/admin/users', label: '账号管理', icon: 'Setting' },
]

// 按路径前缀匹配高亮
const activeMenu = computed(() => {
  const matched = menuItems.find((item) => route.path.startsWith(item.path))
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
      <img :src="logoImg" alt="成都东软学院" class="sidebar-logo-img" />
    </div>

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
        <el-icon>
          <component :is="item.icon" />
        </el-icon>
        <span>{{ item.label }}</span>
      </el-menu-item>
    </el-menu>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
  padding: 0 16px;
}

.sidebar-logo-img {
  height: 44px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

.sidebar-menu {
  border-right: none;
  flex: 1;
}

.sidebar-menu .el-menu-item {
  color: #606266;
}

.sidebar-menu .el-menu-item.is-active {
  color: #409eff;
  background-color: #ecf5ff;
}

.sidebar-menu .el-menu-item:hover {
  background-color: #f5f7fa;
}
</style>
