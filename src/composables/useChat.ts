// ── 智能问答状态管理 Composable ──
// 功能：管理对话列表/消息缓存/增删改查/刷新
import { ref, computed } from 'vue'
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
const HISTORY_DAYS = 30 // 只显示最近 30 天的对话

/** 智能摘要标题：提取核心关键词，控制在 10 字以内完整显示 */
function summaryTitle(text: string): string {
  const t = text.trim()
  if (!t) return '新对话'
  // 去除开头常见前缀
  let s = t.replace(/^(请问|我想问一下|你好|帮我|请教一下|我想|如何|怎么|怎样|哪里|什么是|哪个)\s*/g, '')
  // 去除末尾标点
  s = s.replace(/[？?。，,！!]$/g, '')
  // 提取关键部分：取前 8 个字，适应侧边栏宽度
  if (s.length <= 8) return s
  // 尝试按标点/连词拆分，取前半段
  const split = s.split(/[，,、；;]/, 1)[0]
  if (split.length <= 8) return split
  return split.slice(0, 8) + '…'
}

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
    // 按时间过滤：只显示最近 HISTORY_DAYS 天
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - HISTORY_DAYS)
    const list = conversations.value.filter(c => {
      const d = c.updatedAt || c.createdAt
      return !d || new Date(d) >= cutoff
    })
    // 按关键词搜索
    const kw = searchKeyword.value.trim().toLowerCase()
    if (!kw) return list
    return list.filter(c => c.title.toLowerCase().includes(kw))
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
    // 先乐观更新本地（即时生效）
    const conv = conversations.value.find(c => c.id === id)
    if (conv) conv.title = title
    saveCache()
    // 再异步同步后端（失败也不影响本地显示）
    try {
      await renameConversationApi(id, title)
      // 后端返回后只更新时间戳，不覆盖标题（本地已乐观更新）
      if (conv) saveCache()
    } catch { /* 后端同步失败，本地已更新，不影响用户体验 */ }
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
      const title = summaryTitle(content)
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
      const title = summaryTitle(content)
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

  /** 设置模拟数据（后端不可用时展示示例对话） */
  function setMockData(conv: Conversation, messages: Message[]) {
    // 不覆盖已有数据
    if (conversations.value.length > 0) return
    conversations.value = [conv]
    messagesMap.value[conv.id] = messages
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
    setMockData,
  }
}
