<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Upload } from '@element-plus/icons-vue'
import type { KnowledgeFile, Keyword } from '@/types'
import { deleteDocApi, getDocListApi } from '@/api/knowledge'
import UploadFileForm from '@/components/knowledge/UploadFileForm.vue'
import EditFileForm from '@/components/knowledge/EditFileForm.vue'

const router = useRouter()

const searchQuery = ref('')
const showUploadDialog = ref(false)
const showEditDialog = ref(false)
const editingFile = ref<KnowledgeFile | null>(null)
const loading = ref(false)

const currentPage = ref(1)
const pageSize = ref(8)
const totalFiles = ref(0)

const uploadedFiles = ref<KnowledgeFile[]>([])

async function fetchFiles() {
  loading.value = true
  try {
    const res = await getDocListApi({
      page: currentPage.value,
      page_size: pageSize.value,
    })
    const data = res.results || res.data || res
    uploadedFiles.value = Array.isArray(data) ? data : []
    totalFiles.value = res.total || res.count || uploadedFiles.value.length
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

function handleOpenUpload() {
  console.log('handleOpenUpload called, showUploadDialog:', showUploadDialog.value)
  showUploadDialog.value = true
  console.log('handleOpenUpload done, showUploadDialog:', showUploadDialog.value)
}

const recentFiles = computed(() => {
  return [...uploadedFiles.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
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

function handleFileClick(file: KnowledgeFile) {
  router.push(`/knowledge/detail/${file.id}`)
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

function handleFormSubmit() {
  showUploadDialog.value = false
  fetchFiles()
}
</script>

<template>
  <div class="doc-list-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">知识库管理</h2>
        <p class="page-subtitle">管理和浏览所有上传的文档资源</p>
      </div>
      <el-button type="primary" @click="handleOpenUpload" class="upload-btn">
        <el-icon><Upload /></el-icon>
        上传文件
      </el-button>
    </div>

    <div class="search-section">
      <el-input
        v-model="searchQuery"
        placeholder="搜索文件名、学院/部门、作者、关键词、文件描述..."
        prefix-icon="Search"
        class="search-input"
      />
    </div>

    <div class="recent-section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon><Clock /></el-icon>
          最近上传
        </h3>
      </div>
      <div class="recent-list">
        <div
          v-for="file in recentFiles"
          :key="file.id"
          class="recent-item"
          @click="handleFileClick(file)"
        >
          <el-icon :color="fileTypeColors[file.fileType] || '#409eff'">
            <component :is="fileTypeIcons[file.fileType] || 'Document'" />
          </el-icon>
          <span class="recent-name">{{ file.title }}</span>
          <span class="recent-time">{{ file.createdAt }}</span>
        </div>
      </div>
    </div>

    <div class="file-grid-section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon><FolderOpened /></el-icon>
          全部文件
          <span class="file-count">{{ filteredFiles.length }}</span>
        </h3>
      </div>

      <div v-if="filteredFiles.length === 0" class="empty-state">
        <el-icon size="48" color="#c0c4cc"><FolderOpened /></el-icon>
        <p>暂无文件，请上传</p>
      </div>

      <TransitionGroup v-else name="card" tag="div" class="file-grid">
        <div
          v-for="(file, index) in paginatedFiles"
          :key="file.id"
          class="file-card"
          :style="{ animationDelay: `${index * 50}ms` }"
          @click="handleFileClick(file)"
        >
          <div class="card-icon-wrapper" :style="{ background: fileTypeColors[file.fileType] + '15' }">
            <el-icon :size="32" :color="fileTypeColors[file.fileType] || '#409eff'">
              <component :is="fileTypeIcons[file.fileType] || 'Document'" />
            </el-icon>
          </div>
          <div class="card-content">
            <h4 class="card-title">{{ file.title }}</h4>
            <p class="card-summary">{{ file.summary }}</p>
            <div class="card-meta">
              <el-tag size="small" type="primary">{{ file.collegeName }}</el-tag>
              <el-tag v-for="kw in (file.keywords || []).slice(0, 3)" :key="kw.id" size="small" type="info">{{ kw.phrase }}</el-tag>
              <el-tag size="small">{{ formatFileSize(file.fileSize) }}</el-tag>
            </div>
            <div class="card-footer">
              <span class="card-author">{{ file.author }}</span>
              <span class="card-date">{{ file.createdAt }}</span>
            </div>
          </div>
          <div class="card-actions">
            <el-button size="small" @click.stop="handleEdit(file)" type="text">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" @click.stop="handleDelete(file)" type="text" danger>
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </TransitionGroup>

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

    <UploadFileForm
      :visible="showUploadDialog"
      @close="showUploadDialog = false"
      @submit="handleFormSubmit"
    />

    <EditFileForm
      :visible="showEditDialog"
      :file="editingFile"
      @close="showEditDialog = false"
      @submit="handleEditSubmit"
    />
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

.upload-btn {
  height: 36px;
}

.search-section {
  margin-bottom: var(--spacing-xl);
}

.search-input {
  max-width: 400px;
}

.recent-section {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
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

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: background-color 0.2s;
  min-width: 0;
}

.recent-item:hover {
  background: var(--color-bg);
}

.recent-item :deep(.el-icon) {
  margin-right: 10px;
  flex-shrink: 0;
}

.recent-name {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.recent-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 16px;
  flex-shrink: 0;
}

.file-grid-section {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  padding-bottom: 80px;
  box-shadow: var(--shadow-sm);
  position: relative;
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

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.file-card {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s ease, border-color 0.3s ease;
  overflow: hidden;
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.file-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-base);
  transform: translate3d(0, -6px, 0);
}

.card-enter-active {
  animation: cardEnter 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.card-leave-active {
  animation: cardLeave 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.card-move {
  transition: transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
}

@keyframes cardEnter {
  0% {
    opacity: 0;
    transform: translate3d(0, 30px, 0) scale(0.92);
    filter: blur(4px);
  }
  60% {
    opacity: 1;
    transform: translate3d(0, -5px, 0) scale(1.02);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes cardLeave {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, -20px, 0) scale(0.96);
    filter: blur(4px);
  }
}

.card-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-md);
}

.card-content {
  position: relative;
  z-index: 1;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 6px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-summary {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0 0 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.card-meta {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-author {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.card-date {
  font-size: 12px;
  color: var(--color-info);
}

.card-actions {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-card:hover .card-actions {
  opacity: 1;
}

.card-actions :deep(.el-button) {
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-sm);
}

.upload-form {
  margin-top: var(--spacing-md);
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

.upload-form :deep(.el-form-item) {
  margin-bottom: var(--spacing-md);
}

.upload-dragger {
  width: 100%;
}
</style>