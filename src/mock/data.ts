// ── 后台管理 Mock 数据 ──
import type { College, Account } from '@/types'

/** 学院/部门假数据（2条） */
export const mockColleges: College[] = [
  {
    id: 1,
    name: '计算机科学与技术学院',
    code: 'CS',
    sortOrder: 1,
    status: 1,
  },
  {
    id: 2,
    name: '数学与统计学院',
    code: 'MATH',
    sortOrder: 2,
    status: 1,
  },
]

/** 用户账号假数据（2条） */
export const mockAccounts: Account[] = [
  {
    id: 1,
    username: 'zhangsan',
    realName: '张三',
    email: 'zhangsan@cs.edu.cn',
    role: 'admin_csic',
    collegeId: 1,
    collegeName: '计算机科学与技术学院',
    status: 1,
    createdAt: '2025-09-01',
  },
  {
    id: 2,
    username: 'lisi',
    realName: '李四',
    email: 'lisi@math.edu.cn',
    role: 'user',
    collegeId: 2,
    collegeName: '数学与统计学院',
    status: 1,
    createdAt: '2025-09-15',
  },
]
