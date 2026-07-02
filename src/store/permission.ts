// ── 权限状态管理 ──
// 职责：管理动态菜单列表、按钮级权限集合
// 注意：≤200 行，不处理用户信息
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem, UserRole } from '@/types'
import { useUserStore } from './user'

// ── 多角色菜单配置 ──
const allMenus: MenuItem[] = [
  {
    path: '/chat',
    name: 'Chat',
    title: '智能问答',
    icon: 'ChatLineSquare',
  },
  {
    path: '/knowledge',
    name: 'Knowledge',
    title: '文件管理',
    icon: 'Folder',
    children: [
      { path: '/knowledge/list', name: 'DocList', title: '文档列表' },
      { path: '/knowledge/upload', name: 'DocUpload', title: '上传文档' },
      { path: '/knowledge/browse', name: 'Browse', title: '分类浏览' },
    ],
  },
  {
    path: '/admin',
    name: 'Admin',
    title: '账号管理',
    icon: 'Setting',
    children: [
      { path: '/admin/users', name: 'UserList', title: '账号管理' },
    ],
  },
  {
    path: '/profile',
    name: 'Profile',
    title: '个人中心',
    icon: 'User',
  },
]

// ── 角色 → 可访问菜单 path 映射 ──
const roleMenuMap: Record<UserRole, string[]> = {
  user: ['/chat', '/profile'],
  admin_csic: ['/chat', '/knowledge', '/admin', '/profile'],
  admin_dept: ['/chat', '/knowledge', '/admin', '/profile'],
  superadmin: ['/chat', '/knowledge', '/admin', '/profile'],
}

// ── 角色 → 按钮操作映射 ──
const roleActions: Record<UserRole, string[]> = {
  superadmin: ['create', 'edit', 'delete', 'reset-password', 'batch-delete', 'batch-reset'],
  admin_csic: ['create', 'edit', 'reset-password'],
  admin_dept: ['create', 'edit', 'reset-password'],
  user: [],
}

export const usePermissionStore = defineStore('permission', () => {
  const menus = ref<MenuItem[]>([])

  /** 根据角色过滤菜单 */
  const permissionMenus = computed(() => {
    const userStore = useUserStore()
    if (!userStore.role) return []
    return filterMenus(allMenus, userStore.role)
  })

  /** 递归过滤菜单树 */
  function filterMenus(items: MenuItem[], role: UserRole): MenuItem[] {
    const allowedPaths = roleMenuMap[role] || []
    return items
      .filter((item) => allowedPaths.some((p) => item.path.startsWith(p) || item.path === p))
      .map((item) => ({
        ...item,
        children: item.children ? filterMenus(item.children, role) : undefined,
      }))
  }

  /** 判断按钮是否可见（v-permission 指令使用） */
  function hasPermission(action: string): boolean {
    const userStore = useUserStore()
    const role = userStore.role
    if (!role) return false
    const allowed = roleActions[role] || []
    return allowed.includes(action)
  }

  function loadMenus() {
    menus.value = permissionMenus.value
  }

  return { menus, permissionMenus, loadMenus, hasPermission }
})
