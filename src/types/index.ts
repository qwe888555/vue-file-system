// ── 用户相关 ──
export interface UserInfo {
  id: number
  username: string
  realName: string
  avatar: string
  email: string
  role: UserRole
  collegeId?: number
  collegeName?: string
  departmentId?: number
  departmentName?: string
}

export type UserRole = 'user' | 'admin_csic' | 'admin_dept' | 'superadmin'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: UserInfo
}

// ── 权限相关 ──
export interface MenuItem {
  path: string
  name: string
  title: string
  icon?: string
  children?: MenuItem[]
  meta?: {
    roles?: UserRole[]
    hidden?: boolean
  }
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete'

// ── 字典相关 ──
export interface DictItem {
  label: string
  value: string | number
  type: string
}

// ── 通用分页 ──
export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// ── API 通用响应 ──
export interface ApiResponse<T = any> {
  code: number
  data: T
  message: string
}

// ── 知识库文件 ──
export interface KnowledgeFile {
  id: number
  title: string
  category: string
  categoryName: string
  author: string
  summary: string
  fileUrl: string
  fileSize: number
  fileType: string
  collegeId: number
  collegeName: string
  status: number
  createdAt: string
  updatedAt: string
}

// ── 会话消息 ──
export interface Message {
  id: number
  conversationId: number
  role: 'user' | 'assistant'
  content: string
  references?: KnowledgeFile[]
  feedback?: 'like' | 'dislike' | null
  createdAt: string
}

export interface Conversation {
  id: number
  title: string
  isFavorite: boolean
  messageCount: number
  createdAt: string
  updatedAt: string
}

// ── 账号管理 ──
export interface Account {
  id: number
  username: string
  realName: string
  email: string
  role: UserRole
  collegeId?: number
  collegeName?: string
  status: number
  createdAt: string
}

export interface College {
  id: number
  name: string
  code: string
  sortOrder: number
  status: number
}

export interface Discipline {
  id: number
  name: string
  collegeId: number
  collegeName: string
  sortOrder: number
}

export interface ResourceCategory {
  id: number
  name: string
  parentId: number | null
  level: number
  sortOrder: number
  children?: ResourceCategory[]
}

// ── BaseTable 列定义 ──
export interface ColDef {
  prop: string
  label: string
  width?: string | number
  minWidth?: string | number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  fixed?: 'left' | 'right'
}
