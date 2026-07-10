// ── 权限状态管理 ──
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem, UserRole } from '@/types'
import { useUserStore } from './user'
import { allMenus, roleMenuMap } from '@/config/permission'

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

  function hasPermission(_action: string): boolean {
    return true
  }

  function loadMenus() {
    menus.value = permissionMenus.value
  }

  return { menus, permissionMenus, loadMenus, hasPermission }
})
