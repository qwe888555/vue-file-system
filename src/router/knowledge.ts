import type { RouteRecordRaw } from 'vue-router'

const knowledgeRoutes: RouteRecordRaw[] = [
  {
    path: '/knowledge',
    name: 'Knowledge',
    redirect: '/knowledge/list',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '文件管理', icon: 'Folder' },
    children: [
      {
        path: 'list',
        name: 'DocList',
        component: () => import('@/views/knowledge/DocList.vue'),
        meta: { title: '文档列表' },
      },
      {
        path: 'detail/:id',
        name: 'DocDetail',
        component: () => import('@/views/knowledge/DocDetail.vue'),
        meta: { title: '文档详情', hidden: true },
      },
      // ── 空壳路由重定向：功能已内联到列表/详情页 ──
      // 上传 / 分类浏览 → 文档列表（DocList 内已有上传与分类筛选）
      // 编辑 → 文档详情（DocDetail 内已有内联编辑）
      {
        path: 'upload',
        name: 'DocUpload',
        redirect: '/knowledge/list',
        meta: { title: '上传文档' },
      },
      {
        path: 'browse',
        name: 'Browse',
        redirect: '/knowledge/list',
        meta: { title: '分类浏览' },
      },
      {
        path: 'edit/:id',
        name: 'DocEdit',
        redirect: (to) => ({ name: 'DocDetail', params: { id: to.params.id } }),
        meta: { title: '编辑文档', hidden: true },
      },
    ],
  },
]

export default knowledgeRoutes
