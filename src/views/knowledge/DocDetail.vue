<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import * as mammoth from 'mammoth'
import type { KnowledgeFile } from '@/types'

const route = useRoute()
const router = useRouter()

const file = ref<KnowledgeFile | null>(null)
const previewContent = ref('')
const isLoading = ref(false)

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

const fileTypeIcons: Record<string, any> = {
  pdf: Document,
  doc: Files,
  image: Picture,
  audio: Headset,
  video: VideoCamera,
  archive: FolderOpened,
  txt: Files,
  md: Files,
}

const fileTypeColors: Record<string, string> = {
  pdf: '#f56c6c',
  doc: '#409eff',
  image: '#67c23a',
  audio: '#909399',
  video: '#e6a23c',
  archive: '#9b59b6',
  txt: '#409eff',
  md: '#409eff',
}

const fileCategory: Record<string, string> = {
  pdf: 'PDF文档',
  doc: 'Word文档',
  docx: 'Word文档',
  txt: '文本文件',
  md: 'Markdown文档',
  jpg: '图片',
  jpeg: '图片',
  png: '图片',
  gif: '图片',
  bmp: '图片',
  mp3: '音频',
  wav: '音频',
  mp4: '视频',
  avi: '视频',
  mkv: '视频',
  zip: '压缩包',
  rar: '压缩包',
  xlsx: 'Excel表格',
  pptx: '演示文稿',
}

const defaultFiles: KnowledgeFile[] = [
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
    keywords: [{ id: 1, phrase: '人工智能', match_type: 'exact', weight: 1 }, { id: 2, phrase: '机器学习', match_type: 'exact', weight: 1 }, { id: 3, phrase: '深度学习', match_type: 'exact', weight: 1 }],
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
    keywords: [{ id: 4, phrase: '大数据', match_type: 'exact', weight: 1 }, { id: 5, phrase: '数据分析', match_type: 'exact', weight: 1 }, { id: 6, phrase: '案例', match_type: 'exact', weight: 1 }],
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
    keywords: [{ id: 7, phrase: '软件工程', match_type: 'exact', weight: 1 }, { id: 8, phrase: '实践', match_type: 'exact', weight: 1 }, { id: 9, phrase: '项目', match_type: 'exact', weight: 1 }],
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
    keywords: [{ id: 10, phrase: '校园活动', match_type: 'exact', weight: 1 }, { id: 11, phrase: '采访', match_type: 'exact', weight: 1 }, { id: 12, phrase: '录音', match_type: 'exact', weight: 1 }],
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
    keywords: [{ id: 13, phrase: '课程体系', match_type: 'exact', weight: 1 }, { id: 14, phrase: '规划', match_type: 'exact', weight: 1 }, { id: 15, phrase: '专业', match_type: 'exact', weight: 1 }],
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
    keywords: [{ id: 16, phrase: '毕业设计', match_type: 'exact', weight: 1 }, { id: 17, phrase: '模板', match_type: 'exact', weight: 1 }, { id: 18, phrase: '论文', match_type: 'exact', weight: 1 }],
    status: 1,
    createdAt: '2026-06-28 15:30:00',
    updatedAt: '2026-06-28 15:30:00',
  },
]

function getFiles(): KnowledgeFile[] {
  const stored = localStorage.getItem('knowledgeFiles')
  if (stored) {
    return JSON.parse(stored)
  }
  return defaultFiles
}

function saveFiles(files: KnowledgeFile[]) {
  localStorage.setItem('knowledgeFiles', JSON.stringify(files))
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileExtension(title: string): string {
  const parts = title.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

const fileExtension = computed(() => file.value ? getFileExtension(file.value.title) : '')

const previewType = computed(() => {
  const ext = fileExtension.value
  if (['md', 'markdown'].includes(ext)) return 'markdown'
  if (['txt'].includes(ext)) return 'text'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return 'image'
  if (['mp3', 'wav'].includes(ext)) return 'audio'
  if (['mp4', 'avi', 'mkv'].includes(ext)) return 'video'
  if (['pdf'].includes(ext)) return 'pdf'
  return 'other'
})

async function loadFileContent() {
  if (!file.value) return
  
  isLoading.value = true
  
  if (file.value.content) {
    if (previewType.value === 'markdown') {
      previewContent.value = md.render(file.value.content)
    } else {
      previewContent.value = file.value.content
    }
  } else if (file.value.fileData) {
    if (previewType.value === 'text') {
      const base64Data = file.value.fileData.split(',')[1]
      const decoded = atob(base64Data)
      previewContent.value = decoded
    } else if (['doc', 'docx'].includes(fileExtension.value)) {
      try {
        const base64Data = file.value.fileData.split(',')[1]
        const binaryData = atob(base64Data)
        const arrayBuffer = new ArrayBuffer(binaryData.length)
        const uint8Array = new Uint8Array(arrayBuffer)
        for (let i = 0; i < binaryData.length; i++) {
          uint8Array[i] = binaryData.charCodeAt(i)
        }
        const result = await mammoth.extractRawText({ arrayBuffer })
        previewContent.value = result.value
      } catch (error) {
        console.error('Failed to extract text from Word document:', error)
        previewContent.value = '无法解析Word文档内容，请下载查看'
      }
    }
  } else {
    previewContent.value = ''
  }
  
  isLoading.value = false
}

function goBack() {
  router.push('/knowledge/list')
}

function handleDownload() {
  if (!file.value) return
  
  if (file.value.fileData) {
    const link = document.createElement('a')
    link.href = file.value.fileData
    link.download = file.value.title
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('下载成功')
  } else if (file.value.content) {
    const blob = new Blob([file.value.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.value.title
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } else {
    ElMessage.info('下载功能开发中')
  }
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
        const files = getFiles()
        const index = files.findIndex((f) => f.id === file.value!.id)
        if (index > -1) {
          files[index].title = value.trim()
          saveFiles(files)
        }
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
      const files = getFiles()
      const filtered = files.filter((f) => f.id !== file.value!.id)
      saveFiles(filtered)
      ElMessage.success('删除成功')
      goBack()
    })
    .catch(() => {})
}

onMounted(() => {
  const id = parseInt(route.params.id as string)
  const files = getFiles()
  file.value = files.find((f) => f.id === id) || files[0]
  loadFileContent()
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
            <span class="detail-value">{{ fileCategory[fileExtension] || '未知' }}</span>
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

        <div v-if="file?.keywords?.length" class="info-keywords">
          <h4 class="desc-title">
            <el-icon><Tag /></el-icon>
            关键词
          </h4>
          <div class="keyword-tags">
            <el-tag v-for="kw in file.keywords" :key="kw.id" size="small" effect="plain">{{ kw.phrase }}</el-tag>
          </div>
        </div>
      </div>

      <div class="preview-card">
        <h4 class="preview-title">
          <el-icon><Eye /></el-icon>
          文件预览
        </h4>
        <div class="preview-content">
          <div v-if="isLoading" class="preview-loading">
            <el-icon :size="48" color="#409eff" class="loading-icon"><Loading /></el-icon>
            <p>加载中...</p>
          </div>

          <div v-else-if="previewType === 'markdown'" class="markdown-preview">
            <div v-html="previewContent"></div>
          </div>

          <div v-else-if="previewType === 'text' || (['doc', 'docx'].includes(fileExtension))" class="text-preview">
            <pre>{{ previewContent || '文件内容为空' }}</pre>
          </div>

          <div v-else-if="previewType === 'image'" class="image-preview">
            <img
              :src="file?.fileData || 'https://via.placeholder.com/600x400?text=图片预览'"
              :alt="file?.title"
              class="preview-image"
            />
          </div>

          <div v-else-if="previewType === 'audio'" class="audio-preview">
            <audio controls class="preview-audio">
              <source :src="file?.fileData || ''" type="audio/mpeg" />
              您的浏览器不支持音频播放
            </audio>
          </div>

          <div v-else-if="previewType === 'video'" class="video-preview">
            <video controls class="preview-video">
              <source :src="file?.fileData || ''" type="video/mp4" />
              您的浏览器不支持视频播放
            </video>
          </div>

          <div v-else-if="previewType === 'pdf'" class="pdf-preview">
            <iframe
              v-if="file?.fileData"
              :src="file.fileData"
              class="pdf-iframe"
            ></iframe>
            <div v-else class="pdf-placeholder">
              <el-icon :size="64" color="#f56c6c"><Document /></el-icon>
              <p>PDF 文件预览</p>
              <el-button @click="handleDownload" type="primary" size="large">
                <el-icon><Download /></el-icon>
                下载查看
              </el-button>
            </div>
          </div>

          <div v-else class="preview-placeholder">
            <el-icon :size="64" color="#c0c4cc">
              <component :is="fileTypeIcons[file?.fileType || 'doc'] || 'Document'" />
            </el-icon>
            <p>{{ fileCategory[fileExtension] || '文件' }}预览功能开发中</p>
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

.info-keywords {
  margin-top: var(--spacing-md);
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--color-text-secondary);
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.markdown-preview {
  max-height: 600px;
  overflow-y: auto;
  padding: var(--spacing-md);
  background: #fafafa;
  border-radius: var(--radius-base);
  font-size: 14px;
  line-height: 1.8;
}

.markdown-preview :deep(h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.markdown-preview :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 14px 0;
}

.markdown-preview :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 12px 0;
}

.markdown-preview :deep(p) {
  margin: 8px 0;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.markdown-preview :deep(li) {
  margin: 4px 0;
}

.markdown-preview :deep(code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
}

.markdown-preview :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}

.markdown-preview :deep(a) {
  color: #409eff;
  text-decoration: none;
}

.markdown-preview :deep(a:hover) {
  text-decoration: underline;
}

.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.markdown-preview :deep(th) {
  background: #f5f5f5;
}

.text-preview {
  max-height: 600px;
  overflow-y: auto;
  padding: var(--spacing-md);
  background: #fafafa;
  border-radius: var(--radius-base);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 600px;
  overflow: hidden;
  background: #fafafa;
  border-radius: var(--radius-base);
}

.preview-image {
  max-width: 100%;
  max-height: 600px;
  object-fit: contain;
}

.audio-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  background: #fafafa;
  border-radius: var(--radius-base);
}

.preview-audio {
  width: 100%;
  max-width: 500px;
}

.video-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  border-radius: var(--radius-base);
}

.preview-video {
  width: 100%;
  max-height: 500px;
}

.pdf-preview {
  height: 100%;
}

.pdf-iframe {
  width: 100%;
  height: 500px;
  border: none;
  border-radius: var(--radius-base);
}

.pdf-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--color-text-secondary);
}

.pdf-placeholder p {
  margin: var(--spacing-lg) 0;
  font-size: 14px;
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
