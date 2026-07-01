<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { KnowledgeFile } from '@/types'

const route = useRoute()
const router = useRouter()

const file = ref<KnowledgeFile | null>(null)

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

const mockFiles: KnowledgeFile[] = [
  {
    id: 1,
    title: '人工智能导论课件.pdf',
    category: '课件',
    categoryName: '课件',
    author: '张老师',
    summary: '人工智能基础概念介绍，包括机器学习、深度学习等内容。本课件详细介绍了人工智能的发展历程、核心技术和应用领域，适合本科生学习使用。',
    fileUrl: '',
    fileSize: 2048000,
    fileType: 'pdf',
    collegeId: 1,
    collegeName: '信息工程学院',
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
    summary: '大数据分析实际案例讲解视频，包含数据预处理、特征提取、模型训练等完整流程演示。',
    fileUrl: '',
    fileSize: 52428800,
    fileType: 'video',
    collegeId: 2,
    collegeName: '计算机学院',
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
    summary: '软件工程课程实践项目报告，详细记录了项目需求分析、系统设计、编码实现和测试过程。',
    fileUrl: '',
    fileSize: 512000,
    fileType: 'doc',
    collegeId: 1,
    collegeName: '信息工程学院',
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
    summary: '校园活动采访录音，记录了本次活动的精彩瞬间和参与者的心得体会。',
    fileUrl: '',
    fileSize: 3145728,
    fileType: 'audio',
    collegeId: 3,
    collegeName: '数字艺术学院',
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
    summary: '2026年度专业课程体系规划方案，包含课程设置、教学计划、考核方式等内容。',
    fileUrl: '',
    fileSize: 1024000,
    fileType: 'pdf',
    collegeId: 2,
    collegeName: '计算机学院',
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
    summary: '2026届毕业设计论文模板，包含论文格式要求、章节结构、参考文献格式等。',
    fileUrl: '',
    fileSize: 256000,
    fileType: 'doc',
    collegeId: 1,
    collegeName: '信息工程学院',
    status: 1,
    createdAt: '2026-06-28 15:30:00',
    updatedAt: '2026-06-28 15:30:00',
  },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function goBack() {
  router.push('/knowledge/list')
}

function handleDownload() {
  ElMessage.info('下载功能开发中')
}

function handleRename() {
  if (!file.value) return
  ElMessageBox.prompt('请输入新文件名', '重命名', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: file.value.title,
  })
    .then(({ value }) => {
      if (value && value.trim()) {
        file.value!.title = value.trim()
        ElMessage.success('重命名成功')
      }
    })
    .catch(() => {})
}

function handleDelete() {
  if (!file.value) return
  ElMessageBox.confirm('确定要删除该文件吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      ElMessage.success('删除成功')
      goBack()
    })
    .catch(() => {})
}

onMounted(() => {
  const id = parseInt(route.params.id as string)
  file.value = mockFiles.find((f) => f.id === id) || mockFiles[0]
})
</script>

<template>
  <div class="doc-detail-page">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" type="text" class="back-btn">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="page-title">{{ file?.title }}</h2>
      </div>
      <div class="header-actions">
        <el-button @click="handleRename" type="primary">
          <el-icon><Edit /></el-icon>
          重命名
        </el-button>
        <el-button @click="handleDownload">
          <el-icon><Download /></el-icon>
          下载
        </el-button>
        <el-button @click="handleDelete" type="danger">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </div>

    <div class="detail-content">
      <div class="file-info-card">
        <div class="info-header">
          <div class="icon-wrapper" :style="{ background: fileTypeColors[file?.fileType || 'doc'] + '15' }">
            <el-icon :size="48" :color="fileTypeColors[file?.fileType || 'doc'] || '#409eff'">
              <component :is="fileTypeIcons[file?.fileType || 'doc'] || 'Document'" />
            </el-icon>
          </div>
          <div class="file-meta">
            <h3 class="file-title">{{ file?.title }}</h3>
            <div class="meta-tags">
              <el-tag size="medium" type="primary">{{ file?.collegeName }}</el-tag>
              <el-tag size="medium">{{ file?.categoryName }}</el-tag>
              <el-tag size="medium">{{ formatFileSize(file?.fileSize || 0) }}</el-tag>
            </div>
          </div>
        </div>

        <div class="info-separator"></div>

        <div class="info-detail">
          <div class="detail-row">
            <span class="detail-label">作者</span>
            <span class="detail-value">{{ file?.author }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">格式</span>
            <span class="detail-value">{{ file?.fileType?.toUpperCase() }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">大小</span>
            <span class="detail-value">{{ formatFileSize(file?.fileSize || 0) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">上传时间</span>
            <span class="detail-value">{{ file?.createdAt }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">更新时间</span>
            <span class="detail-value">{{ file?.updatedAt }}</span>
          </div>
        </div>

        <div class="info-separator"></div>

        <div class="info-description">
          <h4 class="desc-title">
            <el-icon><InfoFilled /></el-icon>
            文件描述
          </h4>
          <p class="desc-content">{{ file?.summary }}</p>
        </div>
      </div>

      <div class="preview-card">
        <h4 class="preview-title">
          <el-icon><Eye /></el-icon>
          文件预览
        </h4>
        <div class="preview-content">
          <div class="preview-placeholder">
            <el-icon :size="64" color="#c0c4cc">
              <component :is="fileTypeIcons[file?.fileType || 'doc'] || 'Document'" />
            </el-icon>
            <p>文件预览功能开发中</p>
            <el-button @click="handleDownload" type="primary" size="large">
              <el-icon><Download /></el-icon>
              下载查看
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.doc-detail-page {
  min-height: 100%;
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

.back-btn {
  margin-bottom: var(--spacing-sm);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.detail-content {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: var(--spacing-lg);
}

.file-info-card {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.info-header {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-meta {
  flex: 1;
  min-width: 0;
}

.file-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.info-separator {
  height: 1px;
  background: var(--color-border);
  margin: var(--spacing-md) 0;
}

.info-detail {
  margin-bottom: var(--spacing-lg);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
}

.detail-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.detail-value {
  font-size: 14px;
  color: var(--color-text);
}

.info-description {
  margin-top: var(--spacing-md);
}

.desc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm) 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.desc-content {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin: 0;
}

.preview-card {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  min-height: 500px;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-lg) 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-content {
  height: calc(100% - 40px);
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--color-text-secondary);
}

.preview-placeholder p {
  margin: var(--spacing-lg) 0;
  font-size: 14px;
}

@media (max-width: 768px) {
  .detail-content {
    grid-template-columns: 1fr;
  }
}
</style>