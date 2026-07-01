import type { RouteRecordRaw } from 'vue-router'

const chatRoutes: RouteRecordRaw[] = [
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('@/views/chat/ChatHome.vue'),
    meta: { title: '智能问答', icon: 'ChatLineSquare' },
  },
]

export default chatRoutes
