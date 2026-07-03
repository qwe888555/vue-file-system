// ── 集中式角色配置 ──
// 所有组件从此文件读取角色信息，避免重复定义
import type { UserRole } from '@/types'

export interface RoleMeta {
  label: string
  tagType: 'info' | 'warning' | 'danger' | 'success'
}

/** 角色 → 中文名 / 标签颜色 */
export const ROLE_CONFIG: Record<UserRole, RoleMeta> = {
  user:        { label: '普通用户',   tagType: 'info' },
  admin:       { label: '管理员',     tagType: 'warning' },
  super_admin: { label: '超级管理员', tagType: 'danger' },
}

/** 角色选项列表（供 el-select 等使用，不含"全部"） */
export const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, meta]) => ({
  value,
  label: meta.label,
}))
