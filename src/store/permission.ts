// ── 权限状态管理 ──
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem, UserRole } from '@/types'
import { useUserStore } from './user'
import { allMenus, roleMenuMap } from '@/config/permission'

// ═══ 按钮级权限映射：action → 允许的角色列表 ═══
const permissionActionMap: Record<string, UserRole[]> = {
  // ── 用户管理 ──
  create: ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  edit: ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  delete: ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  'batch-delete': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  'reset-password': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  'batch-reset-password': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],

  // ── 知识库管理 ──
  'knowledge-create': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  'knowledge-edit': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  'knowledge-delete': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],

  // ── FAQ 管理 ──
  'faq-create': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  'faq-edit': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
  'faq-delete': ['super_admin', 'admin', 'admin_csic', 'college_admin', 'dept_admin', 'admin_dept'],
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
      .filter((item) => allowedPaths.some((p) => item.path === p || item.path.startsWith(p + '/')))
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
