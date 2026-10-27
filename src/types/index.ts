// ── 用户相关（对齐后端 /api/admin/me/） ──
export interface UserInfo {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  role_display: string
  college_id: number | null
  college_name: string | null
  department_id: number | null
  department_name: string | null
  phone?: string
  avatar?: string
  date_joined?: string
  is_staff: boolean
  is_superuser: boolean
  permissions: {
    manage_users: boolean
    manage_resources: boolean
    manage_scope: 'all' | 'college' | 'department' | 'self'
  }
}

export type UserRole = 'user' | 'admin' | 'college_admin' | 'dept_admin' | 'super_admin'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  access: string
  refresh: string
  user: UserInfo
}

export interface RefreshParams {
  refresh: string
}

export interface RefreshResult {
  access: string
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

export interface Keyword {
  id: number
  phrase: string
  match_type: string
  weight: number
}

// ── 标签（全平台共享词表，与关键词独立） ──
export interface Tag {
  id: number
  name: string
  created_at: string
  /** 当前用户可浏览范围内打了该标签的文档数（词表接口返回） */
  doc_count?: number
}

export interface DocTag {
  id: number
  tag_id: number
  tag_name: string
  created_at: string
}

// ── 文档关联（文件网有向边：源文档 → 目标文档） ──
export type DocRelationType =
  | 'prerequisite'
  | 'supplement'
  | 'same_course'
  | 'citation'
  | 'replaces'

export interface DocRelation {
  id: number
  source_doc_id: number
  target_doc_id: number
  target_doc_title: string
  relation_type: DocRelationType
  relation_type_name: string
  created_at: string
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
  keywords: Keyword[]
  status: number
  createdAt: string
  updatedAt: string
  content?: string
  fileData?: string
  description?: string
  /** 后端详情接口返回的上传者 id / 用户名（用于判断能否编辑标签与关联） */
  uploader?: number
  uploader_name?: string
  visibility?: string
  /** 文档标签（仅详情接口返回） */
  tags?: DocTag[]
  /** 文档对外关联（文件网出边，仅详情接口返回） */
  relations?: DocRelation[]
  // OSS 相关字段（后端新增）
  oss_url?: string           // 签名内联预览 URL（7天有效）
  download_url?: string      // 附件下载 URL，带原始文件名（7天有效）
  file_name?: string         // 原始文件名
  file_ext?: string          // 真实扩展名（小写不含点，后端从 file_name 解析，空时兜底为 file_type 类别码）
  oss_key?: string           // OSS 对象键（UUID）
}

// ── 追问建议 ──
export interface SuggestedItem {
  display: string   // 引导式问句，前端展示用
  question: string  // 干净问句，用户点击后实际发送
}

// ── 问答图片 ──
export interface ImageItem {
  doc_id: number
  doc_title: string
  description: string
  preview_url: string
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
  suggested?: SuggestedItem[]
  images?: ImageItem[]
}

export interface Conversation {
  id: number
  title: string
  isFavorite: boolean
  messageCount: number
  createdAt: string
  updatedAt: string
}

// ── 账号管理（对齐后端 /api/admin/users/） ──
export interface Account {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  role_display: string
  college: number | null
  college_name: string | null
  department: number | null
  department_name: string | null
  is_active: boolean
  date_joined: string
  last_login: string | null
  uploaded_doc_count: number
}

export interface College {
  id: number
  name: string
  code: string
  sort_order: number
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
