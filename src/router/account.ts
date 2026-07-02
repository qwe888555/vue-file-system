import type { RouteRecordRaw } from 'vue-router'

const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: { title: '账号管理', icon: 'Setting', roles: ['super_admin', 'admin'] },
    children: [
      {
        path: 'users',
        name: 'UserManage',
        component: () => import('@/views/account/UserManage.vue'),
        meta: { title: '用户账号' },
      },
      {
        path: 'colleges',
        name: 'CollegeManage',
        component: () => import('@/views/account/CollegeManage.vue'),
        meta: { title: '学院部门' },
      },
      {
        path: 'disciplines',
        name: 'DisciplineManage',
        component: () => import('@/views/account/DisciplineManage.vue'),
        meta: { title: '学科管理' },
      },
      {
        path: 'categories',
        name: 'CategoryManage',
        component: () => import('@/views/account/CategoryManage.vue'),
        meta: { title: '资源类型' },
      },
      {
        path: 'feedback-pending',
        name: 'FeedbackPending',
        component: () => import('@/views/account/FeedbackPending.vue'),
        meta: { title: '兜底问答' },
      },
    ],
  },
]

export default adminRoutes
