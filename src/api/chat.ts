// ── 智能问答模块接口 ──
// 人员 B 实现
import request from './request'
import type { Conversation, Message, PaginatedResult } from '@/types'

/** 获取会话列表（文档 1.1）— 兼容纯数组和分页格式 */
export async function getConversationsApi(): Promise<Conversation[]> {
  const res: any = await request.get('/chat/conversations/')
  const list = Array.isArray(res) ? res : (res?.results || [])
  return list.map((item: any) => ({
    id: item.id,
    title: item.title || '',
    isFavorite: false,
    messageCount: 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }))
}

/** 获取会话详情含消息列表（文档 1.2） */
export async function getConversationDetailApi(conversationId: number): Promise<{ conversation: Conversation; messages: Message[] }> {
  const res: {
    id: number; title: string; created_at: string; updated_at: string
    messages: Array<{ id: number; role: string; content: string; references: any; created_at: string }>
  } = await request.get(`/chat/conversations/${conversationId}/`)
  return {
    conversation: { id: res.id, title: res.title || '', isFavorite: false, messageCount: res.messages?.length || 0, createdAt: res.created_at, updatedAt: res.updated_at },
    messages: (res.messages || []).map((m) => ({
      id: m.id, conversationId, role: m.role as 'user' | 'assistant', content: m.content, references: m.references, createdAt: m.created_at,
    })),
  }
}

/** 新建会话（文档 1.3） */
export async function createConversationApi(title?: string): Promise<Conversation> {
  const res: { id: number; title: string; created_at: string; updated_at: string } = await request.post('/chat/conversations/', title ? { title } : undefined)
  return {
    id: res.id,
    title: res.title || '',
    isFavorite: false,
    messageCount: 0,
    createdAt: res.created_at,
    updatedAt: res.updated_at,
  }
}

/** 删除单个会话 */
export async function deleteConversationApi(id: number): Promise<void> {
  await request.delete(`/chat/conversations/${id}/`)
}

/** PATCH 重命名会话响应格式 */
interface RenameConversationResponse {
  id: number
  title: string
  created_at: string
  updated_at: string
}

/** 重命名会话（PATCH） */
export async function renameConversationApi(id: number, title: string): Promise<Conversation> {
  const res: RenameConversationResponse = await request.patch(`/chat/conversations/${id}/`, { title })
  return {
    id: res.id,
    title: res.title || '',
    isFavorite: false,
    messageCount: 0,
    createdAt: res.created_at,
    updatedAt: res.updated_at,
  }
}

/** 收藏/取消收藏会话 */
export function toggleFavoriteApi(id: number): Promise<void> {
  return request.put(`/chat/conversations/${id}/favorite/`)
}

/** 获取某会话的消息列表 */
export function getMessagesApi(conversationId: number): Promise<Message[]> {
  return request.get('/chat/message/', { params: { conversation_id: conversationId } })
}

/** 流式问答 POST 请求（返回 ReadableStream 供 parseSSE 消费） */
export function askQuestionApi(conversationId: number | null, question: string): Promise<Response> {
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  const token = localStorage.getItem('access_token') || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${baseUrl}/chat/ask/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversation_id: conversationId, question }),
  })
}

/** 赞/踩消息（文档 1.2） */
export function rateMessageApi(messageId: number, type: 'like' | 'dislike'): Promise<void> {
  return request.post(`/chat/message/${messageId}/rate/`, { rating: type })
}

/** 获取消息引用文件 */
export function getMessageReferencesApi(messageId: number): Promise<any> {
  return request.get(`/chat/message/${messageId}/references/`)
}

/** 获取热点问题 */
export function getHotQuestionsApi(params?: { days?: number; top_k?: number }): Promise<Array<{ question: string; count: number }>> {
  return request.get('/chat/hot-questions/', { params })
}

/** 语音问答（返回 SSE ReadableStream） */
export function voiceAskApi(audioBlob: Blob, conversationId?: number | null): Promise<Response> {
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  const token = localStorage.getItem('access_token') || ''
  const formData = new FormData()
  // 后端支持 WAV/MP3/PCM，使用通用扩展名
  formData.append('audio_file', audioBlob, 'recording.webm')
  if (conversationId) formData.append('conversation_id', String(conversationId))
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${baseUrl}/chat/voice-ask/`, {
    method: 'POST',
    headers,
    body: formData,
  })
}
