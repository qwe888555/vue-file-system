import type { RouteRecordRaw } from 'vue-router'

const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '账号管理', icon: 'Setting', roles: ['super_admin', 'admin', 'college_admin'] },
    children: [
      {
        path: 'users',
        name: 'UserList',
        component: () => import('@/views/account/UserList.vue'),
        meta: { title: '用户账号' },
      },
      {
        path: 'orgs',
        name: 'OrgManage',
        component: () => import('@/views/account/OrgManage.vue'),
        // 学院/部门为平台级组织架构，仅平台级管理员可维护
        meta: { title: '所属单位', roles: ['super_admin', 'admin'] },
      },
    ],
  },
]

export default adminRoutes
