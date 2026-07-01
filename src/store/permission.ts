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
      { path: '/admin/users', name: 'UserManage', title: '用户账号' },
      { path: '/admin/colleges', name: 'CollegeManage', title: '学院部门' },
      { path: '/admin/disciplines', name: 'DisciplineManage', title: '学科管理' },
      { path: '/admin/categories', name: 'CategoryManage', title: '资源类型' },
      { path: '/admin/feedback-pending', name: 'FeedbackPending', title: '兜底问答' },
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
  admin: ['/chat', '/knowledge', '/profile'],
  superadmin: ['/chat', '/knowledge', '/admin', '/profile'],
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
  function hasPermission(_action: string): boolean {
    // 按需实现：根据 role + 后端返回的按钮权限集合做判断
    return true
  }

  function loadMenus() {
    menus.value = permissionMenus.value
  }

  return { menus, permissionMenus, loadMenus, hasPermission }
})
