<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Clock,
  CollectionTag,
  Delete,
  Document,
  Edit,
  Files,
  FolderAdd,
  FolderOpened,
  Grid,
  Headset,
  List,
  MoreFilled,
  Picture,
  Refresh,
  VideoCamera,
  WarningFilled,
} from '@element-plus/icons-vue'
import type { FolderId, Keyword, KnowledgeFile, KnowledgeFolder } from '@/types'
import type { AiDocMeta, InfoSavePayload, InfoTab, UploadQueueItem } from '@/types/workbench'
import {
  addDocTagsApi,
  addKeywordsApi,
  aiClassifyApi,
  appendUploadMeta,
  batchDeleteDocsApi,
  deleteDocApi,
  deleteKeywordApi,
  getDocDetailApi,
  getDocListApi,
  getDocTagsApi,
  getKeywordsApi,
  isValidKeywordId,
  removeDocTagApi,
  resubmitDocReviewApi,
  updateDocApi,
  uploadFileApi,
} from '@/api/knowledge'
import { uploadFileToOss } from '@/utils/oss-upload'
import {
  extractTextFromFile,
  fileBaseName,
  fileExtension,
  isBinaryNoText,
  validateUploadFile,
} from '@/utils/uploadValidation'
import { cacheDesc, cacheKeywords, getCachedDesc, getCachedKeywords } from '@/utils/docCache'
import { useUserStore } from '@/store/user'
import { useDeptFolders } from '@/composables/useDeptFolders'
import UploadStagingPanel from '@/components/knowledge/dept/UploadStagingPanel.vue'
import DeptFolderTree from '@/components/knowledge/dept/DeptFolderTree.vue'
import DocInfoPanel from '@/components/knowledge/dept/DocInfoPanel.vue'
import DirectoryDocList from '@/components/knowledge/dept/DirectoryDocList.vue'
import EditFileForm from '@/components/knowledge/EditFileForm.vue'
import DocFilterBar from '@/components/knowledge/DocFilterBar.vue'
import DocPreviewDialog from '@/components/knowledge/DocPreviewDialog.vue'
import TagManageDialog from '@/components/knowledge/TagManageDialog.vue'
import ReviewStatusTag from '@/components/knowledge/ReviewStatusTag.vue'

const router = useRouter()
const userStore = useUserStore()

const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024
const UNFILED_PREVIEW_LIMIT = 6

const activeTab = ref<'manage' | 'all'>('manage')

const username = computed(() => userStore.userInfo?.username || '')
const isSuperAdmin = computed(() => userStore.role === 'super_admin')
const isManagerRole = computed(() =>
  ['super_admin', 'college_admin', 'dept_admin', 'admin'].includes(String(userStore.role)),
)

const {
  folders,
  folderOptions,
  systemRootFolders,
  customRootFolders,
  localMode,
  loading: folderLoading,
  loadError: folderLoadError,
  canManage: folderCanManage,
  scopeKind,
  loadFolders,
  createFolder: createFolderRequest,
  renameFolder: renameFolderRequest,
  deleteFolder: deleteFolderRequest,
  moveDocs: moveDocsToFolder,
  folderIdForDoc,
  setLocalFolder: setLocalDocFolder,
  folderById,
  fullPath,
  childFolders,
  suggestFolder,
  descendantsOf,
} = useDeptFolders(() => `dept-folders:${userStore.userInfo?.id ?? 'guest'}`)

const canManageFolders = computed(
  () => isManagerRole.value && (localMode.value || folderCanManage.value),
)

type FolderSelection = 'root' | 'unfiled' | FolderId
const selectedFolder = ref<FolderSelection>('root')

const scopeLabel = computed(() => {
  const info = userStore.userInfo
  if (!info) return '当前部门'
  if (info.role === 'super_admin') return '校级资料中心'
  if (info.role === 'admin' || info.role === 'college_admin') {
    return info.college_name || '学院资料'
  }
  if (info.role === 'dept_admin') {
    return [info.college_name, info.department_name].filter(Boolean).join(' / ') ||
      info.department_name ||
      '部门资料'
  }
  return info.department_name || info.college_name || '个人资料'
})

// ── 上传暂存队列 ──
const queue = ref<UploadQueueItem[]>([])
const targetFolderId = ref<FolderId | null>(null)
const uploading = ref(false)
let queueSeq = 0

function addFiles(files: File[]) {
  if (uploading.value) return
  const added: UploadQueueItem[] = []
  files.forEach((file) => {
    const error = validateUploadFile(file)
    if (error) {
      ElMessage.warning(`「${file.name}」${error}`)
      return
    }
    const duplicated = queue.value.some(
      (item) => item.file.name === file.name && item.file.size === file.size,
    )
    if (duplicated) {
      ElMessage.warning(`「${file.name}」已在待上传队列中`)
      return
    }
    const title = fileBaseName(file)
    queueSeq += 1
    added.push({
      key: `upload-${Date.now()}-${queueSeq}`,
      file,
      title,
      originalTitle: title,
      aiTitle: '',
      aiTitleUsed: false,
      description: '',
      keywords: [],
      tags: [],
      scope: 'public',
      status: 'ready',
      errorMessage: '',
      progress: 0,
    })
  })
  if (!added.length) return
  queue.value.push(...added)
  ElMessage.success(`已暂存 ${added.length} 个文件，点击「确认上传」开始上传与 AI 识别`)
}

function removeQueueItem(key: string) {
  if (uploading.value) return
  queue.value = queue.value.filter((item) => item.key !== key)
}

function updateQueueTitle(payload: { key: string; title: string }) {
  const item = queue.value.find((entry) => entry.key === payload.key)
  if (item) item.title = payload.title
}

/** 上传前预览本地文件，保留原有「先看内容再上传」的能力 */
function previewQueueItem(item: UploadQueueItem) {
  previewRef.value?.openLocalFile(item.file)
}

// ── 信息确认面板 ──
const infoTabs = ref<InfoTab[]>([])
const activeInfoKey = ref<string | null>(null)
const infoDoc = ref<KnowledgeFile | null>(null)
const infoAiMeta = ref<AiDocMeta | null>(null)
const infoFormVersion = ref(0)
const detailLoading = ref(false)
const savingInfo = ref(false)
const aiMetaByKey = ref<Record<string, AiDocMeta>>({})
const aiMetaByDocId = ref<Record<number, AiDocMeta>>({})
const batchDocs = ref<Record<string, KnowledgeFile>>({})
let detailSeq = 0

const infoCurrentFolderId = computed<FolderId | null>(() => {
  if (!infoDoc.value) return null
  return folderIdForDoc(infoDoc.value)
})

const canEditInfo = computed(() => {
  const doc = infoDoc.value
  if (!doc) return false
  if (isSuperAdmin.value) return true
  if (username.value && doc.uploader_name === username.value) return true
  return Boolean(infoAiMeta.value?.fromUpload && !doc.uploader_name)
})

const canResubmitInfo = computed(() => {
  const doc = infoDoc.value
  return Boolean(
    doc &&
      doc.review_status === 'rejected' &&
      ((username.value && doc.uploader_name === username.value) ||
        (infoAiMeta.value?.fromUpload && !doc.uploader_name)),
  )
})

function makeStubDoc(id: number, title: string): KnowledgeFile {
  return {
    id,
    title,
    category: '',
    categoryName: '',
    author: '',
    summary: '',
    fileUrl: '',
    fileSize: 0,
    fileType: '',
    collegeId: 0,
    collegeName: '',
    keywords: [],
    status: 0,
    createdAt: '',
    updatedAt: '',
  }
}

function clearInfoSelection() {
  detailSeq += 1
  infoTabs.value = []
  activeInfoKey.value = null
  infoDoc.value = null
  infoAiMeta.value = null
  detailLoading.value = false
  infoFormVersion.value += 1
}

async function loadInfoDetail(base: KnowledgeFile) {
  const token = ++detailSeq
  detailLoading.value = true
  infoDoc.value = base
  try {
    const results = await Promise.allSettled([
      getDocDetailApi(base.id),
      getKeywordsApi(base.id),
      getDocTagsApi(base.id),
    ])
    if (token !== detailSeq) return
    const detail = results[0].status === 'fulfilled' ? results[0].value : base
    const merged = normalizeDoc({ ...base, ...detail })
    if (results[1].status === 'fulfilled') {
      merged.keywords = normalizeKeywordList(results[1].value)
    } else if (!merged.keywords?.length) {
      merged.keywords = normalizeKeywordList(base.keywords)
    }
    if (results[2].status === 'fulfilled') {
      ;(merged as any).tags = results[2].value
    } else if (!(merged as any).tags?.length) {
      ;(merged as any).tags = (base as any).tags || []
    }
    if (!merged.uploader_name) merged.uploader_name = base.uploader_name
    merged.review_status = detail.review_status ?? base.review_status
    infoDoc.value = merged
    const index = allFiles.value.findIndex((file) => file.id === merged.id)
    if (index >= 0) allFiles.value[index] = { ...allFiles.value[index], ...merged }
  } finally {
    if (token === detailSeq) {
      detailLoading.value = false
      infoFormVersion.value += 1
    }
  }
}

function selectDocForInfo(doc: KnowledgeFile) {
  const key = `doc-${doc.id}`
  infoTabs.value = [{ key, title: doc.title, status: 'done', docId: doc.id }]
  activeInfoKey.value = key
  infoAiMeta.value = aiMetaByDocId.value[doc.id] || null
  void loadInfoDetail(doc)
}

function openInfoTab(key: string) {
  const tab = infoTabs.value.find((item) => item.key === key)
  if (!tab) return
  activeInfoKey.value = key
  if (tab.status === 'done' && tab.docId) {
    const doc =
      batchDocs.value[key] ||
      allFiles.value.find((item) => item.id === tab.docId) ||
      makeStubDoc(tab.docId, tab.title)
    infoAiMeta.value =
      aiMetaByKey.value[key] || aiMetaByDocId.value[tab.docId] || null
    void loadInfoDetail(doc)
    return
  }
  detailSeq += 1
  infoDoc.value = null
  infoAiMeta.value = aiMetaByKey.value[key] || null
  detailLoading.value = false
  infoFormVersion.value += 1
}

async function handleInfoSave(payload: InfoSavePayload) {
  const doc = infoDoc.value
  if (!doc || savingInfo.value) return
  savingInfo.value = true
  try {
    if (canEditInfo.value) {
      const updates: {
        title?: string
        description?: string
        visibility?: 'public' | 'private'
      } = {}
      const currentDesc = doc.description || doc.summary || ''
      if (payload.title !== doc.title) updates.title = payload.title
      if (payload.description && payload.description !== currentDesc) {
        updates.description = payload.description
      }
      const currentVisibility = doc.visibility === 'private' ? 'private' : 'public'
      if (payload.scope !== currentVisibility) updates.visibility = payload.scope
      if (Object.keys(updates).length) {
        await updateDocApi(doc.id, updates)
      }

      const currentKeywords = normalizeKeywordList(doc.keywords)
      const removedKeywords = currentKeywords.filter(
        (keyword) =>
          isValidKeywordId(keyword.id) && !payload.keywords.includes(keyword.phrase),
      )
      for (const keyword of removedKeywords) {
        await deleteKeywordApi(keyword.id)
      }
      const addedKeywords = payload.keywords.filter(
        (phrase) => !currentKeywords.some((keyword) => keyword.phrase === phrase),
      )
      if (addedKeywords.length) await addKeywordsApi(doc.id, addedKeywords)

      const currentTags = ((doc as any).tags || [])
        .map((tag: any) => ({
          id: tag.tag_id ?? tag.id,
          name: tag.tag_name ?? tag.name ?? '',
        }))
        .filter((tag: any) => tag.id != null && tag.name)
      for (const tag of currentTags) {
        if (!payload.tags.includes(tag.name)) {
          await removeDocTagApi(doc.id, Number(tag.id))
        }
      }
      const addedTags = payload.tags.filter(
        (name) => !currentTags.some((tag: any) => tag.name === name),
      )
      if (addedTags.length) await addDocTagsApi(doc.id, addedTags)
    }

    const originalFolder = folderIdForDoc(doc)
    if (
      canManageFolders.value &&
      String(payload.folderId ?? '') !== String(originalFolder ?? '')
    ) {
      await moveDocsToFolder([doc], payload.folderId)
    }

    infoTabs.value.forEach((tab) => {
      if (tab.docId === doc.id) tab.title = payload.title
    })
    await Promise.all([fetchFiles(), loadFolders()])
    await loadInfoDetail(doc)
    ElMessage.success('资料信息已保存')
  } catch (error: any) {
    if (!error?.response) {
      ElMessage.error(error?.message || '保存失败，请稍后重试')
    }
  } finally {
    savingInfo.value = false
  }
}

function previewInfoDoc(doc: KnowledgeFile) {
  openDocPreview(doc.id, doc.title)
}

// ── 文档列表 ──
const allFiles = ref<KnowledgeFile[]>([])
const tagFilterFiles = ref<KnowledgeFile[]>([])
const filesLoading = ref(false)
const tagLoading = ref(false)
const listError = ref('')
const tableLoading = computed(() => filesLoading.value || tagLoading.value)

const searchQuery = ref('')
const formatFilter = ref('')
const collegeFilter = ref('')
const uploaderFilter = ref('')
const activeTagId = ref<number | null>(null)
const activeTagName = ref('')
const showTagManager = ref(false)

const selectedDocIds = ref<number[]>([])
const dirSelectedIds = ref<number[]>([])
const dirViewMode = ref<'list' | 'grid'>('list')
const dirSort = ref<'newest' | 'oldest' | 'name' | 'size'>('newest')
const dirMoveTarget = ref<FolderId | null>(null)
const dirMoving = ref(false)
const allMoveTarget = ref<FolderId | null>(null)
const allMoving = ref(false)

const showEditDialog = ref(false)
const editingFile = ref<KnowledgeFile | null>(null)
const previewRef = ref<InstanceType<typeof DocPreviewDialog>>()

const currentPage = ref(1)
const pageSize = ref(10)

function normalizeKeywordList(list: any[] | undefined | null): Keyword[] {
  return (list || [])
    .map((kw: any) => ({
      id: kw.id,
      phrase: kw.phrase || kw.keyword || kw.name || '',
      match_type: kw.match_type || 'exact',
      weight: kw.weight || 1,
    }))
    .filter((kw: Keyword) => kw.phrase)
}

function normalizeDoc(file: any): KnowledgeFile {
  file.keywords = normalizeKeywordList(file.keywords)
  if (file.created_at && !file.createdAt) file.createdAt = file.created_at
  if (file.updated_at && !file.updatedAt) file.updatedAt = file.updated_at
  if (file.college_name && !file.collegeName) file.collegeName = file.college_name
  if (file.uploader && !file.author) file.author = file.uploader
  if (file.uploader_name && !file.author) file.author = file.uploader_name
  if (file.file_size != null && file.fileSize == null) file.fileSize = file.file_size
  const rawDesc = file.description
  if (rawDesc && !file.summary) file.summary = rawDesc
  const cachedDesc = getCachedDesc(file.id)
  if (cachedDesc) {
    if (!file.summary) file.summary = cachedDesc
    if (!file.description) file.description = cachedDesc
  }
  return file as KnowledgeFile
}

async function fetchDocPages(tagId?: number): Promise<KnowledgeFile[]> {
  let page = 1
  let collected: any[] = []
  let hasNext = true
  while (page <= 100 && hasNext) {
    const res: any = await getDocListApi({
      page,
      page_size: 1000,
      tagId,
    })
    const data = res?.results ?? res?.data ?? (Array.isArray(res) ? res : [])
    const batch = Array.isArray(data) ? data : []
    collected = collected.concat(batch)
    hasNext = !Array.isArray(res) && Boolean(res?.next) && batch.length > 0
    page += 1
  }
  return collected.map(normalizeDoc)
}

async function loadAllFiles() {
  filesLoading.value = true
  listError.value = ''
  try {
    allFiles.value = await fetchDocPages()
    const valid = new Set(allFiles.value.map((file) => file.id))
    selectedDocIds.value = selectedDocIds.value.filter((id) => valid.has(id))
    dirSelectedIds.value = dirSelectedIds.value.filter((id) => valid.has(id))
  } catch {
    listError.value = '文档列表加载失败，请检查网络后重试'
  } finally {
    filesLoading.value = false
  }
}

async function loadActiveTagFiles() {
  if (!activeTagId.value) {
    tagFilterFiles.value = []
    return
  }
  tagLoading.value = true
  try {
    tagFilterFiles.value = await fetchDocPages(activeTagId.value)
  } catch {
    tagFilterFiles.value = []
  } finally {
    tagLoading.value = false
  }
}

async function fetchFiles() {
  await Promise.all([loadAllFiles(), loadActiveTagFiles()])
}

async function refreshAll() {
  await Promise.all([fetchFiles(), loadFolders()])
}

onMounted(() => {
  void refreshAll()
})

watch([searchQuery, formatFilter, collegeFilter, uploaderFilter], () => {
  currentPage.value = 1
})

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    .replace(/。/g, '.')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/；/g, ';')
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/‘/g, "'")
    .replace(/’/g, "'")
    .trim()
}

const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Word', docx: 'Word', wps: 'Word', word: 'Word',
  xls: 'Excel', xlsx: 'Excel', et: 'Excel', csv: 'Excel', excel: 'Excel',
  ppt: 'PPT', pptx: 'PPT', dps: 'PPT',
  txt: '文本', md: 'Markdown', markdown: 'Markdown', html: '网页', htm: '网页',
  jpg: '图片', jpeg: '图片', png: '图片', gif: '图片', webp: '图片', bmp: '图片',
  tiff: '图片', tif: '图片', svg: '图片', image: '图片',
  mp3: '音频', wav: '音频', ogg: '音频', flac: '音频', aac: '音频', m4a: '音频', amr: '音频',
  mp4: '视频', webm: '视频', mov: '视频', avi: '视频', mkv: '视频', flv: '视频', m4v: '视频',
  zip: '压缩包', rar: '压缩包', '7z': '压缩包', archive: '压缩包',
  psd: '设计源', ai: '设计源',
  stl: '3D模型', obj: '3D模型', fbx: '3D模型',
  epub: '电子书', pub: '电子书', publisher: '电子书',
  document: 'Word', text: '文本', plain: '文本', sheet: 'Excel', spreadsheet: 'Excel',
  presentation: 'PPT', slides: 'PPT',
  other: '其他',
}

function rowExt(file: KnowledgeFile): string {
  const fe = String(file.file_ext || '').toLowerCase().replace(/^\./, '')
  if (fe) return fe
  const pickName = (value: string): string => {
    const segment = (value || '').split(/[?#]/)[0].split('/').pop() || ''
    const dot = segment.lastIndexOf('.')
    return dot > 0 ? segment.slice(dot + 1).toLowerCase() : ''
  }
  const fromName =
    pickName(file.file_name || '') ||
    pickName(file.fileUrl || '') ||
    pickName(file.oss_url || '') ||
    pickName(file.download_url || '')
  if (fromName) return fromName
  const ft = String((file as any).file_type ?? file.fileType ?? '').toLowerCase()
  if (ft && ft !== 'other' && ft !== '-' && ft !== 'unknown') {
    if (ft === 'markdown') return 'md'
    if (FORMAT_LABELS[ft]) return ft
  }
  for (const value of Object.values(file)) {
    if (typeof value !== 'string' || !value) continue
    const low = value.trim().toLowerCase()
    const segment = low.split(/[?#/\\]/).pop() || low
    const dot = segment.lastIndexOf('.')
    if (dot > 0 && FORMAT_LABELS[segment.slice(dot + 1)]) return segment.slice(dot + 1)
    if (FORMAT_LABELS[low]) return low
  }
  return ''
}

function formatLabelOf(file: KnowledgeFile): string {
  const ext = rowExt(file)
  if (!ext) return '其他'
  return FORMAT_LABELS[ext] || ext.toUpperCase()
}

function formatCellExt(file: KnowledgeFile): string {
  const ext = String(file.file_ext || '').toLowerCase().replace(/^\./, '')
  if (!ext) return formatLabelOf(file)
  if (['image', 'video', 'audio', 'other'].includes(ext)) {
    return FORMAT_LABELS[ext] || ext.toUpperCase()
  }
  return ext.toUpperCase()
}

function collegeOf(file: KnowledgeFile): string {
  return file.collegeName?.trim() || '未归属'
}

function uploaderOf(file: KnowledgeFile): string {
  return file.author?.trim() || file.uploader_name?.trim() || '未知'
}

function isUploaderOf(file: KnowledgeFile): boolean {
  return Boolean(username.value && file.uploader_name === username.value)
}

const myRejectedFiles = computed(() =>
  allFiles.value.filter((file) => file.review_status === 'rejected' && isUploaderOf(file)),
)

const myRejectedTitleText = computed(() => {
  const titles = myRejectedFiles.value.map((file) => file.title).filter(Boolean)
  if (titles.length <= 3) return titles.join('、')
  return `${titles.slice(0, 3).join('、')} 等 ${titles.length} 个文档`
})

const tableSourceFiles = computed(() =>
  activeTagId.value ? tagFilterFiles.value : allFiles.value,
)

const keywordResults = computed(() => {
  const query = normalizeSearchText(searchQuery.value)
  if (!query) return tableSourceFiles.value
  return tableSourceFiles.value.filter((file) => {
    const tagNames = ((file as any).tags || [])
      .map((tag: any) => tag.tag_name ?? tag.name ?? '')
      .join(' ')
    const parts = [
      file.id,
      file.title,
      file.summary,
      file.author,
      file.uploader_name,
      file.collegeName,
      file.categoryName,
      file.fileType,
      file.fileSize,
      formatDate(file.createdAt || (file as any).created_at),
      formatFileSize(Number(file.fileSize ?? (file as any).file_size ?? 0)),
      folderPathOf(file),
      tagNames,
      ...((file.keywords?.length ? file.keywords : getCachedKeywords(file.id)) || []).flatMap(
        (keyword: Keyword) => [keyword.phrase, isValidKeywordId(keyword.id) ? String(keyword.id) : ''],
      ),
    ]
    const searchText = normalizeSearchText(
      parts.filter((part) => part != null && part !== '').map(String).join(' '),
    )
    return searchText.includes(query)
  })
})

const formatOptions = computed(() => [...new Set(keywordResults.value.map(formatLabelOf))].sort())
const collegeOptions = computed(() => [...new Set(keywordResults.value.map(collegeOf))].sort())
const uploaderOptions = computed(() => [...new Set(keywordResults.value.map(uploaderOf))].sort())

const filteredTableFiles = computed(() => {
  let rows = keywordResults.value
  if (formatFilter.value) rows = rows.filter((file) => formatLabelOf(file) === formatFilter.value)
  if (collegeFilter.value) rows = rows.filter((file) => collegeOf(file) === collegeFilter.value)
  if (uploaderFilter.value) rows = rows.filter((file) => uploaderOf(file) === uploaderFilter.value)
  return rows
})

const displayTotalFiles = computed(() => filteredTableFiles.value.length)

const paginatedTableFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredTableFiles.value.slice(start, start + pageSize.value)
})

function handleCurrentChange(page: number) {
  const maxPage = Math.max(1, Math.ceil(displayTotalFiles.value / pageSize.value))
  currentPage.value = Math.min(Math.max(1, page), maxPage)
}

function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

function setTagFilter(tag: { id: number; name: string }) {
  activeTagId.value = tag.id
  activeTagName.value = tag.name
  activeTab.value = 'all'
  currentPage.value = 1
  void loadActiveTagFiles()
}

function clearTagFilter() {
  if (!activeTagId.value) return
  activeTagId.value = null
  activeTagName.value = ''
  tagFilterFiles.value = []
  currentPage.value = 1
}

function rowTags(file: KnowledgeFile): Array<{ id: number; name: string }> {
  const list: any[] = (file as any).tags || []
  return list
    .map((tag) => ({ id: tag.tag_id ?? tag.id, name: tag.tag_name ?? tag.name ?? '' }))
    .filter((tag) => tag.id != null && tag.name)
}

const EXT_CATEGORY: Record<string, string> = {
  pdf: 'pdf',
  doc: 'word', docx: 'word', wps: 'word',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet',
  ppt: 'slide', pptx: 'slide',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video',
  zip: 'archive', rar: 'archive', '7z': 'archive',
}

const CATEGORY_ICONS: Record<string, any> = {
  pdf: Document,
  word: Files,
  sheet: Grid,
  slide: Document,
  image: Picture,
  audio: Headset,
  video: VideoCamera,
  archive: FolderOpened,
}

function categoryOf(file: KnowledgeFile): string {
  return EXT_CATEGORY[rowExt(file)] || 'other'
}

function docIconOf(file: KnowledgeFile): any {
  return CATEGORY_ICONS[categoryOf(file)] || Document
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round((bytes / Math.pow(1024, index)) * 100) / 100} ${units[index]}`
}

// ── 目录 ──
// 子目录中的文件同时计入所有上级目录：教学资料 / 课程大纲 里的文件也属于教学资料
const folderCountMap = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  allFiles.value.forEach((file) => {
    const id = folderIdForDoc(file)
    if (id == null) return
    let current: FolderId | null = id
    const seen = new Set<string>()
    let guard = 0
    while (current != null && guard < 20) {
      const key = String(current)
      if (seen.has(key)) break
      seen.add(key)
      counts[key] = (counts[key] || 0) + 1
      current = folderById(current)?.parent_id ?? null
      guard += 1
    }
  })
  return counts
})

const unfiledFiles = computed(() =>
  allFiles.value.filter((file) => folderIdForDoc(file) == null),
)

const selectedFolderNode = computed<KnowledgeFolder | null>(() => {
  const selection = selectedFolder.value
  if (selection === 'root' || selection === 'unfiled') return null
  return folderById(selection) || null
})

const selectedLineage = computed<KnowledgeFolder[]>(() => {
  const lineage: KnowledgeFolder[] = []
  let current = selectedFolderNode.value
  let guard = 0
  while (current && guard < 20) {
    lineage.unshift(current)
    current = current.parent_id != null ? folderById(current.parent_id) || null : null
    guard += 1
  }
  return lineage
})

const selectedFolderDocs = computed(() => {
  if (selectedFolder.value === 'root') return []
  if (selectedFolder.value === 'unfiled') return unfiledFiles.value
  const id = selectedFolder.value
  const scopeIds = new Set([String(id), ...descendantsOf(id).map(String)])
  return allFiles.value.filter((file) => {
    const folderId = folderIdForDoc(file)
    return folderId != null && scopeIds.has(String(folderId))
  })
})

// 查看含子目录的文件夹时，列表中显示文件的实际路径，便于区分来源
const selectedFolderHasSubfolders = computed(() => {
  const id = selectedFolder.value
  if (id === 'root' || id === 'unfiled') return false
  return descendantsOf(id).length > 0
})

function docTimestamp(file: KnowledgeFile): number {
  const raw = file.createdAt || (file as any).created_at
  const time = raw ? new Date(raw).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

function sortDocs(docs: KnowledgeFile[]): KnowledgeFile[] {
  const list = [...docs]
  if (dirSort.value === 'name') {
    return list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-CN'))
  }
  if (dirSort.value === 'size') {
    return list.sort(
      (a, b) =>
        Number(b.fileSize ?? (b as any).file_size ?? 0) -
        Number(a.fileSize ?? (a as any).file_size ?? 0),
    )
  }
  const direction = dirSort.value === 'oldest' ? 1 : -1
  return list.sort((a, b) => (docTimestamp(a) - docTimestamp(b)) * direction)
}

const sortedSelectedFolderDocs = computed(() => sortDocs(selectedFolderDocs.value))
const sortedUnfiledFiles = computed(() => sortDocs(unfiledFiles.value))
const rootUnfiledPreview = computed(() =>
  sortedUnfiledFiles.value.slice(0, UNFILED_PREVIEW_LIMIT),
)

const directoryTitle = computed(() => {
  if (selectedFolder.value === 'root') return '全部文件'
  if (selectedFolder.value === 'unfiled') return '待分类文件'
  return selectedFolderNode.value?.name || '资料目录'
})

const directoryCount = computed(() => {
  if (selectedFolder.value === 'root') return allFiles.value.length
  if (selectedFolder.value === 'unfiled') return unfiledFiles.value.length
  return selectedFolderDocs.value.length
})

const directoryHint = computed(() => {
  if (selectedFolder.value === 'root') return '按目录整理部门资料，待分类文件可直接拖入左侧目录'
  if (selectedFolder.value === 'unfiled') return '尚未归档的资料，可拖拽到左侧任意目录'
  if (selectedFolderHasSubfolders.value) return '含全部子目录中的资料，可拖拽文件行到左侧目录完成移动'
  return '该目录下的资料，可拖拽文件行到左侧目录完成移动'
})

function folderPathOf(file: KnowledgeFile): string {
  const id = folderIdForDoc(file)
  if (id == null) return '待分类'
  return fullPath(id)
}

function selectRootFolder() {
  selectedFolder.value = 'root'
  dirSelectedIds.value = []
}

function selectUnfiledFolder() {
  selectedFolder.value = 'unfiled'
  dirSelectedIds.value = []
}

function selectFolderNode(folder: KnowledgeFolder) {
  selectedFolder.value = folder.id
  dirSelectedIds.value = []
}

function toggleDirSelect(payload: { id: number; checked: boolean }) {
  if (payload.checked) {
    if (!dirSelectedIds.value.includes(payload.id)) dirSelectedIds.value.push(payload.id)
  } else {
    dirSelectedIds.value = dirSelectedIds.value.filter((id) => id !== payload.id)
  }
}

function selectAllRootDocs(checked: boolean) {
  const ids = rootUnfiledPreview.value.map((file) => file.id)
  if (checked) {
    dirSelectedIds.value = [...new Set([...dirSelectedIds.value, ...ids])]
  } else {
    dirSelectedIds.value = dirSelectedIds.value.filter((id) => !ids.includes(id))
  }
}

function selectAllFolderDocs(checked: boolean) {
  const ids = sortedSelectedFolderDocs.value.map((file) => file.id)
  if (checked) {
    dirSelectedIds.value = [...new Set([...dirSelectedIds.value, ...ids])]
  } else {
    dirSelectedIds.value = dirSelectedIds.value.filter((id) => !ids.includes(id))
  }
}

function docsByIds(ids: number[]): KnowledgeFile[] {
  const wanted = new Set(ids)
  return allFiles.value.filter((file) => wanted.has(file.id))
}

async function moveDocsAndRefresh(
  docs: KnowledgeFile[],
  folderId: FolderId | null,
): Promise<number> {
  const moved = await moveDocsToFolder(docs, folderId)
  if (infoDoc.value && docs.some((doc) => doc.id === infoDoc.value!.id)) {
    infoFormVersion.value += 1
  }
  await loadFolders()
  return moved
}

async function moveDirSelected() {
  if (!canManageFolders.value) {
    ElMessage.warning('当前账号无目录维护权限')
    return
  }
  const docs = docsByIds(dirSelectedIds.value)
  if (!docs.length) return
  dirMoving.value = true
  try {
    const moved = await moveDocsAndRefresh(docs, dirMoveTarget.value)
    ElMessage.success(`已移动 ${moved || docs.length} 个文件`)
    dirSelectedIds.value = []
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error?.message || '移动失败')
  } finally {
    dirMoving.value = false
  }
}

async function moveAllSelected() {
  if (!canManageFolders.value) {
    ElMessage.warning('当前账号无目录维护权限')
    return
  }
  const docs = docsByIds(selectedDocIds.value)
  if (!docs.length) return
  allMoving.value = true
  try {
    const moved = await moveDocsAndRefresh(docs, allMoveTarget.value)
    ElMessage.success(`已移动 ${moved || docs.length} 个文件`)
    selectedDocIds.value = []
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error?.message || '移动失败')
  } finally {
    allMoving.value = false
  }
}

const dragOverFolderId = ref<string | null>(null)

function resolveDroppedIds(event: DragEvent): number[] {
  const raw =
    event.dataTransfer?.getData('application/x-kb-docs') ||
    event.dataTransfer?.getData('text/plain')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    const ids = Array.isArray(parsed) ? parsed : parsed?.ids
    if (!Array.isArray(ids)) return []
    return ids.map((item) => Number(item)).filter((item) => Number.isFinite(item))
  } catch {
    return []
  }
}

async function handleDropDocs(payload: { folderId: FolderId | null; docIds: number[] }) {
  if (!canManageFolders.value) {
    ElMessage.warning('当前账号无目录维护权限')
    return
  }
  const docs = docsByIds(payload.docIds)
  if (!docs.length) return
  try {
    const moved = await moveDocsAndRefresh(docs, payload.folderId)
    ElMessage.success(`已将 ${moved || docs.length} 个文件归档到目录`)
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error?.message || '移动失败')
  }
}

function onFolderCardDragOver(folder: KnowledgeFolder, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverFolderId.value = String(folder.id)
}

function onFolderCardDragLeave(folder: KnowledgeFolder) {
  if (dragOverFolderId.value === String(folder.id)) dragOverFolderId.value = null
}

async function onFolderCardDrop(folder: KnowledgeFolder, event: DragEvent) {
  event.preventDefault()
  dragOverFolderId.value = null
  const ids = resolveDroppedIds(event)
  if (!ids.length) return
  await handleDropDocs({ folderId: folder.id, docIds: ids })
}

function isPromptCancel(error: any): boolean {
  return error === 'cancel' || error === 'close' || error?.action === 'cancel'
}

async function handleCreateFolder(parent: KnowledgeFolder | null) {
  if (!canManageFolders.value) {
    ElMessage.warning('当前账号无目录维护权限')
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      parent ? `在「${parent.name}」下新建文件夹` : '新建自定义文件夹',
      '新建文件夹',
      {
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        inputPlaceholder: '文件夹名称',
        inputValue: '',
        inputValidator: (value: string) => {
          const name = String(value || '').trim()
          if (!name) return '请输入文件夹名称'
          if (name.length > 64) return '名称不能超过 64 个字符'
          return true
        },
      },
    )
    const created = await createFolderRequest(result.value, parent?.id ?? null)
    ElMessage.success('文件夹已创建')
    if (created?.id != null) {
      selectedFolder.value = created.id
    }
  } catch (error: any) {
    if (isPromptCancel(error)) return
    if (!error?.response) ElMessage.error(error?.message || '新建文件夹失败')
  }
}

async function handleRenameFolder(folder: KnowledgeFolder) {
  if (!canManageFolders.value) return
  try {
    const result = await ElMessageBox.prompt('重命名自定义文件夹', '重命名文件夹', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputPlaceholder: '文件夹名称',
      inputValue: folder.name,
      inputValidator: (value: string) => {
        const name = String(value || '').trim()
        if (!name) return '请输入文件夹名称'
        if (name.length > 64) return '名称不能超过 64 个字符'
        return true
      },
    })
    const name = String(result.value || '').trim()
    if (name === folder.name) return
    await renameFolderRequest(folder.id, name)
    ElMessage.success('文件夹已重命名')
  } catch (error: any) {
    if (isPromptCancel(error)) return
    if (!error?.response) ElMessage.error(error?.message || '重命名失败')
  }
}

async function handleDeleteFolder(folder: KnowledgeFolder) {
  if (!canManageFolders.value) return
  try {
    await ElMessageBox.confirm(
      `确定删除文件夹「${folder.name}」吗？其中的文件将移至上级目录。`,
      '删除文件夹',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  const subtree = [String(folder.id), ...descendantsOf(folder.id).map(String)]
  try {
    const result = await deleteFolderRequest(folder.id)
    if (subtree.includes(String(selectedFolder.value))) selectedFolder.value = 'root'
    ElMessage.success(
      result.movedDocs
        ? `文件夹已删除，${result.movedDocs} 个文件已移至上级目录`
        : '文件夹已删除',
    )
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error?.message || '删除失败')
  }
}

// ── 上传与 AI 识别 ──
function setUploadProgress(key: string, percent: number) {
  const item = queue.value.find((entry) => entry.key === key)
  if (item) item.progress = Math.max(item.progress, Math.min(100, Math.round(percent)))
  const tab = infoTabs.value.find((entry) => entry.key === key)
  if (tab && tab.status === 'uploading') tab.progress = Math.round(percent)
}

async function classifyFile(item: UploadQueueItem) {
  const file = item.file
  const ext = fileExtension(file)
  const meta = `文件名: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB\n文件类型: ${ext}`
  if (isBinaryNoText(file)) {
    return aiClassifyApi({ content: meta })
  }
  let content = meta
  try {
    const extracted = await extractTextFromFile(file)
    if (extracted?.trim()) content = extracted
  } catch (error) {
    console.warn('[部门文件管理] 文本提取失败，使用文件基础信息', error)
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('content', content)
  formData.append('filename', file.name)
  return aiClassifyApi(formData)
}

function applyAiResult(item: UploadQueueItem, result: Awaited<ReturnType<typeof classifyFile>>) {
  if (result.title) item.aiTitle = String(result.title).trim()
  // 用户未手动改过标题时，采用 AI 识别标题；手动改过则保留用户输入，右侧仍可一键采用
  if (item.aiTitle && item.title === item.originalTitle) {
    item.title = item.aiTitle
    item.aiTitleUsed = true
  }
  item.description = String(result.description || '').slice(0, 500)
  item.keywords = (result.keywords || [])
    .map((keyword) => String(keyword).trim())
    .filter(Boolean)
    .slice(0, 20)
  item.scope = result.visibility === 'private' ? 'private' : 'public'
  item.confidence = result.confidence

  let suggestion: KnowledgeFolder | null = null
  if (!localMode.value && result.suggested_folder) {
    suggestion =
      folderOptions.value.find(
        (folder) => String(folder.id) === String(result.suggested_folder!.id),
      ) || null
  }
  if (!suggestion) suggestion = suggestFolder(item.aiTitle || item.title, item.keywords)
  item.suggestedFolderId = suggestion?.id ?? null
  item.suggestedFolderName = suggestion?.name || ''
}

function buildAiMeta(item: UploadQueueItem): AiDocMeta {
  return {
    confidence: item.confidence,
    recommendedTitle: item.aiTitle,
    suggestedFolderId: item.suggestedFolderId ?? null,
    suggestedFolderName: item.suggestedFolderName,
    keywords: item.keywords,
    visibility: item.scope,
    analyzedAt: new Date().toISOString(),
    fromUpload: true,
  }
}

async function uploadViaBackend(
  item: UploadQueueItem,
  title: string,
  folderId: number | null,
): Promise<KnowledgeFile> {
  const formData = new FormData()
  formData.append('file', item.file)
  formData.append('title', title)
  if (item.description) formData.append('description', item.description)
  item.keywords.forEach((keyword) => formData.append('keywords', keyword))
  appendUploadMeta(formData, item.tags)
  formData.append('visibility', item.scope)
  if (folderId != null) formData.append('folder_id', String(folderId))
  setUploadProgress(item.key, 12)
  const result = await uploadFileApi(formData)
  setUploadProgress(item.key, 94)
  return result
}

async function uploadOne(item: UploadQueueItem): Promise<KnowledgeFile> {
  const title = item.title.trim() || fileBaseName(item.file)
  const selectedTarget = targetFolderId.value
  const numericFolder = typeof selectedTarget === 'number' ? selectedTarget : null
  let result: KnowledgeFile

  if (item.file.size > LARGE_FILE_THRESHOLD) {
    try {
      result = await uploadFileToOss({
        file: item.file,
        title,
        description: item.description,
        scope: item.scope,
        keywords: item.keywords,
        tags: item.tags,
        folderId: numericFolder,
        onProgress: (percent) => setUploadProgress(item.key, percent),
      })
    } catch (error) {
      console.warn('[部门文件管理] OSS 上传失败，降级为后端中转', error)
      result = await uploadViaBackend(item, title, numericFolder)
    }
  } else {
    result = await uploadViaBackend(item, title, numericFolder)
  }

  if (localMode.value && selectedTarget != null) {
    setLocalDocFolder(result.id, selectedTarget)
  }

  result.title = title
  result.description = item.description || result.description || ''
  result.visibility = item.scope
  result.keywords = item.keywords.length
    ? item.keywords.map((phrase) => ({ id: 0, phrase, match_type: 'exact', weight: 1 }))
    : result.keywords || []
  ;(result as any).tags = item.tags.map((name) => ({
    id: 0,
    tag_id: 0,
    tag_name: name,
    created_at: '',
  }))
  if (!result.uploader_name) result.uploader_name = username.value
  cacheDesc(result.id, item.description)
  if (item.keywords.length) {
    cacheKeywords(
      result.id,
      item.keywords.map((phrase) => ({ id: 0, phrase, match_type: 'exact', weight: 1 })),
    )
  }
  return result
}

async function confirmUpload() {
  if (uploading.value || !queue.value.length) return

  // 保留原有重名校验：已存在同名资料时阻止误重复上传
  const existingTitles = new Set(allFiles.value.map((file) => file.title.trim()))
  const duplicates = queue.value.filter((item) => existingTitles.has(item.title.trim()))
  if (duplicates.length) {
    ElMessage.warning(`文件「${duplicates[0].title}」已存在，请修改标题或删除后重新上传`)
    return
  }
  const seenTitles = new Set<string>()
  const queueDuplicate = queue.value.find((item) => {
    const title = item.title.trim()
    if (seenTitles.has(title)) return true
    seenTitles.add(title)
    return false
  })
  if (queueDuplicate) {
    ElMessage.warning(`待上传队列中有重复标题「${queueDuplicate.title}」，请先修改`)
    return
  }

  const items = queue.value.slice()
  uploading.value = true
  aiMetaByKey.value = {}
  infoTabs.value = items.map((item) => ({
    key: item.key,
    title: item.title,
    status: 'pending',
    progress: 0,
  }))
  activeInfoKey.value = infoTabs.value[0]?.key ?? null
  infoDoc.value = null
  infoAiMeta.value = null
  detailLoading.value = false
  infoFormVersion.value += 1

  let success = 0
  let failed = 0
  let aiFallback = 0

  try {
    for (const item of items) {
      const tab = infoTabs.value.find((entry) => entry.key === item.key)
      if (!tab) continue

      item.status = 'analyzing'
      item.errorMessage = ''
      item.progress = 0
      tab.status = 'analyzing'
      tab.error = ''

      let classified = false
      try {
        const result = await classifyFile(item)
        applyAiResult(item, result)
        classified = true
      } catch (error) {
        console.warn('[部门文件管理] AI 识别失败', item.file.name, error)
        aiFallback += 1
      }

      item.status = 'uploading'
      tab.status = 'uploading'
      tab.progress = 0
      setUploadProgress(item.key, 2)

      try {
        const doc = await uploadOne(item)
        item.status = 'done'
        item.progress = 100
        item.docId = doc.id
        tab.status = 'done'
        tab.docId = doc.id
        tab.progress = 100
        tab.title = item.title

        const meta = buildAiMeta(item)
        aiMetaByKey.value[item.key] = meta
        aiMetaByDocId.value[doc.id] = meta
        batchDocs.value[item.key] = doc
        success += 1

        if (activeInfoKey.value === item.key) {
          infoAiMeta.value = meta
          infoFormVersion.value += 1
          void loadInfoDetail(doc)
        }
      } catch (error: any) {
        failed += 1
        const message =
          error?.message || error?.response?.data?.detail || '上传失败，请重试'
        item.status = 'error'
        item.errorMessage = aiFallback && !classified ? `AI 识别失败；${message}` : message
        tab.status = 'error'
        tab.error = item.errorMessage
        if (activeInfoKey.value === item.key) {
          infoDoc.value = null
          detailLoading.value = false
          infoFormVersion.value += 1
        }
      }
    }
  } finally {
    uploading.value = false
    queue.value = queue.value.filter((item) => item.status !== 'done')
    await Promise.all([fetchFiles(), loadFolders()])
  }

  if (success && !failed) {
    ElMessage.success(`${success} 个文件已上传，AI 识别结果已填入右侧信息确认区`)
  } else if (success && failed) {
    ElMessage.warning(`${success} 个上传成功，${failed} 个失败；失败文件已保留在队列中`)
  } else if (failed) {
    ElMessage.error('文件上传失败，请检查待上传队列')
  }
  if (aiFallback) {
    ElMessage.warning(`${aiFallback} 个文件 AI 识别未成功，已使用文件基础信息`)
  }
}

// ── 列表操作 ──
function openDocPreview(id: number, title: string) {
  previewRef.value?.openDoc(id, title)
}

function goDocDetail(file: KnowledgeFile) {
  router.push({ name: 'DocDetail', params: { id: file.id } })
}

function handleSelectionChange(rows: KnowledgeFile[]) {
  selectedDocIds.value = rows.map((row) => row.id)
}

async function handleBatchDelete(ids: number[]) {
  if (!ids.length) return
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${ids.length} 个文件吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await batchDeleteDocsApi(ids)
    ElMessage.success('批量删除成功')
    if (infoDoc.value && ids.includes(infoDoc.value.id)) clearInfoSelection()
    dirSelectedIds.value = dirSelectedIds.value.filter((id) => !ids.includes(id))
    selectedDocIds.value = selectedDocIds.value.filter((id) => !ids.includes(id))
    await refreshAll()
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error?.message || '批量删除失败')
  }
}

async function handleDelete(file: KnowledgeFile) {
  try {
    await ElMessageBox.confirm(`确定要删除「${file.title}」吗？`, '删除资料', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteDocApi(file.id)
    if (infoDoc.value?.id === file.id) clearInfoSelection()
    ElMessage.success('删除成功')
    await refreshAll()
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error?.message || '删除失败')
  }
}

async function handleDownload(file: KnowledgeFile) {
  try {
    if (file.download_url) {
      downloadByIframe(file.download_url)
      return
    }
    const token = localStorage.getItem('access_token')
    const response = await fetch(`/api/knowledge/docs/${file.id}/download/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `下载失败 (${response.status})`)
    }
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const json = await response.json()
      const downloadUrl = json.download_url || json.url || json.file_url || json.fileUrl
      if (!downloadUrl) throw new Error('未获取到下载地址')
      downloadByIframe(downloadUrl)
      return
    }
    const blob = await response.blob()
    downloadBlob(blob, file.file_name || file.title || `文件${file.id}`)
  } catch (error: any) {
    ElMessage.error(error?.message || '下载文件失败')
  }
}

function downloadByIframe(url: string) {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  setTimeout(() => document.body.removeChild(iframe), 3000)
}

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

async function handleEdit(file: KnowledgeFile) {
  let keywords = normalizeKeywordList(file.keywords)
  try {
    keywords = normalizeKeywordList(await getKeywordsApi(file.id))
  } catch (error) {
    console.warn('[部门文件管理] 获取关键词失败', error)
  }
  file.keywords = keywords
  editingFile.value = file
  showEditDialog.value = true
}

function handleEditSubmit(data: { title: string; description: string; keywords: Keyword[] }) {
  const file = editingFile.value
  if (file) {
    file.title = data.title
    file.summary = data.description
    ;(file as any).description = data.description
    file.keywords = data.keywords
    cacheKeywords(file.id, data.keywords)
    if (data.description) cacheDesc(file.id, data.description)
    saveFiles(paginatedTableFiles.value)
    ElMessage.success('编辑成功')
    void fetchFiles()
    if (infoDoc.value?.id === file.id) {
      infoFormVersion.value += 1
      void loadInfoDetail(infoDoc.value)
    }
  }
  showEditDialog.value = false
  void refreshAll()
}

function handleRowCommand(command: string, row: KnowledgeFile) {
  if (command === 'edit') void handleEdit(row)
  else if (command === 'resubmit') void handleResubmit(row)
}

async function handleResubmit(file: KnowledgeFile) {
  try {
    await ElMessageBox.confirm(
      `确定重新提交「${file.title}」吗？提交后将重新进入审核队列。`,
      '重新提交审核',
      { confirmButtonText: '重新提交', cancelButtonText: '取消', type: 'info' },
    )
  } catch {
    return
  }
  try {
    await resubmitDocReviewApi(file.id)
    ElMessage.success('已重新提交，等待审核')
    await fetchFiles()
    if (infoDoc.value?.id === file.id) await loadInfoDetail(infoDoc.value)
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error?.message || '提交失败')
  }
}

function saveFiles(files: KnowledgeFile[]) {
  localStorage.setItem('knowledgeFiles', JSON.stringify(files))
}
</script>

<template>
  <div class="dept-workbench">
    <header class="page-head">
      <div class="head-copy">
        <div class="title-row">
          <h1>部门文件管理</h1>
          <span class="scope-chip">{{ scopeLabel }}</span>
        </div>
        <p>上传、AI 识别与目录归档一体化工作台，面向部门资料管理员使用。</p>
      </div>
      <div class="head-actions">
        <button
          v-if="isSuperAdmin"
          type="button"
          class="ghost-btn"
          @click="showTagManager = true"
        >
          <el-icon><CollectionTag /></el-icon>
          标签词表
        </button>
        <button
          type="button"
          class="ghost-btn"
          :disabled="tableLoading || folderLoading"
          @click="refreshAll"
        >
          <el-icon :class="{ spinning: tableLoading || folderLoading }"><Refresh /></el-icon>
          刷新
        </button>
      </div>
    </header>

    <nav class="page-tabs">
      <button
        type="button"
        :class="{ active: activeTab === 'manage' }"
        @click="activeTab = 'manage'"
      >文件管理</button>
      <button
        type="button"
        :class="{ active: activeTab === 'all' }"
        @click="activeTab = 'all'"
      >
        全部资料
        <span class="tab-count">{{ allFiles.length }}</span>
      </button>
    </nav>

    <div v-show="activeTab === 'manage'" class="workbench-grid">
      <div class="left-col">
        <UploadStagingPanel
          v-model:target-folder-id="targetFolderId"
          :items="queue"
          :folder-options="folderOptions"
          :uploading="uploading"
          @add-files="addFiles"
          @remove="removeQueueItem"
          @update-title="updateQueueTitle"
          @preview="previewQueueItem"
          @confirm="confirmUpload"
        />
        <DeptFolderTree
          :folders="folders"
          :counts="folderCountMap"
          :selected-id="selectedFolder"
          :unfiled-count="unfiledFiles.length"
          :total-count="allFiles.length"
          :scope-label="scopeLabel"
          :scope-kind="scopeKind"
          :can-manage="canManageFolders"
          :loading="folderLoading"
          :load-error="folderLoadError"
          :local-mode="localMode"
          @select-root="selectRootFolder"
          @select-unfiled="selectUnfiledFolder"
          @select="selectFolderNode"
          @create="handleCreateFolder"
          @rename="handleRenameFolder"
          @delete="handleDeleteFolder"
          @refresh="loadFolders"
          @drop-docs="handleDropDocs"
        />
      </div>

      <div class="right-col">
        <DocInfoPanel
          :tabs="infoTabs"
          :active-key="activeInfoKey"
          :doc="infoDoc"
          :ai-meta="infoAiMeta"
          :current-folder-id="infoCurrentFolderId"
          :folder-options="folderOptions"
          :form-version="infoFormVersion"
          :detail-loading="detailLoading"
          :can-edit-info="canEditInfo"
          :can-manage-folder="canManageFolders"
          :can-resubmit="canResubmitInfo"
          :saving="savingInfo"
          @select-tab="openInfoTab"
          @save="handleInfoSave"
          @preview="previewInfoDoc"
          @download="handleDownload"
          @resubmit="handleResubmit"
        />

        <section class="panel directory-panel">
          <div class="directory-head">
            <div class="directory-title-wrap">
              <span class="directory-icon"><el-icon><FolderOpened /></el-icon></span>
              <div class="directory-copy">
                <div class="directory-title">
                  {{ directoryTitle }}
                  <span class="directory-count">{{ directoryCount }}</span>
                </div>
                <div v-if="selectedFolderNode" class="breadcrumb">
                  <button type="button" class="crumb" @click="selectRootFolder">全部文件</button>
                  <template v-for="(node, index) in selectedLineage" :key="node.id">
                    <span class="crumb-sep">/</span>
                    <button
                      type="button"
                      class="crumb"
                      :class="{ current: index === selectedLineage.length - 1 }"
                      @click="selectFolderNode(node)"
                    >{{ node.name }}</button>
                  </template>
                </div>
                <div v-else class="directory-sub">{{ directoryHint }}</div>
              </div>
            </div>

            <div class="directory-tools">
              <el-select v-model="dirSort" size="small" class="sort-select">
                <el-option label="最新上传" value="newest" />
                <el-option label="最早上传" value="oldest" />
                <el-option label="名称排序" value="name" />
                <el-option label="文件大小" value="size" />
              </el-select>
              <div class="view-toggle">
                <button
                  type="button"
                  :class="{ active: dirViewMode === 'list' }"
                  title="列表视图"
                  @click="dirViewMode = 'list'"
                ><el-icon><List /></el-icon></button>
                <button
                  type="button"
                  :class="{ active: dirViewMode === 'grid' }"
                  title="卡片视图"
                  @click="dirViewMode = 'grid'"
                ><el-icon><Grid /></el-icon></button>
              </div>
              <button
                v-if="canManageFolders"
                type="button"
                class="soft-btn"
                @click="handleCreateFolder(selectedFolderNode)"
              >
                <el-icon><FolderAdd /></el-icon>
                新建文件夹
              </button>
            </div>
          </div>

          <div v-if="dirSelectedIds.length" class="batch-bar">
            <span class="batch-label">已选 {{ dirSelectedIds.length }} 项</span>
            <template v-if="canManageFolders">
              <el-select v-model="dirMoveTarget" size="small" class="batch-select" placeholder="移动到目录">
                <el-option label="待分类（根目录）" :value="null" />
                <el-option
                  v-for="folder in folderOptions"
                  :key="folder.id"
                  :label="folder.full_path"
                  :value="folder.id"
                />
              </el-select>
              <button
                type="button"
                class="batch-btn primary"
                :disabled="dirMoving"
                @click="moveDirSelected"
              >{{ dirMoving ? '移动中…' : '移动' }}</button>
            </template>
            <button type="button" class="batch-btn danger" @click="handleBatchDelete(dirSelectedIds)">批量删除</button>
            <button type="button" class="batch-btn plain" @click="dirSelectedIds = []">取消选择</button>
          </div>

          <div class="directory-body">
            <template v-if="selectedFolder === 'root'">
              <div class="dir-section">
                <div class="section-row">
                  <span class="section-title">
                    <el-icon><Clock /></el-icon>
                    待分类文件
                    <em>{{ unfiledFiles.length }}</em>
                  </span>
                  <button
                    v-if="unfiledFiles.length > UNFILED_PREVIEW_LIMIT"
                    type="button"
                    class="link-btn"
                    @click="selectUnfiledFolder"
                  >查看全部</button>
                </div>
                <div v-if="tableLoading" class="section-hint">资料加载中…</div>
                <div v-else-if="!rootUnfiledPreview.length" class="section-empty">
                  暂无待分类文件。上传时可直接选择存放目录，AI 也会给出归档建议。
                </div>
                <DirectoryDocList
                  v-else
                  :docs="rootUnfiledPreview"
                  :view-mode="dirViewMode"
                  :selected-ids="dirSelectedIds"
                  :active-doc-id="infoDoc?.id ?? null"
                  :can-manage="canManageFolders"
                  :show-folder-path="false"
                  :folder-path-of="folderPathOf"
                  :is-uploader="isUploaderOf"
                  @select="selectDocForInfo"
                  @toggle-select="toggleDirSelect"
                  @select-all="selectAllRootDocs"
                  @preview="openDocPreview($event.id, $event.title)"
                  @download="handleDownload"
                  @edit="handleEdit"
                  @delete="handleDelete"
                  @resubmit="handleResubmit"
                  @tag-filter="setTagFilter"
                />
              </div>

              <div class="dir-section">
                <div class="section-row">
                  <span class="section-title">
                    系统自动分类
                    <em class="ai-em">AI</em>
                  </span>
                  <span class="section-note">按资料内容自动归类的默认目录</span>
                </div>
                <div v-if="folderLoading && !systemRootFolders.length" class="section-hint">目录加载中…</div>
                <div v-else class="folder-card-grid">
                  <div
                    v-for="folder in systemRootFolders"
                    :key="folder.id"
                    class="folder-card system"
                    :class="{ 'drop-over': dragOverFolderId === String(folder.id) }"
                    role="button"
                    tabindex="0"
                    @click="selectFolderNode(folder)"
                    @keydown.enter="selectFolderNode(folder)"
                    @dragover="onFolderCardDragOver(folder, $event)"
                    @dragleave="onFolderCardDragLeave(folder)"
                    @drop="onFolderCardDrop(folder, $event)"
                  >
                    <span class="folder-card-icon"><el-icon><FolderOpened /></el-icon></span>
                    <div class="folder-card-main">
                      <div class="folder-card-name">
                        {{ folder.name }}
                        <span class="folder-count">{{ folderCountMap[String(folder.id)] || 0 }}</span>
                      </div>
                      <div class="folder-children">
                        <span
                          v-for="child in childFolders(folder.id).slice(0, 4)"
                          :key="child.id"
                          class="child-chip"
                        >{{ child.name }}</span>
                        <span v-if="childFolders(folder.id).length > 4" class="child-more">
                          +{{ childFolders(folder.id).length - 4 }}
                        </span>
                        <span v-if="!childFolders(folder.id).length" class="child-empty">暂无子目录</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="!systemRootFolders.length" class="section-empty compact">
                    暂无系统分类目录
                  </div>
                </div>
              </div>

              <div class="dir-section">
                <div class="section-row">
                  <span class="section-title">自定义文件夹</span>
                  <span class="section-note">按业务需要自行维护的目录</span>
                </div>
                <div class="folder-card-grid">
                  <div
                    v-for="folder in customRootFolders"
                    :key="folder.id"
                    class="folder-card custom"
                    :class="{ 'drop-over': dragOverFolderId === String(folder.id) }"
                    role="button"
                    tabindex="0"
                    @click="selectFolderNode(folder)"
                    @keydown.enter="selectFolderNode(folder)"
                    @dragover="onFolderCardDragOver(folder, $event)"
                    @dragleave="onFolderCardDragLeave(folder)"
                    @drop="onFolderCardDrop(folder, $event)"
                  >
                    <span class="folder-card-icon"><el-icon><FolderOpened /></el-icon></span>
                    <div class="folder-card-main">
                      <div class="folder-card-name">
                        {{ folder.name }}
                        <span class="folder-count">{{ folderCountMap[String(folder.id)] || 0 }}</span>
                      </div>
                      <div class="folder-children">
                        <span
                          v-for="child in childFolders(folder.id).slice(0, 4)"
                          :key="child.id"
                          class="child-chip"
                        >{{ child.name }}</span>
                        <span v-if="!childFolders(folder.id).length" class="child-empty">空文件夹</span>
                      </div>
                    </div>
                    <div v-if="canManageFolders" class="folder-card-actions" @click.stop>
                      <button type="button" title="重命名" @click="handleRenameFolder(folder)">
                        <el-icon><Edit /></el-icon>
                      </button>
                      <button type="button" class="danger" title="删除文件夹" @click="handleDeleteFolder(folder)">
                        <el-icon><Delete /></el-icon>
                      </button>
                    </div>
                  </div>
                  <button
                    v-if="canManageFolders"
                    type="button"
                    class="folder-card add-folder"
                    @click="handleCreateFolder(null)"
                  >
                    <span class="folder-card-icon"><el-icon><FolderAdd /></el-icon></span>
                    <div class="folder-card-main">
                      <div class="folder-card-name">新建文件夹</div>
                      <div class="folder-children"><span class="child-empty">创建自定义归档目录</span></div>
                    </div>
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <div v-if="selectedFolderNode && !selectedFolderNode.is_system" class="folder-view-note">
                拖拽本目录中的文件到左侧其他目录即可移动。
              </div>

              <div v-if="tableLoading" class="section-hint">资料加载中…</div>
              <template v-else>
                <div v-if="selectedFolderNode" class="subfolder-grid">
                  <button
                    v-for="folder in childFolders(selectedFolderNode.id)"
                    :key="folder.id"
                    type="button"
                    class="subfolder-card"
                    :class="{ 'drop-over': dragOverFolderId === String(folder.id) }"
                    @click="selectFolderNode(folder)"
                    @dragover="onFolderCardDragOver(folder, $event)"
                    @dragleave="onFolderCardDragLeave(folder)"
                    @drop="onFolderCardDrop(folder, $event)"
                  >
                    <el-icon><FolderOpened /></el-icon>
                    <span>{{ folder.name }}</span>
                    <em>{{ folderCountMap[String(folder.id)] || 0 }}</em>
                  </button>
                  <button
                    v-if="canManageFolders"
                    type="button"
                    class="subfolder-card add"
                    @click="handleCreateFolder(selectedFolderNode)"
                  >
                    <el-icon><FolderAdd /></el-icon>
                    <span>新建子文件夹</span>
                  </button>
                </div>

                <DirectoryDocList
                  v-if="sortedSelectedFolderDocs.length"
                  :docs="sortedSelectedFolderDocs"
                  :view-mode="dirViewMode"
                  :selected-ids="dirSelectedIds"
                  :active-doc-id="infoDoc?.id ?? null"
                  :can-manage="canManageFolders"
                  :show-folder-path="selectedFolderHasSubfolders"
                  :folder-path-of="folderPathOf"
                  :is-uploader="isUploaderOf"
                  @select="selectDocForInfo"
                  @toggle-select="toggleDirSelect"
                  @select-all="selectAllFolderDocs"
                  @preview="openDocPreview($event.id, $event.title)"
                  @download="handleDownload"
                  @edit="handleEdit"
                  @delete="handleDelete"
                  @resubmit="handleResubmit"
                  @tag-filter="setTagFilter"
                />
                <div v-else class="directory-empty">
                  <el-icon><FolderOpened /></el-icon>
                  <h3>{{ selectedFolder === 'unfiled' ? '暂无待分类文件' : '该目录暂无资料' }}</h3>
                  <p>
                    {{
                      selectedFolder === 'unfiled'
                        ? '上传时未选择目录的文件会出现在这里。'
                        : '可以从待分类文件拖拽资料到此目录，或在资料信息中调整归档位置。'
                    }}
                  </p>
                </div>
              </template>
            </template>
          </div>
        </section>
      </div>
    </div>

    <section v-if="activeTab === 'all'" class="panel all-panel">
      <div class="all-head">
        <div>
          <h2>全部资料</h2>
          <p>检索部门范围内全部资料，查看审核状态、归档目录与详细元数据。</p>
        </div>
        <div class="all-head-actions">
          <span class="all-count">{{ displayTotalFiles }} 份资料</span>
          <button
            v-if="isSuperAdmin"
            type="button"
            class="ghost-btn"
            @click="showTagManager = true"
          >
            <el-icon><CollectionTag /></el-icon>
            标签词表
          </button>
        </div>
      </div>

      <el-alert
        v-if="myRejectedFiles.length"
        :title="`你有 ${myRejectedFiles.length} 个文档被驳回，请查看驳回理由并重新提交`"
        type="error"
        :closable="false"
        show-icon
        class="review-alert"
      >
        <div class="review-alert-docs">{{ myRejectedTitleText }}</div>
      </el-alert>

      <el-alert
        title="点击文件名可预览；支持 Markdown/文本、图片、音视频、PDF、Word(.docx)、Excel、PPT(.pptx) 在线预览。Office 大文件可能无法预览，可下载后查看。"
        type="info"
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

      <div v-if="activeTagId" class="active-tag-filter">
        <span class="active-tag-label">按标签筛选：</span>
        <el-tag type="warning" effect="light" closable @close="clearTagFilter">{{ activeTagName }}</el-tag>
      </div>

      <div v-if="listError" class="list-error">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ listError }}</span>
        <button type="button" class="link-btn" @click="refreshAll">重试</button>
      </div>

      <div v-if="selectedDocIds.length" class="batch-bar">
        <span class="batch-label">已选 {{ selectedDocIds.length }} 项</span>
        <template v-if="canManageFolders">
          <el-select v-model="allMoveTarget" size="small" class="batch-select" placeholder="移动到目录">
            <el-option label="待分类（根目录）" :value="null" />
            <el-option
              v-for="folder in folderOptions"
              :key="folder.id"
              :label="folder.full_path"
              :value="folder.id"
            />
          </el-select>
          <button type="button" class="batch-btn primary" :disabled="allMoving" @click="moveAllSelected">
            {{ allMoving ? '移动中…' : '移动' }}
          </button>
        </template>
        <button type="button" class="batch-btn danger" @click="handleBatchDelete(selectedDocIds)">批量删除</button>
        <button type="button" class="batch-btn plain" @click="selectedDocIds = []">取消选择</button>
      </div>

      <div class="table-wrap">
        <el-table
          :data="paginatedTableFiles"
          :loading="tableLoading"
          class="file-table"
          empty-text="暂无资料"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="46" align="center" />

          <el-table-column label="资料名" min-width="230" align="left">
            <template #default="{ row }">
              <div class="file-name-cell">
                <span class="table-file-icon" :class="`cat-${categoryOf(row)}`">
                  <el-icon><component :is="docIconOf(row)" /></el-icon>
                </span>
                <span class="file-title" @click="openDocPreview(row.id, row.title)">{{ row.title }}</span>
                <div v-if="rowTags(row).length" class="file-tag-row">
                  <el-tag
                    v-for="tag in rowTags(row)"
                    :key="tag.id"
                    size="small"
                    type="info"
                    effect="plain"
                    class="file-tag"
                    @click.stop="setTagFilter(tag)"
                  >{{ tag.name }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="审核状态" width="108" align="center">
            <template #default="{ row }">
              <ReviewStatusTag
                :status="row.review_status"
                :comment="row.review_comment"
                :reviewer="row.reviewer_name"
                :reviewed-at="row.reviewed_at"
              />
            </template>
          </el-table-column>

          <el-table-column label="归档目录" min-width="140" align="left" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="folder-cell" :class="{ unfiled: folderPathOf(row) === '待分类' }">
                {{ folderPathOf(row) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="上传单位" min-width="120" align="left" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="cell-text">{{ row.collegeName || '未归属' }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="author" label="上传者" min-width="90" align="left" show-overflow-tooltip />

          <el-table-column prop="createdAt" label="上传时间" width="150" align="left" sortable>
            <template #default="{ row }">{{ formatDate(row.createdAt || row.created_at) }}</template>
          </el-table-column>

          <el-table-column label="格式" width="76" align="center">
            <template #default="{ row }">
              <span class="ext-badge">{{ formatCellExt(row) }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="fileSize" label="大小" width="84" align="center" sortable>
            <template #default="{ row }">{{ formatFileSize(Number(row.fileSize ?? row.file_size ?? 0)) }}</template>
          </el-table-column>

          <el-table-column label="操作" width="176" align="center" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <button type="button" class="row-link row-link-strong" @click.stop="goDocDetail(row)">详情</button>
                <span class="row-link-sep" aria-hidden="true" />
                <button type="button" class="row-link" @click.stop="handleDownload(row)">下载</button>
                <span class="row-link-sep" aria-hidden="true" />
                <button type="button" class="row-link row-link-danger" @click.stop="handleDelete(row)">删除</button>
                <el-dropdown
                  trigger="click"
                  placement="bottom-end"
                  @command="(command: string) => handleRowCommand(command, row)"
                >
                  <button type="button" class="row-more" title="更多操作">
                    <el-icon><MoreFilled /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">编辑</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.review_status === 'rejected' && isUploaderOf(row)"
                        command="resubmit"
                        divided
                      >
                        重新提交审核
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

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
    </section>

    <EditFileForm
      :visible="showEditDialog"
      :file="editingFile"
      @close="showEditDialog = false"
      @submit="handleEditSubmit"
    />

    <DocPreviewDialog ref="previewRef" />

    <TagManageDialog v-model:visible="showTagManager" @changed="fetchFiles()" />
  </div>
</template>

<style scoped>
.dept-workbench {
  max-width: 1640px;
  margin: 0 auto;
  padding: 2px 2px 30px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-row h1 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.scope-chip {
  padding: 2px 8px;
  border: 1px solid #dbe6f7;
  border-radius: 4px;
  background: #f8fbff;
  color: #3f6fb5;
  font-size: 11.5px;
}

.head-copy p {
  margin: 5px 0 0;
  color: #7a8ba3;
  font-size: 12.5px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #dde6f1;
  border-radius: 5px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.ghost-btn:hover:not(:disabled) {
  border-color: #bcd2f5;
  color: #2563eb;
}

.ghost-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.page-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid #e8eef6;
}

.page-tabs button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.page-tabs button:hover {
  color: #2563eb;
}

.page-tabs button.active {
  color: #1d4ed8;
  font-weight: 650;
}

.page-tabs button.active::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: #2563eb;
}

.tab-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #f1f5fa;
  color: #64748b;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.page-tabs button.active .tab-count {
  background: #eef4ff;
  color: #2563eb;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(0, 2fr);
  align-items: start;
  gap: 16px;
}

.left-col,
.right-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.panel {
  background: #fff;
  border: 1px solid #e8eef6;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.directory-panel {
  padding: 16px 18px;
  min-height: 420px;
}

.directory-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eef2f7;
}

.directory-title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
}

.directory-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #dbe8fb;
  border-radius: 6px;
  background: #f4f8ff;
  color: #4c7dbf;
  font-size: 16px;
}

.directory-copy {
  min-width: 0;
}

.directory-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 650;
}

.directory-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 9px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 18px;
  text-align: center;
}

.directory-sub,
.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
  color: #8a99ad;
  font-size: 11px;
}

.crumb {
  padding: 0;
  border: 0;
  background: transparent;
  color: #7a8ba3;
  font: inherit;
  cursor: pointer;
}

.crumb:hover {
  color: #2563eb;
}

.crumb.current {
  color: #3f6fb5;
  font-weight: 600;
}

.crumb-sep {
  color: #c2ccda;
}

.directory-tools {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.sort-select {
  width: 104px;
}

.sort-select :deep(.el-select__wrapper) {
  min-height: 27px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px #e5ecf5 inset;
  font-size: 11.5px;
}

.view-toggle {
  display: inline-flex;
  padding: 2px;
  border: 1px solid #e5ecf5;
  border-radius: 5px;
  background: #f8fafc;
}

.view-toggle button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 23px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #8a99ad;
  cursor: pointer;
}

.view-toggle button.active {
  background: #fff;
  color: #2563eb;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.soft-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 27px;
  padding: 0 8px;
  border: 1px solid #dbe6f7;
  border-radius: 5px;
  background: #f8fbff;
  color: #3f6fb5;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.soft-btn:hover {
  border-color: #bcd2f5;
  color: #2563eb;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 2px;
  padding: 7px 9px;
  border: 1px solid #dbe8fb;
  border-radius: 5px;
  background: #f7faff;
}

.batch-label {
  color: #3f6fb5;
  font-size: 11.5px;
  font-weight: 600;
}

.batch-select {
  width: 190px;
}

.batch-select :deep(.el-select__wrapper) {
  min-height: 26px;
  border-radius: 4px;
  font-size: 11.5px;
}

.batch-btn {
  height: 26px;
  padding: 0 9px;
  border-radius: 4px;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.batch-btn.primary {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
}

.batch-btn.primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.batch-btn.primary:disabled {
  border-color: #bcd2f5;
  background: #bcd2f5;
  cursor: not-allowed;
}

.batch-btn.danger {
  border: 1px solid #f3c9c9;
  background: #fff;
  color: #dc2626;
}

.batch-btn.danger:hover {
  background: #fef5f5;
}

.batch-btn.plain {
  border: 1px solid #e2e9f3;
  background: #fff;
  color: #64748b;
}

.batch-btn.plain:hover {
  border-color: #c7d6ea;
  color: #2563eb;
}

.directory-body {
  max-height: 520px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.dir-section {
  padding-top: 14px;
}

.dir-section + .dir-section {
  margin-top: 4px;
  border-top: 1px solid #f1f5fa;
}

.section-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #334155;
  font-size: 12.5px;
  font-weight: 600;
}

.section-title .el-icon {
  color: #6b93c9;
}

.section-title em {
  padding: 0 5px;
  border-radius: 8px;
  background: #f1f5fa;
  color: #64748b;
  font-style: normal;
  font-size: 9.5px;
  font-weight: 500;
  line-height: 15px;
}

.section-title em.ai-em {
  background: #eef4ff;
  color: #3b82f6;
  font-weight: 700;
}

.section-note {
  margin-left: auto;
  color: #a3b0c2;
  font-size: 10.5px;
}

.link-btn {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.section-hint {
  padding: 12px;
  color: #a3b0c2;
  font-size: 11.5px;
}

.section-empty {
  padding: 14px;
  border: 1px dashed #e3eaf4;
  border-radius: 6px;
  background: #fbfcfe;
  color: #94a3b8;
  font-size: 11.5px;
  line-height: 1.65;
  text-align: center;
}

.section-empty.compact {
  padding: 10px;
}

.folder-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(186px, 1fr));
  gap: 8px;
}

.folder-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #e9eef6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.folder-card:hover {
  border-color: #c7d8ee;
  background: #fbfdff;
  box-shadow: 0 2px 7px rgba(37, 99, 235, 0.05);
}

.folder-card.drop-over {
  border-color: #7ba1dc;
  background: #f3f8ff;
  box-shadow: inset 0 0 0 1px #93b4e8;
}

.folder-card-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  background: #f3f7fd;
  color: #5b85bb;
  font-size: 14px;
}

.folder-card.system .folder-card-icon {
  background: #eef4ff;
  color: #2563eb;
}

.folder-card-main {
  min-width: 0;
  flex: 1;
}

.folder-card-name {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #1e293b;
  font-size: 12px;
  font-weight: 600;
}

.folder-count {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #f1f5fa;
  color: #64748b;
  font-size: 9px;
  font-weight: 500;
  line-height: 15px;
  text-align: center;
}

.folder-children {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 5px;
  min-height: 15px;
}

.child-chip {
  padding: 0 4px;
  border-radius: 2px;
  background: #f6f8fb;
  color: #8494a8;
  font-size: 9px;
  line-height: 15px;
}

.child-empty {
  color: #b3bdca;
  font-size: 9.5px;
}

.child-more {
  color: #a3b0c2;
  font-size: 9px;
  line-height: 15px;
}

.folder-card-actions {
  display: none;
  position: absolute;
  right: 6px;
  top: 6px;
  gap: 1px;
  padding: 1px;
  border: 1px solid #e8eef6;
  border-radius: 4px;
  background: #fff;
}

.folder-card:hover .folder-card-actions {
  display: flex;
}

.folder-card-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #8a99ad;
  cursor: pointer;
}

.folder-card-actions button:hover {
  background: #f1f5f9;
  color: #2563eb;
}

.folder-card-actions button.danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

.add-folder {
  border-style: dashed;
  background: #fcfdff;
}

.add-folder .folder-card-icon {
  background: #f8fafc;
  color: #94a3b8;
}

.add-folder .folder-card-name {
  color: #7a8ba3;
  font-weight: 500;
}

.folder-view-note {
  margin: 10px 0 8px;
  color: #94a3b8;
  font-size: 10.5px;
}

.subfolder-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}

.subfolder-card {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 27px;
  padding: 0 8px;
  border: 1px solid #e9eef6;
  border-radius: 5px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.subfolder-card:hover,
.subfolder-card.drop-over {
  border-color: #bcd2f5;
  background: #f7faff;
  color: #2563eb;
}

.subfolder-card .el-icon {
  color: #6b93c9;
}

.subfolder-card em {
  padding: 0 4px;
  border-radius: 7px;
  background: #f1f5fa;
  color: #7c8da3;
  font-style: normal;
  font-size: 9px;
  line-height: 14px;
}

.subfolder-card.add {
  border-style: dashed;
  color: #94a3b8;
}

.directory-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 52px 16px;
  color: #94a3b8;
  text-align: center;
}

.directory-empty .el-icon {
  font-size: 30px;
  color: #c0ccda;
}

.directory-empty h3 {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.directory-empty p {
  max-width: 380px;
  margin: 5px 0 0;
  color: #a3b0c2;
  font-size: 11.5px;
  line-height: 1.65;
}

.all-panel {
  padding: 18px 20px 16px;
}

.all-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.all-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
  font-weight: 650;
}

.all-head p {
  margin: 4px 0 0;
  color: #7a8ba3;
  font-size: 12px;
}

.all-head-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.all-count {
  color: #8a99ad;
  font-size: 11.5px;
}

.review-alert,
.preview-hint {
  margin-bottom: 10px;
}

.review-alert-docs {
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.active-tag-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 4px;
}

.active-tag-label {
  color: #64748b;
  font-size: 12px;
}

.list-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 8px 0;
  padding: 9px 10px;
  border: 1px solid #fecaca;
  border-radius: 5px;
  background: #fef7f7;
  color: #b91c1c;
  font-size: 12px;
}

.table-wrap {
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid #e8eef6;
  border-radius: 8px;
  background: #fff;
}

.file-table {
  width: 100%;
}

.file-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.file-table :deep(.el-table__header th) {
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid #e8eef6;
  background: #f7f9fc;
  color: #5b6b80;
  font-size: 11.5px;
  font-weight: 600;
}

.file-table :deep(.el-table__body td) {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5fa;
  color: #334155;
  font-size: 12px;
}

.file-table :deep(.el-table__body tr:last-child td) {
  border-bottom: none;
}

.file-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #f8fbff;
}

.file-table :deep(.el-table__empty-block) {
  min-height: 180px;
}

.file-table :deep(.el-checkbox__inner) {
  border-radius: 3px;
}

.file-name-cell {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.table-file-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: #f3f7fd;
  color: #5b85bb;
  font-size: 12px;
}

.table-file-icon.cat-pdf { background: #fef2f2; color: #dc5a5a; }
.table-file-icon.cat-word { background: #f0f6ff; color: #3b82f6; }
.table-file-icon.cat-sheet { background: #f2fbf4; color: #22a06b; }
.table-file-icon.cat-slide { background: #fff7ed; color: #d97706; }
.table-file-icon.cat-image { background: #f5f3ff; color: #7c6bd6; }
.table-file-icon.cat-archive { background: #f8f5ee; color: #92723e; }

.file-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #1e293b;
  font-size: 12.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.file-title:hover {
  color: #2563eb;
}

.file-tag-row {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 1px;
  padding-left: 30px;
}

.file-tag {
  cursor: pointer;
}

.cell-text {
  color: #475569;
  font-size: 11.5px;
}

.folder-cell {
  color: #5b6b80;
  font-size: 11.5px;
}

.folder-cell.unfiled {
  color: #b08c4f;
}

.ext-badge {
  display: inline-block;
  min-width: 34px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #f3f6fa;
  color: #5b6b80;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

.row-link {
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: #5b6b80;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.row-link:hover {
  color: #2563eb;
}

.row-link-strong {
  color: #2563eb;
  font-weight: 550;
}

.row-link-danger:hover {
  color: #dc2626;
}

.row-link-sep {
  flex-shrink: 0;
  width: 1px;
  height: 10px;
  background: #e2e8f2;
}

.row-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #8a99ad;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.row-more:hover {
  background: #eef4ff;
  color: #2563eb;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 14px 0 2px;
}

.pagination-wrapper :deep(.el-pagination) {
  display: flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 1180px) {
  .workbench-grid {
    grid-template-columns: minmax(280px, 1fr) minmax(0, 2fr);
  }

  .directory-tools {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}

@media (max-width: 960px) {
  .workbench-grid {
    grid-template-columns: 1fr;
  }

  .directory-body {
    max-height: none;
  }

  .page-head {
    flex-direction: column;
  }

  .head-actions {
    align-self: flex-end;
  }
}
</style>
