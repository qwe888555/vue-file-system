// ── 智能问答状态管理 Composable ──
// 功能：管理对话列表/消息缓存/增删改查/刷新
import { ref, computed, watch } from 'vue'
import type { Conversation, Message, KnowledgeFile } from '@/types'
import {
  getConversationsApi,
  getConversationDetailApi,
  createConversationApi,
  deleteConversationApi,
  renameConversationApi,
  rateMessageApi,
} from '@/api/chat'

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

  const loading = ref(false)

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
    loading.value = true
    try {
      const list = await getConversationsApi()
      if (list) {
        conversations.value = list
        saveCache()
      }
    } catch { /* 忽略 */ }
    finally { loading.value = false }
  }

  async function selectConversation(id: number) {
    currentConversationId.value = id
    if (!messagesMap.value[id]) {
      try {
        const detail = await getConversationDetailApi(id)
        if (detail) {
          messagesMap.value[id] = detail.messages
          // 更新对话标题
          const conv = conversations.value.find(c => c.id === id)
          if (conv) {
            conv.title = detail.conversation.title || conv.title
            conv.messageCount = detail.conversation.messageCount
          }
        }
      } catch { /* 忽略 */ }
    }
  }

  async function createConversation(): Promise<Conversation | null> {
    try {
      const conv = await createConversationApi()
      if (conv) {
        conversations.value.unshift(conv)
        currentConversationId.value = conv.id
        messagesMap.value[conv.id] = []
        saveCache()
      }
      return conv
    } catch { return null }
  }

  async function deleteConversation(id: number) {
    try { await deleteConversationApi(id) } catch { /* 忽略 */ }
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (currentConversationId.value === id) {
      currentConversationId.value = conversations.value[0]?.id ?? null
    }
    delete messagesMap.value[id]
    saveCache()
  }

  async function renameConversation(id: number, title: string) {
    try {
      const updated = await renameConversationApi(id, title)
      const conv = conversations.value.find(c => c.id === id)
      if (conv && updated) conv.title = updated.title
      saveCache()
    } catch { /* 忽略 */ }
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

    // 第一条用户消息自动生成标题并同步到后端
    if (messagesMap.value[id].length === 1) {
      const title = content.slice(0, 18) + (content.length > 18 ? '…' : '')
      const conv = conversations.value.find(c => c.id === id)
      if (conv) {
        conv.title = title
        renameConversationApi(id, title).catch(() => {})
        saveCache()
      }
    }
    return msg
  }

  /** 添加 AI 回复消息（SSE 完成后调用） */
  function appendAssistantMessage(content: string, references?: KnowledgeFile[], realId?: number): Message {
    const id = currentConversationId.value
    if (!id) throw new Error('No active conversation')
    const msg: Message = {
      id: realId || Date.now() + 1,
      conversationId: id,
      role: 'assistant',
      content,
      references,
      createdAt: new Date().toISOString(),
    }
    if (!messagesMap.value[id]) messagesMap.value[id] = []
    messagesMap.value[id].push(msg)
    // 如果标题为空，用 AI 回答作为后备标题
    const conv = conversations.value.find(c => c.id === id)
    if (conv && !conv.title && messagesMap.value[id].length === 2) {
      const title = content.slice(0, 18) + (content.length > 18 ? '…' : '')
      conv.title = title
      renameConversationApi(id, title).catch(() => {})
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
