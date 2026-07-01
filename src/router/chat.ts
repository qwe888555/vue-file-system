import type { RouteRecordRaw } from 'vue-router'

const chatRoutes: RouteRecordRaw[] = [
  {
    path: '/chat',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '智能问答', icon: 'ChatLineSquare' },
    children: [
      {
        path: '',
        name: 'Chat',
        component: () => import('@/views/chat/ChatHome.vue'),
      },
    ],
  },
]

export default chatRoutes
