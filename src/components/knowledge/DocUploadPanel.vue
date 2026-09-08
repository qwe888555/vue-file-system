<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, triggerRef } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
import { Upload, Close, Plus, Check, Document, WarningFilled, Loading } from '@element-plus/icons-vue'
import type { KnowledgeFile } from '@/types'
import { uploadTextApi, uploadFileApi, aiClassifyApi, addKeywordsApi } from '@/api/knowledge'
import { uploadFileToOss } from '@/utils/oss-upload'
import { cacheDesc, cacheKeywords } from '@/utils/docCache'

const props = defineProps<{
  /** 已存在的资料标题列表（用于重名校验） */
  existingTitles?: string[]
}>()

const emit = defineEmits<{
  (e: 'uploaded'): void
  (e: 'preview-file', file: File, docId?: number): void
}>()

const createMode = ref(false)

interface FileItem {
  file: File
  docId?: number
  previewContent?: string
  title: string
  keywords: string
  keywordOptions: string[]
  checkedKeywords: string[]
  description: string
  scope: 'public' | 'private'
  isAnalyzing: boolean
  uploadError?: string
}

const selectedFiles = ref<FileItem[]>([])
const selectedFileIndex = ref(0)

// ── 文件列表区域拖拽上传状态 ──
const isDragOver = ref(false)
let dragCounter = 0
// 稳定的空数组引用，避免每次渲染传新 [] 导致 el-upload 内部状态重置
const emptyFileList = ref<never[]>([])
const uploadRef = ref()
const showCreateForm = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const currentFileForm = computed(() => {
  if (selectedFiles.value.length > 0 && selectedFiles.value[selectedFileIndex.value]) {
    return selectedFiles.value[selectedFileIndex.value]
  }
  return null
})

const uploadForm = ref({
  title: '',
  keywords: '',
  keywordOptions: [] as string[],
  checkedKeywords: [] as string[],
  description: '',
  content: '',
  scope: 'public',
})

function resetUploadForm() {
  selectedFiles.value = []
  uploadRef.value?.clearFiles()
  showCreateForm.value = false
  uploadForm.value = {
    title: '',
    keywords: '',
    keywordOptions: [],
    checkedKeywords: [],
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

/** 支持的扩展名白名单（后端允许的扩展名，逐类有大小限制） */
const SUPPORTED_EXTENSIONS = [
  // 文档类
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'md', 'html',
  // 图片类（30MB 限制）
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif',
  // 音频类（50MB 限制）
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'amr',
  // 视频类（500MB 限制）
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v',
  // 压缩包（80MB 限制）
  'zip', 'rar', '7z',
  // 设计源文件（100MB 限制）
  'psd', 'ai',
  // 3D 模型（200MB 限制）
  'stl', 'obj', 'fbx',
  // 电子书（50MB 限制）
  'epub', 'pub',
]

/** 文件大小限制映射（单位：字节） */
const FILE_SIZE_LIMITS: Record<string, number> = {
  // PDF: 50MB
  pdf: 50 * 1024 * 1024,
  // Word: 30MB
  doc: 30 * 1024 * 1024,
  docx: 30 * 1024 * 1024,
  // Excel: 30MB
  xls: 30 * 1024 * 1024,
  xlsx: 30 * 1024 * 1024,
  csv: 30 * 1024 * 1024,
  // PPT: 50MB
  ppt: 50 * 1024 * 1024,
  pptx: 50 * 1024 * 1024,
  // 文本: 50MB
  txt: 50 * 1024 * 1024,
  md: 50 * 1024 * 1024,
  html: 50 * 1024 * 1024,
  // 图片: 30MB
  jpg: 30 * 1024 * 1024,
  jpeg: 30 * 1024 * 1024,
  png: 30 * 1024 * 1024,
  gif: 30 * 1024 * 1024,
  webp: 30 * 1024 * 1024,
  bmp: 30 * 1024 * 1024,
  tiff: 30 * 1024 * 1024,
  tif: 30 * 1024 * 1024,
  // 音频: 50MB
  mp3: 50 * 1024 * 1024,
  wav: 50 * 1024 * 1024,
  ogg: 50 * 1024 * 1024,
  flac: 50 * 1024 * 1024,
  aac: 50 * 1024 * 1024,
  m4a: 50 * 1024 * 1024,
  amr: 50 * 1024 * 1024,
  // 视频: 500MB
  mp4: 500 * 1024 * 1024,
  webm: 500 * 1024 * 1024,
  mov: 500 * 1024 * 1024,
  avi: 500 * 1024 * 1024,
  mkv: 500 * 1024 * 1024,
  flv: 500 * 1024 * 1024,
  m4v: 500 * 1024 * 1024,
  // 压缩包: 80MB
  zip: 80 * 1024 * 1024,
  rar: 80 * 1024 * 1024,
  '7z': 80 * 1024 * 1024,
  // 设计源文件: 100MB
  psd: 100 * 1024 * 1024,
  ai: 100 * 1024 * 1024,
  // 3D 模型: 200MB
  stl: 200 * 1024 * 1024,
  obj: 200 * 1024 * 1024,
  fbx: 200 * 1024 * 1024,
  // 电子书: 50MB
  epub: 50 * 1024 * 1024,
  pub: 50 * 1024 * 1024,
}

/** 校验文件是否可上传，返回错误原因或 null */
function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  // 1. 格式校验
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    return `不支持的文件格式 ".${ext || '未知'}"，支持：PDF、Word、Excel、PPT、CSV、TXT、Markdown、HTML、图片、音视频、压缩包、设计文件、3D模型、电子书（共43种扩展名）`
  }

  // 2. 大小校验
  const maxSize = FILE_SIZE_LIMITS[ext]
  if (maxSize && file.size > maxSize) {
    const limitMB = (maxSize / (1024 * 1024)).toFixed(0)
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
    return `文件大小超出限制：${ext.toUpperCase()} 文件最大支持 ${limitMB}MB，当前文件 ${sizeMB}MB`
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
    keywordOptions: [] as string[],
    checkedKeywords: [] as string[],
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
async function classifyFile(fileItem: FileItem, file: File) {
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
        console.warn('[DocUploadPanel] 文本提取失败，使用兜底:', extractErr)
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
      const kws = result.keywords.map((kw) => kw.trim()).filter((kw) => kw)
      fileItem.keywordOptions = kws
      fileItem.checkedKeywords = [...kws]
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
    console.error('[DocUploadPanel] AI分类失败:', error)
    ElMessage.warning(`"${file.name}" AI 分类失败，请手动填写信息`)
    // AI 解析失败，也更新状态
    fileItem.isAnalyzing = false
    triggerRef(selectedFiles)
  }
}

function handleRemove(item: FileItem) {
  const index = selectedFiles.value.indexOf(item)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  }

  if (selectedFiles.value.length === 0) {
    selectedFileIndex.value = 0
    uploadRef.value?.clearFiles()
  } else if (selectedFileIndex.value >= selectedFiles.value.length) {
    selectedFileIndex.value = selectedFiles.value.length - 1
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
    console.warn('[DocUploadPanel] onUploadChange: 无法获取 File 对象', uploadFile)
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

function keywordsOf(item: FileItem): string[] {
  if (item.keywordOptions.length > 0) {
    return item.checkedKeywords.map((kw) => kw.trim()).filter((kw) => kw)
  }
  return item.keywords.split(/[,，、\s]+/).map((kw) => kw.trim()).filter((kw) => kw)
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
      const kws = result.keywords.map((kw) => kw.trim()).filter((kw) => kw)
      uploadForm.value.keywordOptions = kws
      uploadForm.value.checkedKeywords = [...kws]
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
    if (uploadForm.value.keywordOptions.length > 0) {
      keywords = uploadForm.value.checkedKeywords.map((kw) => kw.trim()).filter((kw) => kw)
    } else {
      if (!uploadForm.value.keywords) {
        ElMessage.warning('请输入关键词')
        return
      }
      keywords = uploadForm.value.keywords
        .split(/[,，、\s]+/)
        .map((kw) => kw.trim())
        .filter((kw) => kw)
    }

    if (keywords.length === 0) {
      ElMessage.warning(uploadForm.value.keywordOptions.length > 0 ? '请至少勾选一个关键词' : '请输入关键词')
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
      const itemKeywords = keywordsOf(item)
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
      emit('uploaded')
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

    const existingTitles = props.existingTitles || []
    for (const item of selectedFiles.value) {
      if (existingTitles.includes(item.title)) {
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

        // 将用户勾选后的关键词整理成数组
        const uploadKeywords = keywordsOf(item)

        let result: KnowledgeFile

        if (file.size > LARGE_FILE_THRESHOLD) {
          // ── 大文件：走 OSS 分片直传（无超时，支持断点续传） ──
          try {
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
          } catch (ossError) {
            // OSS 上传失败（如 CORS 错误），降级到后端中转上传
            console.warn('[DocUploadPanel] OSS 上传失败，降级到后端中转:', ossError)
            loadingInstance.setText(`正在上传中... ${i + 1}/${totalCount}：${file.name}（后端中转）`)

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
      emit('uploaded')
    } catch (error) {
      console.error('文件上传失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '文件上传失败，请重试')
    } finally {
      loadingInstance.close()
    }
  }
}
</script>

<template>
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
          ref="uploadRef"
          :auto-upload="false"
          :file-list="emptyFileList"
          @change="onUploadChange"
          drag
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.html,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.mp3,.wav,.ogg,.flac,.aac,.m4a,.amr,.mp4,.webm,.mov,.avi,.mkv,.flv,.m4v,.zip,.rar,.7z,.psd,.ai,.stl,.obj,.fbx,.epub,.pub"
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
                  @click.stop="emit('preview-file', item.file, item.docId)"
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.html,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.mp3,.wav,.ogg,.flac,.aac,.m4a,.amr,.mp4,.webm,.mov,.avi,.mkv,.flv,.m4v,.zip,.rar,.7z,.psd,.ai,.stl,.obj,.fbx,.epub,.pub"
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
            <el-checkbox-group
              v-if="currentFileForm.keywordOptions.length > 0"
              v-model="currentFileForm.checkedKeywords"
              class="keyword-checkbox-group"
              :disabled="currentFileForm.isAnalyzing"
            >
              <el-checkbox v-for="kw in currentFileForm.keywordOptions" :key="kw" :value="kw" class="keyword-checkbox">{{ kw }}</el-checkbox>
            </el-checkbox-group>
            <el-input
              v-else
              v-model="currentFileForm.keywords"
              placeholder="关键词，用逗号或空格分隔"
              class="form-input"
              :disabled="currentFileForm.isAnalyzing"
            />
          </div>
          <div class="form-item">
            <label class="form-label">公开/私密</label>
            <el-radio-group v-model="currentFileForm.scope" class="scope-group">
              <el-tooltip content="公开文件：全校共享资源，登录后全校所有师生均可在知识库中查看、搜索和下载。" placement="top" effect="dark">
                <el-radio value="public">公开</el-radio>
              </el-tooltip>
              <el-tooltip content="私密文件：仅文件所属学院（本单位）的成员可以查看和下载，其他学院用户不可见。" placement="top" effect="dark">
                <el-radio value="private">私密</el-radio>
              </el-tooltip>
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
            <el-checkbox-group
              v-if="uploadForm.keywordOptions.length > 0"
              v-model="uploadForm.checkedKeywords"
              class="keyword-checkbox-group"
            >
              <el-checkbox v-for="kw in uploadForm.keywordOptions" :key="kw" :value="kw" class="keyword-checkbox">{{ kw }}</el-checkbox>
            </el-checkbox-group>
            <el-input
              v-else
              v-model="uploadForm.keywords"
              placeholder="关键词，用逗号或空格分隔"
              class="form-input"
            />
          </div>
          <div class="form-item">
            <label class="form-label">公开/私密</label>
            <el-radio-group v-model="uploadForm.scope" class="scope-group">
              <el-tooltip content="公开文件：全校共享资源，登录后全校所有师生均可在知识库中查看、搜索和下载。" placement="top" effect="dark">
                <el-radio value="public">公开</el-radio>
              </el-tooltip>
              <el-tooltip content="私密文件：仅文件所属学院（本单位）的成员可以查看和下载，其他学院用户不可见。" placement="top" effect="dark">
                <el-radio value="private">私密</el-radio>
              </el-tooltip>
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
</template>

<style scoped>
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

.keyword-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}

.keyword-checkbox {
  margin-right: 0;
  height: auto;
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
</style>
