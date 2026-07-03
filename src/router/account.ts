import type { RouteRecordRaw } from 'vue-router'

const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '账号管理', icon: 'Setting', roles: ['super_admin', 'admin', 'admin_csic', 'admin_dept', 'college_admin'] },
    children: [
      {
        path: 'users',
        name: 'UserList',
        component: () => import('@/views/account/UserList.vue'),
        meta: { title: '用户账号' },
      },
    ],
  },
]

export default adminRoutes
