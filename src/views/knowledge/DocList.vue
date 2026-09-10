<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Picture, Headset, VideoCamera, FolderOpened, Download, Edit, Delete, WarningFilled, Grid } from '@element-plus/icons-vue'
import type { KnowledgeFile, Keyword } from '@/types'
import { deleteDocApi, getDocListApi, getKeywordsApi, batchDeleteDocsApi } from '@/api/knowledge'
import { cacheDesc, cacheKeywords, getCachedDesc, getCachedKeywords, hasCachedDesc } from '@/utils/docCache'
import EditFileForm from '@/components/knowledge/EditFileForm.vue'
import DocUploadPanel from '@/components/knowledge/DocUploadPanel.vue'
import DocFilterBar from '@/components/knowledge/DocFilterBar.vue'
import DocPreviewDialog from '@/components/knowledge/DocPreviewDialog.vue'

const searchQuery = ref('')
const formatFilter = ref('')
const collegeFilter = ref('')
const uploaderFilter = ref('')

const showEditDialog = ref(false)
const editingFile = ref<KnowledgeFile | null>(null)
const loading = ref(false)
const listError = ref('')

const selectedDocIds = ref<number[]>([])

const previewRef = ref<InstanceType<typeof DocPreviewDialog>>()

function openDocPreview(id: number, title: string) {
  previewRef.value?.openDoc(id, title)
}

function onPreviewFile(file: File, docId?: number) {
  previewRef.value?.openLocalFile(file, docId)
}

const currentPage = ref(1)
const pageSize = ref(10)
const totalFiles = ref(0)

const uploadedFiles = ref<KnowledgeFile[]>([])
const allFiles = ref<KnowledgeFile[]>([])

async function fetchFiles(keyword?: string) {
  loading.value = true
  listError.value = ''
  try {
    // 后端实际返回 DRF 分页结构 { results: [...] }，与 PaginatedResult 类型声明不一致
    const res: any = await getDocListApi({
      page: 1,
      page_size: 1000,
      keyword: keyword || undefined,
    })
    const data = res.results || res.data || res
    let newFiles = Array.isArray(data) ? data : []

    // 后端 page_size 参数不生效（DRF 固定 20 条/页），按 next 循环翻页取全量
    if (!Array.isArray(res)) {
      const maxPages = 100
      for (let page = 2; page <= maxPages && res?.next; page++) {
        const nextRes: any = await getDocListApi({
          page,
          page_size: 1000,
          keyword: keyword || undefined,
        })
        const nextData = nextRes.results || nextRes.data || []
        if (Array.isArray(nextData) && nextData.length > 0) {
          newFiles = newFiles.concat(nextData)
        } else {
          break
        }
        res.next = nextRes?.next || null
      }
    }

    newFiles.forEach((file) => {
      const cachedKws = getCachedKeywords(file.id)
      if (cachedKws) {
        file.keywords = cachedKws
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
      // 文件大小映射（后端 file_size → 前端 fileSize）
      if (file.file_size != null && file.fileSize == null) {
        file.fileSize = file.file_size
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
      const cachedDesc = getCachedDesc(file.id)
      if (cachedDesc) {
        if (!file.summary) file.summary = cachedDesc
        ;(file as any).description = cachedDesc
      }
    })

    // 在覆盖 allFiles 前，保存现有文件的描述到缓存（防止 fetchFiles 刷新后丢失）
    allFiles.value.forEach((f) => {
      const desc = f.summary || (f as any).description
      if (desc && !hasCachedDesc(f.id)) {
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
    listError.value = '文档列表加载失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchFiles()
})

watch([searchQuery, formatFilter, collegeFilter, uploaderFilter], () => {
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
    .replace(/“/g, '"')   // 中文左引号
    .replace(/”/g, '"')   // 中文右引号
    .replace(/‘/g, "'")   // 中文左单引号
    .replace(/’/g, "'")   // 中文右单引号
    .trim()
}

/** 文件格式 → 中文标签（兼容扩展名与后端分组类型） */
const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Word', docx: 'Word', wps: 'Word', word: 'Word',
  xls: 'Excel', xlsx: 'Excel', et: 'Excel', csv: 'Excel', excel: 'Excel',
  ppt: 'PPT', pptx: 'PPT', dps: 'PPT',
  txt: '文本', md: 'Markdown', markdown: 'Markdown', html: '网页', htm: '网页',
  jpg: '图片', jpeg: '图片', png: '图片', gif: '图片', webp: '图片', bmp: '图片', tiff: '图片', tif: '图片', svg: '图片', image: '图片',
  mp3: '音频', wav: '音频', ogg: '音频', flac: '音频', aac: '音频', m4a: '音频', amr: '音频', audio: '音频',
  mp4: '视频', webm: '视频', mov: '视频', avi: '视频', mkv: '视频', flv: '视频', m4v: '视频', video: '视频',
  zip: '压缩包', rar: '压缩包', '7z': '压缩包', archive: '压缩包',
  psd: '设计源', ai: '设计源',
  stl: '3D模型', obj: '3D模型', fbx: '3D模型',
  epub: '电子书', pub: '电子书', publisher: '电子书',
  document: 'Word', text: '文本', plain: '文本', sheet: 'Excel', spreadsheet: 'Excel', presentation: 'PPT', slides: 'PPT',
  other: '其他',
}

/** 从文件多来源字段提取真实扩展名（后端 file_ext → 文件名 → URL → file_type → 全字段扫描） */
function rowExt(file: KnowledgeFile): string {
  // 后端 2026-09-10 起返回 file_ext（真实扩展名，小写不含点，永不为空，拿不到时兜底为类别码）
  const fe = String(file.file_ext || '').toLowerCase().replace(/^\./, '')
  if (fe) return fe

  const pickName = (s: string): string => {
    const seg = (s || '').split(/[?#]/)[0].split('/').pop() || ''
    const dot = seg.lastIndexOf('.')
    return dot > 0 ? seg.slice(dot + 1).toLowerCase() : ''
  }
  const fromName = pickName(file.file_name || '')
    || pickName(file.fileUrl || '')
    || pickName(file.oss_url || '')
    || pickName(file.download_url || '')
  if (fromName) return fromName

  const ft = String((file as any).file_type ?? file.fileType ?? (file as any).ext ?? '').toLowerCase()
  if (ft && ft !== 'other' && ft !== '-' && ft !== 'unknown') {
    if (ft === 'markdown') return 'md'
    if (FORMAT_LABELS[ft]) return ft
  }

  // 兜底：后端字段名不定时，扫描整行字符串字段，只要带扩展名或格式 token 就识别
  for (const val of Object.values(file)) {
    if (typeof val !== 'string' || !val) continue
    const low = val.trim().toLowerCase()
    const seg = low.split(/[?#/\\]/).pop() || low
    const dot = seg.lastIndexOf('.')
    if (dot > 0 && FORMAT_LABELS[seg.slice(dot + 1)]) return seg.slice(dot + 1)
    if (FORMAT_LABELS[low]) return low
  }
  return ''
}
function formatLabelOf(file: KnowledgeFile): string {
  const ext = rowExt(file)
  if (!ext) return '其他'
  return FORMAT_LABELS[ext] || ext.toUpperCase()
}

/** 表格"文件格式"列：直接展示后端 file_ext 真实扩展名（PPTX/XLSX/DOCX...）；类别码兜底时映射中文 */
function formatCellExt(file: KnowledgeFile): string {
  const ext = String(file.file_ext || '').toLowerCase().replace(/^\./, '')
  if (!ext) return formatLabelOf(file)
  if (['image', 'video', 'audio', 'other'].includes(ext)) {
    return FORMAT_LABELS[ext] || ext.toUpperCase()
  }
  return ext.toUpperCase()
}
function collegeOf(file: KnowledgeFile): string {
  return file.collegeName && String(file.collegeName).trim() ? String(file.collegeName).trim() : '未归属'
}
function uploaderOf(file: KnowledgeFile): string {
  return file.author && String(file.author).trim() ? String(file.author).trim() : '未知'
}

/** 关键词搜索后的结果（文件格式/单位/上传者选项以此为数据源，随搜索实时更新） */
const keywordResults = computed(() => {
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

const formatOptions = computed(() => [...new Set(keywordResults.value.map(formatLabelOf))].sort())
const collegeOptions = computed(() => [...new Set(keywordResults.value.map(collegeOf))].sort())
const uploaderOptions = computed(() => [...new Set(keywordResults.value.map(uploaderOf))].sort())

const filteredFiles = computed(() => {
  let rows = keywordResults.value
  if (formatFilter.value) rows = rows.filter((f) => formatLabelOf(f) === formatFilter.value)
  if (collegeFilter.value) rows = rows.filter((f) => collegeOf(f) === collegeFilter.value)
  if (uploaderFilter.value) rows = rows.filter((f) => uploaderOf(f) === uploaderFilter.value)
  return rows
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
  excel: Grid,
  publisher: Document,
  image: Picture,
  audio: Headset,
  video: VideoCamera,
  archive: FolderOpened,
}

const fileTypeColors: Record<string, string> = {
  pdf: '#f56c6c',
  doc: '#409eff',
  excel: '#67c23a',
  publisher: '#e6a23c',
  image: '#67c23a',
  audio: '#909399',
  video: '#e6a23c',
  archive: 'var(--color-type-archive, #9b59b6)',
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

/** 格式化文件大小显示 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
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
    // 优先使用后端返回的 download_url（带原始文件名）
    if (file.download_url) {
      downloadByIframe(file.download_url)
      return
    }

    // 兜底方案：请求后端下载接口获取 download_url
    const token = localStorage.getItem('access_token')
    const response = await fetch(`/api/knowledge/docs/${file.id}/download/`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `下载失败 (${response.status})`)
    }

    const contentType = response.headers.get('Content-Type') || ''

    // 后端返回 JSON（含 download_url）
    if (contentType.includes('application/json')) {
      const json = await response.json()
      const downloadUrl = json.download_url || json.url || json.file_url || json.fileUrl
      if (!downloadUrl) throw new Error('未获取到下载地址')
      downloadByIframe(downloadUrl)
      return
    }

    // 后端直接返回二进制文件流（旧兼容）
    const blob = await response.blob()
    const fileName = file.file_name || file.title || `文件${file.id}`
    downloadBlob(blob, fileName)
  } catch (error: any) {
    console.error('下载文件失败:', error)
    ElMessage.error(error.message || '下载文件失败')
  }
}

/** 通过隐藏 iframe 触发下载，避免新标签页闪烁 */
function downloadByIframe(url: string) {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  setTimeout(() => document.body.removeChild(iframe), 3000)
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
  // 与 DocDetail 共用同一 key，保证详情页重命名/删除后列表缓存一致
  localStorage.setItem('knowledgeFiles', JSON.stringify(files))
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

    <DocUploadPanel
      :existing-titles="uploadedFiles.map(f => f.title)"
      @uploaded="fetchFiles"
      @preview-file="onPreviewFile"
    />

    <div class="file-table-section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon><FolderOpened /></el-icon>
          全部资料
          <span class="file-count">{{ displayTotalFiles }}</span>
        </h3>
      </div>

      <el-alert
        title="点击文件名可预览文件内容。可在线预览：Markdown/文本、图片、音视频、PDF、Word(.docx)、Excel(.xls/.xlsx)、PPT(.pptx)；不支持在线预览需下载：Word(.doc)、PPT(.ppt)、压缩包(.zip/.rar/.7z)、设计源(.psd/.ai)、3D模型(.stl/.obj/.fbx)、电子书(.epub/.pub)。大文件请打包成压缩包后上传。Office 文件在线预览由微软服务渲染，超过 10MB 的大文件可能无法预览，请下载后本地查看。预览失败或需修改内容时，请下载后本地查看，修改完成再重新上传。"
        type="success"
        :closable="false"
        show-icon
        class="preview-hint"
      />

      <DocFilterBar
        v-model:search="searchQuery"
        v-model:format="formatFilter"
        v-model:college="collegeFilter"
        v-model:uploader="uploaderFilter"
        :format-options="formatOptions"
        :college-options="collegeOptions"
        :uploader-options="uploaderOptions"
      />

      <div v-if="filteredFiles.length === 0 && !loading">
        <div v-if="listError" class="empty-state">
          <el-icon size="48" color="#f56c6c"><WarningFilled /></el-icon>
          <p>{{ listError }}</p>
          <el-button type="primary" size="small" @click="fetchFiles()">重试</el-button>
        </div>
        <div v-else class="empty-state">
          <el-icon size="48" color="#c0c4cc"><FolderOpened /></el-icon>
          <p>暂无文件，请上传</p>
        </div>
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

        <el-table-column prop="title" label="资料名" min-width="160" align="center" show-overflow-tooltip>
          <template #default="scope">
            <div class="file-name-cell">
              <el-icon
                :size="18"
                :color="fileTypeColors[scope.row.fileType] || '#409eff'"
                class="file-icon cursor-pointer"
                @click="openDocPreview(scope.row.id, scope.row.title)"
              >
                <component :is="fileTypeIcons[scope.row.fileType] || 'Document'" />
              </el-icon>
              <span class="file-title cursor-pointer" @click="openDocPreview(scope.row.id, scope.row.title)">{{ scope.row.title }}</span>
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

        <el-table-column label="文件格式" min-width="100" align="center">
          <template #default="scope">
            <el-tag size="small" effect="plain">{{ formatCellExt(scope.row) }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="fileSize" label="文件大小" min-width="110" align="center">
          <template #default="scope">
            {{ formatFileSize(scope.row.fileSize) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="280" align="center" fixed="right">
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
          :page-sizes="[10, 20, 30]"
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

    <DocPreviewDialog ref="previewRef" />
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

/* fixed 右侧操作列：增加内边距，防止按钮边框被截断 */
.file-table :deep(.el-table__fixed-right .el-table__body td) {
  padding-left: 12px;
  padding-right: 12px;
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: nowrap;
}

/* 操作按钮更紧凑，防止两边溢出 */
.action-buttons :deep(.el-button) {
  padding: 5px 8px;
  font-size: 12px;
  --el-button-size: 24px;
}

.action-buttons :deep(.el-button .el-icon) {
  margin-right: 3px;
  font-size: 12px;
}

.file-name-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0; /* flex 容器需要此属性，子元素才能正确省略文本 */
  width: 100%;
}

.file-icon {
  color: #409eff;
  margin-right: 8px;
}

.file-icon {
  flex-shrink: 0;
}

.file-title {
  min-width: 0;
  max-width: calc(100% - 28px); /* 留出图标空间，防止文字过长挤压 */
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-title:hover {
  color: var(--color-primary, #409eff);
}

.cursor-pointer {
  cursor: pointer;
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

.preview-hint {
  margin-bottom: var(--spacing-md);
}
</style>
