// ── 部门管理路由 ──
// 接口权限（文档 v1.0 2026-09-01）：GET 列表所有管理员可用；POST/DELETE 仅超级管理员
import type { RouteRecordRaw } from 'vue-router'

const departmentRoutes: RouteRecordRaw[] = [
  {
    path: '/departments',
    name: 'DepartmentManage',
    component: () => import('@/views/layouts/Layout.vue'),
    meta: {
      title: '部门管理',
      icon: 'OfficeBuilding',
      roles: ['super_admin', 'admin', 'admin_csic', 'admin_dept', 'college_admin', 'dept_admin'],
    },
    children: [
      {
        path: '',
        name: 'DepartmentManageHome',
        component: () => import('@/views/account/DepartmentManage.vue'),
      },
    ],
  },
]

export default departmentRoutes
