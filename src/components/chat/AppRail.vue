<script setup lang="ts">
// ── 问答页左侧常驻 rail（64px 收起态 + hover 浮层）──
// 对应演示方案 Q1B/Q9A：主导航常驻 rail，悬停浮层显示菜单文字；
// 原顶栏「退出问答」（Q2A）移除后，出口统一交给本 rail。
// 菜单数据与 Layout 侧边栏同源（permissionMenus，按角色动态过滤）。

import { computed, ref, onMounted, onUnmounted } from 'vue'
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
import { ElMessageBox } from 'element-plus'
import PersonalCenter from '@/components/common/PersonalCenter.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const permissionStore = usePermissionStore()
const chatUi = useChatUiStore()

const isAdmin = computed(() => isAdminRole(userStore.role))

// 菜单图标字符串 → 组件映射（与 Layout 侧边栏一致）
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

// 当前路由高亮（rail 仅在问答页可见，命中即高亮对应项）
const activePath = computed(() => {
  const matched = items.value.find((i) => route.path.startsWith(i.path))
  return matched ? matched.path : route.path
})

// 激活项索引 → 指示条 translateY（每项 48px 高 + 4px gap = 52px）
const activeIndex = computed(() =>
  items.value.findIndex((i) => i.path === activePath.value),
)
const indicatorY = computed(() =>
  activeIndex.value >= 0 ? activeIndex.value * 52 : 0,
)

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
  } catch {
    // 取消操作
  }
}

// 点击 rail 外部关闭用户浮层
function onDocMousedown(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (!t.closest('.rail-user')) showUserMenu.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocMousedown))
onUnmounted(() => document.removeEventListener('mousedown', onDocMousedown))
</script>

<template>
  <nav class="app-rail" aria-label="主导航">
    <!-- Logo（校徽 · 浅蓝底蓝徽，下边距对齐 Layout 菜单起点 85px） -->
    <div class="rail-logo" title="成都东软学院">
      <img :src="sealBlue" alt="校徽" />
    </div>

    <!-- 顶部空白带装饰（点阵水印，两端渐隐） -->
    <div class="rail-deco" aria-hidden="true" />

    <!-- 主导航（悬停浮层显示文字，问答项后台生成完毕亮红点） -->
    <div class="rail-menu">
      <!-- 激活态滑动指示条：沿轨道平滑滑动到当前激活项 -->
      <div
        v-if="activeIndex >= 0"
        class="rail-indicator"
        :style="{ transform: `translateY(${indicatorY}px)` }"
      />
      <button
        v-for="item in items"
        :key="item.path"
        class="rail-item"
        :class="{ 'is-active': activePath === item.path }"
        :aria-label="item.label"
        :title="item.label"
        @click="router.push(item.path)"
      >
        <el-icon :size="20"><component :is="item.icon" /></el-icon>
        <span v-if="item.path === '/chat' && chatUi.unread" class="badge-dot" />
        <span class="rail-pop">{{ item.label }}</span>
      </button>
    </div>

    <!-- 用户 -->
    <div class="rail-user">
      <button
        class="rail-user-btn"
        :aria-label="displayName"
        :title="displayName"
        @click="showUserMenu = !showUserMenu"
      >
        {{ avatarChar }}
      </button>
      <Transition name="rail-pop">
        <div v-if="showUserMenu" class="rail-user-pop" @click.stop>
          <div class="rup-head">
            <div class="rup-avatar">{{ avatarChar }}</div>
            <div>
              <div class="rup-name">{{ displayName }}</div>
              <div class="rup-role">{{ roleLabel }}</div>
            </div>
          </div>
          <button class="rup-item" @click="openProfile">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
            个人中心
          </button>
          <button class="rup-item rup-logout" @click="handleLogout">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            退出登录
          </button>
        </div>
      </Transition>
    </div>

    <PersonalCenter v-if="showPersonalCenter" @close="showPersonalCenter = false" />
  </nav>
</template>

<style scoped>
.app-rail {
  width: 64px;
  flex-shrink: 0;
  height: 100%;
  background: #fff;
  border-right: 1px solid var(--color-border, #e8ecf1);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0 12px;
  z-index: 30;
  position: relative; /* 顶部图案带绝对定位基准 */
}

/* 校徽 logo：10(pad) + 38 + 37 = 85px，菜单起点与 Layout 侧边栏对齐 */
.rail-logo {
  width: 38px;
  height: 38px;
  margin-bottom: 37px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef3fe, #e6edfe);
  border: 1px solid #d9e4f8;
  cursor: default;
}
.rail-logo img {
  width: 76%;
  height: 76%;
  object-fit: contain;
  display: block;
}

/* 顶部空白带装饰（点阵水印，两端渐隐） */
.rail-deco {
  position: absolute;
  top: 50px;
  left: 0;
  width: 64px;
  height: 30px;
  overflow: hidden;
  pointer-events: none;
  background-image: radial-gradient(rgba(64, 158, 255, 0.28) 1.4px, transparent 1.6px);
  background-size: 9px 9px;
  background-position: 4px 4px;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 30%, #000 70%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 30%, #000 70%, transparent);
}

.rail-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
}

/* 激活态滑动指示条：沿轨道平滑滑动到当前激活项 */
.rail-indicator {
  position: absolute;
  left: 0;
  top: 0;
  width: 40px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, #eef3fe, #e6edfe);
  transition: transform 0.42s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
  pointer-events: none;
}

.rail-item {
  position: relative;
  width: 40px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8e95a6;
  transition: background 0.18s ease, color 0.18s ease;
  z-index: 1;
}

.rail-item:hover {
  background: #f0f4fa;
  color: #5a7cf0;
}

.rail-item.is-active {
  color: var(--color-primary-deep, #2563eb);
}

/* hover 浮层提示 */
.rail-pop {
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%) translateX(-6px);
  background: #fff;
  padding: 7px 13px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.08);
  font-size: 13px;
  font-weight: 500;
  color: #1f1f1f;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 50;
}

.rail-item:hover .rail-pop {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

/* 后台生成完毕红点 */
.badge-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger, #f56c6c);
  box-shadow: 0 0 0 2px #fff;
}

/* 用户浮层 */
.rail-user {
  margin-top: auto;
  position: relative;
}

.rail-user-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.15);
  color: var(--color-primary, #409eff);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rail-user-pop {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 10px;
  width: 190px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.08);
  overflow: hidden;
}

.rup-head {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f3f8;
  display: flex;
  gap: 10px;
  align-items: center;
}

.rup-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.15);
  color: var(--color-primary, #409eff);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rup-name {
  font-size: 13px;
  font-weight: 600;
}

.rup-role {
  font-size: 11px;
  color: var(--color-text-secondary, #64748b);
  margin-top: 2px;
}

.rup-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px 14px;
  font-size: 13px;
  color: #1a2332;
  transition: background 0.15s;
  text-align: left;
}

.rup-item:hover {
  background: #f0f4fa;
  color: var(--color-primary-deep, #2563eb);
}

.rup-item svg {
  color: #8e95a6;
}

.rup-item:hover svg {
  color: var(--color-primary-deep, #2563eb);
}

.rup-logout:hover,
.rup-logout:hover svg {
  color: var(--color-danger, #f56c6c);
}

/* 浮层过渡 */
.rail-pop-enter-active,
.rail-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.rail-pop-enter-from,
.rail-pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
