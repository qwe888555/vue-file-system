// ── 智能问答模块接口 ──
// 人员 B 实现
import request from './request'
import type { Conversation, Message, PaginatedResult } from '@/types'

/** 后端会话列表原始响应格式 */
interface ConversationsRawItem {
  id: number
  title: string
  created_at: string
  updated_at: string
}
interface ConversationsRawResponse {
  count: number
  next: string | null
  previous: string | null
  results: ConversationsRawItem[]
}

/** 获取会话列表（分页）— 适配真实后端格式 */
export async function getConversationsApi(params: { page: number; pageSize: number }): Promise<PaginatedResult<Conversation>> {
  const res: ConversationsRawResponse = await request.get('/chat/conversations/', {
    params: { page: params.page, page_size: params.pageSize },
  })
  return {
    list: res.results.map((item) => ({
      id: item.id,
      title: item.title || '',
      isFavorite: false,
      messageCount: 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    total: res.count,
    page: params.page,
    pageSize: params.pageSize,
  }
}

/** 后端新建会话响应格式 */
interface CreateConversationResponse {
  id: number
  title: string
  messages: any[]
  created_at: string
  updated_at: string
}

/** 新建会话 */
export async function createConversationApi(): Promise<Conversation> {
  const res: CreateConversationResponse = await request.post('/chat/conversations/')
  return {
    id: res.id,
    title: res.title || '',
    isFavorite: false,
    messageCount: res.messages?.length || 0,
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
  return request.get(`/chat/conversations/${conversationId}/messages/`)
}

/** 流式问答 POST 请求（返回 ReadableStream 供 parseSSE 消费） */
export function askQuestionApi(conversationId: number, question: string): Promise<Response> {
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  const token = localStorage.getItem('access_token') || ''
  return fetch(`${baseUrl}/chat/ask/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ conversation_id: conversationId, question }),
  })
}

/** 点赞/点踩 */
export function feedbackApi(messageId: number, type: 'like' | 'dislike', reason?: string): Promise<void> {
  return request.post(`/chat/messages/${messageId}/feedback/`, { type, reason })
}
