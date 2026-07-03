<script setup lang="ts">
// ── 消息气泡组件（豆包风格）──
import { computed } from 'vue'
import type { Message, KnowledgeFile, UserRole } from '@/types'
import MarkdownViewer from './MarkdownViewer.vue'
import SseRenderer from './SseRenderer.vue'
import ReferencesPopover from './ReferencesPopover.vue'

const props = defineProps<{
  message: Message
  streaming?: boolean
  streamContent?: string
  userRole?: UserRole
}>()

const emit = defineEmits<{
  feedback: [messageId: number, type: 'like' | 'dislike']
}>()

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.streaming && !isUser.value)
const hasReferences = computed(() => !isUser.value && (props.message.references?.length ?? 0) > 0)

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
  <div class="msg-row" :class="{ 'msg-row-user': isUser, 'msg-row-ai': !isUser }">
    <!-- AI 头像 -->
    <div v-if="!isUser" class="msg-avatar">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    </div>

    <!-- 内容 -->
    <div class="msg-content-area">
      <div
        class="msg-bubble"
        :class="{ 'msg-bubble-user': isUser, 'msg-bubble-ai': !isUser }"
      >
        <!-- SSE 流式 -->
        <SseRenderer v-if="isStreaming" :content="streamContent || ''" :streaming="true" />
        <!-- Markdown 静态 -->
        <MarkdownViewer v-else :content="message.content" />
      </div>

      <!-- 引用 -->
      <ReferencesPopover
        v-if="hasReferences"
        :references="(message.references as KnowledgeFile[]) || []"
        :user-role="userRole"
      />

      <!-- 反馈（仅 AI 已完成消息） -->
      <div v-if="!isUser && !streaming && message.content" class="msg-feedback">
        <button
          class="fb-btn"
          :class="{ active: message.feedback === 'like' }"
          @click="handleLike"
          title="有帮助"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M4 7v6H2V7h2zm10-1a1 1 0 01-1 1h-3v4a2 2 0 01-2 2H7l-1-4V7V5a1 1 0 011-1h4.5l.7-1.4A1 1 0 0113 2.5V6z"/>
          </svg>
        </button>
        <button
          class="fb-btn"
          :class="{ active: message.feedback === 'dislike' }"
          @click="handleDislike"
          title="没有帮助"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M12 9V3h2v6h-2zm-10 1a1 1 0 011-1h3V5a2 2 0 012-2h1l1 4v2v2a1 1 0 01-1 1H4.5l-.7 1.4A1 1 0 013 13.5V10z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-row {
  display: flex;
  gap: 12px;
  animation: msgIn 0.3s ease;
}
@keyframes msgIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.msg-row-user {
  flex-direction: row-reverse;
}

/* AI 头像 */
.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #409eff;
  flex-shrink: 0;
  margin-top: 4px;
}

/* 内容区域 */
.msg-content-area {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.msg-row-user .msg-content-area {
  align-items: flex-end;
}

/* 气泡 */
.msg-bubble {
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.8;
  word-break: break-word;
}

.msg-bubble-user {
  background: #409eff;
  color: #fff;
  border-radius: 18px;
  border-bottom-right-radius: 4px;
}

.msg-bubble-ai {
  background: #f0f7ff;
  color: #303133;
  border-radius: 18px;
  border-bottom-left-radius: 4px;
}

/* 引用 */
.msg-row-ai .msg-content-area :deep(.refs-popover) {
  margin-top: 2px;
}

/* 反馈按钮 */
.msg-feedback {
  display: flex;
  gap: 2px;
  padding: 2px 0;
  opacity: 0;
  transition: opacity 0.2s;
}
.msg-row:hover .msg-feedback { opacity: 1; }

.fb-btn {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer; color: #aeaeb2;
  transition: all 0.15s;
}
.fb-btn:hover { background: rgba(64,158,255,0.08); color: #409eff; }
.fb-btn.active { color: #409eff; }
</style>
