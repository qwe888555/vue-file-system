// ── 智能问答状态管理 Composable ──
// 功能：管理对话列表/消息缓存/增删改查/刷新
import { ref, computed, watch } from 'vue'
import type { Conversation, Message, KnowledgeFile } from '@/types'
import {
  getConversationsApi,
  createConversationApi,
  deleteConversationApi,
  renameConversationApi,
  getMessagesApi,
  rateMessageApi,
} from '@/api/chat'
import { useRequest } from './useRequest'

/** localStorage 缓存 key */
const CACHE_KEY = 'chat_conversations_cache'
const CACHE_EXPIRE = 5 * 60 * 1000 // 5 分钟

interface CacheData {
  conversations: Conversation[]
  timestamp: number
}

export function useChat() {
  // ── 对话列表 ──
  const conversations = ref<Conversation[]>([])
  const currentConversationId = ref<number | null>(null)
  const messagesMap = ref<Record<number, Message[]>>({})
  const searchKeyword = ref('')

  // 请求封装
  const listReq = useRequest(getConversationsApi)
  const createReq = useRequest(createConversationApi)
  const deleteReq = useRequest(deleteConversationApi)
  const renameReq = useRequest(renameConversationApi)
  const messagesReq = useRequest(getMessagesApi)

  // ── Computed ──
  const currentMessages = computed<Message[]>(() => {
    const id = currentConversationId.value
    if (!id) return []
    return messagesMap.value[id] || []
  })

  const currentConversation = computed(() => {
    return conversations.value.find(c => c.id === currentConversationId.value) || null
  })

  const filteredConversations = computed(() => {
    const kw = searchKeyword.value.trim().toLowerCase()
    if (!kw) return conversations.value
    return conversations.value.filter(c => c.title.toLowerCase().includes(kw))
  })

  const loading = computed(() => listReq.loading.value)

  // ── 缓存读写 ──
  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return false
      const data: CacheData = JSON.parse(raw)
      if (Date.now() - data.timestamp > CACHE_EXPIRE) {
        localStorage.removeItem(CACHE_KEY)
        return false
      }
      conversations.value = data.conversations
      return true
    } catch {
      return false
    }
  }

  function saveCache() {
    try {
      const data: CacheData = {
        conversations: conversations.value,
        timestamp: Date.now(),
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      // 存储满时静默失败
    }
  }

  // ── 操作方法 ──
  async function fetchConversations() {
    const res = await listReq.execute({ page: 1, pageSize: 100 })
    if (res && res.list) {
      conversations.value = res.list
      saveCache()
    }
  }

  async function selectConversation(id: number) {
    currentConversationId.value = id
    if (!messagesMap.value[id]) {
      const msgs = await messagesReq.execute(id)
      if (msgs) {
        messagesMap.value[id] = msgs
      }
    }
  }

  async function createConversation(): Promise<Conversation | null> {
    const conv = await createReq.execute()
    if (conv) {
      conversations.value.unshift(conv)
      currentConversationId.value = conv.id
      messagesMap.value[conv.id] = []
      saveCache()
    }
    return conv
  }

  async function deleteConversation(id: number) {
    await deleteReq.execute(id)
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (currentConversationId.value === id) {
      currentConversationId.value = conversations.value[0]?.id ?? null
    }
    delete messagesMap.value[id]
    saveCache()
  }

  async function renameConversation(id: number, title: string) {
    await renameReq.execute(id, title)
    const conv = conversations.value.find(c => c.id === id)
    if (conv) conv.title = title
    saveCache()
  }

  /** 添加用户消息到当前对话（本地即时） */
  function appendUserMessage(content: string): Message {
    const id = currentConversationId.value
    if (!id) throw new Error('No active conversation')
    const msg: Message = {
      id: Date.now(),
      conversationId: id,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    if (!messagesMap.value[id]) messagesMap.value[id] = []
    messagesMap.value[id].push(msg)
    return msg
  }

  /** 添加 AI 回复消息（SSE 完成后调用） */
  function appendAssistantMessage(content: string, references?: KnowledgeFile[]): Message {
    const id = currentConversationId.value
    if (!id) throw new Error('No active conversation')
    const msg: Message = {
      id: Date.now() + 1,
      conversationId: id,
      role: 'assistant',
      content,
      references,
      createdAt: new Date().toISOString(),
    }
    if (!messagesMap.value[id]) messagesMap.value[id] = []
    messagesMap.value[id].push(msg)
    // 更新对话标题（首条消息）
    const conv = conversations.value.find(c => c.id === id)
    if (conv && messagesMap.value[id].length === 2) {
      conv.title = content.slice(0, 30) + (content.length > 30 ? '…' : '')
      saveCache()
    }
    return msg
  }

  async function submitFeedback(messageId: number, type: 'like' | 'dislike') {
    try { await rateMessageApi(messageId, type) } catch { /* 忽略评分失败 */ }
    const id = currentConversationId.value
    if (!id) return
    const msg = messagesMap.value[id]?.find(m => m.id === messageId)
    if (msg) msg.feedback = type
  }

  function refreshConversation(conversationId: number) {
    delete messagesMap.value[conversationId]
    if (currentConversationId.value === conversationId) {
      return selectConversation(conversationId)
    }
    return Promise.resolve()
  }

  // ── 初始化 ──
  function init() {
    if (!loadCache()) {
      fetchConversations()
    }
  }

  return {
    // 状态
    conversations,
    currentConversationId,
    currentMessages,
    currentConversation,
    filteredConversations,
    searchKeyword,
    loading,
    // 操作
    init,
    fetchConversations,
    selectConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    appendUserMessage,
    appendAssistantMessage,
    submitFeedback,
    refreshConversation,
  }
}
