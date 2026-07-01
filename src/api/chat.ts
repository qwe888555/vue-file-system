// ── 智能问答模块接口 ──
// 人员 B 实现
import request from './request'
import type { Conversation, Message, PaginatedResult } from '@/types'

/** 获取会话列表（分页） */
export function getConversationsApi(params: { page: number; pageSize: number }): Promise<PaginatedResult<Conversation>> {
  return request.get('/chat/conversations', { params })
}

/** 新建会话 */
export function createConversationApi(): Promise<Conversation> {
  return request.post('/chat/conversations')
}

/** 删除会话（支持批量） */
export function deleteConversationsApi(ids: number[]): Promise<void> {
  return request.delete('/chat/conversations', { data: { ids } })
}

/** 重命名会话 */
export function renameConversationApi(id: number, title: string): Promise<void> {
  return request.put(`/chat/conversations/${id}`, { title })
}

/** 收藏/取消收藏会话 */
export function toggleFavoriteApi(id: number): Promise<void> {
  return request.put(`/chat/conversations/${id}/favorite`)
}

/** 获取某会话的消息列表 */
export function getMessagesApi(conversationId: number): Promise<Message[]> {
  return request.get(`/chat/conversations/${conversationId}/messages`)
}

/** SSE 流式问答（由 SseRenderer 组件调用 EventSource） */
export function getChatStreamUrl(conversationId: number, question: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  const params = new URLSearchParams({ conversationId: String(conversationId), question })
  return `${baseUrl}/chat/stream?${params}`
}

/** 点赞/点踩 */
export function feedbackApi(messageId: number, type: 'like' | 'dislike', reason?: string): Promise<void> {
  return request.post(`/chat/messages/${messageId}/feedback`, { type, reason })
}
