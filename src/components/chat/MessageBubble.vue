<script setup lang="ts">
// ── 消息气泡组件（豆包风格）──
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Message, KnowledgeFile, UserRole } from '@/types'
import MarkdownViewer from './MarkdownViewer.vue'
import SseRenderer from './SseRenderer.vue'
import ReferencesPopover from './ReferencesPopover.vue'
import { previewDocApi } from '@/api/knowledge'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

const props = defineProps<{
  message: Message
  streaming?: boolean
  streamContent?: string
  suggestedQuestions?: string[]
  userRole?: UserRole
}>()

const emit = defineEmits<{
  feedback: [messageId: number, type: 'like' | 'dislike' | 'none']
  quickQuestion: [text: string]
}>()

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.streaming && !isUser.value)
const hasReferences = computed(() => !isUser.value && (props.message.references?.length ?? 0) > 0)
const hasSuggested = computed(() => !isUser.value && (props.suggestedQuestions?.length ?? 0) > 0)

// 预览对话框状态（用于消息正文中的知识库文档链接）
const showPreview = ref(false)
const previewFileName = ref('')
const previewContent = ref('')
const isMarkdownPreview = ref(false)
const rawMarkdownContent = ref('')
const previewFileUrl = ref('')
const isOfficePreview = ref(false)

// 点击已选中的按钮 = 取消反馈（rating: none）；点击另一个按钮 = 切换
function handleLike() {
  emit('feedback', props.message.id, props.message.feedback === 'like' ? 'none' : 'like')
}
function handleDislike() {
  emit('feedback', props.message.id, props.message.feedback === 'dislike' ? 'none' : 'dislike')
}

/** 智能检测文本是否为 Markdown */
function isLikelyMarkdown(text: string): boolean {
  if (!text || text.length < 10) return false
  const patterns = [
    /^#{1,6}\s/m, /\*\*[^*]+\*\*/, /^>\s/m, /^[-*+]\s/m,
    /^\|.+\|$/m, /```/, /`[^`]+`/, /!\[[^\]]*\]\(/, /\[[^\]]+\]\(/,
  ]
  return patterns.some((p) => p.test(text))
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/** 处理 Markdown 内容中知识库文档链接的点击事件 */
async function handleDocLinkClick(docId: number, title: string) {
  previewFileName.value = title
  previewContent.value = ''
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''
  previewFileUrl.value = ''
  isOfficePreview.value = false
  showPreview.value = true

  try {
    const result = await previewDocApi(docId)
    const fileExtension = title.split('.').pop()?.toLowerCase() || ''
    const isMarkdownFile = fileExtension === 'md' || fileExtension === 'markdown' || result.preview_type === 'markdown'

    if (result.content && result.content.startsWith('http')) {
      if (fileExtension === 'pdf') {
        previewFileUrl.value = result.content
      } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'wps', 'et', 'dps'].includes(fileExtension)) {
        previewFileUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(result.content)}`
        isOfficePreview.value = true
      } else {
        try {
          const response = await fetch(result.content)
          const text = await response.text()
          if (isMarkdownFile || isLikelyMarkdown(text)) {
            isMarkdownPreview.value = true
            rawMarkdownContent.value = text
          } else {
            previewContent.value = `<pre style="white-space:pre-wrap;word-break:break-word;font-family:Consolas,monospace;font-size:13px;margin:0;">${escapeHtml(text)}</pre>`
          }
        } catch {
          previewContent.value = '<div style="text-align:center;padding:40px;color:#909399;">无法查看文件内容</div>'
        }
      }
    } else if (result.content) {
      if (isMarkdownFile || isLikelyMarkdown(result.content)) {
        isMarkdownPreview.value = true
        rawMarkdownContent.value = result.content
      } else {
        previewContent.value = `<pre style="white-space:pre-wrap;word-break:break-word;font-family:Consolas,monospace;font-size:13px;margin:0;">${escapeHtml(result.content)}</pre>`
      }
    } else {
      previewContent.value = '<div style="text-align:center;padding:40px;color:#909399;">文件内容为空</div>'
    }
  } catch (error) {
    console.error('预览文件失败:', error)
    previewContent.value = '<div style="text-align:center;padding:40px;color:#f56c6c;">预览失败，请重试</div>'
  }
}

function closePreview() {
  if (previewFileUrl.value) {
    URL.revokeObjectURL(previewFileUrl.value)
    previewFileUrl.value = ''
  }
  showPreview.value = false
}

/** 下载知识库文档 */
async function handleDocDownload(docId: number, title: string) {
  const fileName = title || `文档${docId}`
  try {
    const token = userStore.token
    const response = await fetch(`/api/knowledge/docs/${docId}/download/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error(`下载失败 (${response.status})`)

    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const json = await response.json()
      const fileUrl = json.url || json.file_url || json.fileUrl || json.download_url
      if (!fileUrl) throw new Error('未获取到下载地址')
      try {
        const ossRes = await fetch(fileUrl)
        if (ossRes.ok) {
          downloadBlob(await ossRes.blob(), fileName)
          return
        }
      } catch {
        // CORS 不通，回退到新窗口打开
      }
      window.open(fileUrl, '_blank')
      return
    }
    downloadBlob(await response.blob(), fileName)
    ElMessage.success('下载已开始')
  } catch (error: any) {
    console.error('下载文件失败:', error)
    ElMessage.error(error.message || '下载文件失败')
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
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
        <SseRenderer v-if="isStreaming" :content="streamContent || ''" :streaming="true" @doc-link-click="handleDocLinkClick" @doc-download="handleDocDownload" />
        <!-- Markdown 静态 -->
        <MarkdownViewer v-else :content="message.content" @doc-link-click="handleDocLinkClick" @doc-download="handleDocDownload" />
      </div>

      <!-- 引用 -->
      <ReferencesPopover
        v-if="hasReferences"
        :references="(message.references as KnowledgeFile[]) || []"
        :user-role="userRole"
      />

      <!-- 追问建议 -->
      <div v-if="hasSuggested" class="msg-suggested">
        <button
          v-for="(q, idx) in suggestedQuestions"
          :key="idx"
          class="suggested-btn"
          @click="emit('quickQuestion', q)"
        >{{ q }}</button>
      </div>

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

    <!-- 文档预览对话框（用于消息正文中的知识库文档链接） -->
    <Teleport to="body">
      <el-dialog
        v-model="showPreview"
        :title="previewFileName"
        width="800px"
        top="5vh"
        append-to-body
        @close="closePreview"
      >
        <div class="msg-preview-content">
          <iframe v-if="isOfficePreview" class="msg-preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
          <iframe v-else-if="previewFileUrl && previewFileName.endsWith('.pdf')" class="msg-preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
          <MarkdownViewer v-else-if="isMarkdownPreview" :content="rawMarkdownContent" class="msg-preview-markdown" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-else v-html="previewContent" class="msg-preview-text"></div>
        </div>
        <template #footer>
          <el-button @click="showPreview = false">关闭</el-button>
        </template>
      </el-dialog>
    </Teleport>
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
  margin-left: 0;
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
  background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-dark, #337ecc));
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
  position: relative;
  width: 44px;
  height: 34px;
  background: #f7f7f7;
  border-radius: 17px;
}
.fb-like::before { content: ""; position: absolute; inset: -5px 0; }

/* 点踩：纯图标，无底板 */
.fb-dislike {
  position: relative;
  width: 34px;
  height: 34px;
}
.fb-dislike::before { content: ""; position: absolute; inset: -5px; }

.fb-like:hover { color: #409eff; background: #eef4ff; }
.fb-like.active { color: #409eff; background: #e8f0fe; }

/* 点踩：纯图标，无底板 */
.fb-dislike {
  width: 34px;
  height: 34px;
}

.fb-dislike:hover { color: #409eff; }
.fb-dislike.active { color: #409eff; }

/* 追问建议按钮 */
.msg-suggested {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.suggested-btn {
  padding: 6px 14px;
  background: #f0f4ff;
  border: 1px solid #dbe4f5;
  border-radius: 16px;
  font-size: 13px;
  color: #2563eb;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.suggested-btn:hover {
  background: #dbe4f5;
  border-color: #2563eb;
}

/* 预览对话框样式 */
.msg-preview-content {
  max-height: 60vh;
  overflow-y: auto;
}

.msg-preview-iframe {
  width: 100%;
  height: 60vh;
  border: none;
}

.msg-preview-markdown {
  font-size: 14px;
  color: #303133;
  padding: 4px 0;
}

.msg-preview-text {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
}
</style>
