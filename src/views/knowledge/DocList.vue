<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Upload, Search, Close } from '@element-plus/icons-vue'
import type { KnowledgeFile, Keyword } from '@/types'
import { deleteDocApi, getDocListApi, getKeywordsApi, uploadTextApi, uploadFileApi, aiClassifyApi, previewDocApi } from '@/api/knowledge'
import EditFileForm from '@/components/knowledge/EditFileForm.vue'

const router = useRouter()

const searchQuery = ref('')
const showEditDialog = ref(false)
const editingFile = ref<KnowledgeFile | null>(null)
const loading = ref(false)

const createMode = ref(true)
const selectedFiles = ref<{ file: File; docId?: number; previewContent?: string }[]>([])
const showCreateForm = ref(false)
const showPreviewDialog = ref(false)
const previewContent = ref('')
const previewFileName = ref('')

const uploadForm = ref({
  title: '',
  keywords: '',
  description: '',
  content: '',
  scope: 'public' as 'public' | 'private',
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

async function handleFileChange(file: File) {
  selectedFiles.value.push({ file })
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  if (!uploadForm.value.title) {
    uploadForm.value.title = baseName
  }
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const result = await aiClassifyApi(formData)
    
    if (result.title && !uploadForm.value.title) {
      uploadForm.value.title = result.title
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
  } catch (error) {
    console.error('AI分类失败:', error)
  }
}

function handleRemove(item: { file: File; docId?: number; previewContent?: string }) {
  const index = selectedFiles.value.indexOf(item)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  }
}

async function handlePreviewFile(item: { file: File; docId?: number; previewContent?: string }) {
  previewFileName.value = item.file.name
  
  if (item.docId && item.previewContent) {
    previewContent.value = item.previewContent
    showPreviewDialog.value = true
    return
  }
  
  if (item.docId) {
    try {
      const result = await previewDocApi(item.docId)
      item.previewContent = result.content || '无法预览此文件内容'
      previewContent.value = item.previewContent
      showPreviewDialog.value = true
      return
    } catch (error) {
      console.error('预览文件失败:', error)
    }
  }
  
  const ext = item.file.name.split('.').pop()?.toLowerCase()
  if (['pdf', 'doc', 'docx'].includes(ext || '')) {
    ElMessage.info('正在上传文件以获取预览内容...')
    try {
      const fileName = item.file.name.replace(/\.[^/.]+$/, '')
      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('title', uploadForm.value.title || fileName)
      if (uploadForm.value.description) {
        formData.append('description', uploadForm.value.description)
      }
      formData.append('scope', uploadForm.value.scope === 'public' ? 'school' : 'college')
      
      const result = await uploadFileApi(formData)
      
      if (result.id) {
        item.docId = result.id
        
        const previewResult = await previewDocApi(result.id)
        item.previewContent = previewResult.content || '无法预览此文件内容'
        previewContent.value = item.previewContent
        showPreviewDialog.value = true
      } else {
        previewContent.value = '文件上传成功，但无法获取文档ID进行预览。'
        showPreviewDialog.value = true
      }
    } catch (error) {
      console.error('上传文件失败:', error)
      previewContent.value = '文件上传失败，无法预览。'
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
  } else {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      previewContent.value = content
      showPreviewDialog.value = true
    }
    reader.readAsText(item.file)
  }
}

async function handlePreviewDoc(id: number, title: string) {
  try {
    previewFileName.value = title
    const result = await previewDocApi(id)
    previewContent.value = result.content || '无法预览此文件内容'
    showPreviewDialog.value = true
  } catch (error) {
    console.error('预览文件失败:', error)
    ElMessage.error('预览文件失败')
  }
}

async function handleConfirmInfo() {
  if (!uploadForm.value.content.trim()) {
    ElMessage.warning('请输入文件内容')
    return
  }

  try {
    const blob = new Blob([uploadForm.value.content], { type: 'text/plain' })
    const file = new File([blob], 'content.txt', { type: 'text/plain' })
    
    const formData = new FormData()
    formData.append('file', file)
    
    const result = await aiClassifyApi(formData)
    
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
  if (!uploadForm.value.keywords) {
    ElMessage.warning('请输入关键词')
    return
  }
  if (!uploadForm.value.scope) {
    ElMessage.warning('请选择可见范围')
    return
  }

  const keywords = uploadForm.value.keywords
    .split(/[,，、\s]+/)
    .map((kw) => kw.trim())
    .filter((kw) => kw)

  if (keywords.length === 0) {
    ElMessage.warning('请输入关键词')
    return
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

    try {
      let successCount = 0
      const totalCount = selectedFiles.value.length
      
      for (let i = 0; i < totalCount; i++) {
        const item = selectedFiles.value[i]
        const file = item.file
        const fileName = file.name.replace(/\.[^/.]+$/, '')
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', uploadForm.value.title || fileName)
        if (uploadForm.value.description) {
          formData.append('description', uploadForm.value.description)
        }
        formData.append('scope', uploadForm.value.scope === 'public' ? 'school' : 'college')
        if (keywords.length > 0) {
          keywords.forEach(kw => {
            formData.append('keywords', kw)
          })
        }

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
    
    const promises = newFiles.map(async (file) => {
      if (keywordsCache.has(file.id)) {
        file.keywords = keywordsCache.get(file.id)!
      } else {
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
          file.keywords = keywordList
        } catch (error) {
          console.error(`获取文件 ${file.title} 的关键词失败:`, error)
          file.keywords = []
        }
      }
    })
    
    await Promise.all(promises)
    
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

function handleEdit(file: KnowledgeFile) {
  editingFile.value = file
  showEditDialog.value = true
}

function handleEditSubmit(data: { title: string; keywords: Keyword[] }) {
  if (editingFile.value) {
    editingFile.value.title = data.title
    editingFile.value.keywords = data.keywords
    saveFiles(uploadedFiles.value)
    ElMessage.success('编辑成功')
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
              <el-radio :value="true">创建文件</el-radio>
              <el-radio :value="false">上传文件</el-radio>
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
                @click="handlePreviewFile(item)"
              >
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
            </div>
          </div>

          <div class="upload-content-right">
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
              <el-radio :value="true">创建文件</el-radio>
              <el-radio :value="false">上传文件</el-radio>
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

      <el-table
        v-else
        :data="paginatedFiles"
        border
        stripe
        :loading="loading"
        class="file-table"
        @row-click="handleFileClick"
      >
        <el-table-column prop="title" label="文件名" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <div class="file-name-cell">
              <el-icon :size="18" :color="fileTypeColors[scope.row.fileType] || '#409eff'" class="file-icon">
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

        <el-table-column prop="keywords" label="关键词" min-width="150">
          <template #default="scope">
            <div class="keywords-cell">
              <el-tag
                v-for="kw in (scope.row.keywords || []).slice(0, 3)"
                :key="kw.id"
                size="small"
                class="keyword-tag"
              >
                {{ kw.phrase }}
              </el-tag>
              <span v-if="(scope.row.keywords || []).length > 3" class="more-keywords">
                +{{ (scope.row.keywords || []).length - 3 }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="fileSize" label="大小" width="100" align="center">
          <template #default="scope">
            {{ formatFileSize(scope.row.fileSize) }}
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="上传时间" min-width="160" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="scope">
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
    >
      <div class="preview-content">
        <div v-html="previewContent" class="preview-text"></div>
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
  padding: 40px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
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
  height: 100%;
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