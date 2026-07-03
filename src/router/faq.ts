import type { RouteRecordRaw } from 'vue-router'

const faqRoutes: RouteRecordRaw[] = [
  {
    path: '/faq',
    name: 'Faq',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '常见问题', icon: 'ChatDotSquare' },
    children: [
      {
        path: '',
        name: 'FaqList',
        component: () => import('@/views/faq/FaqList.vue'),
      },
    ],
  },
  {
    path: '/faq-manage',
    name: 'FaqManage',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: 'FAQ 管理', icon: 'ChatDotSquare', roles: ['super_admin', 'admin', 'college_admin', 'dept_admin'] },
    children: [
      {
        path: '',
        name: 'FaqManageHome',
        component: () => import('@/views/faq/FaqManage.vue'),
      },
    ],
  },
]

export default faqRoutes
