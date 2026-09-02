<script setup lang="ts">
// ── 引用文件弹窗组件 ──
// 功能：展示 AI 回复引用的知识库文件，支持在线预览和下载
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { KnowledgeFile, UserRole } from '@/types'
import { isAdminRole } from '@/config/roles'
import { previewDocApi } from '@/api/knowledge'
import { useUserStore } from '@/store/user'
import MarkdownViewer from './MarkdownViewer.vue'

const props = defineProps<{
  references: KnowledgeFile[]
  userRole?: UserRole
}>()

const userStore = useUserStore()
const visible = ref(false)

// 预览对话框状态
const showPreview = ref(false)
const previewFileName = ref('')
const previewContent = ref('')
const isMarkdownPreview = ref(false)
const rawMarkdownContent = ref('')
const previewFileUrl = ref('')
const isOfficePreview = ref(false)

// 权限判断：管理员角色可见全部引用，普通 user 仅可见公开（status=1）文件
const accessibleFiles = computed(() => {
  if (!props.userRole || isAdminRole(props.userRole)) {
    return props.references
  }
  // user 角色仅显示状态为 1（已发布/公开）的文件
  return props.references.filter(f => f.status === 1)
})

const limited = computed(() => accessibleFiles.value.length < props.references.length)

function toggle() {
  visible.value = !visible.value
}

/**
 * 智能检测文本是否为 Markdown 格式
 */
function isLikelyMarkdown(text: string): boolean {
  if (!text || text.length < 10) return false
  const patterns = [
    /^#{1,6}\s/m,
    /\*\*[^*]+\*\*/,
    /^>\s/m,
    /^[-*+]\s/m,
    /^\|.+\|$/m,
    /```/,
    /`[^`]+`/,
    /!\[[^\]]*\]\(/,
    /\[[^\]]+\]\(/,
  ]
  return patterns.some((p) => p.test(text))
}

/** 预览文件内容（调用知识库预览接口） */
async function previewFile(file: KnowledgeFile) {
  if (!file.id || file.id === 0) {
    ElMessage.warning('该文件暂不支持预览')
    return
  }

  // 重置预览状态
  previewFileName.value = file.title
  previewContent.value = ''
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''
  previewFileUrl.value = ''
  isOfficePreview.value = false
  showPreview.value = true

  try {
    const result = await previewDocApi(file.id)
    const title = file.title || ''
    const fileExtension = title.split('.').pop()?.toLowerCase() || ''
    const isMarkdownFile = fileExtension === 'md' || fileExtension === 'markdown' || result.preview_type === 'markdown'

    if (result.content && result.content.startsWith('http')) {
      if (fileExtension === 'pdf') {
        previewFileUrl.value = result.content
      } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'wps', 'et', 'dps'].includes(fileExtension)) {
        previewFileUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(result.content)}`
        isOfficePreview.value = true
      } else if (['md', 'markdown'].includes(fileExtension) || isMarkdownFile) {
        try {
          const response = await fetch(result.content)
          const text = await response.text()
          isMarkdownPreview.value = true
          rawMarkdownContent.value = text || '无法查看文件内容'
        } catch {
          previewContent.value = '<div style="text-align:center;padding:40px;color:#909399;">无法查看文件内容</div>'
        }
      } else {
        try {
          const response = await fetch(result.content)
          const text = await response.text()
          if (isLikelyMarkdown(text)) {
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/** 下载文件 */
async function downloadFile(file: KnowledgeFile) {
  if (!file.id || file.id === 0) {
    ElMessage.warning('该文件暂不支持下载')
    return
  }

  try {
    // 优先使用后端返回的 download_url（带原始文件名）
    if (file.download_url) {
      window.open(file.download_url, '_blank')
      return
    }

    // 兜底方案：请求后端下载接口获取 download_url
    const token = userStore.token
    const response = await fetch(`/api/knowledge/docs/${file.id}/download/`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      throw new Error(`下载失败 (${response.status})`)
    }

    const contentType = response.headers.get('Content-Type') || ''

    // 后端返回 JSON（含 download_url）
    if (contentType.includes('application/json')) {
      const json = await response.json()
      const downloadUrl = json.download_url || json.url || json.file_url || json.fileUrl
      if (!downloadUrl) throw new Error('未获取到下载地址')
      window.open(downloadUrl, '_blank')
      return
    }

    // 后端直接返回二进制文件流（旧兼容）
    const blob = await response.blob()
    const fileName = file.file_name || file.title || `文件${file.id}`
    downloadBlob(blob, fileName)
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

function closePreview() {
  if (previewFileUrl.value) {
    URL.revokeObjectURL(previewFileUrl.value)
    previewFileUrl.value = ''
  }
  showPreview.value = false
}
</script>

<template>
  <div v-if="references.length > 0" class="refs-popover">
    <button class="refs-toggle" @click="toggle">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <path d="M2 2.5A1.5 1.5 0 013.5 1h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0112 5.622V13.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 13.5v-11z" />
      </svg>
      <span>{{ references.length }} 篇参考</span>
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="currentColor"
        :class="{ rotated: visible }"
        class="chevron"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>

    <Transition name="refs-dropdown">
      <div v-if="visible" class="refs-list">
        <div
          v-for="file in accessibleFiles"
          :key="file.id"
          class="refs-item"
        >
          <!-- 文件信息区域（点击预览） -->
          <div class="refs-item-main" @click="previewFile(file)">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M2 2.5A1.5 1.5 0 013.5 1h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0112 5.622V13.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 13.5v-11z" />
            </svg>
            <span class="refs-title">{{ file.title }}</span>
            <span v-if="file.fileType" class="refs-type">{{ file.fileType.toUpperCase() }}</span>
          </div>
          <!-- 下载按钮 -->
          <button class="refs-download-btn" @click.stop="downloadFile(file)" title="下载文件">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 2a.75.75 0 01.75.75v6.638l1.96-2.158a.75.75 0 111.08 1.04l-3.25 3.5a.75.75 0 01-1.08 0l-3.25-3.5a.75.75 0 111.08-1.04l1.96 2.158V2.75A.75.75 0 018 2z" />
              <path d="M2.5 12a.75.75 0 01.75.75v.5c0 .138.112.25.25.25h9a.25.25 0 00.25-.25v-.5a.75.75 0 011.5 0v.5A1.75 1.75 0 0112.5 15h-9A1.75 1.75 0 011.75 13.25v-.5A.75.75 0 012.5 12z" />
            </svg>
          </button>
        </div>
        <div v-if="limited" class="refs-limited">
          部分文件当前角色无法访问
        </div>
      </div>
    </Transition>

    <!-- 预览对话框 -->
    <Teleport to="body">
      <el-dialog
        v-model="showPreview"
        :title="previewFileName"
        width="800px"
        top="5vh"
        append-to-body
        class="refs-preview-dialog"
        @close="closePreview"
      >
        <div class="refs-preview-content">
          <iframe v-if="isOfficePreview" class="refs-preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
          <iframe v-else-if="previewFileUrl && previewFileName.endsWith('.pdf')" class="refs-preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
          <MarkdownViewer v-else-if="isMarkdownPreview" :content="rawMarkdownContent" class="refs-preview-markdown" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-else v-html="previewContent" class="refs-preview-text"></div>
        </div>
        <template #footer>
          <el-button @click="showPreview = false">关闭</el-button>
        </template>
      </el-dialog>
    </Teleport>
  </div>
</template>

<style scoped>
.refs-popover {
  position: relative;
  margin-top: var(--spacing-sm, 8px);
}

.refs-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-primary, #409eff);
  background: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refs-toggle:hover {
  background: rgba(64, 158, 255, 0.14);
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron.rotated {
  transform: rotate(180deg);
}

.refs-list {
  margin-top: var(--spacing-xs, 4px);
  background: #fff;
  border: 1px solid var(--color-border, #e4e7ed);
  border-radius: var(--radius-base, 6px);
  box-shadow: var(--shadow-base, 0 2px 8px rgba(0, 0, 0, 0.08));
  overflow: hidden;
  max-width: 320px;
}

.refs-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text, #303133);
  transition: background 0.15s ease;
}

.refs-item:hover {
  background: var(--color-bg, #f5f7fa);
}

.refs-item + .refs-item {
  border-top: 1px solid var(--color-border, #e4e7ed);
}

.refs-item-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.refs-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.refs-type {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 4px;
  background: var(--color-bg, #f5f7fa);
  border-radius: 3px;
  color: var(--color-info, #909399);
}

.refs-download-btn {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-secondary, #909399);
  transition: all 0.15s ease;
  padding: 0;
}

.refs-download-btn:hover {
  background: rgba(64, 158, 255, 0.12);
  color: var(--color-primary, #409eff);
}

.refs-limited {
  padding: var(--spacing-xs, 4px) var(--spacing-md, 12px);
  font-size: var(--font-size-xs, 12px);
  color: var(--color-warning, #e6a23c);
  background: rgba(230, 162, 60, 0.06);
  border-top: 1px solid var(--color-border, #e4e7ed);
}

/* 预览对话框内容样式 */
.refs-preview-content {
  max-height: 60vh;
  overflow-y: auto;
}

.refs-preview-iframe {
  width: 100%;
  height: 60vh;
  border: none;
}

.refs-preview-markdown {
  font-size: 14px;
  color: #303133;
  padding: 4px 0;
}

.refs-preview-text {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
}

/* 过渡动画 */
.refs-dropdown-enter-active,
.refs-dropdown-leave-active {
  transition: all 0.15s ease;
}

.refs-dropdown-enter-from,
.refs-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
