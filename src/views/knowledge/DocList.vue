<script setup lang="ts">
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, onMounted, triggerRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Upload, Close, Plus, Check, Download, Edit, Delete } from '@element-plus/icons-vue'
import type { KnowledgeFile, Keyword } from '@/types'
import { deleteDocApi, getDocListApi, getKeywordsApi, uploadTextApi, uploadFileApi, aiClassifyApi, previewDocApi, batchDeleteDocsApi, addKeywordsApi } from '@/api/knowledge'
import mammoth from 'mammoth'
import EditFileForm from '@/components/knowledge/EditFileForm.vue'

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

const createMode = ref(false)
const selectedFiles = ref<{ file: File; docId?: number; previewContent?: string; title: string; keywords: string; description: string; scope: 'public' | 'private' }[]>([])
const selectedFileIndex = ref(0)
const showCreateForm = ref(false)
const showPreviewDialog = ref(false)
const previewContent = ref('')
const previewFileName = ref('')
const previewFileUrl = ref('')
const isOfficePreview = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const showKeywordsDialog = ref(false)
const keywordsDialogTitle = ref('')
const allKeywords = ref<{ id: number; phrase: string }[]>([])

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

async function handleFileChange(file: File) {
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  const newFileItem = {
    file,
    title: baseName,
    keywords: '',
    description: '',
    scope: 'public' as const,
  }
  
  selectedFiles.value.push(newFileItem)
  selectedFileIndex.value = selectedFiles.value.length - 1
  
  try {
    const content = await extractTextFromFile(file)
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('content', content)
    formData.append('filename', file.name)
    
    const result = await aiClassifyApi(formData)
    
    if (result.title) {
      newFileItem.title = result.title
    }
    if (result.keywords && result.keywords.length > 0) {
      newFileItem.keywords = result.keywords.join(', ')
    }
    if (result.description) {
      newFileItem.description = result.description
    }
    if (result.scope) {
      newFileItem.scope = result.scope === 'school' ? 'public' : 'private'
    }
    
    triggerRef(selectedFiles)
  } catch (error) {
    console.error('AI分类失败:', error)
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
      const arrayBuffer = await item.file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      previewContent.value = `<pre style="white-space: pre-wrap; word-break: break-word; max-height: 600px; overflow-y: auto;">${result.value}</pre>`
      showPreviewDialog.value = true
    } catch (error) {
      console.error('预览Word文档失败:', error)
      previewContent.value = '<div style="text-align: center; padding: 40px;">浏览器无法直接预览此文件。请下载文件后使用Word等文档软件打开查看。</div>'
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
          previewContent.value = '<div style="text-align: center; padding: 40px;">浏览器无法直接预览此文件。请下载文件后使用PDF阅读器打开查看。</div>'
          showPreviewDialog.value = true
        }
      } catch (error) {
        console.error('预览文件失败:', error)
        previewContent.value = '<div style="text-align: center; padding: 40px;">预览失败，请重试。</div>'
        showPreviewDialog.value = true
      }
    } else {
      previewContent.value = '<div style="text-align: center; padding: 40px;">PDF文件需要先上传才能预览。</div>'
      showPreviewDialog.value = true
    }
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      previewContent.value = `<img src="${content}" style="max-width: 100%; max-height: 600px; object-fit: contain;" />`
      showPreviewDialog.value = true
    }
    reader.readAsDataURL(item.file)
  } else if (['txt', 'md', 'json', 'xml', 'csv'].includes(ext || '')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      previewContent.value = `<pre style="white-space: pre-wrap; word-break: break-word; max-height: 600px; overflow-y: auto;">${content}</pre>`
      showPreviewDialog.value = true
    }
    reader.readAsText(item.file)
  } else {
    previewContent.value = '<div style="text-align: center; padding: 40px;">浏览器无法直接预览此文件格式。请下载文件后使用相应软件打开查看。</div>'
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

async function handlePreviewDoc(id: number, title: string) {
  try {
    previewFileName.value = title
    previewContent.value = ''
    previewFileUrl.value = ''
    isOfficePreview.value = false
    
    const result = await previewDocApi(id)
    
    const fileExtension = title.split('.').pop()?.toLowerCase() || ''
    
    if (result.content && result.content.startsWith('http')) {
      if (fileExtension === 'pdf') {
        previewFileUrl.value = result.content
      } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
        previewFileUrl.value = result.content
      } else if (result.preview_type === 'url' && result.file_type === 'document') {
        previewFileUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(result.content)}`
        isOfficePreview.value = true
      } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'wps', 'et', 'dps'].includes(fileExtension)) {
        previewFileUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(result.content)}`
        isOfficePreview.value = true
      } else if (fileExtension === 'txt') {
        try {
          const response = await fetch(result.content)
          const text = await response.text()
          previewContent.value = `<pre style="white-space: pre-wrap; word-break: break-word; max-height: 600px; overflow-y: auto;">${text || '无法查看文件详细内容'}</pre>`
        } catch (error) {
          console.error('获取文本内容失败:', error)
          previewContent.value = '无法查看文件详细内容'
        }
      } else {
        previewContent.value = '无法查看文件详细内容'
      }
    } else if (result.content) {
      if (result.preview_type === 'html' || result.file_type === 'pdf') {
        previewContent.value = result.content
      } else {
        previewContent.value = `<pre style="white-space: pre-wrap; word-break: break-word; max-height: 600px; overflow-y: auto;">${result.content}</pre>`
      }
    } else {
      previewContent.value = '无法查看文件详细内容'
    }
    
    showPreviewDialog.value = true
  } catch (error) {
    console.error('获取文件预览失败:', error)
    ElMessage.error('获取文件预览失败')
  }
}

function handlePreviewClose() {
  if (previewFileUrl.value) {
    URL.revokeObjectURL(previewFileUrl.value)
    previewFileUrl.value = ''
  }
  previewContent.value = ''
  isOfficePreview.value = false
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

    try {
      const result = await uploadTextApi({
        title: uploadForm.value.title,
        content: uploadForm.value.content,
        description: uploadForm.value.description || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        scope: uploadForm.value.scope === 'public' ? 'school' : 'college',
      })
      console.log('创建文件结果:', result)
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

    try {
      let successCount = 0
      const totalCount = selectedFiles.value.length
      
      for (let i = 0; i < totalCount; i++) {
        const item = selectedFiles.value[i]
        const file = item.file
        const fileName = file.name.replace(/\.[^/.]+$/, '')
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', item.title || fileName)
        if (item.description) {
          formData.append('description', item.description)
        }
        // 将用户修改后的关键词也发给后端
        const uploadKeywords = item.keywords
          .split(/[,，、\s]+/)
          .map((kw: string) => kw.trim())
          .filter((kw: string) => kw)
        uploadKeywords.forEach((kw: string) => formData.append('keywords', kw))
        formData.append('scope', item.scope === 'public' ? 'school' : 'college')

        const result = await uploadFileApi(formData)
        if (result.id) {
          item.docId = result.id
          // 缓存描述，防止 fetchFiles 刷新后丢失
          if (item.description) {
            cacheDesc(result.id, item.description)
          }
          // 手动写入关键词 + 本地缓存（后端异步 AI 提取可能覆盖用户修改）
          if (uploadKeywords.length > 0) {
            try { await addKeywordsApi(result.id, uploadKeywords) } catch {}
            cacheKeywords(result.id, uploadKeywords.map((phrase: string) => ({
              id: 0, phrase, match_type: 'exact', weight: 1,
            })))
          }
        }
        successCount++
      }

      console.log('文件上传结果:', `${successCount}/${totalCount}`)
      ElMessage.success(`${successCount}/${totalCount} 个文件上传成功`)
      resetUploadForm()
      fetchFiles()
    } catch (error) {
      console.error('文件上传失败:', error)
      ElMessage.error('文件上传失败，请重试')
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
  try {
    const res = await getDocListApi({
      page: 1,
      page_size: 1000,
      keyword: keyword || undefined,
    })
    console.log('文档列表响应:', JSON.stringify(res, null, 2))
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
  archive: '#9b59b6',
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
  localStorage.setItem('uploadedFiles', JSON.stringify(files))
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

        <div v-if="selectedFiles.length === 0" class="upload-center-empty">
          <el-upload
            :auto-upload="false"
            :file-list="[]"
            :on-change="(file) => { if (file.raw) handleFileChange(file.raw) }"
            drag
            multiple
            accept=".pdf,.doc,.docx,.txt,.jpg,.png,.gif,.mp3,.wav,.mp4,.avi,.mkv,.zip,.rar"
            class="upload-dragger"
          >
            <el-icon :size="300" color="#c0c4cc"><Upload /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <div class="upload-file-formats">
              支持 PDF、Word、TXT、图片、音视频等格式
            </div>
          </el-upload>
        </div>

        <div v-else class="upload-content">
          <div class="upload-content-left">
            <div class="file-preview-list">
              <div
                v-for="(item, index) in selectedFiles"
                :key="index"
                class="file-preview-item"
                :class="{ 'selected': selectedFileIndex === index }"
                @click="selectedFileIndex = index"
              >
                <div class="file-selection-indicator" :class="{ 'selected': selectedFileIndex === index }">
                  <el-icon v-if="selectedFileIndex === index" :size="14">
                    <Check />
                  </el-icon>
                </div>
                <el-icon :size="32" class="preview-file-icon">
                  <Document />
                </el-icon>
                <div class="preview-file-info">
                  <span class="preview-file-name">{{ item.file.name }}</span>
                  <span class="preview-file-size">{{ (item.file.size / 1024).toFixed(1) }} KB</span>
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
                accept=".pdf,.doc,.docx,.txt,.jpg,.png,.gif,.mp3,.wav,.mp4,.avi,.mkv,.zip,.rar"
                style="display: none"
                @change="handleFileInputChange"
              />
            </div>
          </div>

          <div class="upload-content-right" v-if="currentFileForm">
            <div class="form-item">
              <label class="form-label">文件名</label>
              <el-input
                v-model="currentFileForm.title"
                placeholder="请输入文件名"
                class="form-input"
              />
            </div>
            <div class="form-item">
              <label class="form-label">关键词</label>
              <el-input
                v-model="currentFileForm.keywords"
                placeholder="关键词，用逗号或空格分隔"
                class="form-input"
              />
            </div>
            <div class="form-item">
              <label class="form-label">公开/私密</label>
              <el-radio-group v-model="currentFileForm.scope" class="scope-group">
                <el-radio label="public">公开</el-radio>
                <el-radio label="private">私密</el-radio>
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
              />
            </div>
            <div class="form-submit">
              <el-button type="primary" @click="handleUploadSubmit">确认上传</el-button>
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
                <el-radio label="public">公开</el-radio>
                <el-radio label="private">私密</el-radio>
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
      
      <div class="search-section">
        <el-input
          v-model="searchQuery"
          placeholder="搜索资料名、上传单位、上传者、上传时间、资料描述..."
          prefix-icon="Search"
          class="search-input"
        />
      </div>

      <el-alert
        title="如需修改文档内容，请先下载文件，本地修改后再重新上传"
        type="info"
        :closable="false"
        show-icon
        class="edit-hint"
      />

      <div v-if="filteredFiles.length === 0" class="empty-state">
        <el-icon size="48" color="#c0c4cc"><FolderOpened /></el-icon>
        <p>暂无文件，请上传</p>
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
        
        <el-table-column prop="title" label="资料名" min-width="200" show-overflow-tooltip>
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

        <el-table-column label="操作" width="240" align="center" fixed="right">
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
        <iframe v-if="isOfficePreview" :src="previewFileUrl" style="width: 100%; height: 600px;" frameborder="0"></iframe>
        <iframe v-else-if="previewFileUrl && previewFileName.endsWith('.pdf')" :src="previewFileUrl" style="width: 100%; height: 600px;" frameborder="0"></iframe>
        <img v-else-if="previewFileUrl" :src="previewFileUrl" style="max-width: 100%; max-height: 600px; object-fit: contain;" />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else v-html="previewContent" class="preview-text"></div>
      </div>
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showKeywordsDialog"
      :title="keywordsDialogTitle + ' - 全部关键词'"
      width="400px"
      top="30vh"
    >
      <div class="keywords-list">
        <el-tag
          v-for="kw in allKeywords"
          :key="kw.id"
          size="medium"
          class="keyword-tag-large"
        >
          {{ kw.phrase }}
        </el-tag>
        <div v-if="allKeywords.length === 0" class="no-keywords">
          暂无关键词
        </div>
      </div>
      <template #footer>
        <el-button @click="showKeywordsDialog = false">关闭</el-button>
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

.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  flex-shrink: 0;
}

.file-title {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
  transition: color 0.2s;
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

.preview-content {
  max-height: 600px;
  overflow-y: auto;
}

.preview-text {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-all;
}

</style>