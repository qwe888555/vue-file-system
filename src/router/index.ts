import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import type { UserRole } from '@/types'

import authRoutes from './common'
import chatRoutes from './chat'
import knowledgeRoutes from './knowledge'
import adminRoutes from './account'
import { useUserStore } from '@/store/user'

// ── 用户专属路由（个人中心） ──
const profileRoutes: RouteRecordRaw[] = [
  {
    path: '/profile',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '个人中心', icon: 'User' },
    children: [
      {
        path: '',
        name: 'Profile',
        component: () => import('@/views/profile/Profile.vue'),
      },
    ],
  },
]

// ── 合并所有路由 ──
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/chat' },
  ...authRoutes,
  ...chatRoutes,
  ...profileRoutes,
  ...knowledgeRoutes,
  ...adminRoutes,
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── 路由守卫：权限拦截 + 登录校验 ──
const roleMenuMap: Record<UserRole, string[]> = {
  user: ['/chat', '/profile'],
  admin: ['/chat', '/knowledge', '/profile'],
  superadmin: ['/chat', '/knowledge', '/admin', '/profile'],
}

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()

  // 白名单：登录页、异常页
  if (to.meta.hidden) {
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

  const currentRole = userStore.role!
  if (!currentRole) {
    next({ path: '/login' })
    return
  }

  // 权限校验
  if (to.meta.roles) {
    const allowedRoles = to.meta.roles as UserRole[]
    if (!allowedRoles.includes(currentRole)) {
      next({ path: '/403' })
      return
    }
  }

  // 角色菜单校验
  const allowedPaths = roleMenuMap[currentRole] || []
  const matched = to.matched.some((r) => allowedPaths.some((p) => r.path.startsWith(p)))
  if (!matched && to.path !== '/') {
    next({ path: '/403' })
    return
  }

  next()
})

export default router
