<script setup lang="ts">
// ── 智能问答主页面 ──
// 豆包风格：简洁、留白、圆润

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { KnowledgeFile } from '@/types'
import { useChat } from '@/composables/useChat'
import { useSSE } from '@/composables/useSSE'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ChatLoginDialog from '@/components/chat/ChatLoginDialog.vue'
import PersonalCenter from '@/components/common/PersonalCenter.vue'

const userStore = useUserStore()
const router = useRouter()
const chat = useChat()

const sidebarOpen = ref(true)
const showLoginDialog = ref(false)
const showPersonalCenter = ref(false)
const showUserMenu = ref(false)
const hasPlayed = sessionStorage.getItem('hasPlayHomeAnimation') === 'true'
const showEntryAnim = ref(!hasPlayed)
const showInstantContent = ref(hasPlayed)
const inputText = ref('')
const isRecording = ref(false)

// SSE
const streamingContent = ref('')
const isStreaming = ref(false)
const streamingReferences = ref<KnowledgeFile[]>([])
const streamingMessageId = ref<number | null>(null)
let currentSSE: ReturnType<typeof useSSE> | null = null

const isLoggedIn = computed(() => !!userStore.token)
const isAdminUser = computed(() => userStore.role === 'super_admin' || userStore.role === 'admin' || userStore.role === 'college_admin' || userStore.role === 'dept_admin')
const hasActiveConversation = computed(() => chat.currentConversationId.value !== null)

// ── 热点问题（API）──
const hotQuestions = ref<Array<{ question: string; count: number }>>([])
const SEED_ICONS: Record<string, string> = {
  '如何重置密码': '🔑', '怎么连接校园网': '🌐', '论文格式要求': '📝',
  '如何查找学习资料': '📚', '课程表在哪查': '📅', '图书馆借书流程': '📖',
  '奖学金申请条件': '🏆', '如何选课': '🎯', '实习机会有哪些': '💼',
  '学校邮箱怎么注册': '📧',
}

async function loadHotQuestions() {
  try {
    const { getHotQuestionsApi } = await import('@/api/chat')
    const data = await getHotQuestionsApi({ top_k: 9 })
    hotQuestions.value = data
  } catch {
    // API 不通时使用空列表
    hotQuestions.value = []
  }
}

const topQuestions = computed(() =>
  hotQuestions.value.map(q => ({
    text: q.question,
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
  if (userStore.role === 'super_admin' || userStore.role === 'admin' || userStore.role === 'admin_csic' || userStore.role === 'admin_dept' || userStore.role === 'college_admin') {
    router.push('/knowledge/list')
  }
  chat.fetchConversations()
}
function handleLoginCancel() { showLoginDialog.value = false }
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示')
    userStore.logout()
    router.push('/')
  } catch {}
}
function cancelStreaming() {
  currentSSE?.close()
  isStreaming.value = false
  streamingContent.value = ''
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
  cancelStreaming()
  chat.createConversation()
}
async function handleSelectConversation(id: number) {
  cancelStreaming()
  await chat.selectConversation(id)
}
async function handleDeleteConversation(id: number) { await chat.deleteConversation(id) }
function handleBackToList() { chat.currentConversationId.value = null }

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  // 电脑端必须登录才能使用
  if (!isLoggedIn.value) {
    showLoginDialog.value = true
    return
  }
  currentSSE?.close()
  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }
  const convId = chat.currentConversationId.value!
  chat.appendUserMessage(text)
  inputText.value = ''

  isStreaming.value = true
  streamingContent.value = ''
  streamingReferences.value = []

  // 30 秒超时自动取消
  const timeoutId = setTimeout(() => {
    if (isStreaming.value) { cancelStreaming(); ElMessage.warning('AI 回复超时，可重新提问') }
  }, 30000)

  currentSSE = useSSE(convId, text, () => {
    clearTimeout(timeoutId)
    if (!isStreaming.value) return // 已被取消
    isStreaming.value = false
    const realId = currentSSE?.messageId?.value
    chat.appendAssistantMessage(streamingContent.value, streamingReferences.value, realId || undefined)
    streamingContent.value = ''
    streamingReferences.value = []
    streamingMessageId.value = null
  })
  watch(currentSSE.content, (val) => { streamingContent.value = val })
  watch(currentSSE.references, (val) => { streamingReferences.value = val })
}

function handleFeedback(messageId: number, type: 'like' | 'dislike') {
  chat.submitFeedback(messageId, type)
}

/* ── 语音录制（通用，供后端降级 & 语音消息使用） ── */
let mediaRecorder: MediaRecorder | null = null

/** 开始录音，返回录制的 Blob（停止后 resolve） */
function startRecording(): Promise<Blob | null> {
  return new Promise(async (resolve) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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

/* ── 语音转文字（优先使用浏览器原生 Web Speech API，降级到后端 ASR） ── */
let speechRecognition: any = null

async function handleSTT() {
  // 如果正在录音中，点击则停止
  if (isRecording.value) {
    if (speechRecognition) {
      speechRecognition.stop()
      speechRecognition = null
    }
    stopRecording()
    return
  }

  // 方案一：浏览器原生 Web Speech API（Chrome / Edge / Safari 支持）
  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechAPI) {
    try {
      const recognition = new SpeechAPI()
      recognition.lang = 'zh-CN'
      recognition.interimResults = true
      recognition.continuous = true
      speechRecognition = recognition

      inputText.value = ''
      isRecording.value = true

      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          transcript += result[0].transcript
        }
        inputText.value = transcript
      }

      recognition.onerror = (event: any) => {
        isRecording.value = false
        speechRecognition = null
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          ElMessage.error('语音识别错误: ' + event.error)
        }
      }

      recognition.onend = () => {
        isRecording.value = false
        speechRecognition = null
      }

      recognition.start()
      return
    } catch {
      // Web Speech API 初始化失败，降级到后端方案
      speechRecognition = null
    }
  }

  // 方案二：后端 ASR（向后兼容）
  const blob = await startRecording()
  if (!blob) return
  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }
  const convId = chat.currentConversationId.value!
  inputText.value = '语音识别中…'
  let gotText = false
  try {
    const { voiceAskApi } = await import('@/api/chat')
    const response = await voiceAskApi(blob, convId)
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      ElMessage.error(`语音请求失败 (${response.status}): ${errText}`)
      inputText.value = ''; return
    }
    const reader = response.body?.getReader()
    if (!reader) { ElMessage.error('无法读取语音响应'); inputText.value = ''; return }
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
            switch (currentEvent) {
              case 'asr_text':
                gotText = true
                inputText.value = data.text || ''
                break
              case 'token':
              case 'msg':
                // AI 回答来了但没有 asr_text → 走兜底：发语音消息
                if (!gotText && inputText.value === '语音识别中…') {
                  inputText.value = ''
                  chat.appendUserMessage('[语音消息]')
                  streamingContent.value = data.content || ''
                  isStreaming.value = true
                }
                break
              case 'done':
                if (!gotText) isStreaming.value = false
                break
            }
          } catch {}
        }
      }
    }
  } catch { inputText.value = '' }
  if (!gotText && inputText.value === '语音识别中…') inputText.value = ''
}

/* ── 语音消息（录音 → 预览播放 → 发送给 AI 回答） ── */
const voicePreviewUrl = ref('')
const showVoicePreview = ref(false)
let pendingVoiceBlob: Blob | null = null
let voiceAudioEl: HTMLAudioElement | null = null
const isVoicePlaying = ref(false)

async function handleVoiceMsg() {
  if (isRecording.value) { stopRecording(); return }
  const blob = await startRecording()
  if (!blob) return
  pendingVoiceBlob = blob
  voicePreviewUrl.value = URL.createObjectURL(blob)
  voiceAudioEl = new Audio(voicePreviewUrl.value)
  voiceAudioEl.onended = () => { isVoicePlaying.value = false }
  showVoicePreview.value = true
}

function playVoicePreview() {
  if (!voiceAudioEl) return
  if (isVoicePlaying.value) { voiceAudioEl.pause(); voiceAudioEl.currentTime = 0; isVoicePlaying.value = false; return }
  voiceAudioEl.play(); isVoicePlaying.value = true
}

function cancelVoicePreview() {
  voiceAudioEl?.pause()
  voiceAudioEl = null
  if (voicePreviewUrl.value) URL.revokeObjectURL(voicePreviewUrl.value)
  voicePreviewUrl.value = ''
  pendingVoiceBlob = null
  showVoicePreview.value = false
  isVoicePlaying.value = false
}

async function confirmVoicePreview() {
  voiceAudioEl?.pause()
  voiceAudioEl = null
  showVoicePreview.value = false
  isVoicePlaying.value = false
  if (!pendingVoiceBlob) return
  const blob = pendingVoiceBlob
  pendingVoiceBlob = null
  if (voicePreviewUrl.value) URL.revokeObjectURL(voicePreviewUrl.value)
  voicePreviewUrl.value = ''
  // 发送到 voice-ask
  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }
  const convId = chat.currentConversationId.value!
  chat.appendUserMessage('[语音消息]')
  isStreaming.value = true
  streamingContent.value = ''
  try {
    const { voiceAskApi } = await import('@/api/chat')
    const response = await voiceAskApi(blob, convId)
    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      ElMessage.error(errBody ? `语音请求失败: ${errBody}` : `语音请求失败 (${response.status})`)
      isStreaming.value = false; return
    }
    const reader = response.body?.getReader()
    if (!reader) { isStreaming.value = false; return }
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
            switch (currentEvent) {
              case 'token':
              case 'msg': streamingContent.value += data.content || ''; break
              case 'done': chat.appendAssistantMessage(streamingContent.value, undefined, data.message_id); isStreaming.value = false; streamingContent.value = ''; break
              case 'error': ElMessage.error(data.message || 'AI 回答失败'); isStreaming.value = false; break
            }
          } catch {}
        }
      }
    }
  } catch (e: any) { ElMessage.error('语音发送异常: ' + (e?.message || '')); isStreaming.value = false }
}
/** 全局点击空白取消改名 */
function handleBlankClick(e: MouseEvent) {
  if (renamingId.value === null) return
  const el = e.target as HTMLElement
  // 点击这些元素不取消
  if (el.closest('.conv-rename-input, .conv-rename-confirm, .sidebar-new-chat, .conv-item-edit, .conv-item-icon')) return
  cancelRename()
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
})
</script>

<template>
  <div class="chat-app">
    <!-- 蜂巢入场动画（相 1-2：弹出 → 聚合 → 缩小） -->
    <div v-if="showEntryAnim" class="entry-overlay">
      <div class="entry-honeycomb">
        <div></div><div></div><div></div><div></div><div></div><div></div><div></div>
      </div>
    </div>
    <!-- ═══ 左侧边栏（对话列表）═══ -->
    <aside class="chat-sidebar" :class="{ collapsed: !sidebarOpen }">
      <!-- 顶部 -->
      <div class="sidebar-logo">
        <span class="sidebar-logo-text">NISU-CD</span>
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
          :class="{ active: conv.id === chat.currentConversationId.value }"
          @click="renamingId !== conv.id && handleSelectConversation(conv.id)"
        >
          <div class="conv-item-icon">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7a1.5 1.5 0 01-1.5 1.5h-3.586a1.5 1.5 0 00-1.06.44L5 15V12H3.5A1.5 1.5 0 012 10.5v-7z"/>
            </svg>
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

      <!-- 底部用户 -->
      <div v-if="isLoggedIn" class="sidebar-user-area">
        <Transition name="menu-up">
          <div v-if="showUserMenu" class="user-popup">
            <div class="user-popup-item" @click="showUserMenu = false; showPersonalCenter = true">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
              <span>个人中心</span>
            </div>
            <div class="user-popup-item" @click="showUserMenu = false; handleLogout()">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M3 3h6v2H5v10h4v2H3V3zm12.5 5H11V6h4.5L19 10l-3.5 4H11v-2h4.5L16 10l-1.5-2z"/></svg>
              <span>退出登录</span>
            </div>
          </div>
        </Transition>
        <div class="sidebar-user" @click="showUserMenu = !showUserMenu">
          <div class="su-avatar">
            <span class="su-avatar-text">{{ (userStore.userInfo?.role_display || userStore.userInfo?.username || '?').charAt(0).toUpperCase() }}</span>
          </div>
          <div class="su-info">
            <span class="su-name">{{ userStore.userInfo?.username || '' }}</span>
            <span class="su-role">{{ userStore.userInfo?.role_display || '' }}</span>
          </div>
          <span class="su-status">已登录</span>
        </div>
      </div>
      <div v-else class="sidebar-user" @click="showLoginDialog = true">
        <div class="su-avatar">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
          </svg>
        </div>
        <span class="su-name">未登录</span>
      </div>
    </aside>

    <!-- ═══ 右侧主区域 ═══ -->
    <div class="chat-main" :class="{ 'sidebar-collapsed': !sidebarOpen }">
      <!-- 顶部栏 -->
      <header class="chat-topbar">
        <div class="topbar-left">
          <button class="topbar-btn" @click="toggleSidebar" title="切换侧边栏">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h14v1.5H3v-1.5z" />
            </svg>
          </button>
          <h1 v-if="!hasActiveConversation" class="topbar-title">智能问答</h1>
          <button v-else class="topbar-btn" @click="handleBackToList" title="返回">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"/>
            </svg>
          </button>
        </div>
        <div v-if="isLoggedIn" class="topbar-right">
          <button v-if="isAdminUser" class="topbar-exit-btn" @click="router.push('/knowledge/list')" title="退出问答">
            <span>退出问答</span>
          </button>
          <button v-else class="topbar-exit-btn" @click="router.push('/faq')" title="常见问题">
            <span>退出问答</span>
          </button>
        </div>
      </header>

      <!-- 对话区 -->
      <div class="chat-messages">
        <div class="messages-inner">
          <!-- 消息列表（有对话且有消息时显示） -->
          <template v-if="hasActiveConversation && chat.currentMessages.value.length > 0">
            <MessageBubble
              v-for="msg in chat.currentMessages.value"
              :key="msg.id"
              :message="msg"
              :user-role="userStore.role ?? undefined"
              @feedback="handleFeedback"
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
              :user-role="userStore.role ?? undefined"
            />
          </template>

          <!-- 欢迎页（无对话或对话为空时显示） -->
          <div v-else class="chat-welcome">
            <div class="welcome-icon">
              <div class="wi-honeycomb">
                <div></div><div></div><div></div><div></div><div></div><div></div><div></div>
              </div>
            </div>
            <h2 class="welcome-title" :class="{ 'wi-anim-in': !showEntryAnim, instant: showInstantContent }">
              你好！有什么可以帮助你的？
              <span v-if="showInstantContent || !showEntryAnim" class="title-scanline" />
            </h2>
            <div v-if="topQuestions.length" class="quick-questions" :class="{ 'wi-anim-in': !showEntryAnim, instant: showInstantContent }">
              <button
                v-for="(q, qi) in topQuestions"
                :key="q.text"
                class="qq-btn"
                :style="{ transitionDelay: showInstantContent ? '0ms' : `${qi * 70}ms` }"
                @click="quickQuestion(q.text)"
              >{{ q.text }}</button>
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
            <button v-if="isStreaming" class="cancel-btn" @click="cancelStreaming" title="取消">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2"/></svg>
            </button>
            <button class="voice-btn" :class="{ recording: isRecording }" @click="handleSTT" title="语音转文字">🎤</button>
            <button class="voice-btn" :class="{ recording: isRecording }" @click="handleVoiceMsg" title="语音消息">
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
    <PersonalCenter v-if="showPersonalCenter" @close="showPersonalCenter = false" />
    <ChatLoginDialog v-if="showLoginDialog" @success="handleLoginSuccess" @cancel="handleLoginCancel" />

    <!-- 语音预览弹窗 -->
    <Transition name="panel">
      <div v-if="showVoicePreview" class="voice-preview-overlay" @click.self="cancelVoicePreview">
        <div class="voice-preview-card">
          <div class="vp-header">
            <span>语音预览</span>
            <button class="vp-close" @click="cancelVoicePreview">×</button>
          </div>
          <div class="vp-body">
            <div class="vp-wave" :class="{ playing: isVoicePlaying }">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <button class="vp-play-btn" @click="playVoicePreview">
              <svg v-if="!isVoicePlaying" viewBox="0 0 20 20" width="24" height="24" fill="currentColor"><path d="M5 3l12 7-12 7V3z"/></svg>
              <svg v-else viewBox="0 0 20 20" width="24" height="24" fill="currentColor"><path d="M6 3h3v14H6V3zm5 0h3v14h-3V3z"/></svg>
            </button>
            <p class="vp-hint">点击播放试听，确认后发送</p>
          </div>
          <div class="vp-footer">
            <button class="vp-btn vp-cancel" @click="cancelVoicePreview">重录</button>
            <button class="vp-btn vp-confirm" @click="confirmVoicePreview">发送</button>
          </div>
        </div>
      </div>
    </Transition>
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', Roboto, sans-serif;
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
  color: #2b5fd9;
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
  color: #8e8e93;
  transition: all 0.15s;
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
  color: #8e8e93;
}
.sidebar-search input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: #1f1f1f;
}
.sidebar-search input::placeholder { color: #aeaeb2; }

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
  gap: 10px;
  padding: 10px 12px;
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
  color: #8e8e93;
  flex-shrink: 0;
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
  color: #aeaeb2;
}
.conv-item-del {
  opacity: 0;
  background: none;
  border: none;
  color: #aeaeb2;
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
  opacity: 0; background: none; border: none; color: #aeaeb2;
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
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 4px; background: #409eff; color: #fff;
  cursor: pointer; flex-shrink: 0; transition: background 0.15s;
}
.conv-rename-confirm:hover { background: #3a8ee6; }

.sidebar-loading { display: flex; justify-content: center; gap: 4px; padding: 20px; }
.load-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #aeaeb2; animation: dotPulse 1.2s ease-in-out infinite;
}
.load-dot:nth-child(2) { animation-delay: 0.2s; }
.load-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.sidebar-empty { text-align: center; padding: 24px; font-size: 13px; color: #aeaeb2; }

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
.user-popup-item:hover { background: #f0f4fe; color: #2b5fd9; }
.user-popup-item:first-child { border-bottom: 1px solid #f0f0f0; }
.menu-up-enter-active, .menu-up-leave-active { transition: all 0.2s ease; }
.menu-up-enter-from, .menu-up-leave-to { opacity: 0; transform: translateY(8px); }
.su-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(64, 158, 255, 0.15);
  display: flex; align-items: center; justify-content: center;
  color: #409eff; flex-shrink: 0; font-size: 15px; font-weight: 600;
}
.su-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.su-name { font-size: 13px; font-weight: 600; color: #1f1f1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.su-role { font-size: 11px; color: #8e8e93; }
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
.topbar-left, .topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbar-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer; color: #8e8e93;
  transition: all 0.15s;
}
.topbar-btn:hover { background: #ecf5ff; color: #409eff; }
.topbar-title { font-size: 16px; font-weight: 600; margin: 0; color: #1f1f1f; }
.topbar-exit-btn {
  height: 33px; padding: 0 12px;
  display: flex; align-items: center; gap: 4px;
  background: transparent; border: none; border-radius: 6px;
  font-size: 15px; font-weight: 600; cursor: pointer; color: #1f1f1f;
  transition: all 0.15s;
}
.topbar-exit-btn:hover { background: #fef0f0; color: #e74c3c; }
.topbar-conv-title { font-size: 13px; color: #8e8e93; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }


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
  margin-bottom: 60px;
  width: 72px; height: 72px;
  display: flex; align-items: center; justify-content: center;
  position: relative; z-index: 1;
}

/* ═══ 标题入场 + 扫光特效 ═══ */
.welcome-title {
  font-size: 22px;
  font-weight: 400;
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
/* 扫光光带 */
.title-scanline {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, rgba(120,190,255,0.5) 50%, transparent 100%);
  background-size: 200% 100%;
  opacity: 0;
}
.welcome-title.wi-anim-in .title-scanline {
  opacity: 1;
  animation: scanlineSweep 0.4s ease-out 0s forwards;
}
@keyframes scanlineSweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ═══ 快捷按钮入场（分层延时 + 外发光脉冲） ═══ */
.quick-questions {
  opacity: 0;
}
.quick-questions.wi-anim-in {
  opacity: 1;
}
.quick-questions.instant {
  opacity: 1;
}
.quick-questions.instant .qq-btn {
  opacity: 1;
  transform: scale(1);
  transition: none;
  box-shadow: none;
}
.qq-btn {
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 0.3s ease-out, transform 1s ease-out, box-shadow 0.3s ease-out, background 0.2s, color 0.2s;
}
.quick-questions.wi-anim-in .qq-btn {
  opacity: 1;
  transform: scale(1);
  animation: btnGlowPulse 0.3s ease-out forwards;
}
@keyframes btnGlowPulse {
  0%   { box-shadow: 0 0 12px rgba(80,160,255,0.4); }
  100% { box-shadow: 0 0 8px rgba(80,160,255,0); }
}

/* 快捷提问胶囊按钮 */
.quick-questions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}
.qq-btn {
  padding: 10px 16px;
  background: #f0f0f5;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  color: #444;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qq-btn:hover {
  background: #e0e3ed;
  color: #409eff;
}

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
  border: 1px solid rgba(22, 119, 255, 0.1);
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
  background: linear-gradient(90deg, #4a9eff, #7bb8ff, #f5b8d0);
  background-size: 200% 100%;
}

.spin-intense::before {
  background: linear-gradient(90deg, #5ca8ff, #90c6ff, #f7c8da);
  background-size: 200% 100%;
}

.spin-inside::before {
  background: linear-gradient(90deg, #7bb8ff, #b0d4ff, #fad4e4);
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
.input-field::placeholder { color: #8e9ebd; font-size: 15px; }
.send-fab {
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: #1677ff; color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0; padding: 0;
}
.send-fab svg { width: 16px; height: 16px; }
.send-fab:hover:not(:disabled) { background: #4096ff; }
.send-fab:disabled { background: #d9d9d9; cursor: not-allowed; }

/* 语音输入按钮 */
.voice-btn {
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: transparent; color: #8e9ebd;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0; padding: 0;
}
.voice-btn:hover { background: rgba(64,158,255,0.08); color: #409eff; }
.voice-btn.recording { color: #f56c6c; animation: micPulse 1s ease-in-out infinite; }
@keyframes micPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* 语音预览弹窗 */
.voice-preview-overlay {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.35);
}
.voice-preview-card {
  width: 300px; background: #fff; border-radius: 20px;
  overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12);
  animation: dialogIn 0.25s ease;
}
.vp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #f0f0f0;
  font-weight: 600; font-size: 15px;
}
.vp-close { width: 28px; height: 28px; border: none; background: none; font-size: 20px; color: #999; cursor: pointer; }
.vp-body { display: flex; flex-direction: column; align-items: center; padding: 32px 20px; gap: 16px; }
.vp-wave { display: flex; align-items: center; gap: 3px; height: 32px; }
.vp-wave span {
  width: 4px; height: 100%; border-radius: 2px; background: #409eff;
  animation: waveAnim 0.6s ease-in-out infinite alternate;
}
.vp-wave.playing span:nth-child(1) { animation-delay: 0s; }
.vp-wave.playing span:nth-child(2) { animation-delay: 0.1s; }
.vp-wave.playing span:nth-child(3) { animation-delay: 0.2s; }
.vp-wave.playing span:nth-child(4) { animation-delay: 0.3s; }
.vp-wave.playing span:nth-child(5) { animation-delay: 0.4s; }
@keyframes waveAnim { 0% { height: 8px; } 100% { height: 32px; } }
.vp-play-btn {
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: #409eff; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.vp-hint { font-size: 13px; color: #8e8e93; margin: 0; }
.vp-footer { display: flex; gap: 12px; padding: 0 20px 20px; }
.vp-btn { flex: 1; height: 42px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
.vp-cancel { background: #f5f5f5; color: #666; }
.vp-cancel:hover { background: #e8e8e8; }
.vp-confirm { background: #409eff; color: #fff; }
.vp-confirm:hover { background: #3a8ee6; }

</style>
<style>
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

/* ═══ 欢迎页永久蜂巢图标（缓慢顺时旋转） ═══ */
.wi-honeycomb {
  height: 24px; position: relative; width: 24px;
  animation: slowSpin 12s linear infinite;
  animation-delay: 2.6s; /* 等待入场动画完成 */
}
@keyframes slowSpin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.wi-honeycomb div {
  background: #409eff; height: 12px; margin-top: 6px;
  position: absolute; width: 24px;
}
.wi-honeycomb div:after, .wi-honeycomb div:before {
  content: ''; border-left: 12px solid transparent; border-right: 12px solid transparent;
  position: absolute; left: 0; right: 0;
}
.wi-honeycomb div:after { top: -6px; border-bottom: 6px solid #409eff; }
.wi-honeycomb div:before { bottom: -6px; border-top: 6px solid #409eff; }
.wi-honeycomb div:nth-child(1) { left: -28px; top: 0; }
.wi-honeycomb div:nth-child(2) { left: -14px; top: 22px; }
.wi-honeycomb div:nth-child(3) { left: 14px; top: 22px; }
.wi-honeycomb div:nth-child(4) { left: 28px; top: 0; }
.wi-honeycomb div:nth-child(5) { left: 14px; top: -22px; }
.wi-honeycomb div:nth-child(6) { left: -14px; top: -22px; }
.wi-honeycomb div:nth-child(7) { left: 0; top: 0; }
</style>
