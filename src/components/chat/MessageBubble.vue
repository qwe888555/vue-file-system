<script setup lang="ts">
// ── 消息气泡组件 ──
// 组合：头像 + Markdown 内容 / SSE 流式渲染 + 引用 + 点赞/点踩
import { computed } from 'vue'
import type { Message, KnowledgeFile, UserRole } from '@/types'
import MarkdownViewer from './MarkdownViewer.vue'
import SseRenderer from './SseRenderer.vue'
import ReferencesPopover from './ReferencesPopover.vue'

const props = defineProps<{
  message: Message
  /** SSE 专用：是否正在流式输出 */
  streaming?: boolean
  /** SSE 专用：当前累积文本 */
  streamContent?: string
  /** 用户角色（用于权限过滤引用） */
  userRole?: UserRole
}>()

const emit = defineEmits<{
  feedback: [messageId: number, type: 'like' | 'dislike']
  retry: []
}>()

const isUser = computed(() => props.message.role === 'user')
const displayName = computed(() => isUser.value ? '我' : 'AI')
const hasReferences = computed(() => {
  return !isUser.value && (props.message.references?.length ?? 0) > 0
})
const isStreaming = computed(() => props.streaming && !isUser.value)

function handleLike() {
  if (props.message.feedback === 'like') return
  emit('feedback', props.message.id, 'like')
}

function handleDislike() {
  if (props.message.feedback === 'dislike') return
  emit('feedback', props.message.id, 'dislike')
}
</script>

<template>
  <div class="message-bubble" :class="{ 'is-user': isUser, 'is-ai': !isUser }">
    <!-- 头像 -->
    <div class="msg-avatar" :class="{ 'msg-avatar-ai': !isUser }">
      <span>{{ isUser ? displayName.charAt(0).toUpperCase() : 'AI' }}</span>
    </div>

    <!-- 内容主体 -->
    <div class="msg-body">
      <!-- 角色标识 -->
      <div class="msg-role-label">{{ isUser ? '你' : '智能助手' }}</div>

      <!-- 内容区 -->
      <div class="msg-content" :class="{ 'streaming': isStreaming }">
        <!-- SSE 流式渲染 -->
        <SseRenderer
          v-if="isStreaming"
          :content="streamContent || ''"
          :streaming="true"
        />
        <!-- 静态 Markdown 渲染 -->
        <MarkdownViewer
          v-else
          :content="message.content"
        />
      </div>

      <!-- 引用文件（仅 AI 消息） -->
      <ReferencesPopover
        v-if="hasReferences"
        :references="(message.references as KnowledgeFile[]) || []"
        :user-role="userRole"
      />

      <!-- 反馈按钮（仅 AI 消息完成时） -->
      <div v-if="!isUser && !streaming" class="msg-actions">
        <button
          class="action-btn"
          :class="{ active: message.feedback === 'like' }"
          @click="handleLike"
          title="有帮助"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M4 7v6H2V7h2zm10-1a1 1 0 01-1 1h-3v4a2 2 0 01-2 2H7l-1-4V7V5a1 1 0 011-1h4.5l.7-1.4A1 1 0 0113 2.5V6z" />
          </svg>
        </button>
        <button
          class="action-btn"
          :class="{ active: message.feedback === 'dislike' }"
          @click="handleDislike"
          title="没有帮助"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M12 9V3h2v6h-2zm-10 1a1 1 0 011-1h3V5a2 2 0 012-2h1l1 4v2v2a1 1 0 01-1 1H4.5l-.7 1.4A1 1 0 013 13.5V10z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-bubble {
  display: flex;
  gap: var(--spacing-md, 12px);
  animation: msgFadeIn 0.3s ease;
}

@keyframes msgFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-bubble.is-user {
  flex-direction: row-reverse;
}

/* 头像 */
.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs, 12px);
  font-weight: 700;
  flex-shrink: 0;
  background: var(--color-primary, #409eff);
  color: #fff;
}

.msg-avatar-ai {
  background: rgba(3, 84, 167, 0.15);
  color: #0354a7;
}

/* 主体 */
.msg-body {
  max-width: 70%;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.is-user .msg-body {
  align-items: flex-end;
}

.msg-role-label {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-info, #909399);
  margin-bottom: 2px;
}

.is-user .msg-role-label {
  text-align: right;
}

.msg-content {
  padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  border-radius: var(--radius-xl, 12px);
  font-size: var(--font-size-base, 14px);
  line-height: 1.6;
}

.is-ai .msg-content {
  background: rgba(3, 84, 167, 0.08);
  border: 1px solid rgba(3, 84, 167, 0.12);
  color: var(--color-text, #303133);
  border-bottom-left-radius: 4px;
}

.is-user .msg-content {
  background: var(--color-primary, #409eff);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.is-user .msg-content :deep(p) {
  margin: 0;
  color: #fff;
}

/* 反馈按钮 */
.msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-bubble:hover .msg-actions {
  opacity: 1;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-text-secondary, #606266);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--color-bg, #f5f7fa);
}

.action-btn.active {
  color: var(--color-primary, #409eff);
}
</style>
