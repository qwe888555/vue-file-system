<script setup lang="ts">
import { ref, computed, onMounted, triggerRef } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Upload, Search, Close, Plus, Check } from '@element-plus/icons-vue'
import type { KnowledgeFile, Keyword } from '@/types'
import { deleteDocApi, getDocListApi, getDocDetailApi, getKeywordsApi, uploadTextApi, uploadFileApi, aiClassifyApi, previewDocApi, downloadDocApi, batchDeleteDocsApi } from '@/api/knowledge'
import mammoth from 'mammoth'
import EditFileForm from '@/components/knowledge/EditFileForm.vue'

const router = useRouter()

const searchQuery = ref('')
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
    
    const result = await previewDocApi(id)
    
    const fileExtension = title.split('.').pop()?.toLowerCase() || ''
    
    if (result.content && result.content.startsWith('http')) {
      if (fileExtension === 'pdf') {
        previewFileUrl.value = result.content
      } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
        previewFileUrl.value = result.content
      } else if (fileExtension === 'docx') {
        try {
          const response = await fetch(result.content)
          const blob = await response.blob()
          const arrayBuffer = await blob.arrayBuffer()
          const mammothResult = await mammoth.convertToHtml({ arrayBuffer })
          previewContent.value = mammothResult.value || '无法查看文件详细内容'
        } catch (mammothError) {
          console.error('mammoth解析失败:', mammothError)
          previewContent.value = '无法查看文件详细内容'
        }
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
}

function showAllKeywords(keywords: { id: number; phrase: string }[], title: string) {
  keywordsDialogTitle.value = title
  allKeywords.value = keywords
  showKeywordsDialog.value = true
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
        formData.append('scope', item.scope === 'public' ? 'school' : 'college')

        const result = await uploadFileApi(formData)
        if (result.id) {
          item.docId = result.id
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
const keywordsCache = new Map<number, Keyword[]>()
const loadingKeywords = new Set<number>()

async function fetchFiles() {
  loading.value = true
  try {
    const res = await getDocListApi({
      page: currentPage.value,
      page_size: pageSize.value,
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
      
      if (file.created_at && !file.createdAt) {
        file.createdAt = file.created_at
      }
      if (file.updated_at && !file.updatedAt) {
        file.updatedAt = file.updated_at
      }
      if (file.description && !file.summary) {
        file.summary = file.description
      }
    })
    
    if (newFiles.length === 0) {
      if (currentPage.value === 1) {
        uploadedFiles.value = []
        totalFiles.value = 0
      } else {
        totalFiles.value = (currentPage.value - 1) * pageSize.value
        currentPage.value = currentPage.value - 1
        await fetchFiles()
        return
      }
    } else {
      uploadedFiles.value = newFiles
      if (newFiles.length < pageSize.value) {
        totalFiles.value = (currentPage.value - 1) * pageSize.value + newFiles.length
      } else {
        const backendTotal = res.total || res.count || 0
        totalFiles.value = backendTotal || (currentPage.value * pageSize.value)
      }
    }
    
  } catch (error: any) {
    console.error('获取文件列表失败:', error)
    if (error.response?.status === 404 && currentPage.value > 1) {
      currentPage.value = 1
      await fetchFiles()
    } else if (error.response?.status === 401) {
      console.warn('Token过期，需要重新登录')
    }
  } finally {
    loading.value = false
  }
}

async function loadKeywordsForFiles(files: KnowledgeFile[]) {
  const filesToLoad = files.filter(f => !keywordsCache.has(f.id) && !loadingKeywords.has(f.id))
  
  const semaphore = 3
  let activeCount = 0
  let index = 0
  
  async function loadNext() {
    while (index < filesToLoad.length) {
      if (activeCount >= semaphore) {
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }
      
      const file = filesToLoad[index++]
      activeCount++
      loadingKeywords.add(file.id)
      
      try {
        const keywords = await getKeywordsApi(file.id)
        let keywordList: Keyword[] = []
        if (Array.isArray(keywords)) {
          keywordList = keywords.map((kw: any) => ({
            id: kw.id,
            phrase: kw.phrase || kw.keyword || kw.name || '',
            match_type: kw.match_type || 'exact',
            weight: kw.weight || 1,
          })).filter((kw: Keyword) => kw.phrase)
        }
        keywordsCache.set(file.id, keywordList)
        
        const fileIndex = uploadedFiles.value.findIndex(f => f.id === file.id)
        if (fileIndex > -1) {
          uploadedFiles.value[fileIndex].keywords = keywordList
          triggerRef(uploadedFiles)
        }
      } catch (error) {
        console.error(`获取文件 ${file.title} 的关键词失败:`, error)
      } finally {
        loadingKeywords.delete(file.id)
        activeCount--
      }
    }
  }
  
  await loadNext()
}

onMounted(() => {
  fetchFiles()
})

const filteredFiles = computed(() => {
  if (!searchQuery.value) return uploadedFiles.value
  const query = searchQuery.value.toLowerCase()
  return uploadedFiles.value.filter(
    (file) =>
      file.title.toLowerCase().includes(query) ||
      (file.summary && file.summary.toLowerCase().includes(query)) ||
      (file.author && file.author.toLowerCase().includes(query)) ||
      (file.collegeName && file.collegeName.toLowerCase().includes(query)) ||
      (file.keywords && file.keywords.some((kw) => kw.phrase.toLowerCase().includes(query)))
  )
})

const paginatedFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredFiles.value.slice(start, end)
})

function handleCurrentChange(page: number) {
  if (page < 1) {
    currentPage.value = 1
    return
  }
  currentPage.value = page
  fetchFiles()
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

function handleFileClick(file: KnowledgeFile) {
  handlePreviewDoc(file.id, file.title)
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

async function handleDownload(file: KnowledgeFile) {
  try {
    const { data: blob } = await downloadDocApi(file.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const extMap: Record<string, string> = {
      doc: '.doc',
      docx: '.docx',
      pdf: '.pdf',
      txt: '.txt',
      md: '.md',
      image: '.jpg',
      audio: '.mp3',
      video: '.mp4',
      archive: '.zip',
    }
    const ext = extMap[file.fileType] || ''
    const fileName = file.title && !file.title.includes('.') 
      ? `${file.title}${ext}` 
      : (file.title || `文件${file.id}${ext}`)
    
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch (error) {
    console.error('下载文件失败:', error)
    ElMessage.error('下载文件失败')
  }
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

function handleEditSubmit(data: { title: string; description: string; keywords: Keyword[] }) {
  if (editingFile.value) {
    editingFile.value.title = data.title
    editingFile.value.summary = data.description
    editingFile.value.keywords = data.keywords
    saveFiles(uploadedFiles.value)
    ElMessage.success('编辑成功')
    fetchFiles()
  }
  showEditDialog.value = false
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

    <div class="search-section">
      <el-input
        v-model="searchQuery"
        placeholder="搜索文件名、学院/部门、作者、关键词、文件描述..."
        prefix-icon="Search"
        class="search-input"
      />
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
            <el-icon :size="48" color="#c0c4cc"><Upload /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
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
          全部文件
          <span class="file-count">{{ totalFiles }}</span>
        </h3>
      </div>

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
        
        <el-table-column prop="title" label="文件名" min-width="200" show-overflow-tooltip>
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
              <span class="file-title">{{ scope.row.title }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="categoryName" label="分类" min-width="120" align="center">
          <template #default="scope">
            <el-tag size="small" type="info" effect="plain">
              {{ scope.row.categoryName || '未分类' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="collegeName" label="学院" min-width="120" align="center">
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

        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="scope">
            <el-button size="small" @click.stop="handleDownload(scope.row)" type="primary" link>
              下载
            </el-button>
            <el-button size="small" @click.stop="handleEdit(scope.row)" type="primary" link>
              编辑
            </el-button>
            <el-button size="small" @click.stop="handleDelete(scope.row)" type="danger" link>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          :current-page="currentPage"
          :page-size="pageSize"
          :total="totalFiles"
          :page-sizes="[8, 10, 12, 16, 18]"
          :pager-count="6"
          layout="total, sizes, prev, pager, next, jumper"
          :hide-on-single-page="false"
          @current-change="handleCurrentChange"
          @size-change="(size) => { pageSize.value = size; currentPage.value = 1; fetchFiles(); }"
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
        <iframe v-if="previewFileUrl && previewFileName.endsWith('.pdf')" :src="previewFileUrl" style="width: 100%; height: 600px;" frameborder="0"></iframe>
        <img v-else-if="previewFileUrl" :src="previewFileUrl" style="max-width: 100%; max-height: 600px; object-fit: contain;" />
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

.upload-section {
  background: #fff;
  border: 3px dashed #409eff;
  border-radius: var(--radius-lg);
  padding: 0;
  margin-bottom: var(--spacing-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  min-height: 650px;
  transition: all 0.3s ease;
}

.upload-section:hover {
  border-color: #66b1ff;
  box-shadow: var(--shadow-xl);
}

.mode-switch-wrapper {
  display: flex;
  align-items: center;
}

.upload-area,
.create-area {
  display: flex;
  flex-direction: column;
  min-height: 650px;
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
  min-height: 650px;
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
  height: 650px;
  border-radius: 12px;
}

.upload-dragger .el-upload-dragger {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
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