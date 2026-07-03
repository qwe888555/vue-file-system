<script setup lang="ts">
// ── 智能问答主页面 ──
// 豆包风格：简洁、留白、圆润

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessageBox } from 'element-plus'
import logoImg from '@/assets/logo.png'
import type { KnowledgeFile } from '@/types'
import { useChat } from '@/composables/useChat'
import { useSSE } from '@/composables/useSSE'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ChatLoginDialog from '@/components/chat/ChatLoginDialog.vue'

const userStore = useUserStore()
const router = useRouter()
const chat = useChat()

const sidebarOpen = ref(true)
const showLoginDialog = ref(false)
const showToolsMenu = ref(false)
const inputText = ref('')

// SSE
const streamingContent = ref('')
const isStreaming = ref(false)
const streamingReferences = ref<KnowledgeFile[]>([])
let currentSSE: ReturnType<typeof useSSE> | null = null

const isLoggedIn = computed(() => !!userStore.token)
const isAdminUser = computed(() => userStore.role === 'super_admin' || userStore.role === 'admin')
const displayName = computed(() => {
  if (!userStore.userInfo) return ''
  return userStore.userInfo.role_display || userStore.userInfo.username || ''
})
const hasActiveConversation = computed(() => chat.currentConversationId.value !== null)

// ── 热门问题统计（localStorage 持久化）──
const HOT_KEY = 'chat_hot_questions'
const SEED_QUESTIONS = [
  { text: '如何查找学习资料', icon: '📚' },
  { text: '论文格式要求是什么', icon: '📝' },
  { text: '校园网怎么连接', icon: '🌐' },
  { text: '课程表在哪里查', icon: '📅' },
  { text: '图书馆借书流程', icon: '📖' },
  { text: '奖学金申请条件', icon: '🏆' },
  { text: '如何选课', icon: '🎯' },
  { text: '学校邮箱怎么注册', icon: '📧' },
  { text: '实习机会有哪些', icon: '💼' },
]
interface QuestionStat { text: string; icon: string; count: number }

const hotQuestions = ref<QuestionStat[]>([])

function loadHotQuestions() {
  try {
    const raw = localStorage.getItem(HOT_KEY)
    if (raw) {
      hotQuestions.value = JSON.parse(raw)
      return
    }
  } catch {}
  // 首次使用：种子数据带随机初始次数
  hotQuestions.value = SEED_QUESTIONS.map((q, i) => ({
    ...q,
    count: Math.floor(Math.random() * 8) + (8 - i),
  }))
  saveHotQuestions()
}
function saveHotQuestions() {
  try { localStorage.setItem(HOT_KEY, JSON.stringify(hotQuestions.value)) } catch {}
}
function recordQuestion(text: string) {
  const found = hotQuestions.value.find(q => q.text === text)
  if (found) {
    found.count++
  } else {
    hotQuestions.value.push({ text, icon: '💬', count: 1 })
  }
  saveHotQuestions()
}
// 取 top 9
const topQuestions = computed(() =>
  [...hotQuestions.value].sort((a, b) => b.count - a.count).slice(0, 9)
)

function quickQuestion(text: string) {
  recordQuestion(text)
  inputText.value = text
  sendMessage()
}

function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }

function handleLoginSuccess() { showLoginDialog.value = false; chat.fetchConversations() }
function handleLoginCancel() { showLoginDialog.value = false }
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示')
    userStore.logout()
    router.push('/login')
  } catch {}
}

function handleNewConversation() { chat.createConversation() }
async function handleSelectConversation(id: number) { await chat.selectConversation(id) }
async function handleDeleteConversation(id: number) { await chat.deleteConversation(id) }
function handleBackToList() { chat.currentConversationId.value = null }
function toggleToolsMenu() { showToolsMenu.value = !showToolsMenu.value }
function handleDocumentAction() { showToolsMenu.value = false; /* TODO: 文档相关操作 */ }
function handleLanguageSetting() { showToolsMenu.value = false; /* TODO: 语言设置 */ }

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
  streamingReferences.value = []

  currentSSE = useSSE(convId, text, () => {
    isStreaming.value = false
    chat.appendAssistantMessage(streamingContent.value, streamingReferences.value)
    streamingContent.value = ''
    streamingReferences.value = []
  })
  watch(currentSSE.content, (val) => { streamingContent.value = val })
  watch(currentSSE.references, (val) => { streamingReferences.value = val })
}

function handleFeedback(messageId: number, type: 'like' | 'dislike') {
  chat.submitFeedback(messageId, type)
}
onMounted(() => { chat.init(); loadHotQuestions() })
</script>

<template>
  <div class="chat-app">
    <!-- ═══ 左侧边栏（对话列表）═══ -->
    <aside class="chat-sidebar" :class="{ collapsed: !sidebarOpen }">
      <!-- 顶部 -->
      <div class="sidebar-top">
        <div class="sidebar-logo-area">
          <img :src="logoImg" alt="logo" class="sidebar-logo" />
        </div>
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
          @click="handleSelectConversation(conv.id)"
        >
          <div class="conv-item-icon">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7a1.5 1.5 0 01-1.5 1.5h-3.586a1.5 1.5 0 00-1.06.44L5 15V12H3.5A1.5 1.5 0 012 10.5v-7z"/>
            </svg>
          </div>
          <div class="conv-item-content">
            <span class="conv-item-title">{{ conv.title || '新对话' }}</span>
            <span class="conv-item-time">{{ conv.updatedAt?.slice(5, 10) }}</span>
          </div>
          <button class="conv-item-del" @click.stop="handleDeleteConversation(conv.id)">×</button>
        </div>
        <div v-if="chat.loading.value" class="sidebar-loading">
          <span class="load-dot" /><span class="load-dot" /><span class="load-dot" />
        </div>
        <div v-if="chat.filteredConversations.value.length === 0 && !chat.loading.value" class="sidebar-empty">
          暂无对话
        </div>
      </div>

      <!-- 底部用户 -->
      <div v-if="isLoggedIn" class="sidebar-user" @click="handleLogout">
        <div class="su-avatar">
          <span class="su-avatar-text">{{ displayName.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="su-info">
          <span class="su-name">{{ userStore.userInfo?.username || '' }}</span>
          <span class="su-role">{{ userStore.role === 'admin' ? '普通管理员' : (userStore.userInfo?.role_display || '') }}</span>
        </div>
        <span class="su-status">已登录</span>
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
        <div v-if="isLoggedIn && isAdminUser" class="topbar-right">
          <button class="topbar-exit-btn" @click="router.push('/knowledge/list')" title="退出问答">
            <span>退出问答</span>
          </button>
        </div>
      </header>

      <!-- 对话区 -->
      <div class="chat-messages">
        <div class="messages-inner">
          <!-- 消息列表 -->
          <template v-if="hasActiveConversation">
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

          <!-- 空状态 -->
          <div v-else class="chat-welcome">
            <div class="welcome-icon">
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
            <h2 class="welcome-title">你好！有什么可以帮助你的？</h2>
            <div v-if="topQuestions.length" class="quick-questions">
              <button
                v-for="q in topQuestions"
                :key="q.text"
                class="qq-btn"
                @click="quickQuestion(q.text)"
              >{{ q.icon }} {{ q.text }}</button>
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
            <div class="input-extra-wrap">
              <button class="input-extra-btn" @click="toggleToolsMenu">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                  <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                </svg>
              </button>
              <Transition name="tools">
                <div v-if="showToolsMenu" class="tools-menu">
                  <div class="tools-menu-item" @click="handleDocumentAction">
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                      <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                      <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                    <span>文档相关操作</span>
                  </div>
                  <div class="tools-menu-item" @click="handleLanguageSetting">
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z" />
                      <path d="M6.5 10c0 1.5.5 3 1.5 4.5.5.7 1 1.2 1.5 1.5.5-.3 1-.8 1.5-1.5 1-1.5 1.5-3 1.5-4.5s-.5-3-1.5-4.5c-.5-.7-1-1.2-1.5-1.5-.5.3-1 .8-1.5 1.5C7 7 6.5 8.5 6.5 10z" />
                      <path d="M3.5 7.5h13" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" />
                      <path d="M3.5 12.5h13" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" />
                    </svg>
                    <span>语言设置</span>
                  </div>
                </div>
              </Transition>
            </div>
            <input
              v-model="inputText"
              type="text"
              class="input-field"
              :placeholder="isStreaming ? 'AI 正在回复…' : '输入你的问题…'"
              :disabled="isStreaming"
              @keyup.enter="sendMessage"
            />
            <button class="input-send-btn" :disabled="!inputText.trim() || isStreaming" @click="sendMessage">发送</button>
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
  transition: margin-left 0.25s ease;
  z-index: 10;
}
.chat-sidebar.collapsed {
  margin-left: -280px;
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
.sidebar-logo-area {
  margin-bottom: 12px;
}
.sidebar-logo {
  height: 44px;
  width: auto;
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
.conv-item:hover .conv-item-del { opacity: 1; }
.conv-item-del:hover { color: #f56c6c; }

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
.sidebar-user:hover { background: #f0f4fe; }
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
  margin-bottom: 24px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  box-shadow: 0 0 40px rgba(64, 158, 255, 0.08), inset 0 0 20px rgba(64, 158, 255, 0.04);
}

/* 欢迎页加载动画（蓝调版） */
.loader {
  --color-one: #ffbf48;
  --color-two: #be4a1d;
  --color-three: #ffbf4780;
  --color-four: #bf4a1d80;
  --color-five: #ffbf4740;
  --time-animation: 2s;
  --size: 0.56;
  position: relative;
  border-radius: 50%;
  transform: scale(var(--size));
  box-shadow: 0 0 25px 0 var(--color-three), 0 20px 50px 0 var(--color-four);
  animation: colorize calc(var(--time-animation) * 3) ease-in-out infinite;
  transform-origin: center;
}

.loader::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border-top: solid 1px var(--color-one);
  border-bottom: solid 1px var(--color-two);
  background: linear-gradient(180deg, var(--color-five), var(--color-four));
  box-shadow: inset 0 10px 10px 0 var(--color-three), inset 0 -10px 10px 0 var(--color-four);
}

.loader .box {
  width: 100px;
  height: 100px;
  background: linear-gradient(180deg, var(--color-one) 30%, var(--color-two) 70%);
  mask: url(#clipping);
  -webkit-mask: url(#clipping);
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

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes roundness {
  0% { filter: contrast(15); }
  20% { filter: contrast(3); }
  40% { filter: contrast(3); }
  60% { filter: contrast(15); }
  100% { filter: contrast(15); }
}
@keyframes colorize {
  0% { filter: hue-rotate(0deg); }
  20% { filter: hue-rotate(-30deg); }
  40% { filter: hue-rotate(-60deg); }
  60% { filter: hue-rotate(-90deg); }
  80% { filter: hue-rotate(-45deg); }
  100% { filter: hue-rotate(0deg); }
}
.welcome-title {
  font-size: 22px;
  font-weight: 400;
  color: #1f1f1f;
  margin: 0 0 10px;
  letter-spacing: -0.04em;
  position: relative;
  z-index: 1;
}
.welcome-desc {
  font-size: 14px;
  font-weight: 400;
  color: #555;
  margin: 0 0 24px;
  letter-spacing: 0.05em;
  position: relative;
  z-index: 1;
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
  padding: 20px 24px 32px;
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
  gap: 12px;
  border: none;
  border-radius: 0.875em;
  padding: 10px 8px 10px 20px;
  background: #f0f5ff;
  z-index: 1;
  overflow: hidden;
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
  inset: -2px;
  border-radius: inherit;
  filter: blur(2px) url(#unopaq3);
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

.input-extra-btn {
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  padding: 10px; border-radius: 10px;
  color: #409eff; flex-shrink: 0;
  transition: background 0.15s;
}
.input-extra-btn:hover { background: rgba(64,158,255,0.1); }
.input-extra-btn svg { width: 20px; height: 20px; }

/* 工具菜单 */
.input-extra-wrap { position: relative; }
.tools-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: 180px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  border: 1px solid #eee;
  overflow: hidden;
  z-index: 50;
}
.tools-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  transition: background 0.12s;
}
.tools-menu-item:hover { background: #f5f8ff; color: #409eff; }
.tools-menu-item svg { color: #8e8e93; }
.tools-menu-item:hover svg { color: #409eff; }
.tools-menu-item + .tools-menu-item { border-top: 1px solid #f5f5f5; }
.tools-enter-active, .tools-leave-active { transition: all 0.15s ease; }
.tools-enter-from, .tools-leave-to { opacity: 0; transform: translateY(6px); }
.input-field {
  flex: 1; border: none; background: transparent; outline: none;
  font-size: 16px; color: #1f1f1f; padding: 12px 0; min-height: 30px;
}
.input-field::placeholder { color: #8e9ebd; font-size: 15px; }
.input-send-btn {
  padding: 0 22px; height: 46px; border-radius: 12px;
  border: none; background: #409eff; color: #fff;
  font-size: 16px; font-weight: 600; letter-spacing: 1px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s; flex-shrink: 0;
}
.input-send-btn:hover:not(:disabled) { background: #3a8ee6; box-shadow: 0 0 20px rgba(64,158,255,0.3); }
.input-send-btn:disabled { background: #d0ddf0; cursor: not-allowed; color: #8e9ebd; }

/* 动画 */
</style>
