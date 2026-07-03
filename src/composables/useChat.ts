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

  // ── Mock 数据 ──
  function seedMockData() {
    const now = new Date()
    const mockConversations: Conversation[] = [
      { id: 1, title: '如何查找学习资料', isFavorite: false, messageCount: 4, createdAt: new Date(now.getTime() - 86400000).toISOString(), updatedAt: new Date(now.getTime() - 3600000).toISOString() },
      { id: 2, title: '论文格式要求', isFavorite: true, messageCount: 3, createdAt: new Date(now.getTime() - 172800000).toISOString(), updatedAt: new Date(now.getTime() - 86400000).toISOString() },
      { id: 3, title: '校园网使用方法', isFavorite: false, messageCount: 2, createdAt: new Date(now.getTime() - 259200000).toISOString(), updatedAt: new Date(now.getTime() - 172800000).toISOString() },
      { id: 4, title: '课程表查询', isFavorite: false, messageCount: 5, createdAt: new Date(now.getTime() - 345600000).toISOString(), updatedAt: new Date(now.getTime() - 259200000).toISOString() },
      { id: 5, title: '图书馆借阅规则', isFavorite: true, messageCount: 3, createdAt: new Date(now.getTime() - 432000000).toISOString(), updatedAt: new Date(now.getTime() - 345600000).toISOString() },
    ]
    conversations.value = mockConversations

    messagesMap.value[1] = [
      { id: 1, conversationId: 1, role: 'user', content: '你好，请问如何查找学习资料？', createdAt: new Date(now.getTime() - 3600000).toISOString() },
      { id: 2, conversationId: 1, role: 'assistant', content: '你好！你可以通过以下方式查找学习资料：\n\n1. **访问图书馆官网** — 在"数字资源"栏目下可以搜索电子图书和期刊\n2. **使用知识库系统** — 在本系统左侧导航栏点击「知识库管理」即可浏览和搜索文档\n3. **联系学科馆员** — 每个学院都有对应的学科馆员提供专业咨询\n\n请问你需要查找哪方面的资料？', createdAt: new Date(now.getTime() - 3540000).toISOString() },
      { id: 3, conversationId: 1, role: 'user', content: '我想找一些关于计算机科学的论文', createdAt: new Date(now.getTime() - 3000000).toISOString() },
      { id: 4, conversationId: 1, role: 'assistant', content: '关于计算机科学论文的查找建议：\n\n### 推荐数据库\n- **CNKI中国知网** — 收录国内核心期刊论文\n- **IEEE Xplore** — 计算机和电子工程领域权威数据库\n- **ACM Digital Library** — 计算机学会全文数据库\n\n### 检索技巧\n1. 使用关键词组合，例如：`"machine learning" AND "neural network"`\n2. 利用高级搜索限定时间范围和期刊等级\n3. 查看参考文献列表可以找到更多相关论文\n\n需要我进一步帮你检索吗？', createdAt: new Date(now.getTime() - 2940000).toISOString() },
    ]
    messagesMap.value[2] = [
      { id: 5, conversationId: 2, role: 'user', content: '毕业论文的格式要求是什么？', createdAt: new Date(now.getTime() - 86400000).toISOString() },
      { id: 6, conversationId: 2, role: 'assistant', content: '毕业论文格式要求如下：\n\n### 基本格式\n- **封面**：使用学校统一模板\n- **正文字号**：小四号宋体（中文）\n- **行距**：1.5 倍行距\n- **页边距**：上下 2.54cm，左右 3.17cm\n\n### 章节结构\n1. 摘要（中英文）\n2. 目录\n3. 正文（引言 → 文献综述 → 方法 → 结果 → 讨论）\n4. 参考文献\n5. 致谢\n\n### 参考文献格式\n采用 GB/T 7714 标准格式，建议使用文献管理工具如 EndNote 或 Zotero。', createdAt: new Date(now.getTime() - 85800000).toISOString() },
      { id: 7, conversationId: 2, role: 'user', content: '参考文献的格式能具体说一下吗', createdAt: new Date(now.getTime() - 80000000).toISOString() },
      { id: 8, conversationId: 2, role: 'assistant', content: '以下是 GB/T 7714 标准格式示例：\n\n**期刊论文**\n`[1] 作者. 题名[J]. 刊名, 出版年, 卷(期): 起止页码.`\n\n**图书**\n`[2] 作者. 书名[M]. 出版地: 出版社, 出版年.`\n\n**学位论文**\n`[3] 作者. 题名[D]. 保存地点: 保存单位, 年份.`\n\n**网络资源**\n`[4] 作者. 题名[EB/OL]. (更新日期)[引用日期]. 网址.`', createdAt: new Date(now.getTime() - 79400000).toISOString() },
    ]
    saveCache()
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
