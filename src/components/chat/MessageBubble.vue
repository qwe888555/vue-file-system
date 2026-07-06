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
        <button class="fb-btn fb-like" :class="{ active: message.feedback === 'like' }" @click="handleLike" title="有帮助">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 9v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-6a1 1 0 011-1h2z" />
            <path d="M7 9l3-4a2 2 0 012 2v2h5.5a1.5 1.5 0 011.5 1.5v.5l-1.5 5a2 2 0 01-2 1.5H7" />
          </svg>
        </button>
        <button class="fb-btn fb-dislike" :class="{ active: message.feedback === 'dislike' }" @click="handleDislike" title="没有帮助">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 15V7a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2z" />
            <path d="M17 15l-3 4a2 2 0 01-2-2v-2H6.5A1.5 1.5 0 015 13.5V13l1.5-5a2 2 0 012-1.5H17" />
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
.msg-row-user {
  flex-direction: row-reverse;
}

/* AI 气泡整体向左收窄一点 */
.msg-row-ai {
  margin-left: -150px;
  padding-right: 60px;
}
.msg-row-ai .msg-content-area {
  max-width: 85%;
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
  padding: 14px 20px;
  font-size: 15px;
  line-height: 1.75;
  word-break: break-word;
}

.msg-bubble-user {
  background: linear-gradient(135deg, #409eff, #3a8ee6);
  color: #fff;
  border-radius: 20px;
  border-bottom-right-radius: 4px;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
}

.msg-bubble-ai {
  background: #f7f8fa;
  color: #2c3e50;
  border-radius: 20px;
  border-bottom-left-radius: 4px;
  border: 1px solid #eef0f2;
}

/* 引用 */
.msg-row-ai .msg-content-area :deep(.refs-popover) {
  margin-top: 2px;
}

/* 反馈按钮 */
.msg-feedback {
  display: flex;
  gap: 16px;
  padding: 6px 0;
  align-items: center;
}

.fb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  background: none;
  border: none;
}

/* 点赞：浅灰圆角底板 */
.fb-like {
  width: 44px;
  height: 34px;
  background: #f7f7f7;
  border-radius: 17px;
}

.fb-like:hover { color: #409eff; background: #eef4ff; }
.fb-like.active { color: #409eff; background: #e8f0fe; }

/* 点踩：纯图标，无底板 */
.fb-dislike {
  width: 34px;
  height: 34px;
}

.fb-dislike:hover { color: #409eff; }
.fb-dislike.active { color: #409eff; }
</style>
