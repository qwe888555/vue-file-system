import type { RouteRecordRaw } from 'vue-router'

const faqRoutes: RouteRecordRaw[] = [
  {
    path: '/faq',
    name: 'Faq',
    component: () => import('@/views/layouts/Layout.vue'),
    // 前端策略：需登录后才能浏览（后端 /faq/items/ 本身是 AllowAny，此处是前端更严格的闸）。
    // 未登录 → 守卫跳首页登录；登录后按 roleMenuMap 校验，仅 user 角色有此路径，
    // 四个管理角色不在 roleMenuMap.user 的允许列表中，访问会被弹回知识库列表。
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
