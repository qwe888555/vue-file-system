import type { RouteRecordRaw } from 'vue-router'

// ── 手机端路由 ──
// /mobile/login 独立（全屏登录页，无 Tab 栏）
// /mobile → MobileLayout（固定全屏外壳 + 底部 Tab 栏）下的子页面
const mobileRoutes: RouteRecordRaw[] = [
  {
    path: '/mobile/login',
    name: 'MobileLogin',
    component: () => import('@/views/mobile/MobileLogin.vue'),
    meta: { title: '登录', hidden: true, public: true },
  },
  {
    path: '/mobile',
    component: () => import('@/views/mobile/MobileLayout.vue'),
    meta: { title: '移动端', hidden: true },
    redirect: '/mobile/chat',
    children: [
      {
        path: 'chat',
        name: 'MobileChat',
        component: () => import('@/views/mobile/MobileChat.vue'),
        // 游客可浏览（提问/历史面板时才引导登录），避免守卫在 /mobile/chat 与 / 间死循环
        meta: { title: '智能问答', hidden: true, public: true },
      },
      {
        path: 'faq',
        name: 'MobileFaq',
        component: () => import('@/views/mobile/MobileFaq.vue'),
        // 游客可浏览常见问题（组件内置 401 登录引导）
        meta: { title: '常见问题', hidden: true, public: true },
      },
    ],
  },
]

export default mobileRoutes
