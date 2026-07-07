<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Upload, Search } from '@element-plus/icons-vue'
import type { KnowledgeFile, Keyword } from '@/types'
import { deleteDocApi, getDocListApi, getKeywordsApi } from '@/api/knowledge'
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
    
    uploadedFiles.value = newFiles
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
  showUploadDialog.value = true
}

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

    <div class="upload-section" @click="handleOpenUpload">
      <div class="upload-inner">
        <div class="upload-icon-wrapper">
          <el-icon :size="48" color="#409eff"><Upload /></el-icon>
        </div>
        <h3 class="upload-title">上传文件</h3>
        <p class="upload-desc">点击或拖拽文件到此处上传</p>
        <p class="upload-tips">支持 PDF、Word、图片、音频、视频等格式</p>
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

.search-section {
  margin-bottom: var(--spacing-xl);
}

.search-input {
  max-width: 400px;
}

.upload-section {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border: 2px dashed #c0c4cc;
  border-radius: var(--radius-lg);
  padding: 48px 24px;
  margin-bottom: var(--spacing-xl);
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.upload-section:hover {
  border-color: #409eff;
  background: linear-gradient(135deg, #ecf5ff 0%, #e0ebff 100%);
  box-shadow: 0 4px 20px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.upload-section:active {
  transform: translateY(0);
}

.upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.upload-section:hover .upload-icon-wrapper {
  transform: scale(1.1);
  background: rgba(64, 158, 255, 0.2);
}

.upload-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.upload-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.upload-tips {
  font-size: 12px;
  color: var(--color-info);
  margin: 0;
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
</style>