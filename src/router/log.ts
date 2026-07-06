import type { RouteRecordRaw } from 'vue-router'

const logRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/logs',
    name: 'LogView',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '日志管理', icon: 'Document', roles: ['super_admin'] },
    children: [
      {
        path: '',
        name: 'LogViewHome',
        component: () => import('@/views/admin/LogView.vue'),
      },
    ],
  },
]

export default logRoutes
