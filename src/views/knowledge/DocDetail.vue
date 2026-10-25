<script setup lang="ts">
/* eslint-disable no-console */
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Check, Close, ArrowLeft, Edit, Download, Delete, View, Loading, CollectionTag, Connection, Refresh } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import type { DocRelation, KnowledgeFile } from '@/types'
import {
  getDocDetailApi,
  deleteDocApi,
  downloadDocApi,
  previewDocApi,
  updateDocApi,
  extractFreshnessApi,
  getDocTagsApi,
  addDocTagsApi,
  removeDocTagApi,
  getDocRelationsApi,
  deleteDocRelationApi,
} from '@/api/knowledge'
import DOMPurify from 'dompurify'
import { useUserStore } from '@/store/user'
import { relationTypeLabel } from '@/config/relation'
import FileInfoCard from '@/components/knowledge/FileInfoCard.vue'
import TagSelector from '@/components/knowledge/TagSelector.vue'

const route = useRoute()
const router = useRouter()

const file = ref<KnowledgeFile | null>(null)
const previewContent = ref('')
const sanitizedPreviewContent = computed(() => DOMPurify.sanitize(previewContent.value))
const isLoading = ref(false)
const isEditing = ref(false)
const editContent = ref('')
// 原始内容（preview 接口返回的未渲染 Markdown/文本），编辑时写回此值，避免误存渲染后的 HTML
const rawContent = ref('')

const userStore = useUserStore()

// ── 标签 / 文档关联（文件网）──
const savingTags = ref(false)
const refreshingRelations = ref(false)
const deletingRelationId = ref<number | null>(null)

/** 超管可管理任意文档；其他管理员仅能管理自己上传的文档；普通用户只读 */
const canManage = computed(() => {
  if (!file.value) return false
  if (userStore.role === 'super_admin') return true
  if (!userStore.role || userStore.role === 'user') return false
  const userId = userStore.userInfo?.id
  if (file.value.uploader != null && userId != null) {
    return Number(file.value.uploader) === Number(userId)
  }
  return !!file.value.uploader_name && file.value.uploader_name === userStore.userInfo?.username
})

/** 标签草稿：与后端状态解耦，避免异步保存期间控件回跳 */
const tagDraft = ref<string[]>([])

function syncTagDraft() {
  tagDraft.value = (file.value?.tags || []).map((tag) => tag.tag_name)
}

function handleTagChange(names: string[]) {
  tagDraft.value = names
  void persistTags(names)
}

/** 关联类型中文名（优先使用后端 display 值） */
function relationLabel(rel: DocRelation): string {
  return rel.relation_type_name || relationTypeLabel(rel.relation_type)
}

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
  archive: 'var(--color-type-archive, #9b59b6)',
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
  
  try {
    const result = await previewDocApi(file.value.id)
    // 记录原始内容（未渲染），供编辑回写
    rawContent.value = result.content || ''

    if (result.content) {
      const contentType = result.content_type || ''

      if (contentType.includes('markdown') || ['md', 'markdown'].includes(fileExtension.value)) {
        previewContent.value = md.render(result.content)
      } else if (contentType.includes('text') || ['txt', 'html'].includes(fileExtension.value)) {
        previewContent.value = result.content
      } else if (contentType.includes('json')) {
        previewContent.value = JSON.stringify(JSON.parse(result.content), null, 2)
      } else {
        previewContent.value = result.content
      }
    } else {
      previewContent.value = ''
    }
  } catch (error) {
    console.error('获取文件预览失败:', error)

    rawContent.value = file.value?.content || ''
    if (file.value.content) {
      if (['md', 'markdown'].includes(fileExtension.value)) {
        previewContent.value = md.render(file.value.content)
      } else {
        previewContent.value = file.value.content
      }
    } else {
      previewContent.value = ''
    }
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push('/knowledge/list')
}

async function handleDownload() {
  if (!file.value) return

  // 优先使用后端返回的 download_url（带原始文件名）
  if (file.value.download_url) {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = file.value.download_url
    document.body.appendChild(iframe)
    setTimeout(() => document.body.removeChild(iframe), 3000)
    ElMessage.success('下载已开始')
    return
  }

  // 兜底方案：使用旧下载接口
  try {
    const blob = await downloadDocApi(file.value.id)
    const fileName = file.value.file_name || file.value.title || 'download'
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch (error) {
    console.error('下载文件失败:', error)
    ElMessage.error('下载文件失败')
  }
}

function startEdit() {
  // 优先用原始内容（preview 接口返回的 Markdown），绝不用渲染后的 previewContent（HTML）
  editContent.value = rawContent.value || file.value?.content || ''
  isEditing.value = true
}

async function saveEdit() {
  if (!file.value) return
  
  try {
    await updateDocApi(file.value.id, {
      content: editContent.value,
    })
    ElMessage.success('保存成功')
    isEditing.value = false
    await loadFileContent()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  }
}

function cancelEdit() {
  isEditing.value = false
  editContent.value = ''
}

async function handleRename() {
  if (!file.value) return
  ElMessageBox.prompt('请输入新文件名', '重命名', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: file.value.title,
  })
    .then(async ({ value }) => {
      if (value && value.trim()) {
        try {
          await updateDocApi(file.value!.id, { title: value.trim() })
          file.value!.title = value.trim()
          const files = getFiles()
          const index = files.findIndex((f) => f.id === file.value!.id)
          if (index > -1) {
            files[index].title = value.trim()
            saveFiles(files)
          }
          ElMessage.success('重命名成功')
        } catch {
          ElMessage.error('重命名失败，请重试')
        }
      }
    })
    .catch(() => {})
}

async function handleDelete() {
  if (!file.value) return
  ElMessageBox.confirm('确定要删除该文件吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await deleteDocApi(file.value!.id)
        const files = getFiles()
        const filtered = files.filter((f) => f.id !== file.value!.id)
        saveFiles(filtered)
        ElMessage.success('删除成功')
        goBack()
      } catch (error) {
        console.error('删除文件失败:', error)
        ElMessage.error('删除文件失败')
      }
    })
    .catch(() => {})
}

async function handleExtractFreshness() {
  if (!file.value) return
  
  try {
    ElMessage.info('正在AI提取发布日期...')
    const result = await extractFreshnessApi(file.value.id)
    ElMessage.success(`发布日期提取成功：${result.freshness}`)
    file.value = { ...file.value, freshness: result.freshness }
  } catch (error) {
    console.error('提取发布日期失败:', error)
    ElMessage.error('提取发布日期失败')
  }
}

/** 后端详情字段为蛇形命名，这里统一补齐前端驼峰字段 */
function normalizeDocDetail(raw: any): KnowledgeFile {
  return {
    ...raw,
    summary: raw.summary || raw.description || '',
    description: raw.description || '',
    categoryName: raw.categoryName || raw.category_name || '',
    collegeName: raw.collegeName || raw.college_name || '',
    author: raw.author || raw.uploader_name || '',
    fileSize: raw.fileSize ?? raw.file_size ?? 0,
    fileType: raw.fileType || raw.file_type || '',
    createdAt: raw.createdAt || raw.created_at || '',
    updatedAt: raw.updatedAt || raw.updated_at || '',
    tags: raw.tags || [],
    relations: raw.relations || [],
  }
}

async function fetchDocDetail(id: number) {
  try {
    isLoading.value = true
    const result = await getDocDetailApi(id)
    file.value = normalizeDocDetail(result)
    syncTagDraft()
    loadFileContent()
  } catch (error) {
    console.error('获取文档详情失败:', error)
    ElMessage.error('获取文档详情失败')
    const files = getFiles()
    file.value = files.find((f) => f.id === id) || files[0]
    loadFileContent()
  } finally {
    isLoading.value = false
  }
}

// ── 标签维护 ──
async function refreshTags() {
  if (!file.value) return
  try {
    file.value.tags = await getDocTagsApi(file.value.id)
    syncTagDraft()
  } catch (error) {
    console.warn('[DocDetail] 刷新标签失败:', error)
  }
}

/** 按差异增量同步标签：新增走批量打标，移除走删除关联 */
async function persistTags(names: string[]) {
  if (!file.value || savingTags.value) return
  const current = file.value.tags || []
  const currentNames = new Set(current.map((tag) => tag.tag_name))
  const nextNames = new Set(names)
  const added = names.filter((name) => !currentNames.has(name))
  const removed = current.filter((tag) => !nextNames.has(tag.tag_name))
  if (added.length === 0 && removed.length === 0) return

  savingTags.value = true
  try {
    for (const tag of removed) {
      await removeDocTagApi(file.value.id, tag.tag_id)
    }
    if (added.length > 0) {
      const result = await addDocTagsApi(file.value.id, added)
      file.value.tags = result.tags
    } else {
      file.value.tags = current.filter((tag) => nextNames.has(tag.tag_name))
    }
    syncTagDraft()
    ElMessage.success('标签已更新')
  } catch (error) {
    console.error('更新标签失败:', error)
    await refreshTags()
  } finally {
    savingTags.value = false
  }
}

// ── 文档关联（只读展示，管理员可撤除 AI 错误关联）──
async function refreshRelations() {
  if (!file.value) return
  refreshingRelations.value = true
  try {
    file.value.relations = await getDocRelationsApi(file.value.id)
  } catch (error) {
    console.warn('[DocDetail] 刷新关联失败:', error)
  } finally {
    refreshingRelations.value = false
  }
}

async function handleDeleteRelation(rel: DocRelation) {
  if (!file.value || deletingRelationId.value != null) return

  try {
    await ElMessageBox.confirm(
      `确定撤除与「${rel.target_doc_title}」的关联（${relationLabel(rel)}）吗？`,
      '撤除关联',
      { confirmButtonText: '撤除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  deletingRelationId.value = rel.id
  try {
    await deleteDocRelationApi(file.value.id, rel.id)
    file.value.relations = (file.value.relations || []).filter((item) => item.id !== rel.id)
    ElMessage.success('关联已撤除')
  } catch (error) {
    console.error('撤除关联失败:', error)
    ElMessage.error('撤除关联失败，请重试')
    await refreshRelations()
  } finally {
    deletingRelationId.value = null
  }
}

function openTargetDoc(targetDocId: number) {
  if (targetDocId === file.value?.id) return
  router.push({ name: 'DocDetail', params: { id: targetDocId } })
}

onMounted(() => {
  const id = parseInt(route.params.id as string)
  fetchDocDetail(id)
})

// 详情页内点击关联目标时仅 params 变化，组件会被复用，需要重新拉取详情
watch(
  () => route.params.id,
  (id) => {
    const docId = parseInt(String(id))
    if (!Number.isNaN(docId)) {
      fetchDocDetail(docId)
    }
  },
)
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
        <el-button @click="handleExtractFreshness" type="primary">
          <el-icon><Edit /></el-icon>
          AI提取日期
        </el-button>
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
      <FileInfoCard
        :file="file"
        :file-type-icons="fileTypeIcons"
        :file-type-colors="fileTypeColors"
        :file-category="fileCategory"
        :file-extension="fileExtension"
      />

      <div class="preview-card">
        <div class="preview-header">
          <h4 class="preview-title">
            <el-icon><View /></el-icon>
            文件预览
          </h4>
          <div v-if="!isEditing" class="preview-actions">
            <el-button v-if="previewType === 'markdown' || previewType === 'text'" @click="startEdit" type="primary" size="small">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
          </div>
          <div v-else class="preview-actions">
            <el-button @click="saveEdit" type="primary" size="small">
              <el-icon><Check /></el-icon>
              保存
            </el-button>
            <el-button @click="cancelEdit" size="small">
              <el-icon><Close /></el-icon>
              取消
            </el-button>
          </div>
        </div>
        <div class="preview-content">
          <div v-if="isLoading" class="preview-loading">
            <el-icon :size="48" color="#409eff" class="loading-icon"><Loading /></el-icon>
            <p>加载中...</p>
          </div>

          <div v-else-if="isEditing && (previewType === 'markdown' || previewType === 'text')" class="edit-preview">
            <el-input
              v-model="editContent"
              type="textarea"
              :rows="20"
              placeholder="请输入文件内容..."
              class="content-textarea"
            />
          </div>

          <!-- 仅 Markdown 渲染为 HTML（已过 DOMPurify 净化）；纯文本/JSON/Word 走 <pre> 保留换行 -->
          <div v-if="previewType === 'markdown' && previewContent" class="content-preview markdown-preview">
            <!-- eslint-disable-next-line vue/no-v-html -- 内容经 DOMPurify.sanitize 净化，安全 -->
            <div v-html="sanitizedPreviewContent"></div>
          </div>

          <div v-else-if="previewType === 'text' || previewType === 'json' || (['doc', 'docx'].includes(fileExtension))" class="text-preview">
            <pre>{{ previewContent || '文件内容为空' }}</pre>
          </div>

          <div v-else-if="previewType === 'image'" class="image-preview">
            <img
              :src="file?.fileData || 'https://via.placeholder.com/600x400?text=图片预览'"
              :alt="file?.title"
              loading="lazy"
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

    <!-- 标签 + 文件网关联 -->
    <div class="meta-cards">
      <div class="meta-card">
        <div class="meta-card-header">
          <h4 class="meta-title">
            <el-icon><CollectionTag /></el-icon>
            文档标签
          </h4>
          <span v-if="!canManage" class="meta-hint">上传者 / 超级管理员可编辑</span>
        </div>

        <template v-if="canManage">
          <TagSelector
            :model-value="tagDraft"
            :disabled="savingTags"
            @update:model-value="handleTagChange"
          />
        </template>
        <div v-else-if="file?.tags?.length" class="readonly-tags">
          <el-tag
            v-for="tag in file.tags"
            :key="tag.id"
            type="success"
            effect="plain"
            size="small"
          >{{ tag.tag_name }}</el-tag>
        </div>
        <p v-else class="meta-empty">暂无标签</p>
      </div>

      <!-- 关联由后端 AI 异步生成，前端只读展示；管理员可撤除错误关联 -->
      <div class="meta-card">
        <div class="meta-card-header">
          <h4 class="meta-title">
            <el-icon><Connection /></el-icon>
            文档关联（文件网）
          </h4>
          <div class="meta-card-actions">
            <span v-if="canManage" class="meta-hint">AI 自动关联，可撤除错误关联</span>
            <el-button
              type="primary"
              link
              size="small"
              :loading="refreshingRelations"
              @click="refreshRelations"
            >
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>

        <div v-if="file?.relations?.length" class="relation-list">
          <div v-for="rel in file.relations" :key="rel.id" class="relation-item">
            <div class="relation-link" @click="openTargetDoc(rel.target_doc_id)">
              <span class="relation-arrow">本文档 →</span>
              <span class="relation-target">{{ rel.target_doc_title }}</span>
              <el-tag size="small" type="info" effect="plain">{{ relationLabel(rel) }}</el-tag>
            </div>
            <el-button
              v-if="canManage"
              type="danger"
              link
              size="small"
              :loading="deletingRelationId === rel.id"
              @click="handleDeleteRelation(rel)"
            >撤除</el-button>
          </div>
        </div>
        <p v-else class="meta-empty">暂无关联（AI 自动关联完成后点击刷新查看）</p>
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

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.preview-content {
  height: calc(100% - 40px);
}

.edit-preview {
  padding: var(--spacing-md);
}

.content-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
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
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
}

.markdown-preview :deep(pre) {
  background: #f6f8fa;
  color: #1f2937;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 12px 0;
}

.markdown-preview :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.9em;
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

/* ── 标签 + 文件网关联 ── */
.meta-cards {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
}

.meta-card {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}

.meta-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.meta-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.meta-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.meta-empty {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.readonly-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-card-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.relation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color 0.2s, background-color 0.2s;
}

.relation-item:hover {
  border-color: #409eff;
  background: #f5faff;
}

.relation-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.relation-arrow {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.relation-target {
  min-width: 0;
  font-size: 14px;
  color: #409eff;
  word-break: break-all;
}

.relation-link:hover .relation-target {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .detail-content,
  .meta-cards {
    grid-template-columns: 1fr;
  }
}
</style>
