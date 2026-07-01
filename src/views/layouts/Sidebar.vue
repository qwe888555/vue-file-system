<script setup lang="ts">
// ── 侧边栏 ──
// 功能：Logo 占位 + 菜单导航（智能问答 / 知识库管理 / 账号管理）

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
    <!-- Logo 占位 -->
    <div class="sidebar-logo">
      <div class="logo-placeholder">Logo</div>
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
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.logo-placeholder {
  font-size: 18px;
  font-weight: 600;
  color: #909399;
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
