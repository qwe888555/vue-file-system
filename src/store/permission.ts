// ── 权限状态管理 ──
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem, UserRole } from '@/types'
import { useUserStore } from './user'
import { allMenus, roleMenuMap } from '@/config/permission'

// ── 角色 → 按钮操作映射 ──
const roleActions: Record<UserRole, string[]> = {
  superadmin: ['create', 'edit', 'delete', 'reset-password', 'batch-delete', 'batch-reset'],
  admin_csic: ['create', 'edit', 'reset-password'],
  admin_dept: ['create', 'edit', 'reset-password'],
  user: [],
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
      .filter((item) => allowedPaths.some((p) => item.path.startsWith(p) || item.path === p))
      .map((item) => ({
        ...item,
        children: item.children ? filterMenus(item.children, role) : undefined,
      }))
  }

  function hasPermission(_action: string): boolean {
    return true
  }

  function loadMenus() {
    menus.value = permissionMenus.value
  }

  return { menus, permissionMenus, loadMenus, hasPermission }
})
