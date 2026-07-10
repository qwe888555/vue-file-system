/* eslint-disable no-console */
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import type { UserRole } from '@/types'
import { getAllowedPaths } from '@/config/permission'

import authRoutes from './common'
import chatRoutes from './chat'
import faqRoutes from './faq'
import knowledgeRoutes from './knowledge'
import adminRoutes from './account'
import logRoutes from './log'
import mobileRoutes from './mobile'
import { useUserStore } from '@/store/user'

// ── 合并所有路由 ──
const routes: RouteRecordRaw[] = [
  ...authRoutes,
  ...chatRoutes,
  ...faqRoutes,
  ...knowledgeRoutes,
  ...adminRoutes,
  ...logRoutes,
  ...mobileRoutes,
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── 移动端检测 ──
function isMobileDevice(): boolean {
  // 屏幕宽度 < 768px 视为移动端
  if (typeof window !== 'undefined' && window.innerWidth < 768) return true
  // userAgent 检测
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  return /mobile|android|iphone|ipad|phone/i.test(ua)
}

// ── 页面级初始化标记（刷新时重置，同页导航不复请求） ──
let pageInitialized = false

// ── 路由守卫：权限拦截 + 登录校验 ──
router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()

  // 移动端自动跳转到移动端页面
  if (isMobileDevice() && !to.path.startsWith('/mobile')) {
    next('/mobile/chat')
    return
  }

  // 白名单：首页、异常页（首页 meta.hidden 由 common.ts 标记）
  if (to.meta.hidden) {
    next()
    return
  }

  // 未登录 → 跳首页（嵌入式登录）
  if (!userStore.token) {
    next({ path: '/' })
    return
  }

  // 页面刷新时：始终调用 getUserInfo() 确保角色为最新（覆盖 localStorage 旧缓存）
  if (!pageInitialized) {
    try {
      await userStore.getUserInfo()
      pageInitialized = true
    } catch {
      userStore.logout()
      next({ path: '/' })
      return
    }
  }

  // 已登录但未获取用户信息 → 拉取（兜底）
  if (!userStore.role) {
    try {
      await userStore.getUserInfo()
    } catch {
      userStore.logout()
      next({ path: '/' })
      return
    }
  }

  let currentRole = userStore.role
  if (!currentRole) {
    next({ path: '/' })
    return
  }

  // 兼容：后端可能返回 superadmin（无下划线），统一为 super_admin
  if ((currentRole as string) === 'superadmin') currentRole = 'super_admin' as UserRole

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
  const matched = to.matched.some((r) => allowedPaths.some((p) => r.path === p || r.path.startsWith(p + '/')))
  if (!matched && to.path !== '/') {
    console.warn(
      `[权限守卫] 路径 "${to.path}" 不在角色 "${currentRole}" 的允许列表中，跳转角色首页`,
      allowedPaths,
    )
    const home = currentRole === 'super_admin' || currentRole === 'admin' || currentRole === 'college_admin' || currentRole === 'dept_admin' ? '/knowledge/list' : '/chat'
    next({ path: home })
    return
  }

  next()
})

export default router
