import type { RouteRecordRaw } from 'vue-router'

// ── 文档审核路由 ──
// 仅 reviewer 可见：super_admin 不参与审核，其他管理员无审核入口
const reviewRoutes: RouteRecordRaw[] = [
  {
    path: '/review',
    name: 'ReviewLayout',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '文档审核', roles: ['reviewer'] },
    children: [
      {
        path: '',
        name: 'DocReview',
        component: () => import('@/views/knowledge/DocReview.vue'),
        meta: { title: '文档审核' },
      },
    ],
  },
]

export default reviewRoutes
