<script setup lang="ts">
// ── 手机端智能问答（豆包风格）──
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useChat } from '@/composables/useChat'
import { useSSE } from '@/composables/useSSE'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import type { KnowledgeFile } from '@/types'

const router = useRouter()
const userStore = useUserStore()
const chat = useChat()

const inputText = ref('')
const isStreaming = ref(false)
const isRecording = ref(false)
let mediaRecorder: MediaRecorder | null = null
const streamingContent = ref('')
const streamingReferences = ref<KnowledgeFile[]>([])
let currentSSE: ReturnType<typeof useSSE> | null = null

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
  if (isLongPress) { isLongPress = false; return }
  handleSelectHistory(conv.id)
}
function pinConversation() {
  if (!contextConv.value) return
  const conv = contextConv.value
  // 本地置顶：把该对话移到数组最前面
  const idx = chat.conversations.value.findIndex(c => c.id === conv.id)
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
  if (menuJustOpened) { menuJustOpened = false; return }
  const menu = document.querySelector('.ctx-menu')
  if (menu && !menu.contains(e.target as Node)) {
    closeContextMenu()
  }
}
function closeContextMenu() {
  showContextMenu.value = false
  contextConv.value = null
}

const isLoggedIn = computed(() => !!userStore.token)

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
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

  currentSSE = useSSE(convId, text, () => {
    isStreaming.value = false
    const realId = currentSSE?.messageId?.value
    chat.appendAssistantMessage(streamingContent.value, undefined, realId || undefined)
    streamingContent.value = ''
  })
  watch(currentSSE.content, (val) => { streamingContent.value = val })
}

function handleFeedback(messageId: number, type: 'like' | 'dislike') {
  chat.submitFeedback(messageId, type)
}

function handleSelectHistory(id: number) {
  showHistory.value = false
  chat.selectConversation(id)
}

function handleNewChat() {
  showHistory.value = false
  chat.currentConversationId.value = null
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
      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      const chunks: Blob[] = []; mediaRecorder = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        resolve(blob.size > 100 ? blob : null)
      }
      mr.onerror = () => resolve(null)
      mr.start(); isRecording.value = true
    } catch { resolve(null) }
  })
}
function stopRecording() { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); isRecording.value = false }

/* ── 语音转文字（优先使用浏览器原生 Web Speech API，降级到后端 ASR） ── */
let speechRecognition: any = null

async function handleSTT() {
  if (isRecording.value) {
    if (speechRecognition) { speechRecognition.stop(); speechRecognition = null }
    stopRecording(); return
  }

  // 方案一：浏览器原生 Web Speech API
  
  
  // HTTP 环境不支持语音功能
  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    ElMessage.warning("语音功能需要 HTTPS 环境")
    return
  }
  // iOS Safari 不支持 Web Speech API，提示用户
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    ElMessage.info("iOS Safari 不支持语音转文字，请使用 Chrome 浏览器")
    return
  }
  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechAPI) {
    try {
      const recognition = new SpeechAPI()
      recognition.lang = 'zh-CN'; recognition.interimResults = true; recognition.continuous = true
      speechRecognition = recognition
      inputText.value = ''; isRecording.value = true
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript
        inputText.value = transcript
      }
      recognition.onerror = (event: any) => {
        isRecording.value = false; speechRecognition = null
        if (event.error === "not-allowed") ElMessage.error("请允许麦克风权限后重试")
        else if (event.error !== "no-speech" && event.error !== "aborted") ElMessage.error("语音识别: " + event.error)
      }
      recognition.onend = () => { isRecording.value = false; speechRecognition = null }
      recognition.start()
      return
    } catch { speechRecognition = null }
  }

  // 方案二：后端 ASR
  const blob = await startRecording()
  if (!blob) return
  if (!chat.currentConversationId.value) { const conv = await chat.createConversation(); if (!conv) return }
  const convId = chat.currentConversationId.value!
  inputText.value = '语音识别中…'
  let gotText = false
  try {
    const { voiceAskApi } = await import('@/api/chat')
    const response = await voiceAskApi(blob, convId)
    if (!response.ok) { inputText.value = ''; return }
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
          try { const data = JSON.parse(line.slice(6).trim())
            switch (currentEvent) {
              case 'asr_text': gotText = true; inputText.value = data.text || ''; break
              case 'token': case 'msg':
                if (!gotText && inputText.value === '语音识别中…') {
                  inputText.value = ''; chat.appendUserMessage('[语音消息]')
                  streamingContent.value = data.content || ''; isStreaming.value = true
                } break
              case 'done': if (!gotText) isStreaming.value = false; break
            }
          } catch {}
        }
      }
    }
  } catch { inputText.value = '' }
  if (!gotText && inputText.value === '语音识别中…') inputText.value = ''
}

/* ── 语音消息 ── */
const voicePreviewUrl = ref('')
const showVoicePreview = ref(false)
let pendingVoiceBlob: Blob | null = null
let voiceAudioEl: HTMLAudioElement | null = null
const isVoicePlaying = ref(false)

async function handleVoiceMsg() {
  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    ElMessage.warning("语音功能需要 HTTPS 环境")
    return
  }
  if (isRecording.value) { stopRecording(); return }
  const blob = await startRecording()
  if (!blob) return
  pendingVoiceBlob = blob; voicePreviewUrl.value = URL.createObjectURL(blob)
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
  voiceAudioEl?.pause(); voiceAudioEl = null
  if (voicePreviewUrl.value) URL.revokeObjectURL(voicePreviewUrl.value)
  voicePreviewUrl.value = ''; pendingVoiceBlob = null; showVoicePreview.value = false; isVoicePlaying.value = false
}
async function confirmVoicePreview() {
  voiceAudioEl?.pause(); voiceAudioEl = null; showVoicePreview.value = false; isVoicePlaying.value = false
  if (!pendingVoiceBlob) return
  const blob = pendingVoiceBlob; pendingVoiceBlob = null
  if (voicePreviewUrl.value) URL.revokeObjectURL(voicePreviewUrl.value); voicePreviewUrl.value = ''
  if (!chat.currentConversationId.value) { const conv = await chat.createConversation(); if (!conv) return }
  const convId = chat.currentConversationId.value!
  chat.appendUserMessage('[语音消息]'); isStreaming.value = true; streamingContent.value = ''
  try {
    const { voiceAskApi } = await import('@/api/chat')
    const response = await voiceAskApi(blob, convId)
    if (!response.ok) {
      if (response.status === 401) ElMessage.warning("语音消息需要登录后使用")
      else ElMessage.warning("语音发送失败")
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
          try { const data = JSON.parse(line.slice(6).trim())
            switch (currentEvent) {
              case 'token': case 'msg': streamingContent.value += data.content || ''; break
              case 'done': chat.appendAssistantMessage(streamingContent.value, undefined, data.message_id); isStreaming.value = false; streamingContent.value = ''; break
              case 'error': isStreaming.value = false; break
            }
          } catch {}
        }
      }
    }
  } catch { isStreaming.value = false }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (isLoggedIn.value) {
    localStorage.removeItem('chat_conversations_cache')
    chat.init()
    chat.fetchConversations()
  } else {
    // 未登录时清除缓存，避免看到上一账号的历史记录
    localStorage.removeItem('chat_conversations_cache')
    chat.conversations.value = []
  }
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="mobile-chat">
    <!-- 顶栏 -->
    <header class="m-topbar">
      <button class="m-menu-btn" @click="showHistory = true">
        <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
          <path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h14v1.5H3v-1.5z"/>
        </svg>
      </button>
      <span class="m-title">智能问答</span>
    </header>

    <!-- 对话区 -->
    <div class="m-messages">
      <div class="m-msgs-inner">
        <template v-if="chat.currentConversationId.value">
          <MessageBubble
            v-for="msg in chat.currentMessages.value"
            :key="msg.id"
            :message="msg"
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
          />
        </template>

        <!-- 欢迎页 -->
        <div v-else class="m-welcome">
          <div class="m-welcome-icon">
            <div class="loader">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <defs>
                  <mask id="clipping">
                    <polygon points="0,0 100,0 100,100 0,100" fill="black"></polygon>
                    <polygon points="25,25 75,25 50,75" fill="white"></polygon>
                    <polygon points="50,25 75,75 25,75" fill="white"></polygon>
                    <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                    <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                    <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                    <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                  </mask>
                </defs>
              </svg>
              <div class="box"></div>
            </div>
          </div>
          <h2 class="m-welcome-title">有什么可以帮助你的？</h2>
        </div>
      </div>
    </div>

    <!-- 输入栏 -->
    <div class="m-input-area">
      <div class="m-input-wrap">
        <input
          v-model="inputText"
          type="text"
          class="m-input"
          placeholder="输入你的问题…"
          :disabled="isStreaming"
          @keyup.enter="sendMessage"
        />
        <button class="m-mic-btn" :class="{ recording: isRecording }" @click="handleSTT" title="语音转文字">🎤</button>
        <button class="m-mic-btn" :class="{ recording: isRecording }" @click="handleVoiceMsg" title="语音消息">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M10 2a3 3 0 00-3 3v4a3 3 0 106 0V5a3 3 0 00-3-3zM5 9a5 5 0 0010 0h-1.5a3.5 3.5 0 01-7 0H5z"/>
            <path d="M9.25 13.5v2.75h1.5V13.5h-1.5z"/>
            <path d="M6 14.5h8v1.5H6z"/>
          </svg>
        </button>
        <button class="m-send-btn" :disabled="!inputText.trim() || isStreaming" @click="sendMessage">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M10 2a1 1 0 01.707.293l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414l-4.293 4.293a1 1 0 01-1.414-1.414l6-6A1 1 0 0110 2z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 历史侧边面板（从左侧滑入） -->
    <Transition name="panel-slide">
      <div v-if="showHistory" class="m-panel-wrap">
        <div class="m-panel">
          <div class="m-panel-header">
            <span class="m-panel-title">历史对话</span>
            <button class="m-panel-close" @click="showHistory = false">×</button>
          </div>

          <!-- 搜索 -->
          <div class="m-panel-search">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z"/>
            </svg>
            <input v-model="chat.searchKeyword.value" type="text" placeholder="搜索对话" />
          </div>

          <!-- 新建对话 -->
          <button class="m-panel-new-btn" @click="handleNewChat">+ 新建对话</button>

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
              <div class="m-panel-item-icon">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v9a1.5 1.5 0 01-1.5 1.5h-5.586a1.5 1.5 0 00-1.06.44L6 18.5V15H3.5A1.5 1.5 0 012 13.5v-9z"/></svg>
              </div>
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
              <div class="m-panel-avatar">{{ (userStore.userInfo?.role_display || userStore.userInfo?.username || '?').charAt(0).toUpperCase() }}</div>
              <span class="m-panel-username">{{ userStore.userInfo?.username || '' }}</span>
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" class="m-panel-logout">
                <path d="M3 3h6v2H5v10h4v2H3V3zm12.5 5H11V6h4.5L19 10l-3.5 4H11v-2h4.5L16 10l-1.5-2z"/>
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
            <path d="M15.3 4.3a1 1 0 01.4 1.4l-3 5.3 3.3 3.3a1 1 0 01-1.4 1.4l-12-12a1 1 0 011.4-1.4l3.3 3.3 5.3-3a1 1 0 011.4.4z"/>
            <path d="M10 8.5l4-4-3-3-4 4z"/>
          </svg>
        </div>
        <div class="ctx-divider" />
        <div class="ctx-item ctx-item-danger" @click="deleteConversation">
          <span class="ctx-item-text">从对话列表删除</span>
          <svg class="ctx-item-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2M5 6l1 11a1 1 0 001 1h6a1 1 0 001-1l1-11M8 9v6M12 9v6"/>
          </svg>
        </div>
      </div>
    </Transition>

    <!-- 语音预览弹窗 -->
    <div v-if="showVoicePreview" class="vp-overlay" @click.self="cancelVoicePreview">
      <div class="vp-card">
        <div class="vp-header"><span>语音预览</span><button class="vp-close" @click="cancelVoicePreview">×</button></div>
        <div class="vp-body">
          <div class="vp-wave" :class="{ playing: isVoicePlaying }">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <button class="vp-play-btn" @click="playVoicePreview">
            <svg v-if="!isVoicePlaying" viewBox="0 0 20 20" width="24" height="24" fill="currentColor"><path d="M5 3l12 7-12 7V3z"/></svg>
            <svg v-else viewBox="0 0 20 20" width="24" height="24" fill="currentColor"><path d="M6 3h3v14H6V3zm5 0h3v14h-3V3z"/></svg>
          </button>
          <p class="vp-hint">点击播放试听</p>
        </div>
        <div class="vp-footer">
          <button class="vp-btn vp-cancel" @click="cancelVoicePreview">重录</button>
          <button class="vp-btn vp-confirm" @click="confirmVoicePreview">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-chat {
  height: 100vh; display: flex; flex-direction: column;
  background: #fff; font-family: -apple-system, 'PingFang SC', sans-serif;
}
/* 顶栏 */
.m-topbar {
  height: 48px; display: flex; align-items: center;
  padding: 0 12px; flex-shrink: 0; gap: 8px;
}
.m-menu-btn {
  width: 36px; height: 36px; border: none; background: none;
  color: #333; cursor: pointer; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.m-menu-btn:active { background: #f0f0f0; }
.m-title { font-size: 17px; font-weight: 600; color: #1f1f1f; }

/* 对话区 */
.m-messages { flex: 1; overflow-y: auto; padding: 8px 0; }
.m-msgs-inner { padding: 0 8px; display: flex; flex-direction: column; gap: 12px; }

/* 欢迎页 */
.m-welcome { display: flex; flex-direction: column; align-items: center; padding: 80px 20px; text-align: center; }
.m-welcome-icon { margin-bottom: 16px; }
.m-welcome-title { font-size: 18px; font-weight: 400; color: #333; margin: 0; }

/* 输入栏 */
.m-input-area { flex-shrink: 0; padding: 8px 12px 12px; }
.m-input-wrap {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border-radius: 22px;
  padding: 4px 4px 4px 16px;
  border: 2px solid #d0d5dd;
}
.m-input { flex: 1; border: none; background: none; outline: none; font-size: 15px; padding: 8px 0; color: #1f1f1f; }
.m-input::placeholder { color: #aaa; }
.m-mic-btn {
  width: 32px; height: 32px; border-radius: 50%;
  border: none; background: transparent; color: #8e9ebd;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all 0.2s; flex-shrink: 0; padding: 0; font-size: 15px; line-height: 1;
}
.m-mic-btn:hover { background: rgba(64,158,255,0.08); color: #409eff; }
.m-mic-btn.recording { color: #f56c6c; animation: mPulse 1s ease-in-out infinite; }
@keyframes mPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* 语音预览弹窗 */
.vp-overlay {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.35);
}
.vp-card {
  width: 280px; background: #fff; border-radius: 20px;
  overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12);
}
.vp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #f0f0f0;
  font-weight: 600; font-size: 15px;
}
.vp-close { width: 28px; height: 28px; border: none; background: none; font-size: 20px; color: #999; cursor: pointer; }
.vp-body { display: flex; flex-direction: column; align-items: center; padding: 28px 20px; gap: 14px; }
.vp-wave { display: flex; align-items: center; gap: 3px; height: 28px; }
.vp-wave span {
  width: 4px; height: 100%; border-radius: 2px; background: #409eff;
  animation: waveAnim 0.6s ease-in-out infinite alternate;
}
.vp-wave.playing span:nth-child(1) { animation-delay: 0s; }
.vp-wave.playing span:nth-child(2) { animation-delay: 0.1s; }
.vp-wave.playing span:nth-child(3) { animation-delay: 0.2s; }
.vp-wave.playing span:nth-child(4) { animation-delay: 0.3s; }
.vp-wave.playing span:nth-child(5) { animation-delay: 0.4s; }
@keyframes waveAnim { 0% { height: 6px; } 100% { height: 28px; } }
.vp-play-btn { width: 50px; height: 50px; border-radius: 50%; border: none; background: #409eff; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.vp-hint { font-size: 13px; color: #8e8e93; margin: 0; }
.vp-footer { display: flex; gap: 12px; padding: 0 20px 20px; }
.vp-btn { flex: 1; height: 40px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
.vp-cancel { background: #f5f5f5; color: #666; }
.vp-cancel:hover { background: #e8e8e8; }
.vp-confirm { background: #409eff; color: #fff; }
.vp-confirm:hover { background: #3a8ee6; }
.m-send-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: none; background: #409eff; color: #fff;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.m-send-btn:disabled { background: #d9d9d9; cursor: not-allowed; }

/* 历史侧边面板（左侧滑入，6/7 宽） */
.m-panel-wrap { position: fixed; inset: 0; z-index: 500; display: flex; }
.m-panel {
  width: calc(100vw * 6 / 7); background: #fff;
  display: flex; flex-direction: column; overflow: hidden;
}
.m-panel-overlay { flex: 1; background: rgba(0,0,0,0.25); }

.m-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #f0f0f0;
}
.m-panel-title { font-size: 17px; font-weight: 600; }
.m-panel-close { width: 28px; height: 28px; border: none; background: none; font-size: 20px; color: #999; cursor: pointer; }

/* 搜索 */
.m-panel-search {
  display: flex; align-items: center; gap: 6px;
  margin: 12px 16px; padding: 8px 12px;
  background: #f5f5f5; border-radius: 8px; color: #999;
}
.m-panel-search input {
  flex: 1; border: none; background: transparent; outline: none;
  font-size: 13px; color: #333;
}
.m-panel-search input::placeholder { color: #bbb; }

.m-panel-new-btn {
  margin: 0 16px 8px; padding: 10px;
  border: 1px dashed #d0d0d0; border-radius: 8px;
  background: none; color: #409eff; font-size: 13px; cursor: pointer;
}

.m-panel-list { flex: 1; overflow-y: auto; padding: 0 8px; }
.m-panel-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 12px; margin-bottom: 2px;
  border-radius: 10px; cursor: pointer;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
.m-panel-item:active { background: #f5f5f5; }
.m-panel-item.active { background: #f0f4ff; }
.m-panel-item-icon {
  width: 36px; height: 36px; border-radius: 10px;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  color: #409eff; background: rgba(64,158,255,0.1);
}
.m-panel-item-content {
  flex: 1; display: flex; flex-direction: column; gap: 3px;
  min-width: 0;
}
.m-panel-item-title {
  font-size: 14px; font-weight: 500; color: #1f1f1f;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.m-panel-item-time { font-size: 12px; color: #aeaeb2; }

/* 未登录提示 */
.m-panel-login-hint { padding: 20px; text-align: center; }
.m-panel-login-hint p { font-size: 13px; color: #8e8e93; margin: 0; }

/* 底部用户 */
.m-panel-footer { border-top: 1px solid #f0f0f0; }
.m-panel-user {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; cursor: pointer;
}
.m-panel-user:active { background: #f5f5f5; }
.m-panel-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(64,158,255,0.15); color: #409eff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 600; flex-shrink: 0;
}
.m-panel-avatar-guest { background: #e8ecf1; color: #409eff; font-size: 15px; font-weight: 600; }
.m-panel-username { flex: 1; font-size: 13px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-panel-logout { color: #aaa; }
.m-panel-login-tip { font-size: 12px; color: #409eff; }

/* 覆盖 AI 气泡左偏移 — 手机端不需要 */
.msg-row-ai { margin-left: 0 !important; }
.msg-row-ai .msg-content-area { max-width: 88% !important; }

/* 动画：从左侧滑入 */
.panel-slide-enter-active { transition: all 0.3s ease; }
.panel-slide-leave-active { transition: all 0.2s ease; }
.panel-slide-enter-from .m-panel { transform: translateX(-100%); }
.panel-slide-enter-from .m-panel-overlay { opacity: 0; }
.panel-slide-leave-to .m-panel { transform: translateX(-100%); }
.panel-slide-leave-to .m-panel-overlay { opacity: 0; }

/* 长按上下文菜单 */
.ctx-menu {
  position: fixed; left: 50%; transform: translateX(-50%);
  z-index: 801; width: 280px;
  background: #fff; border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
}
.ctx-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; cursor: pointer;
  transition: background 0.15s;
}
.ctx-item:active { background: #f5f5f5; }
.ctx-item-text { font-size: 15px; color: #1f1f1f; font-weight: 500; }
.ctx-item-icon { flex-shrink: 0; color: #555; }
.ctx-item-danger .ctx-item-text { color: #f56c6c; }
.ctx-item-danger .ctx-item-icon { color: #f56c6c; }
.ctx-divider { height: 1px; background: #f0f0f0; margin: 0 16px; }

.ctx-pop-enter-active { transition: all 0.2s ease-out; }
.ctx-pop-leave-active { transition: all 0.15s ease-in; }
.ctx-pop-enter-from { opacity: 0; transform: translateX(-50%) translateY(12px); }
.ctx-pop-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

</style>
<style>
/* 蜂巢欢迎图标 */
.wi-honeycomb { height: 24px; position: relative; width: 24px; }
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

/* 欢迎页加载动画 */
.loader {
  --color-one: #ffbf48;
  --color-two: #be4a1d;
  --color-three: #ffbf4780;
  --color-four: #bf4a1d80;
  --color-five: #ffbf4740;
  --time-animation: 2s;
  --size: 0.56;
  position: relative; border-radius: 50%;
  transform: scale(var(--size));
  box-shadow: 0 0 25px 0 var(--color-three), 0 20px 50px 0 var(--color-four);
  animation: colorize calc(var(--time-animation) * 3) ease-in-out infinite;
  transform-origin: center;
}
.loader::before {
  content: ""; position: absolute; top: 0; left: 0;
  width: 100px; height: 100px; border-radius: 50%;
  border-top: solid 1px var(--color-one);
  border-bottom: solid 1px var(--color-two);
  background: linear-gradient(180deg, var(--color-five), var(--color-four));
  box-shadow: inset 0 10px 10px 0 var(--color-three), inset 0 -10px 10px 0 var(--color-four);
}
.loader .box {
  width: 100px; height: 100px;
  background: linear-gradient(180deg, var(--color-one) 30%, var(--color-two) 70%);
  mask: url(#clipping); -webkit-mask: url(#clipping);
}
.loader svg { position: absolute; }
.loader svg #clipping { filter: contrast(15); animation: roundness calc(var(--time-animation) / 2) linear infinite; }
.loader svg #clipping polygon { filter: blur(7px); }
.loader svg #clipping polygon:nth-child(1) { transform-origin: 75% 25%; transform: rotate(90deg); }
.loader svg #clipping polygon:nth-child(2) { transform-origin: 50% 50%; animation: rotation var(--time-animation) linear infinite reverse; }
.loader svg #clipping polygon:nth-child(3) { transform-origin: 50% 60%; animation: rotation var(--time-animation) linear infinite; animation-delay: calc(var(--time-animation) / -3); }
.loader svg #clipping polygon:nth-child(4) { transform-origin: 40% 40%; animation: rotation var(--time-animation) linear infinite reverse; }
.loader svg #clipping polygon:nth-child(5) { transform-origin: 40% 40%; animation: rotation var(--time-animation) linear infinite reverse; animation-delay: calc(var(--time-animation) / -2); }
.loader svg #clipping polygon:nth-child(6) { transform-origin: 60% 40%; animation: rotation var(--time-animation) linear infinite; }
.loader svg #clipping polygon:nth-child(7) { transform-origin: 60% 40%; animation: rotation var(--time-animation) linear infinite; animation-delay: calc(var(--time-animation) / -1.5); }
@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes roundness { 0% { filter: contrast(15); } 20% { filter: contrast(3); } 40% { filter: contrast(3); } 60% { filter: contrast(15); } 100% { filter: contrast(15); } }
@keyframes colorize { 0% { filter: hue-rotate(0deg); } 20% { filter: hue-rotate(-30deg); } 40% { filter: hue-rotate(-60deg); } 60% { filter: hue-rotate(-90deg); } 80% { filter: hue-rotate(-45deg); } 100% { filter: hue-rotate(0deg); } }
</style>
