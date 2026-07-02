<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { KnowledgeFile } from '@/types'
import UploadFileForm from '@/components/knowledge/UploadFileForm.vue'

const router = useRouter()

const searchQuery = ref('')
const showUploadDialog = ref(false)

const getStoredFiles = (): KnowledgeFile[] => {
  const stored = localStorage.getItem('knowledgeFiles')
  if (stored) {
    return JSON.parse(stored)
  }
  return []
}

const saveFiles = (files: KnowledgeFile[]) => {
  localStorage.setItem('knowledgeFiles', JSON.stringify(files))
}

const defaultFiles: KnowledgeFile[] = [
  {
    id: 1,
    title: '人工智能导论课件.pdf',
    category: '课件',
    categoryName: '课件',
    author: '张老师',
    summary: '人工智能基础概念介绍，包括机器学习、深度学习等内容',
    fileUrl: '',
    fileSize: 2048000,
    fileType: 'pdf',
    collegeId: 1,
    collegeName: '信息工程学院',
    keywords: ['人工智能', '机器学习', '深度学习'],
    status: 1,
    createdAt: '2026-07-01 14:30:00',
    updatedAt: '2026-07-01 14:30:00',
  },
  {
    id: 2,
    title: '大数据分析案例.mp4',
    category: '视频',
    categoryName: '视频',
    author: '李老师',
    summary: '大数据分析实际案例讲解视频',
    fileUrl: '',
    fileSize: 52428800,
    fileType: 'video',
    collegeId: 2,
    collegeName: '计算机学院',
    keywords: ['大数据', '数据分析', '案例'],
    status: 1,
    createdAt: '2026-07-01 10:15:00',
    updatedAt: '2026-07-01 10:15:00',
  },
  {
    id: 3,
    title: '软件工程实践报告.docx',
    category: '报告',
    categoryName: '报告',
    author: '王同学',
    summary: '软件工程课程实践项目报告',
    fileUrl: '',
    fileSize: 512000,
    fileType: 'doc',
    collegeId: 1,
    collegeName: '信息工程学院',
    keywords: ['软件工程', '实践', '项目'],
    status: 1,
    createdAt: '2026-06-30 16:45:00',
    updatedAt: '2026-06-30 16:45:00',
  },
  {
    id: 4,
    title: '校园活动记录.mp3',
    category: '音频',
    categoryName: '音频',
    author: '广播站',
    summary: '校园活动采访录音',
    fileUrl: '',
    fileSize: 3145728,
    fileType: 'audio',
    collegeId: 3,
    collegeName: '数字艺术学院',
    keywords: ['校园活动', '采访', '录音'],
    status: 1,
    createdAt: '2026-06-30 09:20:00',
    updatedAt: '2026-06-30 09:20:00',
  },
  {
    id: 5,
    title: '专业课程体系规划.pdf',
    category: '文档',
    categoryName: '文档',
    author: '教务处',
    summary: '2026年度专业课程体系规划方案',
    fileUrl: '',
    fileSize: 1024000,
    fileType: 'pdf',
    collegeId: 2,
    collegeName: '计算机学院',
    keywords: ['课程体系', '规划', '专业'],
    status: 1,
    createdAt: '2026-06-29 11:00:00',
    updatedAt: '2026-06-29 11:00:00',
  },
  {
    id: 6,
    title: '毕业设计模板.docx',
    category: '模板',
    categoryName: '模板',
    author: '教务处',
    summary: '2026届毕业设计论文模板',
    fileUrl: '',
    fileSize: 256000,
    fileType: 'doc',
    collegeId: 1,
    collegeName: '信息工程学院',
    keywords: ['毕业设计', '模板', '论文'],
    status: 1,
    createdAt: '2026-06-28 15:30:00',
    updatedAt: '2026-06-28 15:30:00',
  },
]

const storedFiles = getStoredFiles()
const uploadedFiles = ref<KnowledgeFile[]>(
  storedFiles.length > 0 ? storedFiles : defaultFiles
)

const filteredFiles = computed(() => {
  if (!searchQuery.value) return uploadedFiles.value
  const query = searchQuery.value.toLowerCase()
  return uploadedFiles.value.filter(
    (file) =>
      file.title.toLowerCase().includes(query) ||
      file.summary.toLowerCase().includes(query) ||
      file.author.toLowerCase().includes(query) ||
      file.collegeName.toLowerCase().includes(query) ||
      (file.keywords && file.keywords.some((kw) => kw.toLowerCase().includes(query)))
  )
})

const recentFiles = computed(() => {
  return [...uploadedFiles.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
})

const fileTypeIcons: Record<string, string> = {
  pdf: 'Document',
  doc: 'FileText',
  image: 'Picture',
  audio: 'Headset',
  video: 'VideoCamera',
  archive: 'FolderOpened',
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

function handleRename(file: KnowledgeFile) {
  ElMessageBox.prompt('请输入新文件名', '重命名', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: file.title,
  })
    .then(({ value }) => {
      if (value && value.trim()) {
        file.title = value.trim()
        saveFiles(uploadedFiles.value)
        ElMessage.success('重命名成功')
      }
    })
    .catch(() => {})
}

function handleDelete(file: KnowledgeFile) {
  ElMessageBox.confirm('确定要删除该文件吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const index = uploadedFiles.value.findIndex((f) => f.id === file.id)
      if (index > -1) {
        uploadedFiles.value.splice(index, 1)
        saveFiles(uploadedFiles.value)
        ElMessage.success('删除成功')
      }
    })
    .catch(() => {})
}

function handleFormSubmit(data: { title: string; category: string; author: string; keywords: string; description: string }) {
  const keywords = data.keywords
    .split(/[,，、\s]+/)
    .map((kw) => kw.trim())
    .filter((kw) => kw)

  const categories = [
    '信息工程学院',
    '计算机学院',
    '数字艺术学院',
    '商学院',
    '外国语学院',
    '继续教育学院',
    '软件工程系',
    '网络工程系',
    '数字媒体系',
    '经济管理系',
    '英语系',
  ]

  const newFile: KnowledgeFile = {
    id: Date.now(),
    title: data.title,
    category: data.category,
    categoryName: data.category,
    author: data.author,
    summary: data.description,
    fileUrl: '',
    fileSize: Math.floor(Math.random() * 10000000) + 100000,
    fileType: 'doc',
    collegeId: categories.indexOf(data.category) + 1,
    collegeName: data.category,
    keywords,
    status: 1,
    createdAt: new Date().toLocaleString('zh-CN'),
    updatedAt: new Date().toLocaleString('zh-CN'),
  }

  uploadedFiles.value.unshift(newFile)
  saveFiles(uploadedFiles.value)
  showUploadDialog.value = false
  ElMessage.success('上传成功')
}
</script>

<template>
  <div class="doc-list-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">知识库管理</h2>
        <p class="page-subtitle">管理和浏览所有上传的文档资源</p>
      </div>
      <el-button type="primary" @click="showUploadDialog = true" class="upload-btn">
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

      <div v-else class="file-grid">
        <div
          v-for="file in filteredFiles"
          :key="file.id"
          class="file-card"
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
              <el-tag v-for="kw in (file.keywords || []).slice(0, 3)" :key="kw" size="small" type="info">{{ kw }}</el-tag>
              <el-tag size="small">{{ formatFileSize(file.fileSize) }}</el-tag>
            </div>
            <div class="card-footer">
              <span class="card-author">{{ file.author }}</span>
              <span class="card-date">{{ file.createdAt }}</span>
            </div>
          </div>
          <div class="card-actions">
            <el-button size="small" @click.stop="handleRename(file)" type="text">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" @click.stop="handleDelete(file)" type="text" danger>
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <UploadFileForm
      :visible="showUploadDialog"
      @close="showUploadDialog = false"
      @submit="handleFormSubmit"
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
  box-shadow: var(--shadow-sm);
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
  transition: all 0.2s;
  overflow: hidden;
}

.file-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-base);
  transform: translateY(-2px);
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

.upload-form :deep(.el-form-item) {
  margin-bottom: var(--spacing-md);
}

.upload-dragger {
  width: 100%;
}
</style>