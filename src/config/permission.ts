// ── 权限配置（单⼀数据源） ──
// 路由守卫 & 权限菜单共同依赖此处定义
import type { UserRole, MenuItem } from '@/types'

export const roleMenuMap: Record<UserRole, string[]> = {
  user: ['/chat', '/faq'],
  admin: ['/chat', '/faq-manage', '/knowledge', '/admin'],
  college_admin: ['/chat', '/faq-manage', '/knowledge', '/admin'],
  dept_admin: ['/chat', '/faq-manage', '/knowledge', '/admin'],
  super_admin: ['/chat', '/faq-manage', '/knowledge', '/admin'],
}

export const allMenus: MenuItem[] = [
  {
    path: '/chat',
    name: 'Chat',
    title: '智能问答',
    icon: 'ChatLineSquare',
  },
  {
    path: '/faq',
    name: 'FaqList',
    title: '常见问题',
    icon: 'ChatDotSquare',
  },
  {
    path: '/faq-manage',
    name: 'FaqManage',
    title: 'FAQ 管理',
    icon: 'ChatDotSquare',
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
    ],
  },
]

export function getAllowedPaths(role: UserRole): string[] {
  return roleMenuMap[role] || []
}
