<script setup lang="ts">
// ── 手机端智能问答 ──
// 视觉与桌面端重构后的问答页保持一致（学院蓝 / 书页星芒 / 克制留白），
// 并针对窄屏、触摸、刘海屏安全区与软键盘做适配。
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import { useChat } from '@/composables/useChat'
import { useSSE } from '@/composables/useSSE'
import { isTeachingQaRole } from '@/config/roles'
import ChatIcon from '@/components/chat/ChatIcon.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'

const router = useRouter()
const userStore = useUserStore()
const chat = useChat()

const inputText = ref('')
const isStreaming = ref(false)
const isRecording = ref(false)
let mediaRecorder: MediaRecorder | null = null
const streamingContent = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
let currentSSE: ReturnType<typeof useSSE> | null = null
// 当前流的 content watcher（仅监听最新流，发送新消息前解除旧的，防止累积）
let stopContentWatch: (() => void) | null = null
// 流序号：会话切换/新请求时自增，使在途 SSE 回调失效（防止回复写入错误会话）
let streamSeq = 0

const isLoggedIn = computed(() => !!userStore.token)
const isTeachingQa = computed(() => isTeachingQaRole(userStore.role))
const pageTitle = computed(() => (isTeachingQa.value ? '教研问答' : '智能问答'))
const assistantName = computed(() => (isTeachingQa.value ? '教研助手' : '智能助手'))
const topbarSub = computed(() =>
  isTeachingQa.value ? '基于校内教研知识库 · 引用可溯源' : '基于校内知识库 · 引用可溯源',
)
const welcomeSubtitle = computed(() =>
  isTeachingQa.value
    ? '基于校内教研知识库回答，每条结论都可追溯到原文出处，方便核对与引用。'
    : '基于校内知识库回答，每条结论都可追溯到原文出处，方便核对与引用。',
)

// 流式过程中的追问 / 相关图片（随 SSE 事件实时更新）
const streamingSuggested = computed(() => currentSSE?.suggested.value ?? [])
const streamingImages = computed(() => currentSSE?.images.value ?? [])

// ── 热点问题 ──
const hotQuestions = ref<Array<{ question: string; count: number }>>([])
const hotLoading = ref(false)
const hotError = ref('')
const SUGGEST_ICON_NAMES = ['target', 'clipboard', 'file', 'compass', 'chart']

async function loadHotQuestions() {
  hotLoading.value = true
  hotError.value = ''
  try {
    const { getHotQuestionsApi } = await import('@/api/chat')
    // 移动端屏幕纵向空间有限，只取 5 条热点问题
    const data = await getHotQuestionsApi({ top_k: 5 })
    hotQuestions.value = data
  } catch {
    hotQuestions.value = []
    hotError.value = '热点问题加载失败'
  } finally {
    hotLoading.value = false
  }
}

const topQuestions = computed(() =>
  hotQuestions.value.slice(0, 5).map((q, index) => ({
    text: q.question.split('：')[0].split(':')[0], // 冒号后不显示
    icon: SUGGEST_ICON_NAMES[index % SUGGEST_ICON_NAMES.length],
    count: q.count,
    hot: index === 0,
  })),
)

// ── 欢迎页入场动画（每个会话只播放一次）──
const hasPlayedWelcome = sessionStorage.getItem('hasPlayedMobileQaAnimation') === 'true'
const welcomeEntry = ref(!hasPlayedWelcome)
let entryTimer: ReturnType<typeof setTimeout> | undefined

// ── 软键盘适配（iOS Safari 的键盘会覆盖固定布局，这里按可视视口抬升输入区）──
const keyboardInset = ref(0)
function syncViewport() {
  const vv = window.visualViewport
  if (!vv) return
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
  // 小于 80px 的差值多为地址栏伸缩，不当作键盘处理
  keyboardInset.value = inset > 80 ? inset : 0
}

// ── 滚动 ──
function scrollToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// ── 输入框自适应高度 ──
function autoGrowInput() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

function quickQuestion(text: string) {
  inputText.value = text
  nextTick(autoGrowInput)
  sendMessage()
}

const showHistory = ref(false)

// 长按上下文菜单
const contextConv = ref<any>(null)
const showContextMenu = ref(false)
const menuTop = ref(0)
let longPressTimer: any = null
let isLongPress = false
let menuJustOpened = false

function onTouchStart(conv: any, event: TouchEvent) {
  isLongPress = false
  menuJustOpened = false
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  longPressTimer = setTimeout(() => {
    isLongPress = true
    menuJustOpened = true
    contextConv.value = conv
    menuTop.value = rect.bottom + 4
    showContextMenu.value = true
  }, 350)
}
function onTouchEnd() {
  clearTimeout(longPressTimer)
}
function onTouchMove() {
  clearTimeout(longPressTimer)
}
function handleItemClick(conv: any) {
  if (isLongPress) {
    isLongPress = false
    return
  }
  handleSelectHistory(conv.id)
}
function pinConversation() {
  if (!contextConv.value) return
  const conv = contextConv.value
  // 本地置顶：把该对话移到数组最前面
  const idx = chat.conversations.value.findIndex((c) => c.id === conv.id)
  if (idx > 0) {
    const item = chat.conversations.value.splice(idx, 1)[0]
    chat.conversations.value.unshift(item)
  }
  showContextMenu.value = false
  contextConv.value = null
}
async function deleteConversation() {
  if (!contextConv.value) return
  const id = contextConv.value.id
  await chat.deleteConversation(id)
  showContextMenu.value = false
  contextConv.value = null
}
function onDocClick(e: MouseEvent) {
  if (menuJustOpened) {
    menuJustOpened = false
    return
  }
  const menu = document.querySelector('.ctx-menu')
  if (menu && !menu.contains(e.target as Node)) {
    closeContextMenu()
  }
}
function closeContextMenu() {
  showContextMenu.value = false
  contextConv.value = null
}

/** 结束在途 SSE 并清理流状态（切换会话 / 新建对话 / 停止生成共用） */
function resetStream() {
  streamSeq++
  stopContentWatch?.()
  stopContentWatch = null
  currentSSE?.close()
  currentSSE = null
  isStreaming.value = false
  streamingContent.value = ''
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  // 游客必须登录后才能提问（避免静默失败无反馈）
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录后再提问')
    router.push('/mobile/login')
    return
  }

  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }
  const convId = chat.currentConversationId.value!
  const mySeq = ++streamSeq
  chat.appendUserMessage(text)
  inputText.value = ''
  nextTick(autoGrowInput)
  scrollToBottom()

  isStreaming.value = true
  streamingContent.value = ''

  const sse = useSSE(convId, text, () => {
    // 过期回调：期间已切换会话或发起新请求，丢弃本次回复
    if (mySeq !== streamSeq) return
    isStreaming.value = false
    if (sse.error?.value) {
      ElMessage.error(sse.error.value)
      streamingContent.value = ''
      return
    }
    chat.appendAssistantMessage(
      streamingContent.value,
      sse.references.value,
      sse.messageId?.value || undefined,
      sse.suggested.value,
      sse.images.value,
      convId,
    )
    streamingContent.value = ''
    scrollToBottom()
  })
  currentSSE = sse

  // 解除前一轮 watcher，防止累积；仅最新流的 token 写入 streamingContent
  stopContentWatch?.()
  stopContentWatch = watch(sse.content, (val) => {
    if (mySeq !== streamSeq) return
    streamingContent.value = val ?? ''
  })
}

function handleSendClick() {
  if (isStreaming.value) {
    resetStream()
    return
  }
  sendMessage()
}

function handleInputKeydown(e: KeyboardEvent) {
  // 输入法组合中的回车不发送
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    handleSendClick()
  }
}

function handleFeedback(messageId: number, type: 'like' | 'dislike' | 'none') {
  chat.submitFeedback(messageId, type)
}

async function handleSelectHistory(id: number) {
  showHistory.value = false
  resetStream()
  await chat.selectConversation(id)
  scrollToBottom()
}

function handleNewChat() {
  showHistory.value = false
  resetStream()
  chat.currentConversationId.value = null
  nextTick(autoGrowInput)
}

function goLogin() {
  router.push('/mobile/login')
}
function handleLogout() {
  userStore.logout()
  router.push('/mobile/chat')
}

/* ── 语音录制 ── */
function startRecording(): Promise<Blob | null> {
  return new Promise(async (resolve) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType =
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) =>
          MediaRecorder.isTypeSupported(t),
        ) || ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      const chunks: Blob[] = []
      mediaRecorder = mr
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        resolve(blob.size > 100 ? blob : null)
      }
      mr.onerror = () => resolve(null)
      mr.start()
      isRecording.value = true
    } catch {
      resolve(null)
    }
  })
}
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
  isRecording.value = false
}

/* ── 统一语音输入：录音 → 语音转文字 → 自动发送 ── */
let speechRecognition: any = null

async function handleVoiceMsg() {
  if (isStreaming.value) return
  if (isRecording.value) {
    if (speechRecognition) {
      speechRecognition.stop()
      speechRecognition = null
    }
    stopRecording()
    return
  }

  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    ElMessage.warning('语音功能需要 HTTPS 环境')
    return
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    ElMessage.info('iOS Safari 不支持语音输入，请使用 Chrome 浏览器')
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
          if (!last.isFinal) inputText.value = last[0].transcript
        }
      }

      recognition.onerror = (event: any) => {
        isRecording.value = false
        speechRecognition = null
        if (event.error === 'not-allowed') ElMessage.error('请允许麦克风权限后重试')
        else if (event.error !== 'no-speech' && event.error !== 'aborted')
          ElMessage.error('语音识别: ' + event.error)
      }

      recognition.onend = () => {
        isRecording.value = false
        speechRecognition = null
        if (finalTranscript) {
          inputText.value = finalTranscript
          nextTick(autoGrowInput)
          sendMessage()
        }
      }

      recognition.start()
      return
    } catch {
      isRecording.value = false
      speechRecognition = null
    }
  }

  const blob = await startRecording()
  if (!blob) return
  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }
  const convId = chat.currentConversationId.value!
  inputText.value = '语音识别中…'
  nextTick(autoGrowInput)
  try {
    const { voiceAskApi } = await import('@/api/chat')
    const response = await voiceAskApi(blob, convId)
    if (!response.ok) {
      inputText.value = ''
      return
    }
    const reader = response.body?.getReader()
    if (!reader) {
      inputText.value = ''
      return
    }
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7).trim()
        else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6).trim())
            if (currentEvent === 'asr_text' && data.text) {
              inputText.value = data.text
              nextTick(autoGrowInput)
              sendMessage()
            }
          } catch {}
        }
      }
    }
  } catch {
    inputText.value = ''
  }
}

watch(streamingContent, () => {
  if (isStreaming.value) scrollToBottom()
})

onMounted(async () => {
  document.addEventListener('click', onDocClick)
  window.visualViewport?.addEventListener('resize', syncViewport)
  window.visualViewport?.addEventListener('scroll', syncViewport)

  // 有 token 但无用户信息时尝试拉取，失败说明 token 过期
  if (userStore.token && !userStore.userInfo) {
    try {
      await userStore.getUserInfo()
    } catch {
      userStore.logout()
    }
  }
  loadHotQuestions()
  if (isLoggedIn.value) {
    sessionStorage.removeItem('chat_conversations_cache')
    chat.init()
    chat.fetchConversations()
  } else {
    // 未登录时清除缓存，避免看到上一账号的历史记录
    sessionStorage.removeItem('chat_conversations_cache')
    chat.conversations.value = []
  }

  if (welcomeEntry.value) {
    entryTimer = setTimeout(() => {
      welcomeEntry.value = false
      sessionStorage.setItem('hasPlayedMobileQaAnimation', 'true')
    }, 2350)
  }
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.visualViewport?.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('scroll', syncViewport)
  if (entryTimer) clearTimeout(entryTimer)
  // 离开页面时中止在途 SSE、停止录音，释放麦克风等资源（与桌面端 ChatHome 一致）
  resetStream()
  if (speechRecognition) {
    try {
      speechRecognition.stop()
    } catch {
      /* 已停止 */
    }
    speechRecognition = null
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop()
    } catch {
      /* 已停止 */
    }
  }
  mediaRecorder = null
  isRecording.value = false
})
</script>

<template>
  <div
    class="mobile-chat"
    :style="keyboardInset ? { '--mq-keyboard-inset': `${keyboardInset}px` } : undefined"
  >
    <!-- 顶栏 -->
    <header class="m-topbar">
      <button class="m-menu-btn" aria-label="打开历史对话" @click="showHistory = true">
        <ChatIcon name="panel-right" :size="20" />
      </button>
      <div class="m-topbar-main">
        <span class="m-title">{{ pageTitle }}</span>
        <span class="m-sub">{{ topbarSub }}</span>
      </div>
      <button class="m-new-btn" aria-label="新建对话" title="新建对话" @click="handleNewChat">
        <ChatIcon name="plus" :size="18" />
      </button>
    </header>

    <!-- 对话区 -->
    <div ref="messagesRef" class="m-messages">
      <div class="m-msgs-inner">
        <template v-if="chat.currentConversationId.value">
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
              id: Date.now(),
              conversationId: chat.currentConversationId.value!,
              role: 'assistant',
              content: streamingContent || '…',
              createdAt: new Date().toISOString(),
            }"
            :streaming="true"
            :stream-content="streamingContent"
            :suggested-questions="streamingSuggested"
            :images="streamingImages"
            :user-role="userStore.role ?? undefined"
            @quick-question="quickQuestion"
          />
        </template>

        <!-- 欢迎页（与桌面端同一图案：光晕 + 双环 + 书页星芒徽标） -->
        <section v-else class="m-welcome" :class="{ entry: welcomeEntry }">
          <div class="emblem-wrap">
            <div class="emblem-halo" />
            <div class="emblem-ring r1" />
            <div class="emblem-ring r2" />
            <div class="emblem">
              <div class="emblem-tile">
                <ChatIcon name="brand" :size="26" />
              </div>
            </div>
          </div>

          <h2 class="m-welcome-title">
            你好，我是<span>{{ assistantName }}</span>
          </h2>
          <p class="m-welcome-sub">{{ welcomeSubtitle }}</p>

          <div class="m-welcome-trust">
            <span><ChatIcon name="library" :size="12" />校内知识库</span>
            <span><ChatIcon name="book" :size="12" />回答附引用</span>
            <span><ChatIcon name="clock" :size="12" />实时检索</span>
          </div>

          <div
            v-if="hotLoading"
            class="m-suggest-grid m-suggest-grid--skeleton"
            aria-label="热点问题加载中"
          >
            <div v-for="i in 5" :key="i" class="m-suggest-skeleton" />
          </div>
          <div v-else-if="hotError" class="m-suggest-state">
            <span>{{ hotError }}</span>
            <button class="m-suggest-retry" @click="loadHotQuestions">重试</button>
          </div>
          <div v-else-if="topQuestions.length" class="m-suggest-grid">
            <button
              v-for="q in topQuestions"
              :key="q.text"
              class="m-suggest-card"
              type="button"
              @click="quickQuestion(q.text)"
            >
              <span class="m-suggest-top">
                <span class="m-suggest-icon">
                  <ChatIcon :name="q.icon" :size="14" />
                </span>
                <span class="m-suggest-text">{{ q.text }}</span>
              </span>
              <span class="m-suggest-meta">
                {{ q.hot ? '热门 · ' : '' }}{{ q.count }} 次提问
                <span class="m-suggest-arrow">
                  <ChatIcon name="arrow-up-right" :size="13" />
                </span>
              </span>
            </button>
          </div>
          <div v-else class="m-suggest-state">暂无推荐问题，可直接输入您想了解的内容</div>
        </section>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="m-input-area">
      <div class="m-composer-box">
        <div class="m-composer">
          <textarea
            ref="inputRef"
            v-model="inputText"
            rows="1"
            class="m-input"
            enterkeyhint="send"
            :placeholder="isStreaming ? 'AI 正在回答…' : '输入你的问题…'"
            :disabled="isStreaming"
            @input="autoGrowInput"
            @keydown="handleInputKeydown"
          />
          <div class="m-composer-bar">
            <span class="m-composer-feature">
              <ChatIcon name="sparkles" :size="12" />
              知识库增强
            </span>
            <div class="m-composer-actions">
              <button
                class="m-mic-btn"
                :class="{ recording: isRecording }"
                :disabled="isStreaming"
                aria-label="语音输入"
                title="语音输入"
                @click="handleVoiceMsg"
              >
                <ChatIcon name="mic" :size="17" />
              </button>
              <button
                class="m-send-btn"
                :class="{ streaming: isStreaming }"
                :disabled="!isStreaming && !inputText.trim()"
                :aria-label="isStreaming ? '停止生成' : '发送'"
                :title="isStreaming ? '停止生成' : '发送'"
                @click="handleSendClick"
              >
                <ChatIcon :name="isStreaming ? 'stop' : 'arrow-up'" :size="17" />
              </button>
            </div>
          </div>
        </div>
        <p class="m-composer-hint">AI 生成内容可能存在偏差，请以引用原文为准</p>
      </div>
    </div>

    <!-- 历史侧边面板（从左侧滑入） -->
    <Transition name="panel-slide">
      <div v-if="showHistory" class="m-panel-wrap">
        <div class="m-panel">
          <div class="m-panel-header">
            <div class="m-panel-title-row">
              <span class="m-panel-title">历史对话</span>
              <span v-if="isLoggedIn" class="m-panel-count">{{
                chat.filteredConversations.value.length
              }}</span>
            </div>
            <button class="m-panel-close" aria-label="关闭" @click="showHistory = false">
              <ChatIcon name="x" :size="20" />
            </button>
          </div>

          <!-- 搜索 -->
          <div class="m-panel-search">
            <ChatIcon name="search" :size="15" />
            <input v-model="chat.searchKeyword.value" type="text" placeholder="搜索对话" />
          </div>

          <!-- 新建对话 -->
          <button class="m-panel-new-btn" @click="handleNewChat">
            <ChatIcon name="plus" :size="15" />
            新建对话
          </button>

          <!-- 对话列表 -->
          <div v-if="isLoggedIn" class="m-panel-list">
            <div
              v-for="conv in chat.filteredConversations.value"
              :key="conv.id"
              class="m-panel-item"
              :class="{ active: conv.id === chat.currentConversationId.value }"
              @click="handleItemClick(conv)"
              @touchstart="onTouchStart(conv, $event)"
              @touchend="onTouchEnd"
              @touchmove="onTouchMove"
            >
              <div class="m-panel-item-content">
                <span class="m-panel-item-title">{{ conv.title || '新对话' }}</span>
                <span class="m-panel-item-time">{{ conv.updatedAt?.slice(5, 10) }}</span>
              </div>
            </div>
          </div>

          <!-- 未登录提示 -->
          <div v-if="!isLoggedIn" class="m-panel-login-hint">
            <p>登录后可查看历史记录</p>
          </div>

          <!-- 底部用户 -->
          <div class="m-panel-footer">
            <div v-if="isLoggedIn" class="m-panel-user" @click="handleLogout">
              <div class="m-panel-avatar">
                {{
                  (userStore.userInfo?.role_display || userStore.userInfo?.username || '访')
                    .charAt(0)
                    .toUpperCase()
                }}
              </div>
              <span class="m-panel-username">{{ userStore.userInfo?.username || '' }}</span>
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="currentColor"
                class="m-panel-logout"
              >
                <path
                  d="M3 3h6v2H5v10h4v2H3V3zm12.5 5H11V6h4.5L19 10l-3.5 4H11v-2h4.5L16 10l-1.5-2z"
                />
              </svg>
            </div>
            <div v-else class="m-panel-user" @click="goLogin">
              <div class="m-panel-avatar m-panel-avatar-guest">客</div>
              <span class="m-panel-username">游客模式</span>
              <span class="m-panel-login-tip">去登录</span>
            </div>
          </div>
        </div>
        <div class="m-panel-overlay" @click="showHistory = false" />
      </div>
    </Transition>

    <!-- 长按上下文菜单 -->
    <Transition name="ctx-pop">
      <div v-if="showContextMenu" class="ctx-menu" :style="{ top: menuTop + 'px' }" @click.stop>
        <div class="ctx-item" @click="pinConversation">
          <span class="ctx-item-text">置顶</span>
          <svg class="ctx-item-icon" viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path
              d="M15.3 4.3a1 1 0 01.4 1.4l-3 5.3 3.3 3.3a1 1 0 01-1.4 1.4l-12-12a1 1 0 011.4-1.4l3.3 3.3 5.3-3a1 1 0 011.4.4z"
            />
            <path d="M10 8.5l4-4-3-3-4 4z" />
          </svg>
        </div>
        <div class="ctx-divider" />
        <div class="ctx-item ctx-item-danger" @click="deleteConversation">
          <span class="ctx-item-text">从对话列表删除</span>
          <ChatIcon name="trash" :size="18" class="ctx-item-icon" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════
   与桌面端问答页共用的视觉语言：学院蓝 / 书页星芒 / 克制留白
   ── 局部 Token 仅作用于本页
   ══════════════════════════════════════════════════════════════════════ */
.mobile-chat {
  --mq-brand-50: #f0f6ff;
  --mq-brand-100: #e0edff;
  --mq-brand-200: #bfdbfe;
  --mq-brand-400: #60a5fa;
  --mq-brand-500: #3b82f6;
  --mq-brand-600: #2563eb;
  --mq-brand-700: #1d4ed8;
  --mq-ink: #0f172a;
  --mq-ink-2: #334155;
  --mq-ink-3: #64748b;
  --mq-ink-4: #94a3b8;
  --mq-ink-5: #cbd5e1;
  --mq-line: #e6eaf2;
  --mq-line-2: #d8dfeb;
  --mq-danger: #e5484d;
  --mq-ease: cubic-bezier(0.22, 0.61, 0.36, 1);

  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(680px 340px at 50% -8%, rgba(37, 99, 235, 0.06), transparent 68%), #fafbfd;
  color: var(--mq-ink);
  font-family: var(--font-sans);
  touch-action: manipulation; /* 消除 300ms 点击延迟 */
  /* 软键盘弹出时，按键盘高度减掉底部 TabBar 占位，把输入区抬到键盘上方 */
  padding-bottom: max(
    0px,
    calc(var(--mq-keyboard-inset, 0px) - 56px - env(safe-area-inset-bottom))
  );
}
.mobile-chat,
.mobile-chat * {
  box-sizing: border-box;
}

/* ── iOS Safari 默认样式重置：去掉按钮/输入框的原生外观 ── */
.mobile-chat button,
.mobile-chat input,
.mobile-chat textarea {
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}
.mobile-chat button {
  -webkit-tap-highlight-color: transparent;
}
/* iOS Safari SVG 图标修复：防止被 flex 压缩、确保颜色继承 */
.mobile-chat svg {
  flex-shrink: 0;
  color: inherit;
}

/* ═══ 顶栏 ═══ */
.m-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: calc(56px + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 10px 0;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--mq-line);
  position: relative;
  z-index: 10;
}
.m-menu-btn,
.m-new-btn {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--mq-ink-3);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.16s var(--mq-ease),
    color 0.16s var(--mq-ease),
    transform 0.16s var(--mq-ease);
}
.m-menu-btn:active,
.m-new-btn:active {
  background: #f1f5f9;
  color: var(--mq-ink);
  transform: scale(0.95);
}

.m-topbar-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.m-title {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.35;
  color: var(--mq-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.m-sub {
  margin-top: 1px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--mq-ink-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ═══ 对话区 ═══ */
.m-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.m-msgs-inner {
  min-height: 100%;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── 问答区宽度自适应（手机 / 平板宽屏共用） ──
   MessageBubble 为移动与桌面共用，其默认样式面向桌面：AI 内容限制在行宽 85%、
   AI 行右侧再留白 60px，在窄屏手机上气泡只占整行约 67%，偏窄。
   这里仅覆盖移动端：AI 行右侧留白收窄、内容区放宽到接近整行，并按设备宽度自适应，
   用 820px 上限兜住平板等宽屏的行长，避免阅读行过宽。 */
.m-msgs-inner :deep(.msg-row-ai) {
  padding-right: 10px;
}
.m-msgs-inner :deep(.msg-content-area) {
  max-width: min(100%, 820px);
}
.m-msgs-inner :deep(.msg-row-user .msg-content-area) {
  max-width: 90%;
}

/* ═══ 欢迎页 ═══ */
.m-welcome {
  margin: auto;
  width: 100%;
  max-width: 680px;
  padding: 14px 4px 18px;
  text-align: center;
}

/* 图案：光晕 + 双环 + 书页星芒徽标（与桌面端一致） */
.emblem-wrap {
  position: relative;
  width: 70px;
  height: 70px;
  margin: 0 auto 12px;
  display: grid;
  place-items: center;
}
.emblem-halo {
  position: absolute;
  width: 134px;
  height: 134px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(37, 99, 235, 0.19) 0%,
    rgba(37, 99, 235, 0.05) 42%,
    transparent 68%
  );
  filter: blur(6px);
  z-index: 0;
}
.emblem-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(37, 99, 235, 0.13);
  z-index: 1;
}
.emblem-ring.r1 {
  width: 88px;
  height: 88px;
}
.emblem-ring.r2 {
  width: 112px;
  height: 112px;
  border-style: dashed;
  border-color: rgba(37, 99, 235, 0.16);
  animation: mqSpin 28s linear infinite;
}
.emblem-ring.r2::after {
  content: '';
  position: absolute;
  top: 7px;
  left: 50%;
  width: 5px;
  height: 5px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--mq-brand-400);
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16);
}
.emblem {
  position: relative;
  z-index: 2;
  width: 52px;
  height: 52px;
  will-change: transform, opacity;
}
.emblem-tile {
  width: 52px;
  height: 52px;
  border-radius: 17px;
  background: linear-gradient(145deg, #5b96fb 0%, #2563eb 55%, #1d4ed8 100%);
  color: #fff;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 14px 34px rgba(37, 99, 235, 0.28),
    0 3px 9px rgba(37, 99, 235, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.38);
}
.emblem-tile::after {
  content: '';
  position: absolute;
  inset: -30% -60%;
  background: linear-gradient(
    110deg,
    transparent 38%,
    rgba(255, 255, 255, 0.26) 48%,
    transparent 58%
  );
  transform: translateX(-70%);
  animation: mqTileSheen 4.8s var(--mq-ease) infinite;
}
.emblem-tile :deep(.chat-icon) {
  position: relative;
  z-index: 1;
}

.m-welcome-title {
  margin: 0 0 7px;
  font-size: 22px;
  line-height: 1.28;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--mq-ink);
}
.m-welcome-title span {
  background: linear-gradient(100deg, #1d4ed8 0%, #3b82f6 48%, #2563eb 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.m-welcome-sub {
  margin: 0 auto;
  max-width: 420px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--mq-ink-3);
}
.m-welcome-trust {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 14px;
  margin-top: 10px;
  font-size: 10.5px;
  color: var(--mq-ink-4);
}
.m-welcome-trust span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.m-welcome-trust :deep(.chat-icon) {
  color: var(--mq-brand-400);
}

/* 推荐卡片（手机上单列，平板宽度自动两列） */
.m-suggest-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  margin-top: 16px;
  text-align: left;
}
.m-suggest-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 64px;
  padding: 10px 12px 9px;
  border: 1px solid var(--mq-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  text-align: left;
  transition:
    border-color 0.18s var(--mq-ease),
    background 0.18s var(--mq-ease),
    box-shadow 0.18s var(--mq-ease),
    transform 0.18s var(--mq-ease);
}
.m-suggest-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, var(--mq-brand-400), var(--mq-brand-600));
  opacity: 0;
  transition: opacity 0.18s;
}
.m-suggest-card:active {
  border-color: #c7dcff;
  background: #fff;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.09);
  transform: scale(0.995);
}
.m-suggest-card:active::before {
  opacity: 1;
}
.m-suggest-top {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.m-suggest-icon {
  width: 26px;
  height: 26px;
  margin-top: 1px;
  border-radius: 8px;
  background: var(--mq-brand-50);
  color: var(--mq-brand-600);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.m-suggest-text {
  flex: 1;
  min-width: 0;
  font-size: 12.8px;
  line-height: 1.55;
  font-weight: 500;
  color: var(--mq-ink-2);
  overflow-wrap: anywhere;
}
.m-suggest-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 35px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--mq-ink-4);
}
.m-suggest-arrow {
  display: grid;
  place-items: center;
  color: var(--mq-ink-5);
}
.m-suggest-grid--skeleton {
  pointer-events: none;
}
.m-suggest-skeleton {
  min-height: 64px;
  border: 1px solid var(--mq-line);
  border-radius: 14px;
  background: linear-gradient(90deg, #eef1f6 25%, #f9fbfe 50%, #eef1f6 75%);
  background-size: 200% 100%;
  animation: mqShimmer 1.4s ease-in-out infinite;
}
.m-suggest-state {
  margin-top: 16px;
  padding: 18px 14px;
  border: 1px dashed var(--mq-line-2);
  border-radius: 14px;
  font-size: 12.5px;
  color: var(--mq-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.m-suggest-retry {
  padding: 6px 14px;
  border: 1px solid var(--mq-brand-200);
  border-radius: 999px;
  background: #fff;
  color: var(--mq-brand-700);
  font-size: 12px;
  cursor: pointer;
}
.m-suggest-retry:active {
  background: var(--mq-brand-50);
}

/* 欢迎页入场：徽标聚拢 → 归位，文案与卡片依次淡入 */
.m-welcome.entry .emblem {
  animation: mqEmblemSettle 1.9s var(--mq-ease) both;
}
.m-welcome.entry .emblem-halo {
  animation: mqHaloIn 1.9s var(--mq-ease) both;
}
.m-welcome.entry .emblem-ring.r1 {
  animation: mqRingIn 1.9s var(--mq-ease) both;
}
.m-welcome.entry .emblem-ring.r2 {
  animation: mqRingIn2 1.9s var(--mq-ease) both;
}
.m-welcome.entry .m-welcome-title {
  animation: mqFadeUp 0.55s var(--mq-ease) 0.9s both;
}
.m-welcome.entry .m-welcome-sub {
  animation: mqFadeUp 0.55s var(--mq-ease) 1s both;
}
.m-welcome.entry .m-welcome-trust {
  animation: mqFadeUp 0.55s var(--mq-ease) 1.08s both;
}
.m-welcome.entry .m-suggest-grid,
.m-welcome.entry .m-suggest-state {
  animation: mqFadeUp 0.6s var(--mq-ease) 1.16s both;
}

/* ═══ 输入区 ═══ */
.m-input-area {
  flex-shrink: 0;
  padding: 6px 12px 10px;
  background: linear-gradient(to top, #fafbfd 70%, rgba(250, 251, 253, 0));
  position: relative;
  z-index: 5;
}
.m-composer-box {
  max-width: 760px;
  margin: 0 auto;
}
.m-composer {
  position: relative;
  background: #fff;
  border: 1px solid var(--mq-line-2);
  border-radius: 18px;
  padding: 10px 10px 7px 14px;
  box-shadow:
    0 8px 24px rgba(15, 23, 42, 0.055),
    0 1px 2px rgba(15, 23, 42, 0.035);
  transition:
    border-color 0.22s var(--mq-ease),
    box-shadow 0.22s var(--mq-ease);
}
.m-composer:focus-within {
  border-color: #bed9ff;
  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.075),
    0 12px 30px rgba(37, 99, 235, 0.1);
}
.m-input {
  display: block;
  width: 100%;
  min-height: 26px;
  max-height: 120px;
  margin: 0;
  padding: 0 2px;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  /* 16px 防止 iOS Safari 聚焦时自动放大页面 */
  font-size: 16px;
  line-height: 1.55;
  color: var(--mq-ink);
  overflow-y: auto;
  scrollbar-width: thin;
}
.m-input::placeholder {
  color: var(--mq-ink-4);
  font-size: 15px;
}
.m-input:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}
.m-composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 5px;
}
.m-composer-feature {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--mq-brand-50);
  color: var(--mq-brand-700);
  font-size: 10.5px;
  font-weight: 500;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
}
.m-composer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
}
.m-mic-btn {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--mq-ink-4);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.m-mic-btn:active:not(:disabled) {
  background: #f1f5f9;
  color: var(--mq-ink-2);
}
.m-mic-btn.recording {
  color: var(--mq-danger);
  background: #fef2f2;
  animation: mqMicPulse 1.05s ease-in-out infinite;
}
.m-mic-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.m-send-btn {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(145deg, #3b82f6, #1d4ed8);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 6px 15px rgba(37, 99, 235, 0.24);
  transition:
    box-shadow 0.16s,
    transform 0.16s,
    background 0.16s,
    color 0.16s;
}
.m-send-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.m-send-btn:disabled {
  background: #e8edf4;
  color: var(--mq-ink-4);
  box-shadow: none;
  cursor: not-allowed;
}
.m-send-btn.streaming {
  background: #fff;
  color: var(--mq-brand-700);
  border: 1px solid #c7dcff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
}
.m-composer-hint {
  margin: 6px 0 0;
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.01em;
  color: var(--mq-ink-4);
}

/* ═══ 历史侧边面板（左侧滑入，6/7 宽） ═══ */
.m-panel-wrap {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
}
.m-panel {
  width: calc(100vw * 6 / 7);
  max-width: 340px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 8px 0 32px rgba(15, 23, 42, 0.1);
}
.m-panel-overlay {
  flex: 1;
  background: rgba(15, 23, 42, 0.32);
}

.m-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top) + 6px) 12px 6px 18px;
  border-bottom: 1px solid var(--mq-line);
}
.m-panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.m-panel-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--mq-ink);
}
.m-panel-count {
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--mq-ink-3);
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 999px;
}
.m-panel-close {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--mq-ink-4);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.m-panel-close:active {
  background: #f1f5f9;
}

/* 搜索 */
.m-panel-search {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 12px 14px 10px;
  min-height: 40px;
  padding: 0 11px;
  background: #f5f7fb;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--mq-ink-4);
  transition:
    background 0.16s,
    border-color 0.16s,
    box-shadow 0.16s,
    color 0.16s;
}
.m-panel-search:focus-within {
  background: #fff;
  border-color: var(--mq-brand-200);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.07);
  color: var(--mq-brand-600);
}
.m-panel-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  outline: 0;
  font-size: 16px;
  color: var(--mq-ink);
}
.m-panel-search input::placeholder {
  color: var(--mq-ink-4);
  font-size: 14px;
}

.m-panel-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 14px 8px;
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(145deg, #3b82f6, #1d4ed8);
  color: #fff;
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.2);
  transition:
    box-shadow 0.18s var(--mq-ease),
    transform 0.18s var(--mq-ease);
}
.m-panel-new-btn:active {
  transform: translateY(1px);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.18);
}

.m-panel-list {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 2px 8px 10px;
}
.m-panel-item {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s var(--mq-ease);
}
.m-panel-item:active {
  background: #f6f8fc;
}
.m-panel-item.active {
  background: var(--mq-brand-50);
}
.m-panel-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--mq-brand-600);
}
.m-panel-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.m-panel-item-title {
  flex: 1;
  font-size: 13px;
  color: var(--mq-ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.m-panel-item.active .m-panel-item-title {
  color: var(--mq-brand-700);
  font-weight: 600;
}
.m-panel-item-time {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--mq-ink-4);
  flex-shrink: 0;
}

/* 未登录提示（占满剩余高度，把底部用户栏压到面板底部） */
.m-panel-login-hint {
  flex: 1;
  padding: 24px 20px;
  text-align: center;
}
.m-panel-login-hint p {
  font-size: 13px;
  color: var(--mq-ink-3);
  margin: 0;
}

/* 底部用户 */
.m-panel-footer {
  border-top: 1px solid #f1f5f9;
  padding-bottom: constant(safe-area-inset-bottom); /* iOS 11.0 */
  padding-bottom: env(safe-area-inset-bottom); /* iOS 11.2+ */
}
.m-panel-user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 10px 16px;
  cursor: pointer;
}
.m-panel-user:active {
  background: #f6f8fc;
}
.m-panel-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.15);
  color: #409eff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  flex-shrink: 0;
}
.m-panel-avatar-guest {
  background: #f1f5f9;
  color: var(--mq-ink-4);
}
.m-panel-username {
  flex: 1;
  font-size: 14px;
  color: var(--mq-ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.m-panel-logout {
  color: var(--mq-ink-4);
}
.m-panel-login-tip {
  font-size: 13px;
  color: var(--mq-brand-600);
}

.panel-slide-enter-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}
.panel-slide-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
/* 子元素自身需要 transition 才会平滑播放滑入/淡入 */
.panel-slide-enter-active .m-panel {
  transition: transform 0.3s ease;
}
.panel-slide-enter-active .m-panel-overlay {
  transition: opacity 0.3s ease;
}
.panel-slide-leave-active .m-panel {
  transition: transform 0.2s ease;
}
.panel-slide-leave-active .m-panel-overlay {
  transition: opacity 0.2s ease;
}
.panel-slide-enter-from .m-panel {
  transform: translateX(-100%);
}
.panel-slide-enter-from .m-panel-overlay {
  opacity: 0;
}
.panel-slide-leave-to .m-panel {
  transform: translateX(-100%);
}
.panel-slide-leave-to .m-panel-overlay {
  opacity: 0;
}

/* 长按上下文菜单 */
.ctx-menu {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 801;
  width: 280px;
  background: #fff;
  border: 1px solid var(--mq-line);
  border-radius: 14px;
  box-shadow:
    0 24px 60px rgba(15, 23, 42, 0.12),
    0 2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.ctx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.15s;
}
.ctx-item:active {
  background: #f5f8fd;
}
.ctx-item-text {
  font-size: 15px;
  color: var(--mq-ink);
  font-weight: 500;
}
.ctx-item-icon {
  flex-shrink: 0;
  color: var(--mq-ink-3);
}
.ctx-item-danger .ctx-item-text {
  color: var(--mq-danger);
}
.ctx-item-danger .ctx-item-icon {
  color: var(--mq-danger);
}
.ctx-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 0 16px;
}

.ctx-pop-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
}
.ctx-pop-leave-active {
  transition:
    opacity 0.15s ease-in,
    transform 0.15s ease-in;
}
.ctx-pop-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
.ctx-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

/* ═══ 动画 ═══ */
@keyframes mqShimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
@keyframes mqSpin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes mqTileSheen {
  0%,
  62% {
    transform: translateX(-70%);
  }
  82%,
  100% {
    transform: translateX(70%);
  }
}
@keyframes mqEmblemSettle {
  0% {
    opacity: 0;
    transform: scale(2.6) translateY(36px);
    filter: blur(10px);
  }
  16% {
    opacity: 1;
    filter: blur(0);
  }
  55% {
    transform: scale(1.06) translateY(0);
  }
  72% {
    transform: scale(0.975);
  }
  86% {
    transform: scale(1.012);
  }
  100% {
    transform: scale(1) translateY(0);
  }
}
@keyframes mqHaloIn {
  0% {
    opacity: 0;
    transform: scale(0.35);
  }
  28% {
    opacity: 1;
    transform: scale(1.12);
  }
  100% {
    opacity: 0.72;
    transform: scale(1);
  }
}
@keyframes mqRingIn {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-18deg);
  }
  35% {
    opacity: 0.9;
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}
@keyframes mqRingIn2 {
  0% {
    opacity: 0;
    transform: scale(0.2) rotate(30deg);
  }
  40% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}
@keyframes mqFadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes mqMicPulse {
  50% {
    box-shadow: 0 0 0 6px rgba(229, 72, 77, 0.1);
  }
}

/* ═══ 响应式 ═══ */
/* 平板/横屏宽屏：两列推荐卡片，放宽边距 */
@media (min-width: 600px) {
  .m-msgs-inner {
    padding: 0 20px;
  }
  .m-welcome {
    max-width: 720px;
    padding: 24px 8px 28px;
  }
  .m-welcome-title {
    font-size: 27px;
  }
  .m-welcome-sub {
    font-size: 13.5px;
  }
  .m-suggest-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .m-input-area {
    padding-left: 20px;
    padding-right: 20px;
  }
}
/* 矮屏（横屏 / 小屏手机）：压缩欢迎页，保证推荐卡片一屏可及 */
@media (max-height: 620px) {
  .m-welcome {
    padding: 10px 4px 14px;
  }
  .emblem-wrap {
    width: 64px;
    height: 64px;
    margin-bottom: 10px;
  }
  .emblem-halo {
    width: 120px;
    height: 120px;
  }
  .emblem-ring.r1 {
    width: 80px;
    height: 80px;
  }
  .emblem-ring.r2 {
    width: 102px;
    height: 102px;
  }
  .emblem,
  .emblem-tile {
    width: 48px;
    height: 48px;
  }
  .emblem-tile {
    border-radius: 16px;
  }
  .m-welcome-title {
    font-size: 21px;
  }
  .m-welcome-trust {
    display: none;
  }
  .m-suggest-grid {
    margin-top: 14px;
  }
  .m-suggest-card,
  .m-suggest-skeleton {
    min-height: 58px;
  }
  .m-suggest-card {
    padding: 9px 12px;
  }
}
/* 超窄屏：进一步收字距与字号，避免按钮换行拥挤 */
@media (max-width: 360px) {
  .m-welcome {
    padding-left: 0;
    padding-right: 0;
  }
  .m-welcome-title {
    font-size: 21px;
  }
  .m-welcome-sub {
    font-size: 12px;
  }
  .m-welcome-trust {
    gap: 7px 11px;
  }
  .m-composer-feature {
    font-size: 10px;
    padding: 0 6px;
  }
  .m-input-area {
    padding-left: 8px;
    padding-right: 8px;
  }
}

/* 尊重系统「减弱动态效果」设置 */
@media (prefers-reduced-motion: reduce) {
  .mobile-chat *,
  .mobile-chat *::before,
  .mobile-chat *::after {
    animation-duration: 0.001ms !important;
    animation-delay: 0s !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
