import type { FolderId } from '@/types'

export type UploadItemStatus = 'analyzing' | 'ready' | 'error' | 'uploading' | 'done'

/** 上传暂存队列中的单个文件 */
export interface UploadQueueItem {
  key: string
  /** 上传前草稿在信息面板中的临时 id（负数，避免与已入库文档冲突） */
  draftId: number
  file: File
  title: string
  originalTitle: string
  /** AI 推荐文件名（默认不覆盖原文件名） */
  aiTitle: string
  aiTitleUsed: boolean
  description: string
  keywords: string[]
  tags: string[]
  scope: 'public' | 'private'
  status: UploadItemStatus
  errorMessage: string
  /** 加入队列后即开始 AI 识别，失败时记录原因但允许直接上传 */
  analysisError?: string
  /** 本文件预选的上传目录；为空表示待分类 */
  targetFolderId: FolderId | null
  progress: number
  docId?: number
  confidence?: 'high' | 'medium' | 'low' | string
}

/** 右侧信息确认面板的 AI 识别补充信息（不落库，仅展示） */
export interface AiDocMeta {
  confidence?: string
  recommendedTitle?: string
  analyzedAt?: string
  fromUpload?: boolean
  /** AI 提取的关键词 */
  keywords?: string[]
  /** AI 推荐的可见性 */
  visibility?: 'public' | 'private'
}

/** 右侧信息面板顶部的批量上传标签页 */
export interface InfoTab {
  key: string
  title: string
  status: 'pending' | 'analyzing' | 'ready' | 'uploading' | 'done' | 'error'
  docId?: number
  error?: string
  progress?: number
}

export interface InfoSavePayload {
  title: string
  description: string
  keywords: string[]
  tags: string[]
  scope: 'public' | 'private'
  folderId: FolderId | null
}
