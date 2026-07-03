// ── 权限配置（单⼀数据源） ──
// 路由守卫 & 权限菜单共同依赖此处定义
import type { UserRole, MenuItem } from '@/types'

export const roleMenuMap: Record<UserRole, string[]> = {
  user: ['/chat', '/profile'],
  admin: ['/chat', '/knowledge', '/admin', '/profile'],
  super_admin: ['/chat', '/knowledge', '/admin', '/profile'],
  superadmin: ['/chat', '/knowledge', '/admin', '/profile'],
}

export const allMenus: MenuItem[] = [
  {
    path: '/chat',
    name: 'Chat',
    title: '智能问答',
    icon: 'ChatLineSquare',
  },
  {
    path: '/knowledge',
    name: 'Knowledge',
    title: '知识库管理',
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

export function getAllowedPaths(role: UserRole): string[] {
  return roleMenuMap[role] || []
}
