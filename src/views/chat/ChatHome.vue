1<script setup lang="ts">
// ── 智能问答主页面 ──
// 功能：实现智能问答对话界面，包含左侧导航侧边栏、顶部操作栏、
//       右侧对话悬浮弹窗、底部输入栏和中间对话展示区

// ── 1. 外部依赖导入 ──
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

// ── 2. 类型定义 ──
interface Message {
  id: number
  role: 'user' | 'ai'
  content: string
}

interface Conversation {
  id: number
  title: string
  updatedAt: string
}

// ── 3. Store ──
const userStore = useUserStore()
const router = useRouter()

// ── 4. 响应式数据 ──
const sidebarCollapsed = ref(false)
const showFloatPanel = ref(false)
const showHistoryDropdown = ref(true)
const showLoginDialog = ref(false)
const loginForm = ref({ username: '', password: '' })
const loginError = ref('')
const loginLoading = ref(false)
const showProfilePanel = ref(false)
const showLogoutConfirm = ref(false)
const inputText = ref('')
const messages = ref<Message[]>([
  {
    id: 1,
    role: 'ai',
    content: '你好！我是成都东软学院智能助手，请问有什么可以帮助你的？',
  },
  {
    id: 2,
    role: 'user',
    content: '请问如何查找学习资料？',
  },
])
const conversations = ref<Conversation[]>([
  { id: 1, title: '示例 1', updatedAt: '2026-07-01' },
  { id: 2, title: '示例 2', updatedAt: '2026-06-28' },
  { id: 3, title: '示例 3', updatedAt: '2026-06-25' },
])

// ── 5. Computed ──
const isLoggedIn = computed(() => !!userStore.token)
const displayName = computed(() => userStore.username || '未登录')

const sidebarWidth = computed(() => (sidebarCollapsed.value ? '64px' : '240px'))

// ── 6. 方法 ──
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function toggleFloatPanel() {
  showFloatPanel.value = !showFloatPanel.value
}

/* ── 底部用户栏：整行点击入口 ── */
function handleToggleUserPanel() {
  if (isLoggedIn.value) {
    // 已登录 → 弹出侧边栏用户菜单
    showProfilePanel.value = true
  } else {
    // 未登录 → 弹出登录弹窗
    showLoginDialog.value = true
  }
}

/* ── 登录弹窗 ── */
async function handleLoginSubmit() {
  const { username, password } = loginForm.value
  if (!username || !password) {
    loginError.value = '请输入用户名和密码'
    return
  }
  loginLoading.value = true
  loginError.value = ''
  try {
    await userStore.login({ username, password })
    showLoginDialog.value = false
    loginForm.value = { username: '', password: '' }
  } catch (e: unknown) {
    loginError.value = (e as { message?: string })?.message || '登录失败，请检查用户名和密码'
  } finally {
    loginLoading.value = false
  }
}

function handleLoginCancel() {
  showLoginDialog.value = false
  loginForm.value = { username: '', password: '' }
  loginError.value = ''
}

/* ── 侧边栏用户弹窗 ── */
function handleCloseProfile() {
  showProfilePanel.value = false
}

/* ── 退出登录 ── */
function handleLogoutClick() {
  showLogoutConfirm.value = true
}

async function handleLogoutConfirm() {
  try {
    await userStore.logout()
  } finally {
    showLogoutConfirm.value = false
    showProfilePanel.value = false
    showLoginDialog.value = false
  }
}

function handleLogoutCancel() {
  showLogoutConfirm.value = false
}

function handleNewConversation() {
  messages.value = []
  showFloatPanel.value = false
  inputText.value = ''
}

function handleSelectConversation(conv: Conversation) {
  showFloatPanel.value = false
  // TODO: 加载对应对话记录
}

function toggleHistoryDropdown() {
  showHistoryDropdown.value = !showHistoryDropdown.value
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return

  const userMsg: Message = {
    id: Date.now(),
    role: 'user',
    content: text,
  }
  messages.value.push(userMsg)
  inputText.value = ''

  // TODO: 对接 AI 接口获取回复
  setTimeout(() => {
    messages.value.push({
      id: Date.now() + 1,
      role: 'ai',
      content: `收到你的问题：「${text}」\n\n这是一个模拟回复，待接入 AI 接口后将返回真实答案。`,
    })
    nextTick(() => {
      scrollToBottom()
    })
  }, 800)
}

function scrollToBottom() {
  const container = document.querySelector('.content-area')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="chat-page">
    <!-- ════════════════════════ 区域 1：左侧固定侧边栏 ════════════════════════ -->
    <aside class="sidebar" :style="{ width: sidebarWidth }">
      <!-- 顶部校徽标题区 -->
      <div class="sidebar-brand">
        <div class="brand-logo">
          <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
            <circle cx="20" cy="20" r="18" stroke="#fff" stroke-width="2.5" />
            <text x="20" y="26" text-anchor="middle" fill="#fff" font-size="18" font-weight="bold">CD</text>
          </svg>
        </div>
        <div class="brand-text" :class="{ collapsed: sidebarCollapsed }">
          <span class="brand-name">成都东软学院</span>
          <span class="brand-en">Chengdu Neusoft University</span>
        </div>
      </div>

      <!-- 功能导航板块 -->
      <nav class="sidebar-nav">
        <div
          class="nav-item"
          :class="{ active: false }"
          @click="navigateTo('/knowledge/list')"
          :title="'知识库管理'"
        >
          <svg class="nav-icon" viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M2 4a2 2 0 012-2h5l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" />
          </svg>
          <span class="nav-label" :class="{ hidden: sidebarCollapsed }">知识库管理</span>
          <!-- 底色标识 -->
          <span v-if="!sidebarCollapsed" class="nav-badge" />
        </div>

        <div
          class="nav-item active"
          @click="navigateTo('/chat')"
          :title="'智能问答'"
        >
          <svg class="nav-icon" viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          </svg>
          <span class="nav-label" :class="{ hidden: sidebarCollapsed }">智能问答</span>
        </div>
      </nav>

      <!-- 底部用户栏（整行可点击：头像 + 昵称 + 右箭头） -->
      <div class="sidebar-user-row" @click="handleToggleUserPanel">
        <div class="user-avatar">
          <svg v-if="!isLoggedIn" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          <span v-else class="avatar-text">{{ displayName.charAt(0).toUpperCase() }}</span>
        </div>
        <span v-if="!sidebarCollapsed" class="user-display-name">{{ displayName }}</span>
        <svg
          v-if="!sidebarCollapsed"
          class="user-arrow"
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="currentColor"
        >
          <path d="M6 4l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
      </div>
    </aside>

    <!-- ════════════════════════ 右侧主内容区 ════════════════════════ -->
    <div class="main-container" :style="{ marginLeft: sidebarWidth }">
      <!-- ════════════════════════ 区域 2：顶部全局操作栏 ════════════════════════ -->
      <header class="top-bar">
        <div class="top-bar-left">
          <!-- 收缩侧边栏按钮 -->
          <button class="top-bar-btn" @click="toggleSidebar" title="收缩侧边栏">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path v-if="!sidebarCollapsed" d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h14v1.5H3v-1.5z" />
              <path v-else d="M3 4h14v1.5H3V4zm3 5l4 4V9l-4-4v4zm-3 5h14v1.5H3v-1.5z" />
            </svg>
          </button>
        </div>

        <div class="top-bar-right">
          <!-- 搜索 / 对话菜单唤起按钮 -->
          <button class="top-bar-btn" @click="toggleFloatPanel" title="搜索最近对话记录 / 对话菜单">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M12.9 14.32a8 8 0 111.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 108 2a6 6 0 000 12z" />
            </svg>
          </button>
        </div>
      </header>

      <!-- ════════════════════════ 区域 5：中间对话展示区 ════════════════════════ -->
      <div class="content-area">
        <div class="messages-container">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="message-row"
            :class="[msg.role === 'user' ? 'message-user' : 'message-ai']"
          >
            <div class="message-avatar">
              <span v-if="msg.role === 'ai'">AI</span>
              <span v-else>{{ displayName.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="message-bubble">
              <p>{{ msg.content }}</p>
            </div>
          </div>

          <!-- 空状态占位 -->
          <div v-if="messages.length === 0" class="empty-state">
            <svg viewBox="0 0 80 80" width="64" height="64" fill="none" class="empty-icon">
              <circle cx="40" cy="40" r="28" stroke="#c0c4cc" stroke-width="2" />
              <path d="M30 35h20M30 45h14" stroke="#c0c4cc" stroke-width="2" stroke-linecap="round" />
            </svg>
            <p class="empty-text">开始一段新的对话</p>
          </div>
        </div>
      </div>

      <!-- ════════════════════════ 区域 4：底部输入栏 ════════════════════════ -->
      <div class="input-bar-container">
        <div class="input-bar">
          <!-- 加号图标 -->
          <button class="input-tool-btn" title="附加工具">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="var(--color-primary)">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
          </button>

          <!-- 输入框 -->
          <input
            v-model="inputText"
            type="text"
            class="input-field"
            placeholder="文档、语言……(功能)"
            @keyup.enter="sendMessage"
          />

          <!-- 发送按钮 -->
          <button
            class="send-btn"
            :disabled="!inputText.trim()"
            @click="sendMessage"
            title="发送"
          >
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
          <!-- 新建对话 -->
          <button class="panel-action-btn" @click="handleNewConversation">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            <span>新建对话</span>
          </button>

          <!-- 最近对话 -->
          <div class="panel-section">
            <h4 class="section-title">最近对话</h4>
            <ul class="conversation-list">
              <li
                v-for="conv in conversations"
                :key="conv.id"
                class="conversation-item"
                @click="handleSelectConversation(conv)"
              >
                <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" class="conv-icon">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                </svg>
                <span>{{ conv.title }}</span>
              </li>
            </ul>
          </div>

          <!-- 对话记录（可折叠） -->
          <div class="panel-section">
            <div class="section-title collapsible" @click="toggleHistoryDropdown">
              <span>对话记录</span>
              <svg
                viewBox="0 0 20 20"
                width="14"
                height="14"
                fill="currentColor"
                class="chevron"
                :class="{ rotated: showHistoryDropdown }"
              >
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
            <Transition name="dropdown">
              <ul v-if="showHistoryDropdown" class="conversation-list">
                <li
                  v-for="conv in conversations"
                  :key="'hist-' + conv.id"
                  class="conversation-item"
                  @click="handleSelectConversation(conv)"
                >
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" class="conv-icon">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
                  </svg>
                  <span>{{ conv.title }}</span>
                </li>
              </ul>
            </Transition>
          </div>
        </div>
        <!-- 滚轮指示 -->
        <div class="panel-scroll-hint">滚轮</div>
      </div>
    </Transition>

    <!-- ════════════════════════ 登录弹窗 ════════════════════════ -->
    <Transition name="panel">
      <div v-if="showLoginDialog" class="login-overlay" @click.self="handleLoginCancel">
        <div class="login-dialog">
          <div class="login-dialog-header">
            <h3 class="login-dialog-title">登录</h3>
            <button class="panel-close" @click="handleLoginCancel">×</button>
          </div>
          <div class="login-dialog-body">
            <div class="login-field">
              <label>用户名</label>
              <input
                v-model="loginForm.username"
                type="text"
                placeholder="请输入用户名"
              />
            </div>
            <div class="login-field">
              <label>密码</label>
              <input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                @keyup.enter="handleLoginSubmit"
              />
            </div>
            <p v-if="loginError" class="login-error">{{ loginError }}</p>
            <button
              class="login-submit-btn"
              :disabled="loginLoading"
              @click="handleLoginSubmit"
            >
              {{ loginLoading ? '登录中…' : '登 录' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ════════════════════════ 侧边栏用户弹窗（已登录） ════════════════════════ -->
    <Transition name="sidebar-menu">
      <div v-if="showProfilePanel" class="sidebar-menu-overlay" @click.self="handleCloseProfile">
        <div class="sidebar-menu">
          <div class="sidebar-menu-header">
            <div class="sm-avatar">
              <span>{{ displayName.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="sm-info">
              <span class="sm-name">{{ displayName }}</span>
              <span class="sm-role">{{ userStore.role === 'superadmin' ? '超级管理员' : userStore.role === 'admin' ? '管理员' : '用户' }}</span>
            </div>
          </div>
          <div class="sidebar-menu-body">
            <div class="sm-item" @click="handleLogoutClick">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                <path d="M3 3h8v1.5H4.5v11H11V17H3V3zm11.5 2.5L17 10l-2.5 4.5L13 13.5 15 10l-2-3.5 1.5-1z" />
                <path d="M7 9.25h7.5v1.5H7v-1.5z" />
              </svg>
              <span>退出登录</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ════════════════════════ 退出确认弹窗 ════════════════════════ -->
    <Transition name="panel">
      <div v-if="showLogoutConfirm" class="login-overlay" @click.self="handleLogoutCancel">
        <div class="confirm-dialog">
          <div class="confirm-dialog-body">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="var(--color-warning, #e6a23c)">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <p class="confirm-text">确定退出当前账号？</p>
          </div>
          <div class="confirm-dialog-footer">
            <button class="confirm-btn cancel" @click="handleLogoutCancel">取消</button>
            <button class="confirm-btn confirm" @click="handleLogoutConfirm">确定</button>
          </div>
        </div>
      </div>
    </Transition>
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

/* ── 顶部校徽标题区 ── */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-xl, 24px) var(--spacing-lg, 16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
  min-height: 80px;
}

.brand-logo {
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.brand-text.collapsed {
  opacity: 0;
  width: 0;
}

.brand-name {
  font-size: var(--font-size-base, 14px);
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

.brand-en {
  font-size: var(--font-size-xs, 12px);
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.5px;
}

/* ── 功能导航板块 ── */
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
  position: relative;
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

.nav-icon {
  flex-shrink: 0;
}

.nav-label {
  transition: opacity 0.2s ease;
}

.nav-label.hidden {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

/* 底色标识 — 知识库管理右侧的白点 */
.nav-badge {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.8;
}

/* ── 底部用户栏（整行可点击） ── */
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

.sidebar-user-row:hover {
  background: rgba(255, 255, 255, 0.08);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.8);
}

.avatar-text {
  font-size: var(--font-size-base, 14px);
  font-weight: 700;
  color: #fff;
}

.user-display-name {
  flex: 1;
  font-size: var(--font-size-sm, 13px);
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-arrow {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.2s ease;
}

.sidebar-user-row:hover .user-arrow {
  color: rgba(255, 255, 255, 0.7);
}

/* ════════════════════════ 右侧主容器 ════════════════════════ */
.main-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  transition: margin-left 0.3s ease;
}

/* ════════════════════════ 区域 2：顶部全局操作栏 ════════════════════════ */
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

.top-bar-left,
.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.top-bar-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  color: var(--color-text-secondary, #606266);
  transition: all 0.2s ease;
}

.top-bar-btn:hover {
  background: var(--color-bg, #f5f7fa);
  color: var(--color-text, #303133);
}

/* ════════════════════════ 区域 5：中间对话展示区 ════════════════════════ */
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

.message-row {
  display: flex;
  gap: var(--spacing-md, 12px);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-row.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs, 12px);
  font-weight: 700;
  flex-shrink: 0;
}

.message-ai .message-avatar {
  background: rgba(3, 84, 167, 0.15);
  color: #0354a7;
}

.message-user .message-avatar {
  background: var(--color-primary, #409eff);
  color: #fff;
}

.message-bubble {
  max-width: 70%;
  padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  border-radius: var(--radius-xl, 12px);
  font-size: var(--font-size-base, 14px);
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.message-ai .message-bubble {
  background: rgba(3, 84, 167, 0.08);
  border: 1px solid rgba(3, 84, 167, 0.12);
  color: var(--color-text, #303133);
  border-bottom-left-radius: 4px;
}

.message-user .message-bubble {
  background: var(--color-primary, #409eff);
  color: #fff;
  border-bottom-right-radius: 4px;
}

/* ── 空状态 ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--color-placeholder, #c0c4cc);
}

.empty-icon {
  margin-bottom: var(--spacing-lg, 16px);
}

.empty-text {
  font-size: var(--font-size-lg, 16px);
}

/* ════════════════════════ 区域 4：底部输入栏 ════════════════════════ */
.input-bar-container {
  flex-shrink: 0;
  padding: var(--spacing-lg, 16px) var(--spacing-xxl, 32px);
  background: var(--color-bg, #f5f7fa);
}

.input-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  max-width: 800px;
  margin: 0 auto;
  background: #e8f0fe;
  border-radius: 50px;
  padding: 4px 4px 4px var(--spacing-lg, 16px);
  border: 1px solid rgba(3, 84, 167, 0.15);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-bar:focus-within {
  border-color: var(--color-primary, #409eff);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
}

.input-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.input-tool-btn:hover {
  background: rgba(64, 158, 255, 0.12);
}

.input-field {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: var(--font-size-base, 14px);
  color: var(--color-text, #303133);
  padding: var(--spacing-sm, 8px) 0;
  min-height: 24px;
}

.input-field::placeholder {
  color: var(--color-placeholder, #c0c4cc);
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary, #409eff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: var(--color-primary-dark, #3a8ee6);
}

.send-btn:disabled {
  background: var(--color-border, #e4e7ed);
  cursor: not-allowed;
  color: var(--color-placeholder, #c0c4cc);
}

/* ════════════════════════ 区域 3：右侧对话悬浮弹窗 ════════════════════════ */
.float-panel {
  position: fixed;
  top: 56px;
  right: var(--spacing-lg, 16px);
  width: 300px;
  max-height: calc(100vh - 80px);
  background: rgba(3, 84, 167, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: var(--radius-lg, 8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg, 16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.panel-title {
  font-size: var(--font-size-lg, 16px);
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.panel-close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 20px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.panel-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg, 16px);
}

/* 新建对话按钮 */
.panel-action-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  width: 100%;
  padding: var(--spacing-md, 12px);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-base, 6px);
  color: #fff;
  font-size: var(--font-size-base, 14px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.panel-action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 分组标题 */
.panel-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

.section-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title.collapsible {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: var(--spacing-xs, 4px) 0;
}

.section-title.collapsible:hover {
  color: rgba(255, 255, 255, 0.9);
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron.rotated {
  transform: rotate(180deg);
}

/* 对话列表 */
.conversation-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--font-size-sm, 13px);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.conversation-item:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.conv-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

/* 滚轮指示 */
.panel-scroll-hint {
  text-align: center;
  padding: var(--spacing-xs, 4px) 0 var(--spacing-sm, 8px);
  font-size: var(--font-size-xs, 12px);
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
  letter-spacing: 2px;
}

/* ════════════════════════ 登录弹窗 ════════════════════════ */
.login-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  backdrop-filter: blur(2px);
}

.login-dialog {
  width: 380px;
  background: #fff;
  border-radius: var(--radius-xl, 12px);
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
  overflow: hidden;
  animation: dialogIn 0.25s ease;
}

@keyframes dialogIn {
  from { opacity: 0; transform: scale(0.92) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.login-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg, 16px) var(--spacing-xl, 24px);
  border-bottom: 1px solid var(--color-border, #e4e7ed);
}

.login-dialog-title {
  margin: 0;
  font-size: var(--font-size-lg, 16px);
  font-weight: 700;
  color: var(--color-text, #303133);
}

.login-dialog-body {
  padding: var(--spacing-xl, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg, 16px);
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
}

.login-field label {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--color-text-secondary, #606266);
}

.login-field input {
  height: 40px;
  padding: 0 var(--spacing-md, 12px);
  border: 1px solid var(--color-border, #e4e7ed);
  border-radius: var(--radius-base, 6px);
  font-size: var(--font-size-base, 14px);
  outline: none;
  transition: border-color 0.2s ease;
}

.login-field input:focus {
  border-color: var(--color-primary, #409eff);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
}

.login-error {
  margin: 0;
  font-size: var(--font-size-sm, 13px);
  color: var(--color-danger, #f56c6c);
  padding: var(--spacing-sm, 8px);
  background: rgba(245, 108, 108, 0.08);
  border-radius: var(--radius-sm, 4px);
}

.login-submit-btn {
  height: 42px;
  border: none;
  border-radius: var(--radius-base, 6px);
  background: var(--color-primary, #409eff);
  color: #fff;
  font-size: var(--font-size-base, 14px);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 4px;
}

.login-submit-btn:hover:not(:disabled) {
  background: var(--color-primary-dark, #3a8ee6);
}

.login-submit-btn:disabled {
  background: var(--color-border, #e4e7ed);
  cursor: not-allowed;
}

/* ════════════════════════ 侧边栏用户弹窗 ════════════════════════ */
.sidebar-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
}

.sidebar-menu {
  position: fixed;
  bottom: 72px;
  left: var(--spacing-md, 12px);
  width: 220px;
  background: #fff;
  border-radius: var(--radius-lg, 8px);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
  overflow: hidden;
}

.sidebar-menu-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-lg, 16px);
  border-bottom: 1px solid var(--color-border, #e4e7ed);
}

.sm-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg, 16px);
  font-weight: 700;
  color: var(--color-primary, #409eff);
  flex-shrink: 0;
}

.sm-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.sm-name {
  font-size: var(--font-size-base, 14px);
  font-weight: 600;
  color: var(--color-text, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm-role {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-info, #909399);
}

.sidebar-menu-body {
  padding: var(--spacing-sm, 8px);
}

.sm-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-md, 12px);
  border-radius: var(--radius-base, 6px);
  cursor: pointer;
  font-size: var(--font-size-sm, 13px);
  color: var(--color-danger, #f56c6c);
  transition: background 0.2s ease;
}

.sm-item:hover {
  background: rgba(245, 108, 108, 0.06);
}

/* ════════════════════════ 退出确认弹窗 ════════════════════════ */
.confirm-dialog {
  width: 320px;
  background: #fff;
  border-radius: var(--radius-xl, 12px);
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
  overflow: hidden;
  animation: dialogIn 0.25s ease;
}

.confirm-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-xxl, 32px) var(--spacing-xl, 24px);
}

.confirm-text {
  margin: 0;
  font-size: var(--font-size-base, 14px);
  color: var(--color-text, #303133);
  text-align: center;
  line-height: 1.5;
}

.confirm-dialog-footer {
  display: flex;
  gap: var(--spacing-md, 12px);
  padding: 0 var(--spacing-xl, 24px) var(--spacing-xl, 24px);
}

.confirm-btn {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-base, 6px);
  font-size: var(--font-size-base, 14px);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.confirm-btn.cancel {
  background: var(--color-bg, #f5f7fa);
  color: var(--color-text-secondary, #606266);
}

.confirm-btn.cancel:hover {
  background: var(--color-border, #e4e7ed);
}

.confirm-btn.confirm {
  background: var(--color-danger, #f56c6c);
  color: #fff;
}

.confirm-btn.confirm:hover {
  background: #e05050;
}

/* ════════════════════════ 过渡动画 ════════════════════════ */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.25s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.96);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  max-height: 0;
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  max-height: 300px;
}

/* ════════════════════════ 侧边栏菜单动画 ════════════════════════ */
.sidebar-menu-enter-active,
.sidebar-menu-leave-active {
  transition: all 0.2s ease;
}

.sidebar-menu-enter-from,
.sidebar-menu-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* ════════════════════════ 滚动条美化 ════════════════════════ */
.content-area::-webkit-scrollbar,
.panel-body::-webkit-scrollbar {
  width: 6px;
}

.content-area::-webkit-scrollbar-track {
  background: transparent;
}

.content-area::-webkit-scrollbar-thumb {
  background: var(--color-border, #e4e7ed);
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}
</style>
