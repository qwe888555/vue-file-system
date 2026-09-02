<script setup lang="ts">
// ── 引用文件弹窗组件 ──
// 功能：展示 AI 回复引用的知识库文件，支持在线预览和下载
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { KnowledgeFile, UserRole } from '@/types'
import { isAdminRole } from '@/config/roles'
import { previewDocApi } from '@/api/knowledge'
import { useUserStore } from '@/store/user'
import { classifyDocPreview, resolvePreviewMediaUrl } from '@/utils/filePreview'
import DOMPurify from 'dompurify'
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
// 内嵌媒体类型（图片/音频/视频/PDF），通过 previewFileUrl 承载 src
const previewMediaKind = ref<'image' | 'audio' | 'video' | 'pdf' | ''>('')

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

/** 只回收本组件用 blob URL 生成的地址（OSS http 地址 revoke 是安全的空操作） */
function releasePreviewObjectUrl() {
  if (previewFileUrl.value && previewFileUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewFileUrl.value)
  }
}

function previewPlaceholder(msg: string): string {
  return `<div style="text-align:center;padding:40px;color:#909399;">${msg}</div>`
}

/** 图片加载失败（签名过期/防盗链等）时改为下载提示，避免对话框留空白 */
function handlePreviewMediaError() {
  if (previewMediaKind.value === 'image') {
    releasePreviewObjectUrl()
    previewMediaKind.value = ''
    previewFileUrl.value = ''
    previewContent.value = previewPlaceholder('图片在线预览失败，可能是预览地址已过期，请下载后查看')
  }
}

/** 预览文件内容（调用知识库预览接口） */
async function previewFile(file: KnowledgeFile) {
  if (!file.id || file.id === 0) {
    ElMessage.warning('该文件暂不支持预览')
    return
  }

  // 重置预览状态
  releasePreviewObjectUrl()
  previewFileName.value = file.title
  previewContent.value = ''
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''
  previewFileUrl.value = ''
  isOfficePreview.value = false
  previewMediaKind.value = ''
  showPreview.value = true

  let result: Awaited<ReturnType<typeof previewDocApi>>
  try {
    result = await previewDocApi(file.id)
  } catch (error) {
    console.error('预览文件失败:', error)
    previewContent.value = previewPlaceholder('预览失败，请重试')
    return
  }

  // 文件类型以后端返回的 file_name / file_type / preview_type 为准，
  // 不能依赖 title 扩展名（title 多为「文件名去后缀」，不含扩展名）。
  const { kind, fileName } = classifyDocPreview(result, file.title)
  if (fileName) previewFileName.value = fileName
  const content = result?.content || ''

  switch (kind) {
    case 'markdown':
      isMarkdownPreview.value = true
      rawMarkdownContent.value = content || '无法查看文件内容'
      break
    case 'html':
      // HTML 原文：模板处 v-html 渲染（DOMPurify 净化防 XSS）
      previewContent.value = DOMPurify.sanitize(content || '无法查看文件内容')
      break
    case 'text':
      previewContent.value = `<pre style="white-space:pre-wrap;word-break:break-word;font-family:Consolas,monospace;font-size:13px;margin:0;">${escapeHtml(content || '无法查看文件内容')}</pre>`
      break
    case 'image':
    case 'audio':
    case 'video':
    case 'pdf': {
      if (!content) {
        previewContent.value = previewPlaceholder('无法获取在线预览地址，请下载后查看')
        break
      }
      const { url } = await resolvePreviewMediaUrl(kind, content)
      previewMediaKind.value = kind
      previewFileUrl.value = url
      break
    }
    case 'office': {
      // Office 文档走微软 Office Online 在线预览（要求 OSS 地址公网可达）
      if (!content) {
        previewContent.value = previewPlaceholder('无法获取在线预览地址，请下载后查看')
        break
      }
      previewFileUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(content)}`
      isOfficePreview.value = true
      break
    }
    default:
      previewContent.value = previewPlaceholder('该文件类型暂不支持在线预览，请下载后查看')
      break
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
    // 确定文件名
    const fileName = file.title || `文件${file.id}`

    const token = userStore.token
    const response = await fetch(`/api/knowledge/docs/${file.id}/download/`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      throw new Error(`下载失败 (${response.status})`)
    }

    const contentType = response.headers.get('Content-Type') || ''

    // 后端返回 JSON（含 OSS 地址）
    if (contentType.includes('application/json')) {
      const json = await response.json()
      const fileUrl = json.url || json.file_url || json.fileUrl || json.download_url
      if (!fileUrl) throw new Error('未获取到下载地址')

      try {
        const ossRes = await fetch(fileUrl)
        if (ossRes.ok) {
          const blob = await ossRes.blob()
          downloadBlob(blob, fileName)
          return
        }
      } catch {
        // CORS 不通，回退到 window.open
      }
      window.open(fileUrl, '_blank')
      return
    }

    // 后端直接返回二进制文件流
    downloadBlob(await response.blob(), fileName)
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
  releasePreviewObjectUrl()
  previewFileUrl.value = ''
  previewMediaKind.value = ''
  previewContent.value = ''
  isOfficePreview.value = false
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''
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
          <img
            v-if="previewMediaKind === 'image'"
            :src="previewFileUrl"
            :alt="previewFileName"
            class="refs-preview-media refs-preview-image"
            @error="handlePreviewMediaError"
          />
          <video v-else-if="previewMediaKind === 'video'" :src="previewFileUrl" controls class="refs-preview-media refs-preview-video"></video>
          <audio v-else-if="previewMediaKind === 'audio'" :src="previewFileUrl" controls class="refs-preview-media refs-preview-audio"></audio>
          <iframe v-else-if="previewMediaKind === 'pdf'" class="refs-preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
          <iframe v-else-if="isOfficePreview" class="refs-preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
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

/* 内嵌图片/音视频预览（配合 previewMediaKind） */
.refs-preview-image {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  margin: 0 auto;
  object-fit: contain;
}
.refs-preview-video {
  display: block;
  width: 100%;
  max-height: 60vh;
  margin: 0 auto;
  background: #000;
  border-radius: 4px;
}
.refs-preview-audio {
  display: block;
  width: 100%;
  margin: 40px auto;
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
