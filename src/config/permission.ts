// ── 权限配置（单⼀数据源） ──
// 路由守卫 & 权限菜单共同依赖此处定义
import type { UserRole, MenuItem } from '@/types'

export const roleMenuMap: Record<UserRole, string[]> = {
  user: ['/chat', '/faq'],
  admin: ['/chat', '/faq-manage', '/knowledge', '/admin'],
  admin_csic: ['/chat', '/faq-manage', '/knowledge', '/admin'],
  admin_dept: ['/chat', '/faq-manage', '/knowledge'],
  college_admin: ['/chat', '/faq-manage', '/knowledge', '/admin'],
  dept_admin: ['/chat', '/faq-manage', '/knowledge'],
  super_admin: ['/chat', '/faq-manage', '/knowledge', '/admin', '/logs'],
}

export const allMenus: MenuItem[] = [
  {
    path: '/knowledge',
    name: 'Knowledge',
    title: '知识库管理',
    icon: 'Folder',
    children: [
      { path: '/knowledge/list', name: 'DocList', title: '文档列表' },
    ],
  },
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
    path: '/admin',
    name: 'Admin',
    title: '账号管理',
    icon: 'Setting',
    children: [
      { path: '/admin/users', name: 'UserManage', title: '用户账号' },
      {
        path: '/admin/orgs',
        name: 'OrgManage',
        title: '所属单位',
        // 平台级组织架构维护权限：学院/部门仅平台管理员可操作
        meta: { roles: ['super_admin', 'admin', 'admin_csic'] },
      },
    ],
  },
  {
    path: '/logs',
    name: 'LogView',
    title: '日志管理',
    icon: 'Document',
  },
]

export function getAllowedPaths(role: UserRole): string[] {
  return roleMenuMap[role] || []
}
