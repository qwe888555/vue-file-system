<script setup lang="ts">
// ── 智能问答主页面（重构版）──
// 功能：5 大布局区域 + SSE 流式问答 + Markdown 渲染 + 对话缓存
// ── 1. 外部依赖导入 ──
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import logoImg from '@/assets/logo.png'
import type { KnowledgeFile } from '@/types'
import { useChat } from '@/composables/useChat'
import { useSSE } from '@/composables/useSSE'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ChatLoginDialog from '@/components/chat/ChatLoginDialog.vue'
import ChatLogoutConfirm from '@/components/chat/ChatLogoutConfirm.vue'
import ChatUserMenu from '@/components/chat/ChatUserMenu.vue'

// ── 2. Store & Composables ──
const userStore = useUserStore()
const router = useRouter()
const chat = useChat()

// ── 3. 响应式数据 ──
const sidebarCollapsed = ref(false)
const showFloatPanel = ref(false)
const showLoginDialog = ref(false)
const showLogoutConfirm = ref(false)
const showUserMenu = ref(false)
const inputText = ref('')

// SSE 流式状态
const streamingContent = ref('')
const isStreaming = ref(false)
const streamingReferences = ref<KnowledgeFile[]>([])
let currentSSE: ReturnType<typeof useSSE> | null = null

// ── 4. Computed ──
const isLoggedIn = computed(() => !!userStore.token)
const displayName = computed(() => userStore.username || '未登录')
const sidebarWidth = computed(() => (sidebarCollapsed.value ? '64px' : '240px'))
const showBackBtn = computed(() => chat.currentConversationId.value !== null)

// ── 5. 方法 ──

/* 侧边栏 & 面板 */
function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }

/* 用户入口 */
function handleToggleUserPanel() {
  if (isLoggedIn.value) {
    showUserMenu.value = true
  } else {
    showLoginDialog.value = true
  }
}

/* 登录回调 */
function handleLoginSuccess() {
  showLoginDialog.value = false
  chat.fetchConversations()
}
function handleLoginCancel() { showLoginDialog.value = false }

/* 退出登录 */
function handleLogoutClick() { showUserMenu.value = false; showLogoutConfirm.value = true }
async function handleLogoutConfirm() {
  try { await userStore.logout() } finally {
    showLogoutConfirm.value = false
    showUserMenu.value = false
  }
}
function handleLogoutCancel() { showLogoutConfirm.value = false }
function handleUserMenuClose() { showUserMenu.value = false }

/* 对话操作 */
function handleNewConversation() {
  chat.createConversation()
  showFloatPanel.value = false
}

async function handleSelectConversation(id: number) {
  await chat.selectConversation(id)
  showFloatPanel.value = false
}

async function handleDeleteConversation(id: number) {
  await chat.deleteConversation(id)
}

/* 发送消息（核心流程） */
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  // 已有 SSE 连接先断开
  currentSSE?.close()

  // 自动创建对话
  if (!chat.currentConversationId.value) {
    const conv = await chat.createConversation()
    if (!conv) return
  }

  const convId = chat.currentConversationId.value!
  chat.appendUserMessage(text)
  inputText.value = ''

  // 启动 SSE 流式连接
  isStreaming.value = true
  streamingContent.value = ''
  streamingReferences.value = []

  currentSSE = useSSE(convId, text, () => {
    // onDone: SSE 完成时保存完整消息
    chat.appendAssistantMessage(streamingContent.value, streamingReferences.value)
    isStreaming.value = false
    streamingContent.value = ''
    streamingReferences.value = []
  })

  // 实时更新流式内容
  watch(currentSSE.content, (val) => { streamingContent.value = val })
  watch(currentSSE.references, (val) => { streamingReferences.value = val })
}

/* 反馈 */
function handleFeedback(messageId: number, type: 'like' | 'dislike') {
  chat.submitFeedback(messageId, type)
}

function handleBackToList() {
  chat.currentConversationId.value = null
}

/* 搜索（顶部栏）*/
function handleSearchClick() {
  showFloatPanel.value = !showFloatPanel.value
}

/* 导航 */
function navigateTo(path: string) { router.push(path) }

// ── 6. 生命周期 ──
onMounted(() => {
  chat.init()
})
</script>

<template>
  <div class="chat-page">
    <!-- ════════════════════════ 区域 1：左侧固定侧边栏 ════════════════════════ -->
    <aside class="sidebar" :style="{ width: sidebarWidth }">
      <!-- 顶部 Logo -->
      <div class="sidebar-brand">
        <div class="brand-logo">
          <img :src="logoImg" alt="成都东软学院" class="sidebar-logo-img" />
        </div>
      </div>

      <!-- 功能导航 -->
      <nav class="sidebar-nav">
        <div class="nav-item" @click="navigateTo('/knowledge/list')" title="知识库管理">
          <svg class="nav-icon" viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M2 4a2 2 0 012-2h5l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" />
          </svg>
          <span class="nav-label" :class="{ hidden: sidebarCollapsed }">知识库管理</span>
          <span v-if="!sidebarCollapsed" class="nav-badge" />
        </div>
        <div class="nav-item active" @click="navigateTo('/chat')" title="智能问答">
          <svg class="nav-icon" viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          </svg>
          <span class="nav-label" :class="{ hidden: sidebarCollapsed }">智能问答</span>
        </div>
      </nav>

      <!-- 底部用户栏 -->
      <div class="sidebar-user-row" @click="handleToggleUserPanel">
        <div class="user-avatar">
          <svg v-if="!isLoggedIn" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          <span v-else class="avatar-text">{{ displayName.charAt(0).toUpperCase() }}</span>
        </div>
        <span v-if="!sidebarCollapsed" class="user-display-name">{{ displayName }}</span>
        <svg v-if="!sidebarCollapsed" class="user-arrow" viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
          <path d="M6 4l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
      </div>
    </aside>

    <!-- ════════════════════════ 右侧主容器 ════════════════════════ -->
    <div class="main-container" :style="{ marginLeft: sidebarWidth }">
      <!-- ════════════════════════ 区域 2：顶部操作栏 ════════════════════════ -->
      <header class="top-bar">
        <div class="top-bar-left">
          <button class="top-bar-btn" @click="toggleSidebar" title="收缩侧边栏">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path v-if="!sidebarCollapsed" d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h14v1.5H3v-1.5z" />
              <path v-else d="M3 4h14v1.5H3V4zm3 5l4 4V9l-4-4v4zm-3 5h14v1.5H3v-1.5z" />
            </svg>
          </button>
          <!-- 返回对话列表（当有活跃对话时） -->
          <button v-if="showBackBtn" class="top-bar-btn back-btn" @click="handleBackToList" title="返回对话列表">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" />
            </svg>
          </button>
        </div>
        <div class="top-bar-right">
          <button class="top-bar-btn" @click="handleSearchClick" title="搜索对话 / 对话菜单">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M12.9 14.32a8 8 0 111.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 108 2a6 6 0 000 12z" />
            </svg>
          </button>
        </div>
      </header>

      <!-- ════════════════════════ 区域 5：中间对话区 ════════════════════════ -->
      <div class="content-area">
        <div class="messages-container">
          <!-- 有活跃对话 → 显示消息 -->
          <template v-if="chat.currentConversationId.value !== null">
            <MessageBubble
              v-for="msg in chat.currentMessages.value"
              :key="msg.id"
              :message="msg"
              :user-role="userStore.role ?? undefined"
              @feedback="handleFeedback"
            />
            <!-- SSE 流式消息占位 -->
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

          <!-- 无活跃对话 → 显示欢迎 / 空状态 -->
          <div v-else class="empty-state">
            <svg viewBox="0 0 80 80" width="64" height="64" fill="none" class="empty-icon">
              <circle cx="40" cy="40" r="28" stroke="#c0c4cc" stroke-width="2" />
              <path d="M30 35h20M30 45h14" stroke="#c0c4cc" stroke-width="2" stroke-linecap="round" />
            </svg>
            <p class="empty-text">选择或创建一个对话开始提问</p>
            <button class="empty-action" @click="handleNewConversation">新建对话</button>
          </div>
        </div>
      </div>

      <!-- ════════════════════════ 区域 4：底部输入栏 ════════════════════════ -->
      <div class="input-bar-container">
        <div class="input-bar">
          <button class="input-tool-btn" title="附加工具">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="var(--color-primary)">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
          </button>
          <input
            v-model="inputText"
            type="text"
            class="input-field"
            :placeholder="isStreaming ? 'AI 正在回复…' : '文档、语言……(功能)'"
            :disabled="isStreaming"
            @keyup.enter="sendMessage"
          />
          <button class="send-btn" :disabled="!inputText.trim() || isStreaming" @click="sendMessage" title="发送">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ════════════════════════ 区域 3：右侧对话悬浮弹窗 ════════════════════════ -->
    <Transition name="panel">
      <div v-if="showFloatPanel" class="float-panel">
        <div class="panel-header">
          <h3 class="panel-title">对话</h3>
          <button class="panel-close" @click="showFloatPanel = false">×</button>
        </div>
        <div class="panel-body">
          <!-- 搜索框 -->
          <div class="panel-search">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              <path d="M12.9 14.32a8 8 0 111.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 108 2a6 6 0 000 12z" />
            </svg>
            <input v-model="chat.searchKeyword.value" type="text" placeholder="搜索对话…" />
          </div>

          <!-- 新建对话 -->
          <button class="panel-action-btn" @click="handleNewConversation">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            <span>新建对话</span>
          </button>

          <!-- 对话列表 -->
          <div class="panel-section">
            <h4 class="section-title">最近对话</h4>
            <ul class="conversation-list">
              <li
                v-for="conv in chat.filteredConversations.value"
                :key="conv.id"
                class="conversation-item"
                :class="{ active: conv.id === chat.currentConversationId.value }"
                @click="handleSelectConversation(conv.id)"
              >
                <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" class="conv-icon">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                </svg>
                <span class="conv-title">{{ conv.title || '新对话' }}</span>
                <span v-if="conv.isFavorite" class="conv-fav" title="收藏">★</span>
                <button class="conv-delete" @click.stop="handleDeleteConversation(conv.id)" title="删除">×</button>
              </li>
            </ul>
          </div>

          <!-- 加载状态 -->
          <div v-if="chat.loading.value" class="panel-loading">
            <span class="thinking-dot" /><span class="thinking-dot" /><span class="thinking-dot" />
          </div>
        </div>
        <div class="panel-scroll-hint">滚轮</div>
      </div>
    </Transition>

    <!-- ════════════════════════ 登录弹窗 ════════════════════════ -->
    <ChatLoginDialog
      v-if="showLoginDialog"
      @success="handleLoginSuccess"
      @cancel="handleLoginCancel"
    />

    <!-- ════════════════════════ 侧边栏用户菜单 ════════════════════════ -->
    <ChatUserMenu
      v-if="showUserMenu"
      @close="handleUserMenuClose"
      @logout="handleLogoutClick"
    />

    <!-- ════════════════════════ 退出确认 ════════════════════════ -->
    <ChatLogoutConfirm
      v-if="showLogoutConfirm"
      @confirm="handleLogoutConfirm"
      @cancel="handleLogoutCancel"
    />
  </div>
</template>

<style scoped>
/* ════════════════════════ 全局布局 ════════════════════════ */
.chat-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg, #f5f7fa);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ════════════════════════ 区域 1：左侧固定侧边栏 ════════════════════════ */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  background: rgba(3, 84, 167, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: width 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  padding: var(--spacing-xl, 24px) var(--spacing-lg, 16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
  min-height: 80px;
}

.brand-logo {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.sidebar-logo-img {
  height: 44px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

/* ── 导航 ── */
.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-md, 12px) 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  font-size: var(--font-size-base, 14px);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-weight: 600;
}

.nav-icon { flex-shrink: 0; }
.nav-label { transition: opacity 0.2s ease; }
.nav-label.hidden { opacity: 0; width: 0; overflow: hidden; }

.nav-badge {
  width: 6px; height: 6px; border-radius: 50%;
  background: #ffffff; margin-left: auto; flex-shrink: 0; opacity: 0.8;
}

/* ── 底部用户栏 ── */
.sidebar-user-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-lg, 16px);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}
.sidebar-user-row:hover { background: rgba(255, 255, 255, 0.08); }

.user-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(64, 158, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.5);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: rgba(255, 255, 255, 0.8);
}
.avatar-text { font-size: var(--font-size-base, 14px); font-weight: 700; color: #fff; }
.user-display-name {
  flex: 1; font-size: var(--font-size-sm, 13px);
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.user-arrow { flex-shrink: 0; color: rgba(255, 255, 255, 0.4); }
.sidebar-user-row:hover .user-arrow { color: rgba(255, 255, 255, 0.7); }

/* ════════════════════════ 右侧主容器 ════════════════════════ */
.main-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  transition: margin-left 0.3s ease;
}

/* ════════════════════════ 区域 2：顶部操作栏 ════════════════════════ */
.top-bar {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-lg, 16px);
  background: var(--color-white, #ffffff);
  border-bottom: 1px solid var(--color-border, #e4e7ed);
  flex-shrink: 0;
  justify-content: space-between;
}
.top-bar-left, .top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}
.top-bar-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  border-radius: var(--radius-sm, 4px); cursor: pointer;
  color: var(--color-text-secondary, #606266);
  transition: all 0.2s ease;
}
.top-bar-btn:hover { background: var(--color-bg, #f5f7fa); color: var(--color-text, #303133); }

/* ════════════════════════ 区域 5：对话区 ════════════════════════ */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl, 24px) var(--spacing-xxl, 32px);
  display: flex;
  justify-content: center;
}
.messages-container {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg, 16px);
}

/* 空状态 */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 20px; color: var(--color-placeholder, #c0c4cc);
}
.empty-icon { margin-bottom: var(--spacing-lg, 16px); }
.empty-text { font-size: var(--font-size-lg, 16px); margin: 0 0 var(--spacing-lg); }
.empty-action {
  padding: var(--spacing-sm, 8px) var(--spacing-xl, 24px);
  background: var(--color-primary, #409eff);
  color: #fff; border: none; border-radius: 20px;
  font-size: var(--font-size-base, 14px); cursor: pointer;
  transition: background 0.2s ease;
}
.empty-action:hover { background: var(--color-primary-dark, #3a8ee6); }

/* ════════════════════════ 区域 4：输入栏 ════════════════════════ */
.input-bar-container {
  flex-shrink: 0;
  padding: var(--spacing-lg, 16px) var(--spacing-xxl, 32px);
  background: var(--color-bg, #f5f7fa);
}
.input-bar {
  display: flex; align-items: center; gap: var(--spacing-sm, 8px);
  max-width: 800px; margin: 0 auto;
  background: #e8f0fe; border-radius: 50px;
  padding: 4px 4px 4px var(--spacing-lg, 16px);
  border: 1px solid rgba(3, 84, 167, 0.15);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.input-bar:focus-within {
  border-color: var(--color-primary, #409eff);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
}
.input-tool-btn {
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  padding: 6px; border-radius: 50%;
  transition: background 0.2s ease; flex-shrink: 0;
}
.input-tool-btn:hover { background: rgba(64, 158, 255, 0.12); }
.input-field {
  flex: 1; border: none; background: transparent; outline: none;
  font-size: var(--font-size-base, 14px);
  color: var(--color-text, #303133);
  padding: var(--spacing-sm, 8px) 0; min-height: 24px;
}
.input-field::placeholder { color: var(--color-placeholder, #c0c4cc); }
.send-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: none; background: var(--color-primary, #409eff);
  color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { background: var(--color-primary-dark, #3a8ee6); }
.send-btn:disabled { background: var(--color-border, #e4e7ed); cursor: not-allowed; color: var(--color-placeholder, #c0c4cc); }

/* ════════════════════════ 区域 3：右侧悬浮弹窗 ════════════════════════ */
.float-panel {
  position: fixed; top: 56px; right: var(--spacing-lg, 16px);
  width: 300px; max-height: calc(100vh - 80px);
  background: rgba(3, 84, 167, 0.4);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-radius: var(--radius-lg, 8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 200; display: flex; flex-direction: column; overflow: hidden;
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--spacing-lg, 16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}
.panel-title { font-size: var(--font-size-lg, 16px); font-weight: 700; color: #fff; margin: 0; }
.panel-close {
  background: transparent; border: none; color: rgba(255, 255, 255, 0.7);
  font-size: 20px; cursor: pointer; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  transition: all 0.2s ease;
}
.panel-close:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }
.panel-body {
  flex: 1; overflow-y: auto; padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  display: flex; flex-direction: column; gap: var(--spacing-lg, 16px);
}

/* 面板内搜索 */
.panel-search {
  display: flex; align-items: center; gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  background: rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-base, 6px);
  color: rgba(255, 255, 255, 0.5);
}
.panel-search input {
  flex: 1; border: none; background: transparent; outline: none;
  color: #fff; font-size: var(--font-size-sm, 13px);
}
.panel-search input::placeholder { color: rgba(255, 255, 255, 0.4); }

.panel-action-btn {
  display: flex; align-items: center; gap: var(--spacing-sm, 8px);
  width: 100%; padding: var(--spacing-md, 12px);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-base, 6px); color: #fff;
  font-size: var(--font-size-base, 14px); cursor: pointer;
  transition: all 0.2s ease;
}
.panel-action-btn:hover { background: rgba(255, 255, 255, 0.2); }

.panel-section { display: flex; flex-direction: column; gap: var(--spacing-sm, 8px); }
.section-title {
  font-size: var(--font-size-sm, 13px); font-weight: 600;
  color: rgba(255, 255, 255, 0.7); margin: 0;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.conversation-list { list-style: none; margin: 0; padding: 0; }
.conversation-item {
  display: flex; align-items: center; gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--font-size-sm, 13px);
  border-radius: var(--radius-sm, 4px); cursor: pointer;
  transition: all 0.2s ease;
}
.conversation-item:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.conversation-item.active { background: rgba(255, 255, 255, 0.18); color: #fff; }
.conv-icon { flex-shrink: 0; opacity: 0.7; }
.conv-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-fav { color: #e6a23c; font-size: 12px; }
.conv-delete {
  opacity: 0; background: none; border: none; color: rgba(255,255,255,0.5);
  cursor: pointer; font-size: 16px; padding: 0 2px; transition: opacity 0.2s;
}
.conversation-item:hover .conv-delete { opacity: 1; }
.conv-delete:hover { color: #f56c6c; }

.panel-loading { display: flex; justify-content: center; gap: 4px; padding: 8px; }
.panel-loading .thinking-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,255,255,0.5);
  animation: dotBounce 1.2s ease-in-out infinite;
}
.panel-loading .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.panel-loading .thinking-dot:nth-child(3) { animation-delay: 0.4s; }

.panel-scroll-hint {
  text-align: center; padding: var(--spacing-xs, 4px) 0 var(--spacing-sm, 8px);
  font-size: var(--font-size-xs, 12px); color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0; letter-spacing: 2px;
}

/* ════════════════════════ 过渡动画 ════════════════════════ */
.panel-enter-active, .panel-leave-active { transition: all 0.25s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: translateX(20px) scale(0.96); }
@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ════════════════════════ 滚动条美化 ════════════════════════ */
.content-area::-webkit-scrollbar, .panel-body::-webkit-scrollbar { width: 6px; }
.content-area::-webkit-scrollbar-track { background: transparent; }
.content-area::-webkit-scrollbar-thumb { background: var(--color-border, #e4e7ed); border-radius: 3px; }
.panel-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
</style>
