import type { RouteRecordRaw } from 'vue-router'

const mobileRoutes: RouteRecordRaw[] = [
  {
    path: '/mobile/login',
    name: 'MobileLogin',
    component: () => import('@/views/mobile/MobileLogin.vue'),
    meta: { title: '登录', hidden: true },
  },
  {
    path: '/mobile/chat',
    name: 'MobileChat',
    component: () => import('@/views/mobile/MobileChat.vue'),
    meta: { title: '智能问答', hidden: true },
  },
]

export default mobileRoutes
