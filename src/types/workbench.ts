import type { FolderId } from '@/types'

export type UploadItemStatus = 'analyzing' | 'ready' | 'error' | 'uploading' | 'done'

/** 上传暂存队列中的单个文件 */
export interface UploadQueueItem {
  key: string
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
  progress: number
  docId?: number
  confidence?: 'high' | 'medium' | 'low' | string
  suggestedFolderId?: FolderId | null
  suggestedFolderName?: string
}

/** 右侧信息确认面板的 AI 识别补充信息（不落库，仅展示） */
export interface AiDocMeta {
  confidence?: string
  recommendedTitle?: string
  suggestedFolderId?: FolderId | null
  suggestedFolderName?: string
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
  status: 'pending' | 'analyzing' | 'uploading' | 'done' | 'error'
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
