import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import type { UserRole } from '@/types'
import { getAllowedPaths } from '@/config/permission'

import authRoutes from './common'
import chatRoutes from './chat'
import knowledgeRoutes from './knowledge'
import adminRoutes from './account'
import { useUserStore } from '@/store/user'

// ── 合并所有路由 ──
const routes: RouteRecordRaw[] = [
  ...authRoutes,
  ...chatRoutes,
  ...knowledgeRoutes,
  ...adminRoutes,
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── 路由守卫：权限拦截 + 登录校验 ──
router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()

  // 白名单：登录页、异常页（硬编码 /login 防止路由死循环）
  if (to.path === '/login' || to.meta.hidden) {
    next()
    return
  }

  // 未登录 → 跳登录页
  if (!userStore.token) {
    next({ path: '/login' })
    return
  }

  // 已登录但未获取用户信息 → 拉取
  if (!userStore.role) {
    try {
      await userStore.getUserInfo()
    } catch {
      userStore.logout()
      next({ path: '/login' })
      return
    }
  }

  const currentRole = userStore.role
  if (!currentRole) {
    next({ path: '/login' })
    return
  }

  // 权限校验
  if (to.meta.roles) {
    const allowedRoles = to.meta.roles as UserRole[]
    if (!allowedRoles.includes(currentRole!)) {
      console.warn(
        `[权限守卫] 角色 "${currentRole}" 无权访问 "${to.path}"，所需角色:`,
        allowedRoles,
      )
      next({ path: '/403' })
      return
    }
  }

  // 角色菜单校验
  const allowedPaths = getAllowedPaths(currentRole!)
  const matched = to.matched.some((r) => allowedPaths.some((p) => r.path.startsWith(p)))
  if (!matched && to.path !== '/') {
    console.warn(
      `[权限守卫] 路径 "${to.path}" 不在角色 "${currentRole}" 的允许列表中:`,
      allowedPaths,
    )
    next({ path: '/403' })
    return
  }

  next()
})

export default router
