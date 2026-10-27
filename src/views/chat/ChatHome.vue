<script setup lang="ts">
// ── 智能问答主页面 ──
// 新版结构：现有全局导航 + 独立可折叠历史栏 + 新问答工作区
// 说明：本页仍作为 /chat 的根路由组件，保留 KeepAlive 缓存与后台 SSE 能力。

import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isAdminRole } from '@/config/roles'
import type { Conversation, KnowledgeFile, SuggestedItem, ImageItem } from '@/types'
import { useChat } from '@/composables/useChat'
import { useSSE } from '@/composables/useSSE'
import Sidebar from '@/views/layouts/Sidebar.vue'
import ChatIcon from '@/components/chat/ChatIcon.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ChatLoginDialog from '@/components/chat/ChatLoginDialog.vue'
import { useChatUiStore } from '@/store/chatUi'

defineOptions({ name: 'ChatHome' })

const userStore = useUserStore()
const router = useRouter()
const chat = useChat()
const chatUi = useChatUiStore()

// ── 页面状态 ──
const pageActive = ref(true)
const isNarrow = ref(false)
const historyOpen = ref(true)
const showLoginDialog = ref(false)
const inputText = ref('')
const isRecording = ref(false)
const chatScrollRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const hasPlayed = sessionStorage.getItem('hasPlayHomeAnimation') === 'true'
const welcomeEntry = ref(!hasPlayed)
const welcomePulse = ref(false)
let entryTimer: ReturnType<typeof setTimeout> | undefined
let pulseTimer: ReturnType<typeof setTimeout> | undefined
let mediaQuery: MediaQueryList | undefined

// ── SSE：按 convId 索引，切换会话不杀流 ──
interface StreamingState {
  content: string
  references: KnowledgeFile[]
  suggested: SuggestedItem[]
  images: ImageItem[]
  streaming: boolean
  messageId: number | null
  error: string | null
  seq: number
}
const streamingMap = ref<Record<number, StreamingState>>({})
const sseMap: Record<number, ReturnType<typeof useSSE> | null> = {}
const stopWatchMap: Record<number, {
  content?: () => void
  refs?: () => void
  suggested?: () => void
  images?: () => void
}> = {}

const currentStreaming = computed(() => {
  const id = chat.currentConversationId.value
  return id ? streamingMap.value[id] : undefined
})
const isStreaming = computed(() => !!currentStreaming.value?.streaming)
const streamingContent = computed(() => currentStreaming.value?.content ?? '')
const streamingSuggested = computed(() => currentStreaming.value?.suggested ?? [])
const streamingImages = computed(() => currentStreaming.value?.images ?? [])

const isLoggedIn = computed(() => !!userStore.token)
const isAdminUser = computed(() => isAdminRole(userStore.role))
const hasActiveConversation = computed(() => chat.currentConversationId.value !== null)
const hasMessages = computed(() => chat.currentMessages.value.length > 0)

const pageTitle = computed(() => (isAdminUser.value ? '教研问答' : '智能问答'))
const assistantName = computed(() => (isAdminUser.value ? '教研助手' : '智能助手'))
const topbarSub = computed(() => (
  isAdminUser.value ? '基于校内教研知识库 · 引用可溯源' : '基于校内知识库 · 引用可溯源'
))
const welcomeSubtitle = computed(() => (
  isAdminUser.value
    ? '基于校内教研知识库回答，每条结论都可追溯到原文出处，方便核对与引用。'
    : '基于校内知识库回答，每条结论都可追溯到原文出处，方便核对与引用。'
))

const topbarTitle = computed(() => {
  if (hasActiveConversation.value && hasMessages.value) {
    return chat.currentConversation.value?.title || '新对话'
  }
  return pageTitle.value
})

// ── 历史搜索 / 分组 ──
const searchKeyword = computed({
  get: () => chat.searchKeyword.value,
  set: (v: string) => { chat.searchKeyword.value = v },
})

const historyCount = computed(() => chat.filteredConversations.value.length)

interface HistoryGroup {
  label: string
  rows: Conversation[]
}

function dayStart(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

const conversationGroups = computed<HistoryGroup[]>(() => {
  const list = [...chat.filteredConversations.value].sort((a, b) => {
    const ta = new Date(b.updatedAt || b.createdAt).getTime() || 0
    const tb = new Date(a.updatedAt || a.createdAt).getTime() || 0
    return ta - tb
  })
  const today = dayStart(new Date())
  const yesterday = today - 24 * 60 * 60 * 1000
  const todayRows: Conversation[] = []
  const yesterdayRows: Conversation[] = []
  const earlierRows: Conversation[] = []

  for (const conv of list) {
    const d = new Date(conv.updatedAt || conv.createdAt)
    const day = Number.isNaN(d.getTime()) ? 0 : dayStart(d)
    if (day === today) todayRows.push(conv)
    else if (day === yesterday) yesterdayRows.push(conv)
    else earlierRows.push(conv)
  }

  return [
    { label: '今天', rows: todayRows },
    { label: '昨天', rows: yesterdayRows },
    { label: '更早', rows: earlierRows },
  ].filter(g => g.rows.length > 0)
})

function formatConvTime(conv: Conversation): string {
  const d = new Date(conv.updatedAt || conv.createdAt)
  if (Number.isNaN(d.getTime())) return ''
  const today = dayStart(new Date())
  const day = dayStart(d)
  if (day === today) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  if (day === today - 24 * 60 * 60 * 1000) return '昨天'
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}

// ── 热点问题 ──
const hotQuestions = ref<Array<{ question: string; count: number }>>([])
const hotLoading = ref(false)
const hotError = ref('')
const SUGGEST_ICON_NAMES = ['target', 'clipboard', 'file', 'compass', 'chart', 'users']

async function loadHotQuestions() {
  hotLoading.value = true
  hotError.value = ''
  try {
    const { getHotQuestionsApi } = await import('@/api/chat')
    const data = await getHotQuestionsApi({ top_k: 6 })
    hotQuestions.value = data
  } catch {
    hotQuestions.value = []
    hotError.value = '热点问题加载失败'
  } finally {
    hotLoading.value = false
  }
}

const topQuestions = computed(() =>
  hotQuestions.value.slice(0, 6).map((q, index) => ({
    text: q.question.split('：')[0].split(':')[0],
    icon: SUGGEST_ICON_NAMES[index % SUGGEST_ICON_NAMES.length],
    count: q.count,
    hot: index === 0,
  }))
)

// ── 历史上下文菜单 ──
const ctxOpen = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
const ctxConv = ref<Conversation | null>(null)

function closeContextMenu() {
  ctxOpen.value = false
  ctxConv.value = null
}

function openContextMenu(e: MouseEvent, conv: Conversation) {
  e.stopPropagation()
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  const menuW = 134
  const menuH = 72
  const left = Math.min(rect.right - menuW, window.innerWidth - menuW - 8)
  let top = rect.bottom + 4
  if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 4
  ctxX.value = Math.max(8, left)
  ctxY.value = Math.max(8, top)
  ctxConv.value = conv
  ctxOpen.value = true
}

function ctxRename() {
  const conv = ctxConv.value
  closeContextMenu()
  if (conv) startRename(conv)
}

async function ctxDelete() {
  const conv = ctxConv.value
  if (!conv) return
  closeContextMenu()
  try {
    await ElMessageBox.confirm(
      '删除后不可恢复，确定删除该对话吗？',
      '删除对话',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  await handleDeleteConversation(conv.id)
}

// ── 会话操作 ──
const renamingId = ref<number | null>(null)
const renameText = ref('')

function closeHistoryIfNarrow() {
  if (isNarrow.value) historyOpen.value = false
}

async function handleNewConversation() {
  closeContextMenu()
  if (!isLoggedIn.value) {
    showLoginDialog.value = true
    return
  }
  const conv = await chat.createConversation()
  if (!conv) {
    ElMessage.error('新建对话失败，请稍后重试')
    return
  }
  closeHistoryIfNarrow()
  inputText.value = ''
  await nextTick()
  autoGrowInput()
  if (chatScrollRef.value) chatScrollRef.value.scrollTop = 0
  pulseWelcome()
  if (window.innerWidth > 900) inputRef.value?.focus()
}

async function handleSelectConversation(id: number) {
  closeContextMenu()
  await chat.selectConversation(id)
  chatUi.clearConvUnread(id)
  closeHistoryIfNarrow()
  await nextTick()
  scrollToBottom()
}

async function handleDeleteConversation(id: number) {
  // 删除会话前先结束该会话可能存在的后台流，避免回答写入已删除会话
  cancelStreaming(id)
  await chat.deleteConversation(id)
  chatUi.clearConvUnread(id)
  const nextId = chat.currentConversationId.value
  if (nextId) await chat.selectConversation(nextId)
  await nextTick()
  scrollToBottom()
}

function startRename(conv: Conversation) {
  closeContextMenu()
  renamingId.value = conv.id
  renameText.value = conv.title || ''
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.history-panel .rename-input')
    input?.focus()
    input?.select()
  })
}

function confirmRename(id: number) {
  if (renamingId.value !== id) return
  const title = renameText.value.trim()
  renamingId.value = null
  if (!title) return
  const conv = chat.conversations.value.find(c => c.id === id)
  if (conv) conv.title = title
  chat.renameConversation(id, title).catch(() => {})
}

function cancelRename() {
  renamingId.value = null
}

function handleLoginSuccess() {
  showLoginDialog.value = false
  if (isAdminRole(userStore.role)) {
    router.push('/knowledge/list')
  }
  chat.fetchConversations()
}
function handleLoginCancel() { showLoginDialog.value = false }

// ── 流式控制 ──
function cancelStreaming(convId?: number) {
  const id = convId ?? chat.currentConversationId.value
  if (!id) return
  const st = streamingMap.value[id]
  if (st) st.seq++
  sseMap[id]?.close()
  delete sseMap[id]
  stopWatchMap[id]?.content?.()
  stopWatchMap[id]?.refs?.()
  stopWatchMap[id]?.suggested?.()
  stopWatchMap[id]?.images?.()
  delete stopWatchMap[id]
  if (st) st.streaming = false
  delete streamingMap.value[id]
}

function closeAllStreaming() {
  for (const k of Object.keys(sseMap)) {
    const id = Number(k)
    streamingMap.value[id] && (streamingMap.value[id].seq++)
    sseMap[id]?.close()
    stopWatchMap[id]?.content?.()
    stopWatchMap[id]?.refs?.()
    stopWatchMap[id]?.suggested?.()
    stopWatchMap[id]?.images?.()
  }
  for (const k of Object.keys(sseMap)) delete sseMap[Number(k)]
  for (const k of Object.keys(stopWatchMap)) delete stopWatchMap[Number(k)]
  streamingMap.value = {}
}

function scrollToBottom() {
  nextTick(() => {
    const el = chatScrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function autoGrowInput() {
  const el = inputRef.value
  if (!el) return
  // 动态高度：先重置再按内容测量，最大 160px（与设计稿一致）
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

function handleSendClick() {
  if (isStreaming.value) {
    cancelStreaming()
    return
  }
  sendMessage()
}

function handleInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    handleSendClick()
  }
}

function quickQuestion(text: string) {
  inputText.value = text
  nextTick(autoGrowInput)
  sendMessage()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  if (!isLoggedIn.value) {
    showLoginDialog.value = true
    return
  }
  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }
  const convId = chat.currentConversationId.value!
  chat.appendUserMessage(text)
  inputText.value = ''
  nextTick(autoGrowInput)
  scrollToBottom()

  cancelStreaming(convId)

  const prevSeq = streamingMap.value[convId]?.seq ?? 0
  const seq = prevSeq + 1
  streamingMap.value[convId] = {
    content: '',
    references: [],
    suggested: [],
    images: [],
    streaming: true,
    messageId: null,
    error: null,
    seq,
  }

  const timeoutId = setTimeout(() => {
    const st = streamingMap.value[convId]
    if (st && st.seq === seq && st.streaming) {
      cancelStreaming(convId)
      ElMessage.warning('AI 回复超时，可重新提问')
    }
  }, 30000)

  const sse = useSSE(convId, text, () => {
    clearTimeout(timeoutId)
    const st = streamingMap.value[convId]
    if (!st || st.seq !== seq) return
    st.streaming = false
    if (sse.error?.value) {
      delete streamingMap.value[convId]
      delete sseMap[convId]
      ElMessage.error(sse.error.value)
      return
    }
    const realId = sse.messageId?.value
    const content = st.content || sse.content?.value || ''
    chat.appendAssistantMessage(content, st.references, realId || undefined, st.suggested, st.images, convId)
    delete streamingMap.value[convId]
    delete sseMap[convId]

    const onChatPage = router.currentRoute.value.name === 'Chat'
    const onThisConv = chat.currentConversationId.value === convId
    if (!onChatPage) {
      chatUi.setUnread(true)
      ElMessage.success(`回答已生成，点击左侧「${isAdminUser.value ? '教研问答' : '智能问答'}」查看`)
    } else if (!onThisConv) {
      chatUi.markConvUnread(convId)
    } else {
      scrollToBottom()
    }
  })

  sseMap[convId] = sse
  stopWatchMap[convId]?.content?.()
  stopWatchMap[convId]?.refs?.()
  stopWatchMap[convId]?.suggested?.()
  stopWatchMap[convId]?.images?.()
  stopWatchMap[convId] = {
    content: watch(sse.content, (val) => {
      const st = streamingMap.value[convId]
      if (st && st.seq === seq) st.content = val ?? ''
    }),
    refs: watch(sse.references, (val) => {
      const st = streamingMap.value[convId]
      if (st && st.seq === seq) st.references = val ?? []
    }),
    suggested: watch(sse.suggested, (val) => {
      const st = streamingMap.value[convId]
      if (st && st.seq === seq) st.suggested = val ?? []
    }),
    images: watch(sse.images, (val) => {
      const st = streamingMap.value[convId]
      if (st && st.seq === seq) st.images = val ?? []
    }),
  }
}

function handleFeedback(messageId: number, type: 'like' | 'dislike' | 'none') {
  chat.submitFeedback(messageId, type)
}

// ── 语音录制 / 识别 ──
let mediaRecorder: MediaRecorder | null = null

function startRecording(): Promise<Blob | null> {
  return new Promise(async (resolve) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find(t => MediaRecorder.isTypeSupported(t)) || ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      const chunks: Blob[] = []
      mediaRecorder = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        resolve(blob.size > 100 ? blob : null)
      }
      mr.onerror = () => resolve(null)
      mr.start()
      isRecording.value = true
    } catch { resolve(null) }
  })
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  isRecording.value = false
}

let speechRecognition: any = null

async function handleVoiceMsg() {
  if (isRecording.value) {
    if (speechRecognition) { speechRecognition.stop(); speechRecognition = null }
    stopRecording()
    return
  }
  if (isStreaming.value) return
  if (!isLoggedIn.value) {
    showLoginDialog.value = true
    return
  }

  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechAPI) {
    try {
      const recognition = new SpeechAPI()
      recognition.lang = 'zh-CN'
      recognition.interimResults = true
      recognition.continuous = true
      speechRecognition = recognition
      isRecording.value = true

      let finalTranscript = ''

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript = event.results[i][0].transcript
          }
        }
        if (!finalTranscript && event.results.length > 0) {
          const last = event.results[event.results.length - 1]
          if (!last.isFinal) {
            inputText.value = last[0].transcript
          }
        }
      }

      recognition.onerror = (event: any) => {
        isRecording.value = false; speechRecognition = null
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          ElMessage.error('语音识别: ' + event.error)
        }
      }

      recognition.onend = () => {
        isRecording.value = false; speechRecognition = null
        if (finalTranscript) {
          inputText.value = finalTranscript
          sendMessage()
        }
      }

      recognition.start()
      return
    } catch { isRecording.value = false; speechRecognition = null }
  }

  // 方案二：录音 + 后端 ASR
  const blob = await startRecording()
  if (!blob) return
  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }
  const convId = chat.currentConversationId.value!
  inputText.value = '语音识别中…'
  try {
    const { voiceAskApi } = await import('@/api/chat')
    const response = await voiceAskApi(blob, convId)
    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      ElMessage.error(errBody ? '语音请求失败: ' + errBody : '语音请求失败')
      inputText.value = ''; return
    }
    const reader = response.body?.getReader()
    if (!reader) { inputText.value = ''; return }
    const decoder = new TextDecoder(); let buffer = ''; let currentEvent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7).trim()
        else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6).trim())
            if (currentEvent === 'asr_text' && data.text) {
              inputText.value = data.text
              sendMessage()
            }
          } catch { /* 忽略非 JSON 数据 */ }
        }
      }
    }
  } catch { inputText.value = '' }
}

function cleanupRecording() {
  if (speechRecognition) {
    try { speechRecognition.stop() } catch { /* 已停止 */ }
    speechRecognition = null
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch { /* 已停止 */ }
  }
  mediaRecorder = null
  isRecording.value = false
}

// ── 欢迎页动画 ──
function pulseWelcome() {
  welcomeEntry.value = false
  welcomePulse.value = false
  nextTick(() => {
    welcomePulse.value = true
    if (pulseTimer) clearTimeout(pulseTimer)
    pulseTimer = setTimeout(() => { welcomePulse.value = false }, 650)
  })
}

// ── 全局交互 ──
function handleDocumentClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (!el.closest('.history-ctx-menu') && !el.closest('.conv-more')) {
    closeContextMenu()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!pageActive.value) return

  if (e.key === 'Escape') {
    const wasCtx = ctxOpen.value
    const isRenameInput = !!(e.target as HTMLElement)?.closest('.rename-input')
    closeContextMenu()
    if (!isRenameInput && !renamingId.value && !wasCtx && isNarrow.value) {
      historyOpen.value = false
    }
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    historyOpen.value = true
    nextTick(() => {
      searchInputRef.value?.focus()
      searchInputRef.value?.select()
    })
  }
}

function handleMediaChange(e: MediaQueryListEvent) {
  isNarrow.value = e.matches
  historyOpen.value = !e.matches
  closeContextMenu()
}

// ── 生命周期 ──
onMounted(() => {
  chat.init()
  loadHotQuestions()
  autoGrowInput()

  mediaQuery = window.matchMedia('(max-width: 1150px)')
  isNarrow.value = mediaQuery.matches
  historyOpen.value = !mediaQuery.matches
  mediaQuery.addEventListener('change', handleMediaChange)

  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)

  if (welcomeEntry.value) {
    entryTimer = setTimeout(() => {
      welcomeEntry.value = false
      sessionStorage.setItem('hasPlayHomeAnimation', 'true')
    }, 2350)
  }
})

watch(inputText, () => { nextTick(autoGrowInput) })
watch(streamingContent, () => {
  if (isStreaming.value) scrollToBottom()
})

onActivated(() => {
  pageActive.value = true
  chatUi.setUnread(false)
})

onDeactivated(() => {
  pageActive.value = false
  cleanupRecording()
  closeContextMenu()
  if (isNarrow.value) historyOpen.value = false
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
  mediaQuery?.removeEventListener('change', handleMediaChange)
  if (entryTimer) clearTimeout(entryTimer)
  if (pulseTimer) clearTimeout(pulseTimer)
  cleanupRecording()
  closeAllStreaming()
})

watch(
  () => userStore.token,
  (token) => {
    if (!token) {
      closeAllStreaming()
      chat.reset()
      inputText.value = ''
      chatUi.setUnread(false)
      chatUi.clearAllConvUnread()
      closeContextMenu()
    }
  },
)
</script>

<template>
  <div class="chat-app">
    <!-- 现有全局导航（与后台其他页面共用同一个 Sidebar 组件） -->
    <Sidebar />

    <div class="workspace">
      <!-- ═══ 独立会话历史栏 ═══ -->
      <aside class="history-panel" :class="{ collapsed: !historyOpen }" aria-label="会话历史">
        <div class="history-inner">
          <div class="history-head">
            <div class="history-title-row">
              <span class="history-title">对话</span>
              <span class="history-count">{{ historyCount }}</span>
              <button
                class="icon-btn"
                title="收起会话列表"
                aria-label="收起会话列表"
                @click="historyOpen = false"
              >
                <ChatIcon name="panel-left" :size="17" />
              </button>
            </div>

            <button class="new-chat" @click="handleNewConversation">
              <ChatIcon name="plus" :size="15" />
              新建对话
            </button>

            <div class="history-search">
              <ChatIcon name="search" :size="14" />
              <input
                ref="searchInputRef"
                v-model="searchKeyword"
                type="text"
                placeholder="搜索对话"
                aria-label="搜索对话"
              />
              <kbd>Ctrl K</kbd>
            </div>
          </div>

          <div class="history-list">
            <div v-if="chat.loading.value && !conversationGroups.length" class="history-loading">
              <div v-for="i in 5" :key="i" class="history-skeleton" />
            </div>

            <template v-else>
              <div
                v-for="group in conversationGroups"
                :key="group.label"
                class="hist-group"
              >
                <div class="group-label">{{ group.label }}</div>
                <div class="group-rows">
                  <div
                    v-for="conv in group.rows"
                    :key="conv.id"
                    class="conv-row"
                    :class="{ active: conv.id === chat.currentConversationId.value }"
                  >
                    <button
                      v-if="renamingId !== conv.id"
                      class="conv-main"
                      type="button"
                      :title="conv.title || '新对话'"
                      @click="handleSelectConversation(conv.id)"
                    >
                      <span
                        v-if="chatUi.unreadConvIds[conv.id]"
                        class="conv-unread"
                        aria-label="有新回答"
                      />
                      <span class="conv-title">{{ conv.title || '新对话' }}</span>
                      <span class="conv-time">{{ formatConvTime(conv) }}</span>
                    </button>
                    <input
                      v-else
                      v-model="renameText"
                      class="rename-input"
                      type="text"
                      aria-label="重命名对话"
                      @click.stop
                      @keydown.enter.prevent="confirmRename(conv.id)"
                      @keydown.esc.prevent="cancelRename"
                      @blur="confirmRename(conv.id)"
                    />
                    <button
                      v-if="renamingId !== conv.id"
                      class="conv-more"
                      type="button"
                      aria-label="更多操作"
                      @click.stop="openContextMenu($event, conv)"
                    >
                      <ChatIcon name="more" :size="15" />
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="!conversationGroups.length" class="history-empty">
                <ChatIcon name="search" :size="22" />
                <div>{{ searchKeyword ? '没有找到相关对话' : '暂无对话记录' }}</div>
              </div>
            </template>
          </div>

          <div class="history-foot">
            <ChatIcon name="clock" :size="12" />
            仅展示近 30 天对话
          </div>
        </div>
      </aside>

      <button
        v-if="isNarrow && historyOpen"
        class="history-scrim"
        aria-label="关闭会话列表"
        @click="historyOpen = false"
      />

      <!-- ═══ 问答工作区 ═══ -->
      <main class="chat-main">
        <header class="chat-topbar">
          <div class="topbar-left">
            <button
              v-if="!historyOpen"
              class="icon-btn"
              title="展开会话列表"
              aria-label="展开会话列表"
              @click="historyOpen = true"
            >
              <ChatIcon name="panel-right" :size="17" />
            </button>
            <div class="topbar-title-wrap">
              <h1 class="chat-title" :title="topbarTitle">{{ topbarTitle }}</h1>
              <span class="chat-sub">{{ topbarSub }}</span>
            </div>
          </div>

          <div class="topbar-right">
            <span v-if="isStreaming" class="stream-chip"><i />正在回答</span>
            <span class="trust-chip">
              <ChatIcon name="shield" :size="13" />
              引用可溯源
            </span>
            <button
              class="icon-btn"
              title="新建对话"
              aria-label="新建对话"
              @click="handleNewConversation"
            >
              <ChatIcon name="plus" :size="17" />
            </button>
          </div>
        </header>

        <div ref="chatScrollRef" class="chat-scroll">
          <div class="chat-inner">
            <!-- 欢迎页 -->
            <section
              v-if="!hasMessages && !isStreaming"
              class="welcome"
              :class="{ entry: welcomeEntry, pulse: welcomePulse }"
            >
              <div class="emblem-wrap">
                <div class="emblem-halo" />
                <div class="emblem-ring r1" />
                <div class="emblem-ring r2" />
                <div class="emblem">
                  <div class="emblem-tile">
                    <ChatIcon name="brand" :size="34" />
                  </div>
                </div>
              </div>

              <h2 class="welcome-title">
                你好，我是<span>{{ assistantName }}</span>
              </h2>
              <p class="welcome-sub">{{ welcomeSubtitle }}</p>

              <div class="welcome-trust">
                <span><ChatIcon name="library" :size="12" />校内知识库</span>
                <span><ChatIcon name="book" :size="12" />回答附引用</span>
                <span><ChatIcon name="clock" :size="12" />实时检索</span>
              </div>

              <div v-if="hotLoading" class="suggest-grid suggest-grid--skeleton" aria-label="热点问题加载中">
                <div v-for="i in 6" :key="i" class="suggest-skeleton" />
              </div>
              <div v-else-if="hotError" class="suggest-state">
                <span>{{ hotError }}</span>
                <button class="suggest-retry" @click="loadHotQuestions">重试</button>
              </div>
              <div v-else-if="topQuestions.length" class="suggest-grid">
                <button
                  v-for="q in topQuestions"
                  :key="q.text"
                  class="suggest-card"
                  type="button"
                  @click="quickQuestion(q.text)"
                >
                  <span class="suggest-top">
                    <span class="suggest-icon">
                      <ChatIcon :name="q.icon" :size="14" />
                    </span>
                    <span class="suggest-text">{{ q.text }}</span>
                  </span>
                  <span class="suggest-meta">
                    {{ q.hot ? '热门 · ' : '' }}{{ q.count }} 次提问
                    <span class="suggest-arrow">
                      <ChatIcon name="arrow-up-right" :size="13" />
                    </span>
                  </span>
                </button>
              </div>
              <div v-else class="suggest-state">
                暂无推荐问题，可直接输入您想了解的内容
              </div>
            </section>

            <!-- 消息流 -->
            <section v-else class="thread" aria-live="polite">
              <MessageBubble
                v-for="msg in chat.currentMessages.value"
                :key="msg.id"
                :message="msg"
                :suggested-questions="msg.suggested"
                :images="msg.images"
                :user-role="userStore.role ?? undefined"
                @feedback="handleFeedback"
                @quick-question="quickQuestion"
              />
              <MessageBubble
                v-if="isStreaming"
                :message="{
                  id: -1,
                  conversationId: chat.currentConversationId.value!,
                  role: 'assistant',
                  content: streamingContent,
                  createdAt: new Date().toISOString(),
                }"
                :streaming="true"
                :stream-content="streamingContent"
                :suggested-questions="streamingSuggested"
                :images="streamingImages"
                :user-role="userStore.role ?? undefined"
                @quick-question="quickQuestion"
              />
            </section>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="composer-area">
          <div class="composer-box">
            <div class="composer">
              <textarea
                ref="inputRef"
                v-model="inputText"
                rows="1"
                :disabled="isStreaming"
                :placeholder="isStreaming ? 'AI 正在回答…' : '输入你的问题，Enter 发送，Shift + Enter 换行'"
                aria-label="输入问题"
                @input="autoGrowInput"
                @keydown="handleInputKeydown"
              />
              <div class="composer-bar">
                <span class="composer-feature">
                  <ChatIcon name="sparkles" :size="12" />
                  知识库增强
                </span>
                <div class="composer-actions">
                  <button
                    class="mic-btn"
                    :class="{ recording: isRecording }"
                    :disabled="isStreaming"
                    title="语音输入"
                    aria-label="语音输入"
                    @click="handleVoiceMsg"
                  >
                    <ChatIcon name="mic" :size="17" />
                  </button>
                  <button
                    class="send-btn"
                    :class="{ streaming: isStreaming }"
                    :disabled="!isStreaming && !inputText.trim()"
                    :title="isStreaming ? '停止生成' : '发送'"
                    :aria-label="isStreaming ? '停止生成' : '发送'"
                    @click="handleSendClick"
                  >
                    <ChatIcon :name="isStreaming ? 'stop' : 'arrow-up'" :size="17" />
                  </button>
                </div>
              </div>
            </div>
            <p class="composer-hint">AI 生成内容可能存在偏差，请以引用原文为准</p>
          </div>
        </div>
      </main>
    </div>

    <!-- 历史会话右键菜单 -->
    <Teleport to="body">
      <Transition name="ctx-fade">
        <div
          v-if="ctxOpen"
          class="history-ctx-menu"
          :style="{ left: `${ctxX}px`, top: `${ctxY}px` }"
          @click.stop
        >
          <button class="ctx-item" @click="ctxRename">
            <ChatIcon name="edit" :size="14" />
            重命名
          </button>
          <button class="ctx-item danger" @click="ctxDelete">
            <ChatIcon name="trash" :size="14" />
            删除
          </button>
        </div>
      </Transition>
    </Teleport>

    <ChatLoginDialog v-if="showLoginDialog" @success="handleLoginSuccess" @cancel="handleLoginCancel" />
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════
   新版问答页视觉：学院蓝 / 书页星芒 / 克制留白
   ── 局部 Token 仅作用于本页，其他页面视觉不受影响
   ══════════════════════════════════════════════════════════════════════ */
.chat-app {
  --qa-brand-50: #f0f6ff;
  --qa-brand-100: #e0edff;
  --qa-brand-200: #bfdbfe;
  --qa-brand-400: #60a5fa;
  --qa-brand-500: #3b82f6;
  --qa-brand-600: #2563eb;
  --qa-brand-700: #1d4ed8;
  --qa-ink: #0f172a;
  --qa-ink-2: #334155;
  --qa-ink-3: #64748b;
  --qa-ink-4: #94a3b8;
  --qa-ink-5: #cbd5e1;
  --qa-line: #e6eaf2;
  --qa-line-2: #d8dfeb;
  --qa-bg: #f7f8fa;
  --qa-ease: cubic-bezier(.22, .61, .36, 1);

  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--qa-bg);
  color: var(--qa-ink);
  font-family: var(--font-sans);
}
.chat-app,
.chat-app * { box-sizing: border-box; }
button, input, textarea { font: inherit; color: inherit; }
button { -webkit-tap-highlight-color: transparent; }

.workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  position: relative;
  overflow: hidden;
}

/* ═══ 历史栏 ═══ */
.history-panel {
  width: 296px;
  flex: 0 0 auto;
  background: #fff;
  border-right: 1px solid var(--qa-line);
  overflow: hidden;
  position: relative;
  z-index: 30;
  transition: width .28s var(--qa-ease), border-color .28s var(--qa-ease);
}
.history-panel.collapsed {
  width: 0;
  border-right-color: transparent;
}
.history-inner {
  width: 296px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.history-head {
  flex-shrink: 0;
  padding: 16px 14px 10px;
}
.history-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 12px;
}
.history-title {
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -.01em;
  color: var(--qa-ink);
}
.history-count {
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--qa-ink-3);
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 999px;
}
.history-title-row .icon-btn { margin-left: auto; }

.icon-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--qa-ink-3);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background .16s var(--qa-ease), color .16s var(--qa-ease), transform .16s var(--qa-ease);
}
.icon-btn:hover { background: #f1f5f9; color: var(--qa-ink); }
.icon-btn:active { transform: scale(.95); }

.new-chat {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 11px;
  background: linear-gradient(145deg, #3b82f6, #1d4ed8);
  color: #fff;
  font-size: 12.5px;
  font-weight: 550;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(37, 99, 235, .20);
  transition: box-shadow .18s var(--qa-ease), transform .18s var(--qa-ease);
}
.new-chat:hover {
  transform: translateY(-1px);
  box-shadow: 0 9px 22px rgba(37, 99, 235, .28);
}
.new-chat:active { transform: translateY(0) scale(.99); }

.history-search {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  margin-top: 10px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: #f5f7fb;
  color: var(--qa-ink-4);
  transition: background .16s, border-color .16s, box-shadow .16s, color .16s;
}
.history-search:focus-within {
  background: #fff;
  border-color: var(--qa-brand-200);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .07);
  color: var(--qa-brand-600);
}
.history-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 12px;
  color: var(--qa-ink);
}
.history-search input::placeholder { color: var(--qa-ink-4); }
.history-search kbd {
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-size: 9.5px;
  line-height: 1.2;
  color: var(--qa-ink-4);
  background: #fff;
  border: 1px solid var(--qa-line);
  border-radius: 4px;
  padding: 2px 4px;
}

.history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 10px 12px;
  scrollbar-width: thin;
  scrollbar-color: #dbe2ec transparent;
}
.history-list::-webkit-scrollbar { width: 8px; }
.history-list::-webkit-scrollbar-thumb {
  background: #dbe2ec;
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.history-list::-webkit-scrollbar-track { background: transparent; }

.hist-group { margin-top: 4px; }
.group-label {
  padding: 12px 10px 6px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .04em;
  color: var(--qa-ink-4);
}
.conv-row {
  position: relative;
  border-radius: 10px;
  margin-bottom: 1px;
  transition: background .15s var(--qa-ease);
}
.conv-row:hover { background: #f6f8fc; }
.conv-row.active { background: var(--qa-brand-50); }
.conv-row.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 11px;
  bottom: 11px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--qa-brand-600);
}
.conv-main {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 32px 0 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: var(--qa-ink-2);
}
.conv-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-row.active .conv-title {
  color: var(--qa-brand-700);
  font-weight: 600;
}
.conv-time {
  flex-shrink: 0;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--qa-ink-4);
  transition: opacity .12s;
}
.conv-row:hover .conv-time { opacity: 0; }
.conv-unread {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--qa-brand-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, .12);
}
.conv-more {
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--qa-ink-4);
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity .12s, background .12s, color .12s;
}
.conv-row:hover .conv-more { opacity: 1; }
.conv-more:hover { background: #e8eef8; color: var(--qa-ink-2); }
.rename-input {
  width: calc(100% - 20px);
  height: 28px;
  margin: 7px 10px;
  padding: 0 8px;
  border: 1px solid var(--qa-brand-400);
  border-radius: 6px;
  background: #fff;
  outline: 0;
  font-size: 12px;
  color: var(--qa-ink);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .08);
}
.history-empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.7;
  color: var(--qa-ink-4);
}
.history-empty :deep(.chat-icon) {
  margin: 0 auto 8px;
  color: var(--qa-ink-5);
}
.history-loading { padding: 8px 2px; }
.history-skeleton {
  height: 34px;
  margin: 6px 4px;
  border-radius: 9px;
  background: linear-gradient(90deg, #eef1f6 25%, #f8fafc 50%, #eef1f6 75%);
  background-size: 200% 100%;
  animation: qaShimmer 1.4s ease-in-out infinite;
}
.history-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 18px;
  border-top: 1px solid #f1f5f9;
  font-size: 10.5px;
  color: var(--qa-ink-4);
}

.history-scrim {
  position: absolute;
  inset: 0;
  z-index: 25;
  border: 0;
  padding: 0;
  background: rgba(15, 23, 42, .28);
  cursor: pointer;
}

/* ── 历史右键菜单（Teleport 到 body，颜色不依赖父级变量） ── */
.history-ctx-menu {
  position: fixed;
  width: 134px;
  padding: 5px;
  background: #fff;
  border: 1px solid #e6eaf2;
  border-radius: 10px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, .12);
  z-index: 500;
}
.ctx-item {
  width: 100%;
  height: 31px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background .14s, color .14s;
}
.ctx-item :deep(.chat-icon) { color: #94a3b8; }
.ctx-item:hover { background: #f5f8fd; color: #1d4ed8; }
.ctx-item:hover :deep(.chat-icon) { color: #2563eb; }
.ctx-item.danger { color: #e5484d; }
.ctx-item.danger :deep(.chat-icon) { color: #e5484d; }
.ctx-item.danger:hover { background: #fef2f2; color: #e5484d; }
.ctx-fade-enter-active,
.ctx-fade-leave-active { transition: opacity .15s ease, transform .15s ease; }
.ctx-fade-enter-from,
.ctx-fade-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }

/* ═══ 对话主区 ═══ */
.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background:
    radial-gradient(960px 500px at 54% -12%, rgba(37, 99, 235, .055), transparent 62%),
    #fafbfd;
}
.chat-topbar {
  flex-shrink: 0;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 22px;
  background: rgba(255, 255, 255, .78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--qa-line);
  position: relative;
  z-index: 10;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.topbar-title-wrap { min-width: 0; }
.chat-title {
  margin: 0;
  max-width: 48vw;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -.015em;
  line-height: 1.35;
  color: var(--qa-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-sub {
  display: block;
  margin-top: 1px;
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--qa-ink-4);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.stream-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f0f6ff;
  border: 1px solid #dbeafe;
  color: var(--qa-brand-700);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.stream-chip i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--qa-brand-500);
  animation: qaPulseDot 1.15s ease-in-out infinite;
}
.trust-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f4f7fb;
  color: var(--qa-ink-3);
  font-size: 10.5px;
  white-space: nowrap;
}
.trust-chip :deep(.chat-icon) { color: #0f9f6e; }

/* 滚动区 */
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: #dbe2ec transparent;
}
.chat-scroll::-webkit-scrollbar { width: 8px; }
.chat-scroll::-webkit-scrollbar-thumb {
  background: #dbe2ec;
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.chat-scroll::-webkit-scrollbar-track { background: transparent; }
.chat-inner {
  width: 100%;
  max-width: 880px;
  min-height: 100%;
  margin: 0 auto;
  padding: 14px 28px 24px;
  display: flex;
  flex-direction: column;
}

/* ═══ 欢迎页 ═══ */
.welcome {
  margin: auto;
  width: 100%;
  max-width: 810px;
  padding: 18px 0 30px;
  text-align: center;
}
.emblem-wrap {
  position: relative;
  width: 88px;
  height: 88px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
}
.emblem-halo {
  position: absolute;
  width: 168px;
  height: 168px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37, 99, 235, .19) 0%, rgba(37, 99, 235, .05) 42%, transparent 68%);
  filter: blur(6px);
  z-index: 0;
}
.emblem-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(37, 99, 235, .13);
  z-index: 1;
}
.emblem-ring.r1 { width: 108px; height: 108px; }
.emblem-ring.r2 {
  width: 140px;
  height: 140px;
  border-style: dashed;
  border-color: rgba(37, 99, 235, .16);
  animation: qaSpin 28s linear infinite;
}
.emblem-ring.r2::after {
  content: "";
  position: absolute;
  top: 8px;
  left: 50%;
  width: 5px;
  height: 5px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--qa-brand-400);
  box-shadow: 0 0 0 3px rgba(96, 165, 250, .16);
}
.emblem {
  position: relative;
  z-index: 2;
  width: 64px;
  height: 64px;
  will-change: transform, opacity;
}
.emblem-tile {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: linear-gradient(145deg, #5b96fb 0%, #2563eb 55%, #1d4ed8 100%);
  color: #fff;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 18px 44px rgba(37, 99, 235, .28),
    0 3px 10px rgba(37, 99, 235, .18),
    inset 0 1px 0 rgba(255, 255, 255, .38);
}
.emblem-tile::after {
  content: "";
  position: absolute;
  inset: -30% -60%;
  background: linear-gradient(110deg, transparent 38%, rgba(255, 255, 255, .26) 48%, transparent 58%);
  transform: translateX(-70%);
  animation: qaTileSheen 4.8s var(--qa-ease) infinite;
}
.emblem-tile :deep(.chat-icon) {
  position: relative;
  z-index: 1;
}

.welcome-title {
  margin: 0 0 9px;
  font-size: 29px;
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -.03em;
  color: var(--qa-ink);
}
.welcome-title span {
  background: linear-gradient(100deg, #1d4ed8 0%, #3b82f6 48%, #2563eb 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.welcome-sub {
  margin: 0 auto;
  max-width: 560px;
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--qa-ink-3);
}
.welcome-trust {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 13px;
  font-size: 10.5px;
  color: var(--qa-ink-4);
}
.welcome-trust span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.welcome-trust :deep(.chat-icon) { color: var(--qa-brand-400); }

/* 推荐卡片 */
.suggest-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
  margin-top: 28px;
  text-align: left;
}
.suggest-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 78px;
  padding: 13px 15px 12px;
  border: 1px solid var(--qa-line);
  border-radius: 15px;
  background: rgba(255, 255, 255, .78);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  text-align: left;
  transition:
    border-color .18s var(--qa-ease),
    background .18s var(--qa-ease),
    box-shadow .18s var(--qa-ease),
    transform .18s var(--qa-ease);
}
.suggest-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, var(--qa-brand-400), var(--qa-brand-600));
  opacity: 0;
  transition: opacity .18s;
}
.suggest-card:hover {
  border-color: #c7dcff;
  background: #fff;
  box-shadow: 0 12px 28px rgba(37, 99, 235, .09);
  transform: translateY(-1px);
}
.suggest-card:hover::before { opacity: 1; }
.suggest-top {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.suggest-icon {
  width: 27px;
  height: 27px;
  margin-top: 1px;
  border-radius: 8px;
  background: var(--qa-brand-50);
  color: var(--qa-brand-600);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.suggest-text {
  flex: 1;
  font-size: 12.8px;
  line-height: 1.55;
  font-weight: 500;
  color: var(--qa-ink-2);
}
.suggest-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 36px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--qa-ink-4);
}
.suggest-arrow {
  display: grid;
  place-items: center;
  color: var(--qa-ink-5);
  transition: color .18s, transform .18s;
}
.suggest-card:hover .suggest-arrow {
  color: var(--qa-brand-600);
  transform: translate(2px, -2px);
}
.suggest-grid--skeleton { pointer-events: none; }
.suggest-skeleton {
  min-height: 78px;
  border: 1px solid var(--qa-line);
  border-radius: 15px;
  background: linear-gradient(90deg, #eef1f6 25%, #f9fbfe 50%, #eef1f6 75%);
  background-size: 200% 100%;
  animation: qaShimmer 1.4s ease-in-out infinite;
}
.suggest-state {
  margin-top: 28px;
  padding: 22px 18px;
  border: 1px dashed var(--qa-line-2);
  border-radius: 15px;
  font-size: 12.5px;
  color: var(--qa-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.suggest-retry {
  padding: 6px 14px;
  border: 1px solid var(--qa-brand-200);
  border-radius: 999px;
  background: #fff;
  color: var(--qa-brand-700);
  font-size: 12px;
  cursor: pointer;
}
.suggest-retry:hover { background: var(--qa-brand-50); }

/* 欢迎页入场：大图标聚拢 → 缩小归位 */
.welcome.entry .emblem { animation: qaEmblemSettle 1.9s var(--qa-ease) both; }
.welcome.entry .emblem-halo { animation: qaHaloIn 1.9s var(--qa-ease) both; }
.welcome.entry .emblem-ring.r1 { animation: qaRingIn 1.9s var(--qa-ease) both; }
.welcome.entry .emblem-ring.r2 { animation: qaRingIn2 1.9s var(--qa-ease) both; }
.welcome.entry .welcome-title { animation: qaFadeUp .55s var(--qa-ease) .92s both; }
.welcome.entry .welcome-sub { animation: qaFadeUp .55s var(--qa-ease) 1.02s both; }
.welcome.entry .welcome-trust { animation: qaFadeUp .55s var(--qa-ease) 1.1s both; }
.welcome.entry .suggest-grid,
.welcome.entry .suggest-state { animation: qaFadeUp .6s var(--qa-ease) 1.18s both; }
.welcome.pulse .emblem { animation: qaEmblemPop .55s var(--qa-ease) both; }

/* 消息流容器 */
.thread {
  display: flex;
  flex-direction: column;
  padding: 6px 0 4px;
}

/* ═══ 输入区 ═══ */
.composer-area {
  flex-shrink: 0;
  padding: 8px 28px 22px;
  position: relative;
  z-index: 5;
}
.composer-box {
  max-width: 820px;
  margin: 0 auto;
}
.composer {
  position: relative;
  background: #fff;
  border: 1px solid var(--qa-line-2);
  border-radius: 20px;
  padding: 13px 13px 9px 17px;
  box-shadow:
    0 10px 30px rgba(15, 23, 42, .055),
    0 1px 2px rgba(15, 23, 42, .035);
  transition: border-color .22s var(--qa-ease), box-shadow .22s var(--qa-ease);
}
.composer:focus-within {
  border-color: #bed9ff;
  box-shadow:
    0 0 0 4px rgba(37, 99, 235, .075),
    0 16px 38px rgba(37, 99, 235, .10);
}
@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}
.composer::before {
  content: "";
  position: absolute;
  inset: -1px;
  padding: 1px;
  border-radius: 21px;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg 236deg,
    rgba(96, 165, 250, .55) 280deg,
    var(--qa-brand-600) 322deg,
    rgba(37, 99, 235, .06) 360deg
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  opacity: 0;
  pointer-events: none;
  animation: qaBorderSpin 4.2s linear infinite;
  transition: opacity .25s;
}
.composer:focus-within::before { opacity: 1; }
.composer textarea {
  display: block;
  width: 100%;
  min-height: 28px;
  max-height: 160px;
  padding: 0 2px;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  font-size: 14.5px;
  line-height: 1.68;
  color: var(--qa-ink);
  overflow-y: auto;
  scrollbar-width: thin;
}
.composer textarea::placeholder {
  color: var(--qa-ink-4);
  font-size: 14px;
}
.composer textarea:disabled { cursor: not-allowed; }
.composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
}
.composer-feature {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border-radius: 7px;
  background: var(--qa-brand-50);
  color: var(--qa-brand-700);
  font-size: 10.5px;
  font-weight: 500;
  white-space: nowrap;
}
.composer-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}
.mic-btn {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--qa-ink-4);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.mic-btn:hover:not(:disabled) { background: #f1f5f9; color: var(--qa-ink-2); }
.mic-btn.recording {
  color: #e5484d;
  background: #fef2f2;
  animation: qaMicPulse 1.05s ease-in-out infinite;
}
.mic-btn:disabled { opacity: .45; cursor: not-allowed; }
.send-btn {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(145deg, #3b82f6, #1d4ed8);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 6px 15px rgba(37, 99, 235, .24);
  transition: box-shadow .16s, transform .16s, background .16s, color .16s;
}
.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 9px 20px rgba(37, 99, 235, .3);
}
.send-btn:active:not(:disabled) { transform: scale(.96); }
.send-btn:disabled {
  background: #e8edf4;
  color: var(--qa-ink-4);
  box-shadow: none;
  cursor: not-allowed;
}
.send-btn.streaming {
  background: #fff;
  color: var(--qa-brand-700);
  border: 1px solid #c7dcff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, .08);
}
.composer-hint {
  margin: 7px 0 0;
  text-align: center;
  font-size: 10px;
  letter-spacing: .01em;
  color: var(--qa-ink-4);
}

/* ═══ 动画 ═══ */
@keyframes qaShimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
@keyframes qaPulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .35; transform: scale(.82); }
}
@keyframes qaSpin { to { transform: rotate(360deg); } }
@keyframes qaTileSheen {
  0%, 62% { transform: translateX(-70%); }
  82%, 100% { transform: translateX(70%); }
}
@keyframes qaEmblemSettle {
  0% { opacity: 0; transform: scale(2.6) translateY(42px); filter: blur(10px); }
  16% { opacity: 1; filter: blur(0); }
  55% { transform: scale(1.06) translateY(0); }
  72% { transform: scale(.975); }
  86% { transform: scale(1.012); }
  100% { transform: scale(1) translateY(0); }
}
@keyframes qaHaloIn {
  0% { opacity: 0; transform: scale(.35); }
  28% { opacity: 1; transform: scale(1.12); }
  100% { opacity: .72; transform: scale(1); }
}
@keyframes qaRingIn {
  0% { opacity: 0; transform: scale(.3) rotate(-18deg); }
  35% { opacity: .9; }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes qaRingIn2 {
  0% { opacity: 0; transform: scale(.2) rotate(30deg); }
  40% { opacity: .7; }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes qaFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes qaEmblemPop {
  0% { opacity: .3; transform: scale(.82); }
  60% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes qaBorderSpin { to { --angle: 360deg; } }
@keyframes qaMicPulse {
  50% { box-shadow: 0 0 0 6px rgba(229, 72, 77, .10); }
}

/* ═══ 响应式 ═══ */
@media (max-width: 1240px) {
  .chat-inner { max-width: 800px; }
  .composer-box { max-width: 760px; }
  .history-panel { width: 276px; }
  .history-inner { width: 276px; }
}
@media (max-width: 1150px) {
  .history-panel {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 296px;
    border-right: 0;
    box-shadow: 24px 0 60px rgba(15, 23, 42, .16);
    z-index: 35;
    transition: transform .28s var(--qa-ease);
  }
  .history-inner { width: 296px; }
  .history-panel.collapsed {
    width: 296px;
    transform: translateX(-100%);
  }
}
@media (max-width: 1080px) {
  .trust-chip { display: none; }
  .chat-inner { padding-left: 22px; padding-right: 22px; }
}
@media (max-height: 820px) and (min-width: 761px) {
  .chat-inner { padding-top: 10px; padding-bottom: 20px; }
  .welcome { padding: 8px 0 18px; }
  .emblem-wrap { width: 78px; height: 78px; margin-bottom: 11px; }
  .emblem, .emblem-tile { width: 58px; height: 58px; }
  .emblem-tile { border-radius: 18px; }
  .emblem-halo { width: 142px; height: 142px; }
  .emblem-ring.r1 { width: 96px; height: 96px; }
  .emblem-ring.r2 { width: 124px; height: 124px; }
  .welcome-title { font-size: 26px; margin-bottom: 7px; }
  .welcome-sub { font-size: 12.5px; }
  .welcome-trust { margin-top: 10px; }
  .suggest-grid { margin-top: 18px; gap: 9px; }
  .suggest-card { min-height: 70px; padding: 11px 14px 10px; }
  .suggest-text { font-size: 12.5px; }
}
@media (max-width: 760px) {
  .history-panel,
  .history-inner { width: 282px; }
  .history-panel.collapsed { width: 282px; }
  .chat-inner { padding: 12px 16px 24px; }
  .chat-topbar { height: 58px; padding: 0 14px; }
  .chat-title { max-width: 42vw; font-size: 14px; }
  .chat-sub { display: none; }
  .composer-area { padding: 6px 14px 12px; }
  .suggest-grid { grid-template-columns: 1fr; gap: 9px; margin-top: 22px; }
  .welcome-title { font-size: 24px; }
  .welcome-sub { font-size: 12.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .chat-app *,
  .chat-app *::before,
  .chat-app *::after {
    animation-duration: .001ms !important;
    animation-delay: 0s !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
