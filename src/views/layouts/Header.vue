<script setup lang="ts">
// ── 顶部栏 ──
// 人员 A 实现
//
// 功能：面包屑导航 + 用户头像下拉菜单（个人中心/修改密码/退出登录）

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessageBox } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

const username = computed(() => userStore.username)
const avatar = computed(() => userStore.avatar)

function goToProfile() {
  router.push('/profile')
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录吗？', '提示')
    await userStore.logout()
    router.push('/login')
  } catch {
    // 取消操作，不处理
  }
}
</script>

<template>
  <header class="layout-header">
    <!-- 面包屑（TODO: 根据路由 meta.title 渲染） -->
    <div class="header-left">
      <el-breadcrumb>
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="header-right">
      <el-dropdown trigger="click">
        <span class="user-info">
          <el-avatar :size="32" :src="avatar || undefined">
            {{ username?.charAt(0)?.toUpperCase() }}
          </el-avatar>
          <span class="username">{{ username }}</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="goToProfile">个人中心</el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style scoped>
.layout-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  background: #fff;
  border-bottom: 1px solid var(--color-border, #e4e7ed);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  font-size: 14px;
  color: var(--color-text, #303133);
}
</style>
