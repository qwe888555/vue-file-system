// ── 权限状态管理 ──
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem, UserRole } from '@/types'
import { useUserStore } from './user'
import { allMenus, roleMenuMap } from '@/config/permission'

// ═══ 按钮级权限映射：action → 允许的角色列表 ═══
const permissionActionMap: Record<string, UserRole[]> = {
  // ── 部门管理（接口权限：POST/DELETE 仅超级管理员，文档 v1.0 2026-09-01） ──
  'department-manage': ['super_admin'],

  // ── 用户管理 ──
  create: ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  edit: ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  delete: ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  'batch-delete': ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  'reset-password': ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  'batch-reset-password': ['super_admin', 'admin', 'college_admin', 'dept_admin'],

  // ── 知识库管理 ──
  'knowledge-create': ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  'knowledge-edit': ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  'knowledge-delete': ['super_admin', 'admin', 'college_admin', 'dept_admin'],

  // ── FAQ 管理 ──
  'faq-create': ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  'faq-edit': ['super_admin', 'admin', 'college_admin', 'dept_admin'],
  'faq-delete': ['super_admin', 'admin', 'college_admin', 'dept_admin'],
}

export const usePermissionStore = defineStore('permission', () => {
  const menus = ref<MenuItem[]>([])

  const permissionMenus = computed(() => {
    const userStore = useUserStore()
    if (!userStore.role) return []
    return filterMenus(allMenus, userStore.role)
  })

  function filterMenus(items: MenuItem[], role: UserRole): MenuItem[] {
    const allowedPaths = roleMenuMap[role] || []
    return items
      .filter((item) => {
        // 菜单项声明了 meta.roles 时，需显式校验角色（如「所属单位」仅平台管理员可见）
        if (item.meta?.roles && !item.meta.roles.includes(role)) return false
        return allowedPaths.some((p) => item.path === p || item.path.startsWith(p + '/'))
      })
      .map((item) => ({
        ...item,
        children: item.children ? filterMenus(item.children, role) : undefined,
      }))
  }

  function hasPermission(action: string): boolean {
    const userStore = useUserStore()
    const userRole = userStore.role
    if (!userRole) return false
    // 超级管理员拥有所有权限
    if (userRole === 'super_admin') return true
    const allowedRoles = permissionActionMap[action]
    if (!allowedRoles) return false
    return allowedRoles.includes(userRole)
  }

  function loadMenus() {
    menus.value = permissionMenus.value
  }

  return { menus, permissionMenus, loadMenus, hasPermission }
})
