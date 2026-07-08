import type { RouteRecordRaw } from 'vue-router'

/** 登录页 & 异常页 & 介绍页 */
const authRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/home/Introduction.vue'),
    meta: { title: 'NISU-CD 资源系统', hidden: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/components/common/Error403.vue'),
    meta: { title: '无权限访问', hidden: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/components/common/Error404.vue'),
    meta: { title: '页面不存在', hidden: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
    meta: { hidden: true },
  },
]

export default authRoutes
