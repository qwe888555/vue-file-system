<script setup lang="ts">
// ── 智能问答主页面 ──
// 豆包风格：简洁、留白、圆润

import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import { isAdminRole } from '@/config/roles'
import type { KnowledgeFile } from '@/types'
import { useChat } from '@/composables/useChat'
import { useSSE } from '@/composables/useSSE'
import AppRail from '@/components/chat/AppRail.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ChatLoginDialog from '@/components/chat/ChatLoginDialog.vue'
import SidebarUser from '@/components/common/SidebarUser.vue'
import { useChatUiStore } from '@/store/chatUi'

defineOptions({ name: 'ChatHome' })

const userStore = useUserStore()
const router = useRouter()
const chat = useChat()
const chatUi = useChatUiStore()

const sidebarOpen = ref(true)
const showLoginDialog = ref(false)
const hasPlayed = sessionStorage.getItem('hasPlayHomeAnimation') === 'true'
const showEntryAnim = ref(!hasPlayed)
const showInstantContent = ref(hasPlayed)
const inputText = ref('')
const isRecording = ref(false)

// SSE —— 按 convId 索引：切换会话不杀流，后台继续接收，token 写到发起会话的流式态
interface StreamingState {
  content: string
  references: KnowledgeFile[]
  suggested: string[]
  streaming: boolean
  messageId: number | null
  error: string | null
  // 本会话的流序号：同会话再提问/取消时 +1，用于识别并忽略过期流的回调
  seq: number
}
const streamingMap = ref<Record<number, StreamingState>>({})
// 非响应式：按 convId 索引的 SSE 实例与 watcher 清理函数
const sseMap: Record<number, ReturnType<typeof useSSE> | null> = {}
const stopWatchMap: Record<number, { content?: () => void; refs?: () => void; suggested?: () => void }> = {}

// 当前会话的流式态（切换会话时自动反映新会话的流式内容）
const currentStreaming = computed(() => {
  const id = chat.currentConversationId.value
  return id ? streamingMap.value[id] : undefined
})
const isStreaming = computed(() => !!currentStreaming.value?.streaming)
const streamingContent = computed(() => currentStreaming.value?.content ?? '')
const streamingReferences = computed(() => currentStreaming.value?.references ?? [])
const streamingSuggested = computed(() => currentStreaming.value?.suggested ?? [])

const isLoggedIn = computed(() => !!userStore.token)
// 单一数据源：凡拥有知识库访问权的角色均视为管理员口径（与 config/roles.ts 对齐）
const isAdminUser = computed(() => isAdminRole(userStore.role))
const hasActiveConversation = computed(() => chat.currentConversationId.value !== null)

// 顶栏标题：有会话显示会话标题，否则显示页面名（与演示方案一致）
const topbarTitle = computed(() => {
  if (hasActiveConversation.value) {
    return chat.currentConversation.value?.title || '新对话'
  }
  return isAdminUser.value ? '教研问答' : '智能问答'
})

// ── 热点问题（API）──
const hotQuestions = ref<Array<{ question: string; count: number }>>([])
const hotLoading = ref(false)
const hotError = ref('')
const SEED_ICONS: Record<string, string> = {
  '如何重置密码': '🔑', '怎么连接校园网': '🌐', '论文格式要求': '📝',
  '如何查找学习资料': '📚', '课程表在哪查': '📅', '图书馆借书流程': '📖',
  '奖学金申请条件': '🏆', '如何选课': '🎯', '实习机会有哪些': '💼',
  '学校邮箱怎么注册': '📧',
}

async function loadHotQuestions() {
  hotLoading.value = true
  hotError.value = ''
  try {
    const { getHotQuestionsApi } = await import('@/api/chat')
    const data = await getHotQuestionsApi({ top_k: 9 })
    hotQuestions.value = data
  } catch {
    hotQuestions.value = []
    hotError.value = '热点问题加载失败'
  } finally {
    hotLoading.value = false
  }
}

const topQuestions = computed(() =>
  hotQuestions.value.map(q => ({
    text: q.question.split('：')[0].split(':')[0], // 冒号后内容不显示
    icon: SEED_ICONS[Object.keys(SEED_ICONS).find(k => q.question.includes(k)) || ''] || '💬',
    count: q.count,
  }))
)

function quickQuestion(text: string) {
  inputText.value = text
  sendMessage()
}

function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }

function handleLoginSuccess() {
  showLoginDialog.value = false
  if (isAdminRole(userStore.role)) {
    router.push('/knowledge/list')
  }
  chat.fetchConversations()
}
function handleLoginCancel() { showLoginDialog.value = false }
/** 取消指定会话的流（默认当前会话）：同会话再提问或用户主动停止时调用 */
function cancelStreaming(convId?: number) {
  const id = convId ?? chat.currentConversationId.value
  if (!id) return
  const st = streamingMap.value[id]
  if (st) st.seq++ // 使在途回调失效
  sseMap[id]?.close()
  delete sseMap[id]
  stopWatchMap[id]?.content?.()
  stopWatchMap[id]?.refs?.()
  stopWatchMap[id]?.suggested?.()
  delete stopWatchMap[id]
  if (st) st.streaming = false
  delete streamingMap.value[id]
}
/** 关闭所有后台流（组件卸载/登出时调用） */
function closeAllStreaming() {
  for (const k of Object.keys(sseMap)) {
    const id = Number(k)
    streamingMap.value[id] && (streamingMap.value[id].seq++)
    sseMap[id]?.close()
    stopWatchMap[id]?.content?.()
    stopWatchMap[id]?.refs?.()
    stopWatchMap[id]?.suggested?.()
  }
  for (const k of Object.keys(sseMap)) delete sseMap[Number(k)]
  for (const k of Object.keys(stopWatchMap)) delete stopWatchMap[Number(k)]
  streamingMap.value = {}
}
const renamingId = ref<number | null>(null)
const renameText = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function startRename(conv: any) {
  renamingId.value = conv.id
  renameText.value = conv.title || ''
  setTimeout(() => renameInput.value?.focus(), 50)
}
/** 保存改名 */
function confirmRename(id: number) {
  const title = renameText.value.trim()
  if (title) {
    // 先立即更新本地显示（同步，不等 API）
    const conv = chat.conversations.value.find(c => c.id === id)
    if (conv) conv.title = title
    // 再异步同步后端（不 await，不阻塞 UI）
    chat.renameConversation(id, title).catch(() => {})
  }
  renamingId.value = null
}
/** 取消改名（恢复原名） */
function cancelRename() {
  renamingId.value = null
}

function handleNewConversation() {
  // 不杀其他后台流：切走时让其继续生成，落库后切回可见
  chat.createConversation()
}
async function handleSelectConversation(id: number) {
  // 不杀原会话流：切走时让其继续生成，落库后切回可见
  await chat.selectConversation(id)
  // 切回该会话即视为已读，清除其 conv 红点
  chatUi.clearConvUnread(id)
}
async function handleDeleteConversation(id: number) {
  await chat.deleteConversation(id)
  chatUi.clearConvUnread(id)
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  // 电脑端必须登录才能使用
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

  // 同会话有旧流则先杀掉（避免并发污染同一会话）
  cancelStreaming(convId)

  // 初始化本会话的流式状态（seq 递增使旧流回调失效）
  const prevSeq = streamingMap.value[convId]?.seq ?? 0
  const seq = prevSeq + 1
  streamingMap.value[convId] = {
    content: '',
    references: [],
    suggested: [],
    streaming: true,
    messageId: null,
    error: null,
    seq,
  }

  // 30 秒超时自动取消
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
    if (!st || st.seq !== seq) return // 过期流回调，忽略
    st.streaming = false
    // 错误流（SSE error 事件）：结束流状态但不追加普通回答，改用错误提示
    if (sse.error?.value) {
      delete streamingMap.value[convId]
      delete sseMap[convId]
      ElMessage.error(sse.error.value)
      return
    }
    const realId = sse.messageId?.value
    // st.content 来自 SSE 流，为空时取 sse.content（后端返回的错误消息如敏感词拦截）
    const content = st.content || sse.content?.value || ''
    chat.appendAssistantMessage(content, st.references, realId || undefined, st.suggested, convId)
    // 落库后清掉流式状态，下次该会话显示正式消息
    delete streamingMap.value[convId]
    delete sseMap[convId]
    // 后台生成完毕的红点策略：
    //   1) 用户已离开问答页 → rail 红点（原行为，提示用户回到问答模块）
    //   2) 用户还在问答页但切到其他对话 → 给被切走的原对话项加红点
    //   3) 用户还在原对话 → 不标（用户正在看）
    const onChatPage = router.currentRoute.value.name === 'Chat'
    const onThisConv = chat.currentConversationId.value === convId
    if (!onChatPage) {
      chatUi.setUnread(true)
      ElMessage.success(`回答已生成，点击左侧「${isAdminUser.value ? '教研问答' : '智能问答'}」查看`)
    } else if (!onThisConv) {
      chatUi.markConvUnread(convId)
    }
  })

  sseMap[convId] = sse
  // 清除前一轮的 watcher，防止累积；仅最新流的内容写入本会话状态
  stopWatchMap[convId]?.content?.()
  stopWatchMap[convId]?.refs?.()
  stopWatchMap[convId]?.suggested?.()
  stopWatchMap[convId] = {
    content: watch(sse.content, (val) => {
      const st = streamingMap.value[convId]
      if (st && st.seq === seq) st.content = val
    }),
    refs: watch(sse.references, (val) => {
      const st = streamingMap.value[convId]
      if (st && st.seq === seq) st.references = val
    }),
    suggested: watch(sse.suggested, (val) => {
      const st = streamingMap.value[convId]
      if (st && st.seq === seq) st.suggested = val
    }),
  }
}

function handleFeedback(messageId: number, type: 'like' | 'dislike' | 'none') {
  chat.submitFeedback(messageId, type)
}

/* ── 语音录制（通用，供后端降级 & 语音消息使用） ── */
let mediaRecorder: MediaRecorder | null = null

/** 开始录音，返回录制的 Blob（停止后 resolve） */
function startRecording(): Promise<Blob | null> {
  return new Promise(async (resolve) => {
    try {
      // 16kHz 单声道，与 ASR 模型匹配
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

/* ── 统一语音输入：录音 → 语音转文字 → 自动发送 ── */
let speechRecognition: any = null

async function handleVoiceMsg() {
  if (isRecording.value) {
    if (speechRecognition) { speechRecognition.stop(); speechRecognition = null }
    stopRecording()
    return
  }

  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechAPI) {
    try {
      const recognition = new SpeechAPI()
      recognition.lang = "zh-CN"
      recognition.interimResults = true
      recognition.continuous = true
      speechRecognition = recognition
      isRecording.value = true

      let finalTranscript = ""

      recognition.onresult = (event: any) => {
        // 取最新的完整识别结果
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript = event.results[i][0].transcript
          }
        }
        // 实时显示中间结果
        if (!finalTranscript && event.results.length > 0) {
          const last = event.results[event.results.length - 1]
          if (!last.isFinal) {
            inputText.value = last[0].transcript
          }
        }
      }

      recognition.onerror = (event: any) => {
        isRecording.value = false; speechRecognition = null
        if (event.error !== "no-speech" && event.error !== "aborted") {
          ElMessage.error("语音识别: " + event.error)
        }
      }

      recognition.onend = () => {
        isRecording.value = false; speechRecognition = null
        // 停止时如果有识别结果，自动发送
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
  inputText.value = "语音识别中…"
  try {
    const { voiceAskApi } = await import("@/api/chat")
    const response = await voiceAskApi(blob, convId)
    if (!response.ok) {
      const errBody = await response.text().catch(() => "")
      ElMessage.error(errBody ? "语音请求失败: " + errBody : "语音请求失败")
      inputText.value = ""; return
    }
    const reader = response.body?.getReader()
    if (!reader) { inputText.value = ""; return }
    const decoder = new TextDecoder(); let buffer = ""; let currentEvent = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n"); buffer = lines.pop() || ""
      for (const line of lines) {
        if (line.startsWith("event: ")) currentEvent = line.slice(7).trim()
        else if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6).trim())
            if (currentEvent === "asr_text" && data.text) {
              inputText.value = data.text
              sendMessage()
            }
          } catch {}
        }
      }
    }
  } catch { inputText.value = "" }
}
/** 全局点击空白取消改名 */
function handleBlankClick(e: MouseEvent) {
  if (renamingId.value === null) return
  const el = e.target as HTMLElement
  // 点击这些元素不取消
  if (el.closest('.conv-rename-input, .conv-rename-confirm, .sidebar-new-chat, .conv-item-edit, .conv-item-icon')) return
  cancelRename()
}

/** 组件卸载时停止录音/语音识别，避免麦克风持续采集 */
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

onMounted(() => {
  chat.init()
  loadHotQuestions()
  document.addEventListener('mousedown', handleBlankClick)
  if (showEntryAnim.value) {
    // 首次进入：播放完整动画，2600ms 后写入标记
    setTimeout(() => {
      showEntryAnim.value = false
      sessionStorage.setItem('hasPlayHomeAnimation', 'true')
    }, 2600)
  } else {
    // 非首次：直接显示完整内容
    showInstantContent.value = true
  }
})
onUnmounted(() => {
  document.removeEventListener('mousedown', handleBlankClick)
  cleanupRecording()
  // 关闭所有后台流（含 watcher），使在途 SSE 回调失效
  closeAllStreaming()
})

// ── KeepAlive 生命周期（App.vue 已缓存本组件）──
onActivated(() => {
  // 切回问答页即清除未读红点
  chatUi.setUnread(false)
})
onDeactivated(() => {
  // 切走时仅停止录音/语音识别；SSE 保持后台继续生成（不关闭）
  cleanupRecording()
})

// 登出时重置问答状态（keep-alive 下组件不销毁，需手动清空避免账号数据残留）
watch(
  () => userStore.token,
  (token) => {
    if (!token) {
      closeAllStreaming()
      chat.reset()
      inputText.value = ''
      chatUi.setUnread(false)
      chatUi.clearAllConvUnread()
    }
  },
)
</script>

<template>
  <div class="chat-app">
    <!-- 蜂巢入场动画（相 1-2：弹出 → 聚合 → 缩小） -->
    <div v-if="showEntryAnim" class="entry-overlay">
      <div class="entry-honeycomb">
        <div></div><div></div><div></div><div></div><div></div><div></div><div></div>
      </div>
    </div>
    <!-- 左侧常驻 rail（主导航，Q1B/Q9A：64px 收起态 + hover 浮层） -->
    <AppRail />
    <!-- ═══ 左侧边栏（对话列表）═══ -->
    <aside class="chat-sidebar" :class="{ collapsed: !sidebarOpen }">
      <!-- 顶部 -->
      <div class="sidebar-logo">
        <span class="sidebar-logo-text">NeuHub</span>
        <span class="sidebar-logo-sub">资源系统</span>
      </div>

      <!-- 搜索 -->
      <div class="sidebar-search">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z"/>
        </svg>
        <input v-model="chat.searchKeyword.value" type="text" placeholder="搜索对话" />
      </div>

      <!-- 新建对话 -->
      <button class="sidebar-new-chat" @click="handleNewConversation">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
        </svg>
        <span>新建对话</span>
      </button>

      <!-- 对话列表 -->
      <div class="sidebar-conversations">
        <div
          v-for="conv in chat.filteredConversations.value"
          :key="conv.id"
          class="conv-item"
          :class="{ active: conv.id === chat.currentConversationId.value, unread: chatUi.unreadConvIds[conv.id] }"
          @click="renamingId !== conv.id && handleSelectConversation(conv.id)"
        >
          <div class="conv-item-icon">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7a1.5 1.5 0 01-1.5 1.5h-3.586a1.5 1.5 0 00-1.06.44L5 15V12H3.5A1.5 1.5 0 012 10.5v-7z"/>
            </svg>
            <span v-if="chatUi.unreadConvIds[conv.id]" class="conv-unread-dot" />
          </div>
          <div class="conv-item-content">
            <div v-if="renamingId === conv.id" class="conv-rename-row">
              <input
                class="conv-rename-input"
                v-model="renameText"
                @keyup.enter="confirmRename(conv.id)"
                @click.stop
                ref="renameInput"
              />
              <button class="conv-rename-confirm" @click.stop="confirmRename(conv.id)" title="保存">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
              </button>
            </div>
            <span v-else class="conv-item-title">{{ conv.title || '新对话' }}</span>
            <span class="conv-item-time">{{ conv.updatedAt?.slice(5, 10) }}</span>
          </div>
          <button v-if="renamingId !== conv.id" class="conv-item-edit" @click.stop="startRename(conv)" title="重命名">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M12.146.854a.5.5 0 01.708 0l2.292 2.292a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-4 1.5a.5.5 0 01-.64-.64l1.5-4a.5.5 0 01.11-.168l10-10z"/></svg>
          </button>
          <button v-if="renamingId !== conv.id" class="conv-item-del" @click.stop="handleDeleteConversation(conv.id)">×</button>
        </div>
        <div v-if="chat.loading.value" class="sidebar-loading">
          <span class="load-dot" /><span class="load-dot" /><span class="load-dot" />
        </div>
        <div v-if="chat.filteredConversations.value.length === 0 && !chat.loading.value" class="sidebar-empty">
          暂无对话
        </div>
      </div>
      <SidebarUser @login="showLoginDialog = true" />
    </aside>
    <!-- ═══ 右侧主区域 ═══ -->
    <div class="chat-main" :class="{ 'sidebar-collapsed': !sidebarOpen }">
      <!-- 顶部栏（Q2A：原「退出问答」已移除，出口交给左侧常驻 rail） -->
      <header class="chat-topbar">
        <div class="topbar-left">
          <button class="topbar-btn" @click="toggleSidebar" title="收起 / 展开会话列表">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h14v1.5H3v-1.5z" />
            </svg>
          </button>
          <h1 class="topbar-title">{{ topbarTitle }}</h1>
          <span v-if="isStreaming" class="chip-stream"><i></i>正在回答…</span>
        </div>
      </header>

      <!-- 对话区 -->
      <div class="chat-messages">
        <div class="messages-inner">
          <!-- 消息列表（有对话且有消息时显示） -->
          <div v-if="hasActiveConversation && chat.currentMessages.value.length > 0" class="messages-list">
            <MessageBubble
              v-for="msg in chat.currentMessages.value"
              :key="msg.id"
              :message="msg"
              :suggested-questions="msg.suggested"
              :user-role="userStore.role ?? undefined"
              @feedback="handleFeedback"
              @quick-question="quickQuestion"
            />
            <MessageBubble
              v-if="isStreaming"
              :message="{
                id: Date.now(),
                conversationId: chat.currentConversationId.value!,
                role: 'assistant',
                content: streamingContent || '…',
                createdAt: new Date().toISOString(),
              }"
              :streaming="true"
              :stream-content="streamingContent"
              :suggested-questions="streamingSuggested"
              :user-role="userStore.role ?? undefined"
              @quick-question="quickQuestion"
            />
          </div>

          <!-- 欢迎页（无对话或对话为空时显示） -->
          <div v-else class="chat-welcome">
            <div class="welcome-icon">
              <svg class="wi-honeycomb" viewBox="-30 -33 60 66" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g fill="#409eff">
                  <polygon points="0,-12 10.392,-6 10.392,6 0,12 -10.392,6 -10.392,-6"/>
                  <polygon transform="translate(18,10.392)" points="0,-12 10.392,-6 10.392,6 0,12 -10.392,6 -10.392,-6"/>
                  <polygon transform="translate(0,20.785)" points="0,-12 10.392,-6 10.392,6 0,12 -10.392,6 -10.392,-6"/>
                  <polygon transform="translate(-18,10.392)" points="0,-12 10.392,-6 10.392,6 0,12 -10.392,6 -10.392,-6"/>
                  <polygon transform="translate(-18,-10.392)" points="0,-12 10.392,-6 10.392,6 0,12 -10.392,6 -10.392,-6"/>
                  <polygon transform="translate(0,-20.785)" points="0,-12 10.392,-6 10.392,6 0,12 -10.392,6 -10.392,-6"/>
                  <polygon transform="translate(18,-10.392)" points="0,-12 10.392,-6 10.392,6 0,12 -10.392,6 -10.392,-6"/>
                </g>
              </svg>
            </div>
            <h2 class="welcome-title" :class="{ 'wi-anim-in': !showEntryAnim, instant: showInstantContent }">
              你好！有什么可以帮助你的？
            </h2>
            <div v-if="hotLoading" class="quick-questions quick-questions--skeleton">
              <span v-for="i in 5" :key="i" class="qq-skeleton" />
            </div>
            <div v-else-if="hotError" class="quick-questions quick-questions--error">
              <span class="qq-error-text">{{ hotError }}</span>
              <button class="qq-retry" @click="loadHotQuestions">重试</button>
            </div>
            <div v-else-if="topQuestions.length" class="quick-questions">
              <button
                v-for="q in topQuestions"
                :key="q.text"
                class="qq-btn"
                @click="quickQuestion(q.text)"
              >{{ q.text }}</button>
            </div>
            <div v-else class="quick-questions quick-questions--empty">
              <span class="qq-empty-text">暂无推荐问题，可直接输入您想了解的内容</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入栏 -->
      <div class="chat-input-area">
        <div class="input-anim-container">
          <svg style="position: absolute; width: 0; height: 0;">
            <filter width="300%" x="-100%" height="300%" y="-100%" id="unopaq">
              <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 9 0" />
            </filter>
            <filter width="300%" x="-100%" height="300%" y="-100%" id="unopaq2">
              <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 3 0" />
            </filter>
            <filter width="300%" x="-100%" height="300%" y="-100%" id="unopaq3">
              <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 2 0" />
            </filter>
          </svg>
          <div class="spin spin-blur"></div>
          <div class="spin spin-intense"></div>
          <div class="input-backdrop"></div>
          <div class="input-anim-border">
            <div class="spin spin-inside"></div>
            <div class="chat-input-wrapper">
            <input
              v-model="inputText"
              type="text"
              class="input-field"
              :placeholder="isStreaming ? 'AI 正在回复…' : '输入你的问题…'"
              :disabled="isStreaming"
              @keyup.enter="sendMessage"
            />
            <button v-if="isStreaming" class="cancel-btn" @click="cancelStreaming()" title="取消">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2"/></svg>
            </button>
            <button class="voice-btn" :class="{ recording: isRecording }" @click="handleVoiceMsg" title="语音输入">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                <path d="M10 2a3 3 0 00-3 3v4a3 3 0 106 0V5a3 3 0 00-3-3zM5 9a5 5 0 0010 0h-1.5a3.5 3.5 0 01-7 0H5z"/>
                <path d="M9.25 13.5v2.75h1.5V13.5h-1.5z"/>
                <path d="M6 14.5h8v1.5H6z"/>
              </svg>
            </button>
            <button class="send-fab" :disabled="!inputText.trim() || isStreaming" @click="sendMessage">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                <path d="M10 2a1 1 0 01.707.293l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414l-4.293 4.293a1 1 0 01-1.414-1.414l6-6A1 1 0 0110 2z"/>
              </svg>
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 弹窗 ═══ -->
    <ChatLoginDialog v-if="showLoginDialog" @success="handleLoginSuccess" @cancel="handleLoginCancel" />

  </div>
    </template>

<style scoped>
/* ═══════════════════ 全局 ═══════════════════ */
.chat-app {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #f5f5f5;
  font-family: var(--font-sans);
  color: #1f1f1f;
}

/* ═══════════════════ 左侧边栏 ═══════════════════ */
.chat-sidebar {
  width: 222px;
  min-width: 222px;
  background: #fff;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(64, 158, 255, 0.12);
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, opacity 0.25s ease;
  z-index: 10;
  overflow: hidden;
}
.chat-sidebar.collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  opacity: 0;
  border-right: none;
}

/* 顶部 */
.sidebar-top {
  padding: 20px 16px;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}
.sidebar-top::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(64, 158, 255, 0.3), transparent);
}
.sidebar-logo {
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  flex-shrink: 0;
  gap: 2px;
}
.sidebar-logo-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary-deep, #2563eb);
  letter-spacing: 2px;
  line-height: 1.2;
}
.sidebar-logo-sub {
  font-size: 13px;
  font-weight: 500;
  color: #8e95a6;
  letter-spacing: 4px;
}
/* 退出按钮 */
.sidebar-exit {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  margin: 0 8px 4px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary, #64748b);
  transition: background-color 0.15s, color 0.15s;
}
.sidebar-exit:hover {
  background: rgba(64, 158, 255, 0.06);
  color: #409eff;
}

/* 搜索 */
.sidebar-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 16px;
  padding: 8px 12px;
  background: rgba(64, 158, 255, 0.06);
  border-radius: 8px;
  color: var(--color-text-secondary, #64748b);
}
.sidebar-search input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: #1f1f1f;
}
.sidebar-search input::placeholder { color: var(--color-text-placeholder, #6b7280); }

/* 新建对话按钮 */
.sidebar-new-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 16px 12px;
  padding: 10px;
  background: rgba(64, 158, 255, 0.12);
  color: #409eff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.sidebar-new-chat:hover { background: rgba(64, 158, 255, 0.2); }

/* 对话列表 */
.sidebar-conversations {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
  overflow: hidden;
  min-width: 0;
}
.conv-item:hover { background: #f5f5f5; }
.conv-item.active { background: #f0f0f0; }

.conv-item-icon {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-secondary, #64748b);
  flex-shrink: 0;
  position: relative;
}
.conv-unread-dot {
  position: absolute;
  top: 4px; right: 4px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--color-danger, #f56c6c);
  box-shadow: 0 0 0 2px #fff;
  pointer-events: none;
}
.conv-item-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.conv-item-title {
  font-size: 13px;
  color: #1f1f1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-item-time {
  font-size: 11px;
  color: var(--color-text-secondary, #64748b);
}
.conv-item-del {
  opacity: 0;
  background: none;
  border: none;
  color: var(--color-text-secondary, #64748b);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.conv-item:hover .conv-item-del,
.conv-item:hover .conv-item-edit { opacity: 1; }
.conv-item-del:hover { color: #f56c6c; }

.conv-item-edit {
  opacity: 0; background: none; border: none; color: var(--color-text-secondary, #64748b);
  cursor: pointer; padding: 0 2px; transition: opacity 0.15s; flex-shrink: 0;
}
.conv-item-edit:hover { color: #409eff; }
.conv-rename-row {
  display: flex; align-items: center; gap: 4px;
  min-width: 0; overflow: hidden;
}
.conv-rename-input {
  flex: 1; min-width: 0; height: 24px; padding: 0 4px; border: 1px solid #409eff;
  border-radius: 4px; font-size: 13px; outline: none; background: #fff;
}
.conv-rename-confirm {
  position: relative;
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 4px; background: #409eff; color: #fff;
  cursor: pointer; flex-shrink: 0; transition: background 0.15s;
}
.conv-rename-confirm::before { content: ""; position: absolute; inset: -10px; }
.conv-rename-confirm:hover { background: var(--color-primary-dark, #337ecc); }

.sidebar-loading { display: flex; justify-content: center; gap: 4px; padding: 20px; }
.load-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--color-text-secondary, #64748b); animation: dotPulse 1.2s ease-in-out infinite;
}
.load-dot:nth-child(2) { animation-delay: 0.2s; }
.load-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.sidebar-empty { text-align: center; padding: 24px; font-size: 13px; color: var(--color-text-secondary, #64748b); }

/* 底部用户 */
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}
.sidebar-user-area { position: relative; }
.sidebar-user:hover { background: #f0f4fe; }
.user-popup {
  position: absolute; bottom: calc(100% + 4px); left: 8px; right: 8px;
  background: #fff; border-radius: 10px;
  box-shadow: 0 -2px 16px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);
  overflow: hidden; z-index: 20;
}
.user-popup-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer; font-size: 14px; color: #1a2332;
  transition: background 0.15s;
}
.user-popup-item:hover { background: #f0f4fe; color: var(--color-primary-deep, #2563eb); }
.user-popup-item:first-child { border-bottom: 1px solid #f0f0f0; }
.menu-up-enter-active, .menu-up-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.menu-up-enter-from, .menu-up-leave-to { opacity: 0; transform: translateY(8px); }
.su-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(64, 158, 255, 0.15);
  display: flex; align-items: center; justify-content: center;
  color: #409eff; flex-shrink: 0; font-size: 15px; font-weight: 600;
}
.su-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.su-name { font-size: 13px; font-weight: 600; color: #1f1f1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.su-role { font-size: 11px; color: var(--color-text-secondary, #64748b); }
.su-status { font-size: 11px; color: #67c23a; background: #f0f9eb; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
.su-avatar-text { font-size: 16px; font-weight: 700; color: #333; }
.su-name { font-size: 15px; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* ═══════════════════ 右侧主区域 ═══════════════════ */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}
/* 顶栏 */
.chat-topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
  position: relative;
}
.chat-topbar::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(64, 158, 255, 0.4) 20%, rgba(64, 158, 255, 0.6) 50%, rgba(64, 158, 255, 0.4) 80%, transparent 100%);
  animation: topbarGlow 4s ease-in-out infinite;
}
@keyframes topbarGlow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbar-left {
  min-width: 0;
}
.topbar-btn {
  position: relative;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer; color: var(--color-text-secondary, #64748b);
  transition: background-color 0.15s, color 0.15s;
}
/* 触控热区扩展到 44×44（视觉不变，满足移动端触控目标） */
.topbar-btn::before { content: ""; position: absolute; inset: -6px; }
.topbar-btn:hover { background: #ecf5ff; color: #409eff; }
.topbar-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #1f1f1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

/* ── 正在回答 chip（Q4A：SSE 进行中）── */
.chip-stream {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #b45309;
  background: #fff8eb;
  padding: 3px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}
.chip-stream i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
  animation: chipPulse 1.2s ease infinite;
}
@keyframes chipPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}


/* 对话消息区 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
  position: relative;
}

/* 科技感蓝色光晕背景 */
.messages-inner {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 24px;
}

/* 欢迎页 */
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
  text-align: center;
}
.welcome-icon {
  margin-bottom: 24px;
  width: 72px; height: 72px;
  display: flex; align-items: center; justify-content: center;
  position: relative; z-index: 1;
}

/* ═══ 标题入场 ═══ */
.welcome-title {
  font-size: var(--text-hero, 26px);
  font-weight: 600;
  color: #1f1f1f;
  margin: 0 0 10px;
  letter-spacing: -0.04em;
  position: relative;
  z-index: 1;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}
.welcome-title.wi-anim-in {
  opacity: 1;
  transform: translateY(0);
}
.welcome-title.instant {
  opacity: 1;
  transform: translateY(0);
  transition: none;
}

/* ═══ 快捷按钮入场（分层延时 + 外发光脉冲） ═══ */

/* 快捷提问胶囊按钮 */
.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 0 0;
  align-items: center;
  justify-content: center;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}
.qq-btn {
  padding: 8px 18px;
  background: #f0f2f5;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  color: #444;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  white-space: nowrap;
  width: auto;
}
.qq-btn:hover {
  background: #e5e6eb;
  color: var(--color-primary-deep, #2563eb);
}

/* 热点问题：loading 骨架 / error 重试 / empty 提示 */
.qq-skeleton {
  height: 34px;
  min-width: 96px;
  border-radius: 20px;
  background: linear-gradient(90deg, #eef1f6 25%, #f7f9fc 50%, #eef1f6 75%);
  background-size: 200% 100%;
  animation: qqShimmer 1.4s ease-in-out infinite;
}
@keyframes qqShimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
.qq-error-text, .qq-empty-text {
  font-size: 13px;
  color: var(--color-text-secondary, #64748b);
}
.qq-retry {
  padding: 6px 16px;
  border: 1px solid var(--color-primary, #409eff);
  border-radius: 18px;
  background: transparent;
  color: var(--color-primary-deep, #2563eb);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.qq-retry:hover { background: #ecf5ff; }

/* ═══ 输入栏 ═══ */
.chat-input-area {
  flex-shrink: 0;
  padding: 12px 24px 20px;
  background: #fff;
}

/* ── 输入框旋转渐变（蓝橙配色）── */
.input-anim-container {
  position: relative;
  max-width: 760px;
  margin: 0 auto;
}

.input-anim-border {
  padding: 3px;
  inset: 0;
  background: #0005;
  border-radius: 16px;
}

.chat-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--el-input-border-color, #e4e9f0);
  border-radius: 12px;
  padding: 6px 6px 6px 14px;
  background: #fff;
  z-index: 1;
}

.input-backdrop {
  position: absolute;
  inset: -9900%;
  background: radial-gradient(circle at 50% 50%, #0000 0, #0000 20%, #111111aa 50%);
  background-size: 3px 3px;
  z-index: -1;
}

.spin {
  position: absolute;
  inset: 0;
  z-index: -2;
  opacity: 0;
  overflow: hidden;
  transition: opacity 0.35s;
}

.input-anim-container:focus-within .spin,
.input-anim-container:hover .spin,
.input-anim-container:focus-within .input-anim-border .spin,
.input-anim-container:hover .input-anim-border .spin {
  opacity: 0.6;
}

.spin-blur {
  filter: blur(2em) url(#unopaq);
}

.spin-intense {
  inset: -0.125em;
  filter: blur(0.25em) url(#unopaq2);
  border-radius: 0.75em;
}

.spin-inside {
  inset: -1px;
  border-radius: inherit;
  filter: blur(1.5px) url(#unopaq3);
  z-index: 0;
}

.spin::before {
  content: "";
  position: absolute;
  inset: -150%;
  animation: speen 8s cubic-bezier(0.56, 0.15, 0.28, 0.86) infinite, woah 4s ease infinite;
  animation-play-state: paused;
}

.input-anim-container:focus-within .spin::before,
.input-anim-container:hover .spin::before,
.input-anim-container:focus-within .input-anim-border .spin::before,
.input-anim-container:hover .input-anim-border .spin::before {
  animation-play-state: running;
}

.spin-blur::before {
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light), var(--color-primary-dark));
  background-size: 200% 100%;
}

.spin-intense::before {
  background: linear-gradient(90deg, var(--color-primary-dark), var(--color-primary), var(--color-primary-light));
  background-size: 200% 100%;
}

.spin-inside::before {
  background: linear-gradient(90deg, var(--color-primary-light), var(--color-primary-dark), var(--color-primary));
  background-size: 200% 100%;
}

@keyframes speen {
  0% { rotate: 10deg; }
  50% { rotate: 190deg; }
  to { rotate: 370deg; }
}

@keyframes woah {
  0%, to { scale: 1; }
  50% { scale: 0.75; }
}

.input-field {
  flex: 1; border: none; background: transparent; outline: none;
  font-size: 14px; color: #1f1f1f; padding: 8px 0; min-height: 24px;
}
.input-field::placeholder { color: var(--color-text-placeholder, #6b7280); font-size: 15px; }
.send-fab {
  position: relative;
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: var(--color-primary, #409eff); color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background-color 0.2s, transform 0.2s; flex-shrink: 0; padding: 0;
}
.send-fab::before { content: ""; position: absolute; inset: -5px; }
.send-fab svg { width: 16px; height: 16px; }
.send-fab:hover:not(:disabled) { background: var(--color-primary-dark, #337ecc); }
.send-fab:disabled { background: #d9d9d9; cursor: not-allowed; }

/* 语音输入按钮 */
.voice-btn {
  position: relative;
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: transparent; color: var(--color-text-secondary, #64748b);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background-color 0.2s, color 0.2s; flex-shrink: 0; padding: 0;
}
.voice-btn::before { content: ""; position: absolute; inset: -5px; }
.voice-btn:hover { background: rgba(64,158,255,0.08); color: #409eff; }
.voice-btn.recording { color: #f56c6c; animation: micPulse 1s ease-in-out infinite; }
@keyframes micPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* ═══ 入场动画：蜂巢弹出 → 聚合 → 缩小 ═══ */
.entry-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  background: #fff;
}
.entry-honeycomb {
  height: 24px; position: relative; width: 24px;
  transform: scale(3);
  animation: containerFull 2600ms cubic-bezier(0.21, 0.98, 0.22, 1) forwards;
}
.entry-honeycomb div {
  background: #409eff; height: 12px; margin-top: 6px;
  position: absolute; width: 24px;
  opacity: 0; transform: scale(0);
  animation: popIn 600ms cubic-bezier(0.21, 0.98, 0.22, 1) forwards;
}
.entry-honeycomb div:after, .entry-honeycomb div:before {
  content: ''; border-left: 12px solid transparent; border-right: 12px solid transparent;
  position: absolute; left: 0; right: 0;
}
.entry-honeycomb div:after { top: -6px; border-bottom: 6px solid #409eff; }
.entry-honeycomb div:before { bottom: -6px; border-top: 6px solid #409eff; }
.entry-honeycomb div:nth-child(1) { animation-delay: 0ms;   left: -28px; top: 0; }
.entry-honeycomb div:nth-child(2) { animation-delay: 120ms; left: -14px; top: 22px; }
.entry-honeycomb div:nth-child(3) { animation-delay: 240ms; left: 14px; top: 22px; }
.entry-honeycomb div:nth-child(4) { animation-delay: 360ms; left: 28px; top: 0; }
.entry-honeycomb div:nth-child(5) { animation-delay: 480ms; left: 14px; top: -22px; }
.entry-honeycomb div:nth-child(6) { animation-delay: 600ms; left: -14px; top: -22px; }
.entry-honeycomb div:nth-child(7) { animation-delay: 720ms; left: 0; top: 0; }

/* 单块弹出 */
@keyframes popIn {
  0%   { opacity: 0; transform: scale(0); }
  70%  { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
/* 容器：稳定 bounce（800-1300ms）→ 缩小（1300-1800ms）→ 上移归位（1800-2600ms） */
@keyframes containerFull {
  0%, 30.8% { transform: scale(3) translateY(0); }
  34.6%     { transform: scale(3.12) translateY(0); }
  42.3%     { transform: scale(3) translateY(0); }
  50%       { transform: scale(3) translateY(0); }
  69.2%     { transform: scale(1) translateY(0); }
  100%      { transform: scale(1) translateY(-190px); }
}

/* ═══ 欢迎页永久蜂巢图标（SVG 严格六重对称，缓慢顺时旋转） ═══
   尺寸 80×80：内容约 69×79.5px，与改造前 CSS 版蜂巢（7×24px 块、-28..28 / -22..22 → 约 80×68）视觉大小保持一致 */
.wi-honeycomb {
  width: 80px; height: 80px;
  animation: slowSpin 12s linear infinite;
  animation-delay: 2.6s; /* 等待入场动画完成 */
}
@keyframes slowSpin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
