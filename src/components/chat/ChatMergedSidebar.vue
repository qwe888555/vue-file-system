<script setup lang="ts">
// ── 教研问答页合并侧边栏（ChatGPT 风格）──
// 上方：Logo + 6 个导航按钮 + 新建对话
// 下方：对话历史列表
// 替换原来的 AppRail（64px 收起）+ chat-sidebar（对话列表）
// 注意：仅在教研问答页使用，其他页面仍用 Layout/Sidebar.vue

import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Folder,
  ChatLineSquare,
  ChatDotSquare,
  Setting,
  Document,
  OfficeBuilding,
} from '@element-plus/icons-vue'
import sealBlue from '@/assets/images/logo-seal-blue.png'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import { useChatUiStore } from '@/store/chatUi'
import { isAdminRole, ROLE_CONFIG } from '@/config/roles'
import { useChat } from '@/composables/useChat'
import { ElMessageBox } from 'element-plus'
import PersonalCenter from '@/components/common/PersonalCenter.vue'
import SidebarUser from '@/components/common/SidebarUser.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const permissionStore = usePermissionStore()
const chatUi = useChatUiStore()
const chat = useChat()

const isAdmin = computed(() => isAdminRole(userStore.role))

// ── 菜单数据（与 Layout 侧边栏同源 permissionMenus）──
const iconMap: Record<string, Component> = {
  Folder,
  ChatLineSquare,
  ChatDotSquare,
  Setting,
  Document,
  OfficeBuilding,
}
const items = computed(() =>
  permissionStore.permissionMenus.map((item) => ({
    path: item.children?.[0]?.path ?? item.path,
    label: item.title === '智能问答' && isAdmin.value ? '教研问答' : item.title,
    icon: iconMap[item.icon] || Folder,
  })),
)

// 当前路由高亮
const activePath = computed(() => {
  const matched = items.value.find((i) => route.path.startsWith(i.path))
  return matched ? matched.path : route.path
})

// ── 收起 / 展开 ──
const sidebarOpen = defineModel<boolean>('open', { default: true })
function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// ── 用户浮层 ──
const showUserMenu = ref(false)
const showPersonalCenter = ref(false)
const displayName = computed(() => userStore.displayName || '用户')
const roleLabel = computed(() => {
  const role = userStore.role as keyof typeof ROLE_CONFIG | undefined
  if (role && ROLE_CONFIG[role]) return ROLE_CONFIG[role].label
  return userStore.userInfo?.role_display || '用户'
})
const avatarChar = computed(() =>
  (userStore.userInfo?.username || displayName.value).charAt(0).toUpperCase(),
)

function openProfile() {
  showUserMenu.value = false
  showPersonalCenter.value = true
}
async function handleLogout() {
  showUserMenu.value = false
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示')
    userStore.logout()
    router.push('/')
  } catch { /* 取消 */ }
}

// ── 会话操作（从原 ChatHome 提取）──
const renamingId = ref<number | null>(null)
const renameText = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

async function handleNewConversation() {
  await chat.createConversation()
}
function handleSelectConversation(id: number) {
  chat.selectConversation(id)
  // 切回该会话即视为已读，清除其红点
  chatUi.clearConvUnread(id)
}
async function handleDeleteConversation(id: number) {
  try {
    await ElMessageBox.confirm('确定删除这个对话吗？', '提示', { type: 'warning' })
    await chat.deleteConversation(id)
  } catch { /* 取消 */ }
}
function startRename(conv: any) {
  renamingId.value = conv.id
  renameText.value = conv.title || ''
  nextTick(() => renameInput.value?.focus())
}
async function confirmRename(id: number) {
  const title = renameText.value.trim()
  renamingId.value = null
  if (title) await chat.renameConversation(id, title)
}
function cancelRename() { renamingId.value = null }

function onDocMousedown(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (!t.closest('.sidebar-user-area')) showUserMenu.value = false
  // 全局点击空白取消改名
  if (renamingId.value === null) return
  if (t.closest('.conv-rename-input, .conv-rename-confirm, .sidebar-new-chat, .conv-item-edit, .conv-item-icon')) return
  cancelRename()
}

defineExpose({ /* 方便父组件按需调用 */ })

onMounted(() => document.addEventListener('mousedown', onDocMousedown))
onUnmounted(() => document.removeEventListener('mousedown', onDocMousedown))
</script>

<template>
  <aside class="chat-merged-sidebar" :class="{ collapsed: !sidebarOpen }">

    <!-- ═══ 头部：Logo + 折叠按钮 ═══ -->
    <div class="sidebar-head">
      <div class="sidebar-logo-block">
        <img :src="sealBlue" alt="校徽" class="sidebar-logo-img" />
        <div class="sidebar-logo-text">
          <span class="sidebar-logo-title">NeuHub</span>
          <span class="sidebar-logo-sub">资源系统</span>
        </div>
      </div>
      <button class="sidebar-collapse-btn" @click="toggleSidebar" title="收起 / 展开">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
          <path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h14v1.5H3v-1.5z"/>
        </svg>
      </button>
    </div>

    <!-- ═══ 导航区：新建对话 + 6 个模块按钮 ═══ -->
    <div class="sidebar-nav">
      <button class="nav-new-btn" @click="handleNewConversation">
        <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
          <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
        </svg>
        <span>新建对话</span>
      </button>

      <button
        v-for="item in items"
        :key="item.path"
        class="nav-item"
        :class="{ 'is-active': activePath === item.path }"
        @click="router.push(item.path)"
      >
        <el-icon class="nav-icon" :size="18"><component :is="item.icon" /></el-icon>
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.path === '/chat' && chatUi.unread" class="nav-badge-dot" />
      </button>

      <!-- 搜索框（原 ChatHome sidebar 的搜索能力迁移到这里）-->
      <div class="sidebar-search">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z"/>
        </svg>
        <input v-model="chat.searchKeyword.value" type="text" placeholder="搜索对话" />
      </div>
    </div>

    <!-- ═══ 历史区 ═══ -->
    <div class="sidebar-history">
      <div
        v-for="conv in chat.filteredConversations.value"
        :key="conv.id"
        class="conv-item"
        :class="{ active: conv.id === chat.currentConversationId.value, unread: chatUi.unreadConvIds[conv.id] }"
        @click="renamingId !== conv.id && handleSelectConversation(conv.id)"
      >
        <div class="conv-item-icon">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
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
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
            </button>
          </div>
          <span v-else class="conv-item-title">{{ conv.title || '新对话' }}</span>
          <span class="conv-item-time">{{ conv.updatedAt?.slice(5, 10) }}</span>
        </div>
        <button v-if="renamingId !== conv.id" class="conv-item-edit" @click.stop="startRename(conv)" title="重命名">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M12.146.854a.5.5 0 01.708 0l2.292 2.292a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-4 1.5a.5.5 0 01-.64-.64l1.5-4a.5.5 0 01.11-.168l10-10z"/></svg>
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

    <!-- ═══ 用户区 ═══ -->
    <div class="sidebar-user-area" @click.stop>
      <div class="sidebar-user-card" @click="showUserMenu = !showUserMenu">
        <div class="su-avatar">{{ avatarChar }}</div>
        <div class="su-info">
          <div class="su-name">{{ displayName }}</div>
          <div class="su-role">{{ roleLabel }}</div>
        </div>
      </div>
      <Transition name="user-up">
        <div v-if="showUserMenu" class="user-popup">
          <div class="user-popup-item" @click="openProfile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
            个人中心
          </div>
          <div class="user-popup-item user-logout" @click="handleLogout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            退出登录
          </div>
        </div>
      </Transition>
    </div>

    <PersonalCenter v-if="showPersonalCenter" @close="showPersonalCenter = false" />
  </aside>
</template>

<style scoped>
/* ── 容器 ── */
.chat-merged-sidebar {
  width: 220px;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
  position: relative;
  z-index: 20;
  border-right: 1px solid var(--color-border, #e8ecf1);
}
.chat-merged-sidebar.collapsed { width: 0; }

/* ── 头部 Logo ── */
.sidebar-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 12px 10px;
  border-bottom: 1px solid #f0f3f8;
  flex-shrink: 0;
}
.sidebar-logo-block { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sidebar-logo-img {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #eef3fe, #e6edfe);
  padding: 4px;
  flex-shrink: 0;
}
.sidebar-logo-text { display: flex; flex-direction: column; min-width: 0; }
.sidebar-logo-title { font-size: 14px; font-weight: 700; color: #2563eb; letter-spacing: 0.5px; line-height: 1.2; }
.sidebar-logo-sub { font-size: 10px; color: #8e95a6; letter-spacing: 1px; margin-top: 1px; }

.sidebar-collapse-btn {
  width: 26px; height: 26px;
  border-radius: 6px;
  border: 0; background: transparent;
  color: #8e95a6;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.sidebar-collapse-btn:hover { background: #f0f4fa; color: #2563eb; }

/* ── 导航区（新建 + 6 项）── */
.sidebar-nav {
  padding: 10px 10px 8px;
  flex-shrink: 0;
}
.nav-new-btn {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 8px 11px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: 0; border-radius: 9px;
  color: #fff;
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  margin-bottom: 6px;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.18);
  transition: all 0.18s ease;
}
.nav-new-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.26);
}
.nav-new-btn svg { flex-shrink: 0; opacity: 0.9; }

.nav-item {
  display: flex; align-items: center; gap: 9px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 7px;
  background: transparent; border: 0;
  color: #5a6070;
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  text-align: left;
  margin-bottom: 1px;
  transition: background 0.15s, color 0.15s;
  position: relative;
}
.nav-item:hover { background: #f0f4fa; color: #2c3e50; }
.nav-item.is-active {
  background: linear-gradient(135deg, #eef3fe, #e6edfe);
  color: #2563eb;
}
.nav-item.is-active .nav-icon { color: #2563eb; }
.nav-icon { color: #8e95a6; flex-shrink: 0; transition: color 0.15s; }
.nav-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-badge-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #f56c6c;
  box-shadow: 0 0 0 2px #fff;
  flex-shrink: 0;
}

/* ── 搜索框（ChatGPT 风格上方导航末尾）── */
.sidebar-search {
  display: flex; align-items: center; gap: 6px;
  margin: 6px 4px 2px;
  padding: 5px 8px;
  border-radius: 6px;
  background: #f5f7fa;
  color: #8e95a6;
}
.sidebar-search:focus-within {
  background: #fff;
  box-shadow: 0 0 0 1px #d9e4f8;
  color: #5a7cf0;
}
.sidebar-search input {
  flex: 1;
  border: 0; background: transparent;
  font-size: 12px;
  color: #1f1f1f;
  outline: none;
  min-width: 0;
}
.sidebar-search input::placeholder { color: #8e95a6; }

/* ── 历史区 ── */
.sidebar-history {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
  scrollbar-width: thin;
  scrollbar-color: #e4e7ed transparent;
}
.sidebar-history::-webkit-scrollbar { width: 4px; }
.sidebar-history::-webkit-scrollbar-thumb { background: #e4e7ed; border-radius: 2px; }

.conv-item {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #5a6070;
  font-size: 12.5px;
  transition: background 0.12s, color 0.12s;
  position: relative;
  margin-bottom: 1px;
}
.conv-item:hover { background: #f0f4fa; color: #2c3e50; }
.conv-item.active { background: #eff6ff; color: #2563eb; font-weight: 500; }
.conv-item.unread { color: #f56c6c; font-weight: 500; }
.conv-item-icon {
  flex-shrink: 0;
  position: relative;
  width: 14px; height: 14px;
  display: flex; align-items: center; justify-content: center;
  color: inherit;
}
.conv-unread-dot {
  position: absolute;
  top: -1px; right: -3px;
  width: 6px; height: 6px; border-radius: 50%;
  background: #f56c6c;
}
.conv-item-content {
  flex: 1;
  min-width: 0;
  display: flex; align-items: center; gap: 6px;
}
.conv-item-title {
  flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.conv-item-time { font-size: 10px; color: #8e95a6; flex-shrink: 0; }
.conv-item:hover .conv-item-time { display: none; }

.conv-rename-row { display: flex; flex: 1; gap: 4px; align-items: center; }
.conv-rename-input {
  flex: 1;
  border: 1px solid #d9e4f8;
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 12px;
  outline: none;
  min-width: 0;
}
.conv-rename-input:focus { border-color: #2563eb; }
.conv-rename-confirm {
  width: 18px; height: 18px;
  border: 0; border-radius: 4px;
  background: #2563eb; color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.conv-item-edit, .conv-item-del {
  width: 18px; height: 18px;
  border: 0; border-radius: 4px;
  background: transparent;
  color: #8e95a6;
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}
.conv-item:hover .conv-item-edit,
.conv-item:hover .conv-item-del { opacity: 1; }
.conv-item-edit:hover { background: #e0e7f5; color: #2563eb; }
.conv-item-del:hover { background: #fde8e8; color: #f56c6c; }

.sidebar-loading {
  display: flex; justify-content: center; gap: 4px;
  padding: 12px 0;
}
.load-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #c0c4cc;
  animation: pulse 1.2s ease-in-out infinite;
}
.load-dot:nth-child(2) { animation-delay: 0.15s; }
.load-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }

.sidebar-empty {
  text-align: center;
  font-size: 12px;
  color: #8e95a6;
  padding: 24px 0;
}

/* ── 用户区 ── */
.sidebar-user-area {
  position: relative;
  padding: 10px 10px;
  border-top: 1px solid #f0f3f8;
  flex-shrink: 0;
}
.sidebar-user-card {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.sidebar-user-card:hover { background: #f0f4fa; }
.su-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(64, 158, 255, 0.15);
  color: #409eff;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.su-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.su-name {
  font-size: 12.5px; font-weight: 600; color: #1f1f1f;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.su-role { font-size: 10.5px; color: #64748b; }

.user-popup {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 10px; right: 10px;
  background: #fff;
  border-radius: 9px;
  box-shadow:
    0 -2px 16px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  z-index: 50;
}
.user-popup-item {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 14px;
  font-size: 13px;
  color: #1a2332;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.user-popup-item:hover { background: #f0f4fe; color: #2563eb; }
.user-popup-item:first-child { border-bottom: 1px solid #f0f0f0; }
.user-logout:hover { color: #f56c6c; }

.user-up-enter-active, .user-up-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.user-up-enter-from, .user-up-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
