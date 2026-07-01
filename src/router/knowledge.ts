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
        path: 'upload',
        name: 'DocUpload',
        component: () => import('@/views/knowledge/DocUpload.vue'),
        meta: { title: '上传文档' },
      },
      {
        path: 'browse',
        name: 'Browse',
        component: () => import('@/views/knowledge/Browse.vue'),
        meta: { title: '分类浏览' },
      },
      {
        path: 'detail/:id',
        name: 'DocDetail',
        component: () => import('@/views/knowledge/DocDetail.vue'),
        meta: { title: '文档详情', hidden: true },
      },
      {
        path: 'edit/:id',
        name: 'DocEdit',
        component: () => import('@/views/knowledge/DocEdit.vue'),
        meta: { title: '编辑文档', hidden: true },
      },
    ],
  },
]

export default knowledgeRoutes
