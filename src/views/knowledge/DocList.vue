<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, onMounted, triggerRef, watch } from 'vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Upload, Close, Plus, Check, Download, Edit, Delete, WarningFilled, Loading } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import type { KnowledgeFile, Keyword } from '@/types'
import { deleteDocApi, getDocListApi, getKeywordsApi, uploadTextApi, uploadFileApi, aiClassifyApi, previewDocApi, batchDeleteDocsApi, addKeywordsApi } from '@/api/knowledge'
import { uploadFileToOss } from '@/utils/oss-upload'
import { classifyDocPreview, resolvePreviewMediaUrl } from '@/utils/filePreview'
import DOMPurify from 'dompurify'
import EditFileForm from '@/components/knowledge/EditFileForm.vue'
import MarkdownViewer from '@/components/chat/MarkdownViewer.vue'

const searchQuery = ref('')
// 本地描述缓存：后端列表接口不返回 description 字段，持久化到 localStorage 防刷新丢失
const DESC_CACHE_KEY = 'doc_description_cache'
const KW_CACHE_KEY = 'doc_keywords_cache'

function loadJsonCache(key: string): Map<number, any> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return new Map(JSON.parse(raw))
  } catch {}
  return new Map()
}
function saveJsonCache(key: string, map: Map<number, any>) {
  try { localStorage.setItem(key, JSON.stringify([...map])) } catch {}
}
function cacheDesc(id: number, desc: string) {
  if (!desc) return
  localDescriptionCache.value.set(id, desc)
  saveJsonCache(DESC_CACHE_KEY, localDescriptionCache.value)
}
function cacheKeywords(id: number, keywords: Keyword[]) {
  if (!keywords.length) return
  keywordsCache.set(id, keywords)
  saveJsonCache(KW_CACHE_KEY, keywordsCache)
}
const localDescriptionCache = ref<Map<number, string>>(loadJsonCache(DESC_CACHE_KEY) as Map<number, string>)
const showEditDialog = ref(false)
const editingFile = ref<KnowledgeFile | null>(null)
const loading = ref(false)
const listError = ref('')

const createMode = ref(false)
const selectedFiles = ref<{ file: File; docId?: number; previewContent?: string; title: string; keywords: string; description: string; scope: 'public' | 'private'; isAnalyzing: boolean; uploadError?: string }[]>([])
const selectedFileIndex = ref(0)

// ── 文件列表区域拖拽上传状态 ──
const isDragOver = ref(false)
let dragCounter = 0
// 稳定的空数组引用，避免每次渲染传新 [] 导致 el-upload 内部状态重置
const emptyFileList = ref<never[]>([])
const showCreateForm = ref(false)
const showPreviewDialog = ref(false)
const previewContent = ref('')
const sanitizedPreviewContent = computed(() => DOMPurify.sanitize(previewContent.value))
const previewFileName = ref('')
const previewFileUrl = ref('')
// 内嵌媒体类型（图片/音频/视频/PDF），通过 previewFileUrl 承载 src
const previewMediaKind = ref<'image' | 'audio' | 'video' | 'pdf' | ''>('')
const isOfficePreview = ref(false)
const isMarkdownPreview = ref(false)
const rawMarkdownContent = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

// 初始化 MarkdownIt 实例，支持代码高亮
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch {
        // 忽略高亮错误
      }
    }
    return ''
  },
})

// 预览文本 HTML 转义（DOMPurify 会再兜底净化）
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
const PRE_WRAP = '<pre class="preview-pre">'
const PRE_SUFFIX = '</pre>'
function previewPre(text: string): string {
  return `${PRE_WRAP}${escapeHtml(text)}${PRE_SUFFIX}`
}
function previewPlaceholder(msg: string): string {
  return `<div class="preview-placeholder">${msg}</div>`
}

// （已移除死代码：showKeywordsDialog / keywordsDialogTitle / allKeywords —— "全部关键词"弹窗无触发入口且数据从未赋值）

const selectedDocIds = ref<number[]>([])

const currentFileForm = computed(() => {
  if (selectedFiles.value.length > 0 && selectedFiles.value[selectedFileIndex.value]) {
    return selectedFiles.value[selectedFileIndex.value]
  }
  return null
})

const uploadForm = ref({
  title: '',
  keywords: '',
  description: '',
  content: '',
  scope: 'public',
})

function resetUploadForm() {
  createMode.value = true
  selectedFiles.value = []
  showCreateForm.value = false
  uploadForm.value = {
    title: '',
    keywords: '',
    description: '',
    content: '',
    scope: 'public',
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  } else if (['txt', 'md', 'json', 'xml', 'csv'].includes(ext || '')) {
    return await file.text()
  } else if (['doc', 'pdf'].includes(ext || '')) {
    return `文件名: ${file.name}\n文件大小: ${file.size} bytes\n文件类型: ${ext}`
  } else {
    return `文件名: ${file.name}\n文件大小: ${file.size} bytes\n文件类型: ${ext}`
  }
}

/** 支持的扩展名白名单 */
const SUPPORTED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'md',
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma',
  'mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv',
  'zip', 'rar', '7z', 'tar', 'gz',
]

/** 校验文件是否可上传，返回错误原因或 null */
function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  // 仅做格式校验，大小限制完全由后端控制
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    return `不支持的文件格式 ".${ext || '未知'}"，支持：PDF、Word、Excel、CSV、TXT、Markdown、图片、音视频、压缩包`
  }

  return null
}

async function handleFileChange(file: File) {
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  const errorMsg = validateFile(file)

  const newFileItem = {
    file,
    title: baseName,
    keywords: '',
    description: '',
    scope: 'public' as const,
    isAnalyzing: !errorMsg,
    uploadError: errorMsg || undefined,
  }

  selectedFiles.value.push(newFileItem)
  selectedFileIndex.value = selectedFiles.value.length - 1

  if (errorMsg) {
    ElMessage.warning(errorMsg)
    return
  }

  // 异步调用 AI 分类（不阻塞文件添加到列表）
  classifyFile(newFileItem, file)
}

/** 对单个文件执行 AI 分类，结果直接写回 fileItem */
async function classifyFile(
  fileItem: { title: string; keywords: string; description: string; scope: 'public' | 'private'; isAnalyzing: boolean; uploadError?: string },
  file: File,
) {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    // 音视频/压缩包等二进制文件无法提取文本，只发 metadata 给 AI 分类，避免上传大文件超时
    const isBinaryNoText = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma',
      'mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv',
      'zip', 'rar', '7z', 'tar', 'gz'].includes(ext)

    let content: string
    if (isBinaryNoText) {
      // 音视频/压缩包只发基本信息，不上传文件本身
      content = `文件名: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB\n文件类型: ${ext}`
    } else {
      try {
        content = await extractTextFromFile(file)
      } catch (extractErr) {
        console.warn('[DocList] 文本提取失败，使用兜底:', extractErr)
        content = `文件名: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB\n文件类型: ${ext}`
      }
    }

    let result: { title: string; keywords: string[]; description: string; scope: string }
    if (isBinaryNoText) {
      // 音视频/压缩包走 JSON 分支，只发 content 字符串
      result = await aiClassifyApi({ content })
    } else {
      // 文档类走 FormData 分支，上传文件
      const formData = new FormData()
      formData.append('file', file)
      formData.append('content', content)
      formData.append('filename', file.name)
      result = await aiClassifyApi(formData)
    }

    if (result.title) {
      fileItem.title = result.title
    }
    if (result.keywords && result.keywords.length > 0) {
      fileItem.keywords = result.keywords.join(', ')
    }
    if (result.description) {
      fileItem.description = result.description
    }
    if (result.scope) {
      fileItem.scope = result.scope === 'school' ? 'public' : 'private'
    }

    // AI 解析完成，更新状态
    fileItem.isAnalyzing = false
    triggerRef(selectedFiles)
  } catch (error) {
    console.error('[DocList] AI分类失败:', error)
    ElMessage.warning(`"${file.name}" AI 分类失败，请手动填写信息`)
    // AI 解析失败，也更新状态
    fileItem.isAnalyzing = false
    triggerRef(selectedFiles)
  }
}

function handleRemove(item: { file: File; docId?: number; previewContent?: string }) {
  const index = selectedFiles.value.indexOf(item)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  }
  
  if (selectedFiles.value.length === 0) {
    selectedFileIndex.value = 0
  } else if (selectedFileIndex.value >= selectedFiles.value.length) {
    selectedFileIndex.value = selectedFiles.value.length - 1
  }
}

async function handlePreviewFile(item: { file: File; docId?: number; previewContent?: string }) {
  previewFileName.value = item.file.name
  previewContent.value = ''
  previewFileUrl.value = ''
  
  const ext = item.file.name.split('.').pop()?.toLowerCase()
  
  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const arrayBuffer = await item.file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      previewContent.value = previewPre(result.value)
      showPreviewDialog.value = true
    } catch (error) {
      console.error('预览Word文档失败:', error)
      previewContent.value = previewPlaceholder('浏览器无法直接预览此文件。请下载文件后使用Word等文档软件打开查看。')
      showPreviewDialog.value = true
    }
  } else if (ext === 'pdf') {
    if (item.docId) {
      try {
        const result = await previewDocApi(item.docId)
        if (result.preview_type === 'url') {
          previewFileUrl.value = result.content
          showPreviewDialog.value = true
        } else {
          previewContent.value = previewPlaceholder('浏览器无法直接预览此文件。请下载文件后使用PDF阅读器打开查看。')
          showPreviewDialog.value = true
        }
      } catch (error) {
        console.error('预览文件失败:', error)
        previewContent.value = previewPlaceholder('预览失败，请重试。')
        showPreviewDialog.value = true
      }
    } else {
      previewContent.value = previewPlaceholder('PDF文件需要先上传才能预览。')
      showPreviewDialog.value = true
    }
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
    previewContent.value = previewPlaceholder('图片文件请下载后使用图片查看器打开查看')
    showPreviewDialog.value = true
  } else if (['md', 'markdown'].includes(ext || '')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      previewContent.value = md.render(content || '无法查看文件内容')
      showPreviewDialog.value = true
    }
    reader.readAsText(item.file)
  } else if (['txt', 'json', 'xml', 'csv'].includes(ext || '')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      previewContent.value = previewPre(content)
      showPreviewDialog.value = true
    }
    reader.readAsText(item.file)
  } else {
    previewContent.value = previewPlaceholder('浏览器无法直接预览此文件格式。请下载文件后使用相应软件打开查看。')
    showPreviewDialog.value = true
  }
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    Array.from(input.files).forEach(file => {
      handleFileChange(file)
    })
  }
  input.value = ''
}

/** el-upload 的 change 事件回调 */
function onUploadChange(uploadFile: any) {
  const file = uploadFile?.raw
  if (file instanceof File) {
    handleFileChange(file)
  } else if (uploadFile instanceof File) {
    // 兜底：某些情况下 uploadFile 本身就是 File
    handleFileChange(uploadFile)
  } else {
    console.warn('[DocList] onUploadChange: 无法获取 File 对象', uploadFile)
  }
}

// ── 文件列表区域 HTML5 拖拽上传（已有文件时也能拖入新文件）──
function onUploadContentDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  isDragOver.value = true
}

function onUploadContentDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function onUploadContentDragLeave() {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragOver.value = false
  }
}

function onUploadContentDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter = 0
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      handleFileChange(file)
    })
  }
}

function releasePreviewObjectUrl() {
  // 只回收本组件用 blob URL 生成的地址（OSS http 地址 revoke 是安全的空操作）
  if (previewFileUrl.value && previewFileUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewFileUrl.value)
  }
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

/**
 * 预览已上传文档（按 doc id 调后端预览接口）。
 * 文件类型以后端返回的 file_name / file_type / preview_type 为准，
 * 不能依赖 title 扩展名（title 多为「文件名去后缀」，不含扩展名）。
 */
async function handlePreviewDoc(id: number, title: string) {
  releasePreviewObjectUrl()
  previewFileName.value = title
  previewContent.value = ''
  previewFileUrl.value = ''
  previewMediaKind.value = ''
  isOfficePreview.value = false
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''

  let result: Awaited<ReturnType<typeof previewDocApi>>
  try {
    result = await previewDocApi(id)
  } catch (error) {
    console.error('获取文件预览失败:', error)
    previewContent.value = previewPlaceholder('获取预览失败，请重试')
    showPreviewDialog.value = true
    return
  }
  showPreviewDialog.value = true

  const { kind, fileName } = classifyDocPreview(result, title)
  if (fileName) previewFileName.value = fileName // 用真实文件名（含扩展名）作为标题
  const content = result?.content || ''

  switch (kind) {
    case 'markdown':
      isMarkdownPreview.value = true
      rawMarkdownContent.value = content || '无法查看文件内容'
      break
    case 'html':
      // HTML 原文交给弹窗 v-html 渲染（模板处经 DOMPurify 净化）
      previewContent.value = content || '无法查看文件内容'
      break
    case 'text':
      previewContent.value = previewPre(content || '无法查看文件详细内容')
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

function handlePreviewClose() {
  releasePreviewObjectUrl()
  previewFileUrl.value = ''
  previewContent.value = ''
  previewMediaKind.value = ''
  isOfficePreview.value = false
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''
}

async function handleConfirmInfo() {
  if (!uploadForm.value.content.trim()) {
    ElMessage.warning('请输入文件内容')
    return
  }

  try {
    const result = await aiClassifyApi({ content: uploadForm.value.content })
    
    if (result.title) {
      uploadForm.value.title = result.title
    } else {
      uploadForm.value.title = '未命名文档'
    }
    if (result.keywords && result.keywords.length > 0) {
      uploadForm.value.keywords = result.keywords.join(', ')
    }
    if (result.description) {
      uploadForm.value.description = result.description
    }
    if (result.scope) {
      uploadForm.value.scope = result.scope === 'school' ? 'public' : 'private'
    }
    
    showCreateForm.value = true
  } catch (error) {
    console.error('AI分类失败:', error)
    showCreateForm.value = true
    if (!uploadForm.value.title) {
      uploadForm.value.title = '未命名文档'
    }
  }
}

async function handleUploadSubmit() {
  if (!uploadForm.value.scope) {
    ElMessage.warning('请选择可见范围')
    return
  }

  let keywords: string[] = []
  
  if (createMode.value) {
    if (!uploadForm.value.keywords) {
      ElMessage.warning('请输入关键词')
      return
    }
    keywords = uploadForm.value.keywords
      .split(/[,，、\s]+/)
      .map((kw) => kw.trim())
      .filter((kw) => kw)

    if (keywords.length === 0) {
      ElMessage.warning('请输入关键词')
      return
    }
  } else {
    if (selectedFiles.value.length === 0) {
      ElMessage.warning('请选择要上传的文件')
      return
    }

    // 检查是否有不可上传的文件
    const errorFiles = selectedFiles.value.filter(item => item.uploadError)
    if (errorFiles.length > 0) {
      ElMessage.warning(`有 ${errorFiles.length} 个文件无法上传，请先移除或更换：${errorFiles[0].file.name}`)
      return
    }

    for (const item of selectedFiles.value) {
      if (!item.keywords) {
        ElMessage.warning(`文件 "${item.title || item.file.name}" 缺少关键词，请先确认信息`)
        return
      }
      const itemKeywords = item.keywords.split(/[,，、\s]+/).map(kw => kw.trim()).filter(kw => kw)
      if (itemKeywords.length === 0) {
        ElMessage.warning(`文件 "${item.title || item.file.name}" 缺少关键词，请先确认信息`)
        return
      }
    }
  }

  if (createMode.value) {
    if (!uploadForm.value.title) {
      ElMessage.warning('请输入文件名')
      return
    }
    if (!uploadForm.value.content.trim()) {
      ElMessage.warning('请输入文件内容')
      return
    }

    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在创建文件...',
      background: 'rgba(0, 0, 0, 0.7)',
    })

    try {
      const result = await uploadTextApi({
        title: uploadForm.value.title,
        content: uploadForm.value.content,
        description: uploadForm.value.description || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        scope: uploadForm.value.scope === 'public' ? 'school' : 'college',
      })
      // 缓存描述，防止 fetchFiles 刷新后丢失
      if (result.id && uploadForm.value.description) {
        cacheDesc(result.id, uploadForm.value.description)
      }
      ElMessage.success('创建成功')
      resetUploadForm()
      fetchFiles()
    } catch (error) {
      console.error('创建文件失败:', error)
      ElMessage.error('创建文件失败，请重试')
    } finally {
      loadingInstance.close()
    }
  } else {
    if (selectedFiles.value.length === 0) {
      ElMessage.warning('请选择要上传的文件')
      return
    }

    for (let i = 0; i < selectedFiles.value.length; i++) {
      for (let j = i + 1; j < selectedFiles.value.length; j++) {
        const item1 = selectedFiles.value[i]
        const item2 = selectedFiles.value[j]
        if (item1.title === item2.title) {
          ElMessage.warning(`存在两个文件名相同的文件（文件名：${item1.title}），请修改后再上传`)
          return
        }
      }
    }

    for (const item of selectedFiles.value) {
      const existingFile = uploadedFiles.value.find(f => f.title === item.title)
      if (existingFile) {
        ElMessage.warning(`文件 "${item.title}" 已存在，请勿重复上传`)
        return
      }
    }

    const loadingInstance = ElLoading.service({
      lock: true,
      text: `正在上传中... 0/${selectedFiles.value.length}`,
      background: 'rgba(0, 0, 0, 0.7)',
    })

    try {
      let successCount = 0
      const totalCount = selectedFiles.value.length
      // 大文件阈值：超过 20MB 走 OSS 分片直传，规避 nginx 超时
      const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024

      for (let i = 0; i < totalCount; i++) {
        const item = selectedFiles.value[i]
        const file = item.file
        const fileName = file.name.replace(/\.[^/.]+$/, '')

        // 将用户修改后的关键词整理成数组
        const uploadKeywords = item.keywords
          .split(/[,，、\s]+/)
          .map((kw: string) => kw.trim())
          .filter((kw: string) => kw)

        let result: KnowledgeFile

        if (file.size > LARGE_FILE_THRESHOLD) {
          // ── 大文件：走 OSS 分片直传（无超时，支持断点续传） ──
          result = await uploadFileToOss({
            file,
            title: item.title || fileName,
            description: item.description,
            scope: item.scope,
            keywords: uploadKeywords,
            // 文件哈希计算进度回调
            onMd5Progress: (percent) => {
              loadingInstance.setText(`正在校验文件... ${i + 1}/${totalCount}：${file.name}（${percent}%）`)
            },
            // 分片上传进度回调，实时更新 loading 文字
            onProgress: (percent) => {
              loadingInstance.setText(`正在上传中... ${i + 1}/${totalCount}：${file.name}（${percent}%）`)
            },
          })
        } else {
          // ── 小文件：走原有 FormData 后端中转上传 ──
          loadingInstance.setText(`正在上传中... ${i + 1}/${totalCount}：${file.name}`)

          const formData = new FormData()
          formData.append('file', file)
          formData.append('title', item.title || fileName)
          if (item.description) {
            formData.append('description', item.description)
          }
          uploadKeywords.forEach((kw: string) => formData.append('keywords', kw))
          formData.append('scope', item.scope === 'public' ? 'school' : 'college')

          result = await uploadFileApi(formData)
        }

        // 上传成功后的统一处理：缓存描述、写入关键词
        if (result.id) {
          item.docId = result.id
          if (item.description) {
            cacheDesc(result.id, item.description)
          }
          if (uploadKeywords.length > 0) {
            try { await addKeywordsApi(result.id, uploadKeywords) } catch {}
            cacheKeywords(result.id, uploadKeywords.map((phrase: string) => ({
              id: 0, phrase, match_type: 'exact', weight: 1,
            })))
          }
        }
        successCount++
      }

      ElMessage.success(`${successCount}/${totalCount} 个文件上传成功`)
      resetUploadForm()
      fetchFiles()
    } catch (error) {
      console.error('文件上传失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '文件上传失败，请重试')
    } finally {
      loadingInstance.close()
    }
  }
}

const currentPage = ref(1)
const pageSize = ref(8)
const totalFiles = ref(0)

const uploadedFiles = ref<KnowledgeFile[]>([])
const allFiles = ref<KnowledgeFile[]>([])
const keywordsCache: Map<number, Keyword[]> = loadJsonCache(KW_CACHE_KEY) as Map<number, Keyword[]>

async function fetchFiles(keyword?: string) {
  loading.value = true
  listError.value = ''
  try {
    const res = await getDocListApi({
      page: 1,
      page_size: 1000,
      keyword: keyword || undefined,
    })
    const data = res.results || res.data || res
    const newFiles = Array.isArray(data) ? data : []
    
    newFiles.forEach((file) => {
      if (keywordsCache.has(file.id)) {
        file.keywords = keywordsCache.get(file.id)!
      } else if (!file.keywords) {
        file.keywords = []
      } else if (Array.isArray(file.keywords)) {
        file.keywords = file.keywords.map((kw: any) => ({
          id: kw.id,
          phrase: kw.phrase || kw.keyword || kw.name || '',
          match_type: kw.match_type || 'exact',
          weight: kw.weight || 1,
        })).filter((kw: Keyword) => kw.phrase)
      }
      
      // 后端蛇形命名 → 前端驼峰命名映射
      if (file.created_at && !file.createdAt) {
        file.createdAt = file.created_at
      }
      if (file.updated_at && !file.updatedAt) {
        file.updatedAt = file.updated_at
      }
      if (file.college_name && !file.collegeName) {
        file.collegeName = file.college_name
      }
      if (file.uploader && !file.author) {
        file.author = file.uploader
      }
      if (file.uploader_name && !file.author) {
        file.author = file.uploader_name
      }
      // 文件大小映射（后端 file_size → 前端 fileSize）
      if (file.file_size != null && file.fileSize == null) {
        file.fileSize = file.file_size
      }
      // 后端可能返回 description 或 summary，统一映射确保数据不丢失
      const rawDesc = (file as any).description
      if (rawDesc && !file.summary) {
        file.summary = rawDesc
      }
      // 同时保留原始 description 字段，供编辑弹窗使用
      if (rawDesc) {
        ;(file as any).description = rawDesc
      }
      // 从本地缓存恢复描述（后端列表接口可能不返回 description 字段）
      const cachedDesc = localDescriptionCache.value.get(file.id)
      if (cachedDesc) {
        if (!file.summary) file.summary = cachedDesc
        ;(file as any).description = cachedDesc
      }
    })

    // 在覆盖 allFiles 前，保存现有文件的描述到缓存（防止 fetchFiles 刷新后丢失）
    allFiles.value.forEach((f) => {
      const desc = f.summary || (f as any).description
      if (desc && !localDescriptionCache.value.has(f.id)) {
        cacheDesc(f.id, desc)
      }
    })
    
    allFiles.value = newFiles
    totalFiles.value = newFiles.length
    
    const maxPage = Math.max(1, Math.ceil(totalFiles.value / pageSize.value))
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
    }
    
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    uploadedFiles.value = allFiles.value.slice(start, end)
    
  } catch (error: any) {
    console.error('获取文件列表失败:', error)
    if (error.response?.status === 401) {
      console.warn('Token过期，需要重新登录')
    }
    listError.value = '文档列表加载失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchFiles()
})

watch(searchQuery, () => {
  currentPage.value = 1
})

/**
 * 标准化搜索文本：统一中英文标点符号，方便搜索匹配
 */
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/：/g, ':')   // 中文冒号 → 英文冒号
    .replace(/，/g, ',')   // 中文逗号 → 英文逗号
    .replace(/。/g, '.')   // 中文句号 → 英文句号
    .replace(/（/g, '(')   // 中文左括号
    .replace(/）/g, ')')   // 中文右括号
    .replace(/；/g, ';')   // 中文分号
    .replace(/"/g, '"')   // 中文左引号
    .replace(/"/g, '"')   // 中文右引号
    .replace(/'/g, "'")   // 中文左单引号
    .replace(/'/g, "'")   // 中文右单引号
    .trim()
}

const filteredFiles = computed(() => {
  if (!searchQuery.value) return allFiles.value
  const query = normalizeSearchText(searchQuery.value)
  if (!query) return allFiles.value

  return allFiles.value.filter((file) => {
    // 构建包含所有字段的搜索文本，确保输入任何字符都能匹配到相关文件
    const searchableParts = [
      file.id,
      file.title,
      file.summary,
      file.author,
      file.collegeName,
      file.collegeId,
      file.category,
      file.categoryName,
      file.fileType,
      file.fileSize,
      file.status,
      file.content,
      file.fileData,
      file.createdAt,
      file.updatedAt,
      // 格式化后的日期（中文格式，方便按年月日搜索）
      file.createdAt ? formatDate(file.createdAt) : '',
      file.updatedAt ? formatDate(file.updatedAt) : '',
      // 格式化后的文件大小（如 "1.5 MB"）
      file.fileSize != null ? formatFileSize(file.fileSize) : '',
      // 关键词（短语 + ID）
      ...(file.keywords || []).flatMap((kw) => [kw.phrase, String(kw.id)]),
    ]
    const searchText = normalizeSearchText(
      searchableParts
        .filter((p) => p != null && p !== '')
        .map((p) => String(p))
        .join(' ')
    )
    return searchText.includes(query)
  })
})

const displayTotalFiles = computed(() => {
  return filteredFiles.value.length
})

const paginatedFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredFiles.value.slice(start, end)
})

function handleCurrentChange(page: number) {
  const maxPage = Math.max(1, Math.ceil(displayTotalFiles.value / pageSize.value))
  if (page < 1) {
    currentPage.value = 1
    return
  }
  if (page > maxPage) {
    currentPage.value = maxPage
    return
  }
  currentPage.value = page
}

function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

const fileTypeIcons: Record<string, any> = {
  pdf: Document,
  doc: Files,
  image: Picture,
  audio: Headset,
  video: VideoCamera,
  archive: FolderOpened,
}

const fileTypeColors: Record<string, string> = {
  pdf: '#f56c6c',
  doc: '#409eff',
  image: '#67c23a',
  audio: '#909399',
  video: '#e6a23c',
  archive: 'var(--color-type-archive, #9b59b6)',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function handleEdit(file: KnowledgeFile) {
  try {
    if (!file.keywords || file.keywords.length === 0) {
      const keywords = await getKeywordsApi(file.id)
      file.keywords = keywords.map((kw: any) => ({
        id: kw.id,
        phrase: kw.phrase || kw.keyword || kw.name || '',
        match_type: kw.match_type || 'exact',
        weight: kw.weight || 1,
      })).filter((kw: Keyword) => kw.phrase)
    }
    editingFile.value = file
    showEditDialog.value = true
  } catch (error) {
    console.error('获取关键词失败:', error)
    editingFile.value = file
    showEditDialog.value = true
  }
}

function handleEditSubmit(data: { title: string; description: string; keywords: Keyword[] }) {
  if (editingFile.value) {
    editingFile.value.title = data.title
    editingFile.value.summary = data.description
    ;(editingFile.value as any).description = data.description
    editingFile.value.keywords = data.keywords
    cacheKeywords(editingFile.value.id, data.keywords)
    if (data.description) {
      cacheDesc(editingFile.value.id, data.description)
    }
    saveFiles(uploadedFiles.value)
    ElMessage.success('编辑成功')
    fetchFiles()
  }
  showEditDialog.value = false
}

async function handleDownload(file: KnowledgeFile) {
  try {
    // 1. 先确定文件名：列表显示什么就下载什么
    let fileName: string
    if (file.title && file.title.includes('.')) {
      fileName = file.title
    } else {
      let ext = ''
      if (file.fileUrl) {
        const urlExt = file.fileUrl.split('?')[0].split('.').pop()?.toLowerCase()
        if (urlExt && /^[a-z0-9]{1,5}$/i.test(urlExt)) ext = '.' + urlExt
      }
      if (!ext) {
        const extMap: Record<string, string> = {
          doc: '.docx', docx: '.docx', pdf: '.pdf',
          txt: '.txt', md: '.md',
          image: '.png', audio: '.mp3', video: '.mp4', archive: '.zip',
        }
        ext = extMap[file.fileType] || ''
      }
      fileName = (file.title || `文件${file.id}`) + ext
    }

    // 2. 请求后端下载接口
    const token = localStorage.getItem('access_token')
    const response = await fetch(`/api/knowledge/docs/${file.id}/download/`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `下载失败 (${response.status})`)
    }

    const contentType = response.headers.get('Content-Type') || ''

    // 3. 后端返回 JSON（含 OSS 地址）：先尝试 fetch 为 Blob 以保留自定义文件名
    if (contentType.includes('application/json')) {
      const json = await response.json()
      const fileUrl = json.url || json.file_url || json.fileUrl || json.download_url
      if (!fileUrl) throw new Error('后端返回了 JSON 但没有包含文件下载地址')

      try {
        const ossRes = await fetch(fileUrl)
        if (ossRes.ok) {
          const blob = await ossRes.blob()
          downloadBlob(blob, fileName)
          return
        }
      } catch {
        // CORS 不通，回退到 window.open（文件名由 OSS 决定）
      }
      window.open(fileUrl, '_blank')
      return
    }

    // 4. 后端直接返回二进制文件流
    downloadBlob(await response.blob(), fileName)
  } catch (error: any) {
    console.error('下载文件失败:', error)
    ElMessage.error(error.message || '下载文件失败')
  }
}

/** 创建 Blob URL 并触发浏览器下载 */
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

async function handleBatchDelete() {
  if (selectedDocIds.value.length === 0) {
    ElMessage.warning('请选择要删除的文件')
    return
  }
  
  ElMessageBox.confirm(`确定要删除选中的 ${selectedDocIds.value.length} 个文件吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await batchDeleteDocsApi(selectedDocIds.value)
        ElMessage.success('批量删除成功')
        selectedDocIds.value = []
        fetchFiles()
      } catch (error) {
        console.error('批量删除失败:', error)
        ElMessage.error('批量删除失败')
      }
    })
    .catch(() => {})
}

function handleSelectionChange(val: KnowledgeFile[]) {
  selectedDocIds.value = val.map(item => item.id)
}

async function handleDelete(file: KnowledgeFile) {
  ElMessageBox.confirm('确定要删除该文件吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await deleteDocApi(file.id)
        ElMessage.success('删除成功')
        fetchFiles()
      } catch (error) {
        console.error('删除文件失败:', error)
        ElMessage.error('删除文件失败')
      }
    })
    .catch(() => {})
}

function saveFiles(files: KnowledgeFile[]) {
  // 与 DocDetail 共用同一 key，保证详情页重命名/删除后列表缓存一致
  localStorage.setItem('knowledgeFiles', JSON.stringify(files))
}
</script>

<template>
  <div class="doc-list-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">知识库管理</h2>
        <p class="page-subtitle">管理和浏览所有上传的文档资源</p>
      </div>
    </div>

    <div class="upload-section">
      <div v-if="!createMode" class="upload-area">
        <div class="upload-header">
          <div class="mode-switch-wrapper">
            <el-radio-group v-model="createMode">
              <el-radio :value="false">上传文件</el-radio>
              <el-radio :value="true">创建文件</el-radio>
            </el-radio-group>
          </div>
        </div>

        <div v-show="selectedFiles.length === 0" class="upload-center-empty">
          <el-upload
            :auto-upload="false"
            :file-list="emptyFileList"
            @change="onUploadChange"
            drag
            multiple
            accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.aac,.m4a,.flac,.wma,.mp4,.avi,.mkv,.mov,.webm,.flv,.wmv,.zip,.rar,.7z,.tar,.gz"
            class="upload-dragger"
          >
            <el-icon :size="300" color="#c0c4cc"><Upload /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <div class="upload-file-formats">
              支持 PDF、Word、TXT、Markdown、图片、音视频、压缩包等格式（图片≤10MB，大文件自动走 OSS 分片直传）
            </div>
          </el-upload>
        </div>

        <div
          v-show="selectedFiles.length > 0"
          class="upload-content"
          :class="{ 'drag-over': isDragOver }"
          @dragenter="onUploadContentDragEnter"
          @dragover="onUploadContentDragOver"
          @dragleave="onUploadContentDragLeave"
          @drop="onUploadContentDrop"
        >
          <!-- 拖拽悬停提示 -->
          <div v-if="isDragOver" class="drag-overlay">
            <div class="drag-overlay-content">
              <el-icon :size="48" color="#409eff"><Upload /></el-icon>
              <span>释放以添加文件</span>
            </div>
          </div>
          <div class="upload-content-left">
            <div class="file-preview-list">
              <div
                v-for="(item, index) in selectedFiles"
                :key="index"
                class="file-preview-item"
                :class="{ 'selected': selectedFileIndex === index, 'has-error': item.uploadError }"
                @click="selectedFileIndex = index"
              >
                <div class="file-selection-indicator" :class="{ 'selected': selectedFileIndex === index }">
                  <el-icon v-if="selectedFileIndex === index" :size="14">
                    <Check />
                  </el-icon>
                </div>
                <el-icon :size="32" class="preview-file-icon" :class="{ 'error-icon': item.uploadError }">
                  <Document />
                </el-icon>
                <div class="preview-file-info">
                  <span class="preview-file-name">{{ item.file.name }}</span>
                  <span class="preview-file-size">{{ (item.file.size / 1024).toFixed(1) }} KB</span>
                  <span v-if="item.uploadError" class="preview-file-error">
                    <el-icon :size="12"><WarningFilled /></el-icon>
                    {{ item.uploadError }}
                  </span>
                </div>
                <div class="preview-file-actions">
                  <el-icon
                    :size="16"
                    class="preview-icon"
                    @click.stop="handlePreviewFile(item)"
                  >
                    <Document />
                  </el-icon>
                  <el-icon
                    :size="16"
                    class="preview-remove-icon"
                    @click.stop="handleRemove(item)"
                  >
                    <Close />
                  </el-icon>
                </div>
              </div>
              <div
                class="file-preview-item add-file-item"
                @click="triggerFileSelect"
              >
                <el-icon :size="32" class="add-file-icon">
                  <Plus />
                </el-icon>
                <div class="preview-file-info">
                  <span class="preview-file-name">添加文件</span>
                </div>
              </div>
              <input
                ref="fileInputRef"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.aac,.m4a,.flac,.wma,.mp4,.avi,.mkv,.mov,.webm,.flv,.wmv,.zip,.rar,.7z,.tar,.gz"
                style="display: none"
                @change="handleFileInputChange"
              />
            </div>
          </div>

          <div class="upload-content-right" v-if="currentFileForm">
            <div v-if="currentFileForm.isAnalyzing" class="analyzing-tip">
              <el-icon class="is-loading" :size="16"><Loading /></el-icon>
              <span>AI 正在解析文件，请稍候...</span>
            </div>
            <div class="form-item">
              <label class="form-label">文件名</label>
              <el-input
                v-model="currentFileForm.title"
                placeholder="请输入文件名"
                class="form-input"
                :disabled="currentFileForm.isAnalyzing"
              />
            </div>
            <div class="form-item">
              <label class="form-label">关键词</label>
              <el-input
                v-model="currentFileForm.keywords"
                placeholder="关键词，用逗号或空格分隔"
                class="form-input"
                :disabled="currentFileForm.isAnalyzing"
              />
            </div>
            <div class="form-item">
              <label class="form-label">公开/私密</label>
              <el-radio-group v-model="currentFileForm.scope" class="scope-group">
                <el-radio value="public">公开</el-radio>
                <el-radio value="private">私密</el-radio>
              </el-radio-group>
            </div>
            <div class="form-item">
              <label class="form-label">文件描述</label>
              <el-input
                v-model="currentFileForm.description"
                type="textarea"
                :rows="3"
                placeholder="文件描述..."
                class="form-textarea"
                :disabled="currentFileForm.isAnalyzing"
              />
            </div>
            <div class="form-submit">
              <el-button type="primary" @click="handleUploadSubmit" :disabled="currentFileForm.isAnalyzing || selectedFiles.some(f => f.uploadError)">确认上传</el-button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="create-area">
        <div class="create-header">
          <div class="mode-switch-wrapper">
            <el-radio-group v-model="createMode" @change="showCreateForm = false">
              <el-radio :value="false">上传文件</el-radio>
              <el-radio :value="true">创建文件</el-radio>
            </el-radio-group>
          </div>
        </div>

        <div class="create-center">
          <el-input
            v-model="uploadForm.content"
            type="textarea"
            :rows="showCreateForm ? 6 : 15"
            placeholder="请输入文件内容（Markdown格式，便于AI读取）..."
            class="content-editor"
            :disabled="showCreateForm"
          />
          <div class="content-tip">
            <span>建议使用Markdown格式编写，大模型更容易理解和解析</span>
          </div>
          
          <div v-if="showCreateForm" class="create-form-section">
            <div class="form-item">
              <label class="form-label">文件名</label>
              <el-input
                v-model="uploadForm.title"
                placeholder="请输入文件名"
                class="form-input"
              />
            </div>
            <div class="form-item">
              <label class="form-label">关键词</label>
              <el-input
                v-model="uploadForm.keywords"
                placeholder="关键词，用逗号或空格分隔"
                class="form-input"
              />
            </div>
            <div class="form-item">
              <label class="form-label">公开/私密</label>
              <el-radio-group v-model="uploadForm.scope" class="scope-group">
                <el-radio value="public">公开</el-radio>
                <el-radio value="private">私密</el-radio>
              </el-radio-group>
            </div>
            <div class="form-item">
              <label class="form-label">文件描述</label>
              <el-input
                v-model="uploadForm.description"
                type="textarea"
                :rows="2"
                placeholder="文件描述..."
                class="form-textarea"
              />
            </div>
          </div>
          
          <div class="form-submit">
            <el-button v-if="!showCreateForm" type="primary" @click="handleConfirmInfo">确认信息</el-button>
            <template v-else>
              <el-button @click="showCreateForm = false">返回修改内容</el-button>
              <el-button type="primary" @click="handleUploadSubmit">确认创建</el-button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="file-table-section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon><FolderOpened /></el-icon>
          全部资料
          <span class="file-count">{{ displayTotalFiles }}</span>
        </h3>
      </div>

      <el-alert
        title="点击资料名可以在线预览；图片/音视频/PDF/Office 等格式均支持，也可下载到本地查看。如需修改文档内容，请先下载文件，本地修改后再重新上传。"
        type="success"
        :closable="false"
        show-icon
        class="preview-hint"
      />
      
      <div class="search-section">
        <el-input
          v-model="searchQuery"
          placeholder="搜索资料名、上传单位、上传者、上传时间、资料描述..."
          prefix-icon="Search"
          class="search-input"
        />
      </div>

      <div v-if="filteredFiles.length === 0 && !loading">
        <div v-if="listError" class="empty-state">
          <el-icon size="48" color="#f56c6c"><WarningFilled /></el-icon>
          <p>{{ listError }}</p>
          <el-button type="primary" size="small" @click="fetchFiles()">重试</el-button>
        </div>
        <div v-else class="empty-state">
          <el-icon size="48" color="#c0c4cc"><FolderOpened /></el-icon>
          <p>暂无文件，请上传</p>
        </div>
      </div>

      <div v-if="selectedDocIds.length > 0" class="batch-actions">
        <el-button type="danger" size="small" @click="handleBatchDelete">
          批量删除 ({{ selectedDocIds.length }})
        </el-button>
      </div>

      <el-table
        :data="paginatedFiles"
        border
        stripe
        :loading="loading"
        class="file-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        
        <el-table-column prop="title" label="资料名" min-width="160" align="center" show-overflow-tooltip>
          <template #default="scope">
            <div class="file-name-cell">
              <el-icon 
                :size="18" 
                :color="fileTypeColors[scope.row.fileType] || '#409eff'" 
                class="file-icon cursor-pointer"
                @click="handlePreviewDoc(scope.row.id, scope.row.title)"
              >
                <component :is="fileTypeIcons[scope.row.fileType] || 'Document'" />
              </el-icon>
              <span class="file-title cursor-pointer" @click="handlePreviewDoc(scope.row.id, scope.row.title)">{{ scope.row.title }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="collegeName" label="上传单位" min-width="120" align="center">
          <template #default="scope">
            <el-tag size="small" type="primary" effect="plain">
              {{ scope.row.collegeName || '未归属' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="author" label="上传者" min-width="100" align="center" />

        <el-table-column prop="createdAt" label="上传时间" min-width="160" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column prop="fileSize" label="文件大小" min-width="110" align="center">
          <template #default="scope">
            {{ formatFileSize(scope.row.fileSize) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="280" align="center" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button size="small" type="primary" plain :icon="Download" @click.stop="handleDownload(scope.row)">
                下载
              </el-button>
              <el-button size="small" type="warning" plain :icon="Edit" @click.stop="handleEdit(scope.row)">
                编辑
              </el-button>
              <el-button size="small" type="danger" plain :icon="Delete" @click.stop="handleDelete(scope.row)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          :current-page="currentPage"
          :page-size="pageSize"
          :total="displayTotalFiles"
          :page-sizes="[8, 10, 12, 16, 18]"
          :pager-count="6"
          layout="total, sizes, prev, pager, next, jumper"
          :hide-on-single-page="false"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <EditFileForm
      :visible="showEditDialog"
      :file="editingFile"
      @close="showEditDialog = false"
      @submit="handleEditSubmit"
    />

    <el-dialog
      v-model="showPreviewDialog"
      :title="previewFileName"
      width="800px"
      top="5vh"
      @close="handlePreviewClose"
    >
      <div class="preview-content">
        <img
          v-if="previewMediaKind === 'image'"
          :src="previewFileUrl"
          :alt="previewFileName"
          class="preview-media preview-media-image"
          @error="handlePreviewMediaError"
        />
        <video v-else-if="previewMediaKind === 'video'" :src="previewFileUrl" controls class="preview-media preview-media-video"></video>
        <audio v-else-if="previewMediaKind === 'audio'" :src="previewFileUrl" controls class="preview-media preview-media-audio"></audio>
        <iframe v-else-if="previewMediaKind === 'pdf'" class="preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
        <iframe v-else-if="isOfficePreview" class="preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
        <MarkdownViewer v-else-if="isMarkdownPreview" :content="rawMarkdownContent" class="preview-markdown" />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else v-html="sanitizedPreviewContent" class="preview-text" :class="{ 'markdown-body': previewFileName.endsWith('.md') || previewFileName.endsWith('.markdown') }"></div>
      </div>
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.doc-list-page {
  min-height: 100%;
  padding-bottom: var(--spacing-xl);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
}

.header-left {
  flex: 1;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.search-section {
  margin-bottom: var(--spacing-xl);
}

.search-input {
  max-width: 400px;
}

.edit-hint {
  margin-bottom: var(--spacing-md);
}

.upload-section {
  background: #fff;
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  margin-bottom: var(--spacing-xl);
  box-shadow: none;
  overflow: hidden;
  min-height: auto;
  transition: all 0.3s ease;
}

.mode-switch-wrapper {
  display: flex;
  align-items: center;
}

.upload-area,
.create-area {
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.upload-header,
.create-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.title-input {
  flex: 1;
  margin-right: 16px;
}

.upload-center-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  height: 100%;
  min-height: 400px;
  background: transparent;
}

.upload-content {
  flex: 1;
  display: flex;
  height: calc(100% - 50px);
}

.upload-content-left {
  width: 40%;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
  max-height: 350px;
}

.upload-content-right {
  flex: 1;
  padding: 20px;
  background: #fff;
  overflow-y: auto;
}

.analyzing-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 6px;
  color: #409eff;
  font-size: 14px;
  margin-bottom: 16px;
}

.file-preview-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-preview-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.2s;
}

.file-preview-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.file-preview-item.has-error {
  border: 1px solid #f56c6c;
  background: #fef0f0;
}

.preview-file-icon.error-icon {
  color: #f56c6c;
}

.preview-file-error {
  font-size: 12px;
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.4;
}

.preview-file-icon {
  color: #409eff;
  margin-right: 12px;
}

.preview-file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-file-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.preview-file-size {
  font-size: 12px;
  color: #909399;
}

.preview-remove-icon {
  color: #f56c6c;
  cursor: pointer;
}

.preview-remove-icon:hover {
  color: #f78989;
}

.form-item {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
}

.form-textarea {
  width: 100%;
  resize: none;
}

.form-submit {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.create-form-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e4e8ec;
}

.create-center {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
}

.content-editor {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 14px;
  resize: none;
}

.content-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.upload-footer,
.create-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.footer-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-right {
  margin-left: 16px;
}

.keywords-input {
  width: 100%;
}

.description-input {
  width: 100%;
  resize: none;
}

.scope-group {
  display: flex;
  gap: 16px;
}

.upload-dragger {
  width: 100%;
  height: 100%;
  min-height: 350px;
  border-radius: 12px;
}

.upload-dragger .el-upload-dragger {
  width: 100%;
  height: 100%;
  min-height: 350px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* ── 文件列表区域拖拽上传 ── */
.upload-content {
  position: relative;
}

.upload-content.drag-over {
  outline: 2px dashed #409eff;
  outline-offset: -2px;
  background: rgba(64, 158, 255, 0.04);
}

.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(64, 158, 255, 0.06);
  border-radius: 8px;
  pointer-events: none;
}

.drag-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: #409eff;
  font-weight: 500;
}

.upload-file-formats {
  font-size: 12px;
  color: #909399;
  margin-top: 12px;
}

.upload-file-count {
  margin-top: 8px;
  font-size: 13px;
  color: #409eff;
}

.uploaded-files-list {
  margin-top: 16px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
}

.uploaded-file-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 4px;
  margin-bottom: 6px;
  transition: all 0.2s;
}

.uploaded-file-item:hover {
  background: #f0f2f5;
}

.uploaded-file-item:last-child {
  margin-bottom: 0;
}

.file-icon {
  color: #409eff;
  margin-right: 8px;
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #909399;
  margin-right: 12px;
}

.remove-icon {
  color: #f56c6c;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-icon:hover {
  color: #f78989;
}

.file-table-section {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  padding-bottom: 80px;
  box-shadow: var(--shadow-sm);
  position: relative;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-count {
  font-size: 12px;
  font-weight: normal;
  color: var(--color-info);
  background: var(--color-bg);
  padding: 2px 8px;
  border-radius: var(--radius-lg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--color-text-secondary);
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.file-table {
  width: 100%;
}

.batch-actions {
  margin-bottom: 12px;
  padding: 12px;
  background: #fff5f5;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-table :deep(.el-table__header) {
  background: var(--color-bg);
}

.file-table :deep(.el-table__header th) {
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-bg);
  border-bottom: 2px solid var(--color-primary);
}

.file-table :deep(.el-table__body tr) {
  transition: background-color 0.2s ease;
}

.file-table :deep(.el-table__body tr:hover) {
  background: #f5f7fa;
}

.file-table :deep(.el-table__body td) {
  padding: 12px 8px;
  border-bottom: 1px solid var(--color-border);
}

/* fixed 右侧操作列：增加内边距，防止按钮边框被截断 */
.file-table :deep(.el-table__fixed-right .el-table__body td) {
  padding-left: 12px;
  padding-right: 12px;
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: nowrap;
}

/* 操作按钮更紧凑，防止两边溢出 */
.action-buttons :deep(.el-button) {
  padding: 5px 8px;
  font-size: 12px;
  --el-button-size: 24px;
}

.action-buttons :deep(.el-button .el-icon) {
  margin-right: 3px;
  font-size: 12px;
}

.file-name-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0; /* flex 容器需要此属性，子元素才能正确省略文本 */
  width: 100%;
}

.file-icon {
  flex-shrink: 0;
}

.file-title {
  min-width: 0;
  max-width: calc(100% - 28px); /* 留出图标空间，防止文字过长挤压 */
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-title:hover {
  color: var(--color-primary, #409eff);
}

.keywords-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.keyword-tag {
  background: #f0f5ff;
  color: #409eff;
  border-color: #d6e4ff;
}

.more-keywords {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.cursor-pointer {
  cursor: pointer;
}

.click-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
}

.keyword-tag-large {
  background: #f0f5ff;
  color: #409eff;
  border-color: #d6e4ff;
  margin-bottom: 4px;
}

.no-keywords {
  text-align: center;
  color: #909399;
  padding: 20px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: #fff;
  border-top: 1px solid var(--color-border);
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
}

.pagination-wrapper :deep(.el-pagination) {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-wrapper :deep(.el-pagination__btn) {
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s ease;
  backface-visibility: hidden;
}

.pagination-wrapper :deep(.el-pagination__btn:not(.is-disabled):hover) {
  transform: scale(1.15);
}

.pagination-wrapper :deep(.el-pagination__btn:not(.is-disabled):active) {
  transform: scale(0.9);
}

.pagination-wrapper :deep(.el-pagination__number) {
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s ease;
  backface-visibility: hidden;
}

.pagination-wrapper :deep(.el-pagination__number:hover) {
  transform: translate3d(0, -3px, 0) scale(1.05);
}

.pagination-wrapper :deep(.el-pagination__number.is-current) {
  animation: currentPageScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes currentPageScale {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1.1);
  }
}

.preview-file-actions {
  display: flex;
  gap: 8px;
}

.preview-icon {
  color: #409eff;
  cursor: pointer;
}

.preview-icon:hover {
  color: #66b1ff;
}

.preview-hint {
  margin-bottom: var(--spacing-md);
}

.preview-content {
  max-height: 600px;
  overflow-y: auto;
}

/* Markdown 渲染样式 */
.preview-text.markdown-body {
  line-height: 1.7;
  word-break: break-word;
  overflow-wrap: break-word;
  padding: 0;
}

.preview-text.markdown-body :deep(h1),
.preview-text.markdown-body :deep(h2),
.preview-text.markdown-body :deep(h3),
.preview-text.markdown-body :deep(h4) {
  margin: 1em 0 0.5em;
  font-weight: 600;
  line-height: 1.3;
  padding-left: 0;
}

.preview-text.markdown-body :deep(h1) { font-size: 1.4em; }
.preview-text.markdown-body :deep(h2) { font-size: 1.25em; }
.preview-text.markdown-body :deep(h3) { font-size: 1.1em; }

.preview-text.markdown-body :deep(p) {
  margin: 0.5em 0;
  padding-left: 0;
}

.preview-text.markdown-body :deep(ul),
.preview-text.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.preview-text.markdown-body :deep(li) {
  margin: 0.25em 0;
}

.preview-text.markdown-body :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.25em 1em;
  border-left: 3px solid var(--color-primary, #409eff);
  color: var(--color-text-secondary, #606266);
  background: rgba(64, 158, 255, 0.04);
  border-radius: 0 4px 4px 0;
}

.preview-text.markdown-body :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
}

.preview-text.markdown-body :deep(pre) {
  margin: 0.5em 0;
  padding: 1em;
  background: #f6f8fa;
  border-radius: 6px;
  overflow-x: auto;
}

.preview-text.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.85em;
}

.preview-text.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.preview-text.markdown-body :deep(th),
.preview-text.markdown-body :deep(td) {
  border: 1px solid var(--color-border, #e4e7ed);
  padding: 8px 12px;
  text-align: left;
}

.preview-text.markdown-body :deep(th) {
  background: var(--color-bg, #f5f7fa);
  font-weight: 600;
}

.preview-text.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border, #e4e7ed);
  margin: 1em 0;
}

.preview-text.markdown-body :deep(a) {
  color: var(--color-primary, #409eff);
  text-decoration: none;
}

.preview-text.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.preview-text.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}

.preview-text {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 预览内容容器：pre 包裹 / 占位 / 图片 / iframe */
.preview-pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  margin: 0;
}
.preview-placeholder {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary, #64748b);
}
.preview-img {
  display: block;
  max-width: 100%;
  max-height: 600px;
  margin: 0 auto;
  object-fit: contain;
}
.preview-iframe {
  width: 100%;
  height: 600px;
  border: none;
}

/* 内嵌图片/音视频预览（配合 previewMediaKind） */
.preview-media-image {
  display: block;
  max-width: 100%;
  max-height: 600px;
  margin: 0 auto;
  object-fit: contain;
}
.preview-media-video {
  display: block;
  width: 100%;
  max-height: 600px;
  margin: 0 auto;
  background: #000;
  border-radius: 4px;
}
.preview-media-audio {
  display: block;
  width: 100%;
  margin: 40px auto;
}

/* Markdown 预览容器 */
.preview-markdown {
  font-size: 14px;
  color: #303133;
  background: #fff;
  padding: 4px 0;
}
</style>