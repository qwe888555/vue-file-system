/**
 * 部门资料目录状态。
 *
 * 新后端提供 /knowledge/folders/ 目录接口时使用服务端目录；
 * 旧环境（例如尚未部署新版接口的测试服）自动降级为本地目录：
 * 系统分类目录仍然可用，自定义目录与文件归档关系保存在浏览器，
 * 页面功能不会被接口缺失阻断。
 */
import { computed, ref } from 'vue'
import {
  batchMoveDocsApi,
  createFolderApi,
  deleteFolderApi,
  getFolderListApi,
  moveDocApi,
  updateFolderApi,
} from '@/api/knowledge'
import type { FolderId, KnowledgeFile, KnowledgeFolder } from '@/types'

interface LocalFolderState {
  version: 1
  custom: Array<{
    id: string
    name: string
    parent_id: FolderId | null
    created_at: string
  }>
  mappings: Record<string, FolderId>
}

const SYSTEM_TREE: Array<{ key: string; name: string; children: Array<[string, string]> }> = [
  {
    key: 'teaching',
    name: '教学资料',
    children: [
      ['teaching-outline', '课程大纲'],
      ['teaching-lab', '实验指导书'],
      ['teaching-courseware', '课件与习题'],
      ['teaching-exam', '试题库'],
    ],
  },
  {
    key: 'research',
    name: '科研与项目',
    children: [
      ['research-project', '项目申报'],
      ['research-result', '成果材料'],
    ],
  },
  {
    key: 'admin',
    name: '行政制度',
    children: [
      ['admin-meeting', '会议纪要'],
      ['admin-rules', '规章制度'],
    ],
  },
]

const SUGGEST_RULES: Array<[string[], string]> = [
  [['会议', '纪要', '例会', '座谈', '议程'], 'admin-meeting'],
  [['制度', '规章', '办法', '规定', '条例', '细则', '通知'], 'admin-rules'],
  [['实验', '实训', '指导书', '操作手册'], 'teaching-lab'],
  [['试题', '试卷', '题库', '答案', '考试', '测验'], 'teaching-exam'],
  [['大纲', '教学计划', '课程标准', '培养方案'], 'teaching-outline'],
  [['课件', '讲义', '习题', '教案', 'demo', '演示'], 'teaching-courseware'],
  [['科研', '课题', '项目', '申报', '立项', '基金'], 'research-project'],
  [['成果', '论文', '专利', '获奖', '结题'], 'research-result'],
  [['教学', '课程', '课堂', '教材'], 'teaching-courseware'],
]

function localSystemFolders(): KnowledgeFolder[] {
  const list: KnowledgeFolder[] = []
  SYSTEM_TREE.forEach((root, rootIndex) => {
    const rootId = `local-sys:${root.key}`
    list.push({
      id: rootId,
      name: root.name,
      parent_id: null,
      is_system: true,
      system_key: root.key,
      sort_order: rootIndex + 1,
    })
    root.children.forEach(([key, name], childIndex) => {
      list.push({
        id: `local-sys:${key}`,
        name,
        parent_id: rootId,
        is_system: true,
        system_key: key,
        sort_order: (rootIndex + 1) * 100 + childIndex + 1,
      })
    })
  })
  return list
}

function sortFolders(list: KnowledgeFolder[]): KnowledgeFolder[] {
  return list.slice().sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? -1 : 1
    const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0)
    return orderDiff !== 0 ? orderDiff : String(a.name).localeCompare(String(b.name), 'zh-CN')
  })
}

export function useDeptFolders(storageKey: () => string) {
  const folders = ref<KnowledgeFolder[]>([])
  const localMode = ref(false)
  const loading = ref(false)
  const loadError = ref('')
  const canManage = ref(true)
  const scopeKind = ref<'school' | 'college' | 'department'>('department')
  const localMappings = ref<Record<string, FolderId>>({})
  const localCustom = ref<LocalFolderState['custom']>([])

  const folderMap = computed(() => {
    const map = new Map<FolderId, KnowledgeFolder>()
    folders.value.forEach((folder) => map.set(folder.id, folder))
    return map
  })

  const childMap = computed(() => {
    const map = new Map<string, KnowledgeFolder[]>()
    folders.value.forEach((folder) => {
      const key = folder.parent_id == null ? '__root__' : String(folder.parent_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(folder)
    })
    return map
  })

  /** 目录选项（先序展开，供下拉/选择器使用） */
  const folderOptions = computed(() => {
    const result: Array<KnowledgeFolder & { depth: number; full_path: string }> = []
    const visit = (parentId: FolderId | null, depth: number, prefix: string) => {
      const children = childMap.value.get(parentId == null ? '__root__' : String(parentId)) || []
      children.forEach((folder) => {
        const fullPath = prefix ? `${prefix} / ${folder.name}` : folder.name
        result.push({ ...folder, depth, full_path: fullPath })
        visit(folder.id, depth + 1, fullPath)
      })
    }
    visit(null, 0, '')
    return result
  })

  const systemRootFolders = computed(() =>
    folders.value.filter((folder) => folder.is_system && folder.parent_id == null),
  )
  const customRootFolders = computed(() =>
    folders.value.filter((folder) => !folder.is_system && folder.parent_id == null),
  )

  function folderById(id: FolderId | null | undefined): KnowledgeFolder | undefined {
    if (id == null) return undefined
    return folderMap.value.get(id)
  }

  function fullPath(id: FolderId | null | undefined): string {
    if (id == null) return '待分类'
    const names: string[] = []
    let current = folderById(id)
    let guard = 0
    while (current && guard < 20) {
      names.unshift(current.name)
      current = folderById(current.parent_id)
      guard += 1
    }
    return names.length ? names.join(' / ') : '待分类'
  }

  function childFolders(parentId: FolderId | null): KnowledgeFolder[] {
    return childMap.value.get(parentId == null ? '__root__' : String(parentId)) || []
  }

  function descendantsOf(id: FolderId): FolderId[] {
    const result: FolderId[] = []
    const visit = (current: FolderId) => {
      childFolders(current).forEach((child) => {
        result.push(child.id)
        visit(child.id)
      })
    }
    visit(id)
    return result
  }

  function readLocalState(): LocalFolderState {
    try {
      const raw = localStorage.getItem(storageKey())
      if (!raw) return { version: 1, custom: [], mappings: {} }
      const parsed = JSON.parse(raw)
      if (parsed?.version !== 1) return { version: 1, custom: [], mappings: {} }
      return {
        version: 1,
        custom: Array.isArray(parsed.custom) ? parsed.custom : [],
        mappings: parsed.mappings && typeof parsed.mappings === 'object' ? parsed.mappings : {},
      }
    } catch {
      return { version: 1, custom: [], mappings: {} }
    }
  }

  function persistLocalState() {
    try {
      const state: LocalFolderState = {
        version: 1,
        custom: localCustom.value,
        mappings: Object.fromEntries(
          Object.entries(localMappings.value).filter(([, id]) => id != null),
        ),
      }
      localStorage.setItem(storageKey(), JSON.stringify(state))
    } catch {
      // 浏览器禁用 localStorage 时仅当前会话可用，不阻断操作
    }
  }

  function buildLocalFolders(): KnowledgeFolder[] {
    const custom: KnowledgeFolder[] = localCustom.value.map((item) => ({
      id: item.id,
      name: item.name,
      parent_id: item.parent_id,
      is_system: false,
      created_at: item.created_at,
    }))
    return sortFolders([...localSystemFolders(), ...custom])
  }

  function activateLocalMode() {
    localMode.value = true
    canManage.value = true
    scopeKind.value = 'department'
    const state = readLocalState()
    localCustom.value = state.custom
    localMappings.value = { ...state.mappings }
    folders.value = buildLocalFolders()
  }

  async function loadFolders() {
    loading.value = true
    loadError.value = ''
    try {
      const res = await getFolderListApi()
      localMode.value = false
      folders.value = sortFolders(res.folders || [])
      canManage.value = Boolean(res.scope?.can_manage)
      scopeKind.value = res.scope?.kind || 'department'
      const state = readLocalState()
      localMappings.value = { ...state.mappings }
      localCustom.value = state.custom
    } catch (error: any) {
      const statusCode = Number(error?.response?.status || 0)
      // 旧测试服尚未部署目录接口：降级为本地目录，页面其余功能不受影响
      if (!statusCode || statusCode === 404 || statusCode === 405 || statusCode === 501) {
        console.warn('[部门资料] 目录接口不可用，使用本地目录模式', error)
        activateLocalMode()
      } else {
        loadError.value = error?.response?.data?.detail || '目录加载失败'
      }
    } finally {
      loading.value = false
    }
  }

  async function createFolder(name: string, parentId: FolderId | null): Promise<KnowledgeFolder> {
    const cleanName = name.trim()
    if (!cleanName) throw new Error('目录名称不能为空')
    const siblings = childFolders(parentId)
    if (siblings.some((item) => item.name === cleanName)) {
      throw new Error('同级目录下已存在同名文件夹')
    }
    if (localMode.value) {
      if (parentId != null) {
        const parent = folderById(parentId)
        if (!parent) throw new Error('上级目录不存在')
      }
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      localCustom.value.push({
        id,
        name: cleanName,
        parent_id: parentId,
        created_at: new Date().toISOString(),
      })
      persistLocalState()
      folders.value = buildLocalFolders()
      return folderById(id)!
    }
    const created = await createFolderApi({ name: cleanName, parent_id: parentId })
    await loadFolders()
    return created
  }

  async function renameFolder(id: FolderId, name: string): Promise<void> {
    const folder = folderById(id)
    if (!folder) throw new Error('目录不存在')
    if (folder.is_system) throw new Error('系统分类目录不可重命名')
    const cleanName = name.trim()
    if (!cleanName) throw new Error('目录名称不能为空')
    if (localMode.value) {
      const target = localCustom.value.find((item) => item.id === id)
      if (!target) throw new Error('目录不存在')
      target.name = cleanName
      persistLocalState()
      folders.value = buildLocalFolders()
      return
    }
    await updateFolderApi(id, { name: cleanName })
    await loadFolders()
  }

  async function deleteFolder(id: FolderId): Promise<{ movedDocs: number }> {
    const folder = folderById(id)
    if (!folder) throw new Error('目录不存在')
    if (folder.is_system) throw new Error('系统分类目录不可删除')
    if (localMode.value) {
      const ids = new Set([String(id), ...descendantsOf(id).map(String)])
      const parentId = folder.parent_id
      let movedDocs = 0
      Object.entries(localMappings.value).forEach(([docId, folderId]) => {
        if (folderId != null && ids.has(String(folderId))) {
          if (parentId == null) delete localMappings.value[docId]
          else localMappings.value[docId] = parentId
          movedDocs += 1
        }
      })
      localCustom.value = localCustom.value.filter((item) => !ids.has(String(item.id)))
      persistLocalState()
      folders.value = buildLocalFolders()
      return { movedDocs }
    }
    const res = await deleteFolderApi(id)
    await loadFolders()
    return { movedDocs: res.moved_doc_count || 0 }
  }

  function setLocalFolder(docId: number, folderId: FolderId | null) {
    if (folderId == null) delete localMappings.value[docId]
    else localMappings.value[docId] = folderId
    persistLocalState()
  }

  function folderIdForDoc(doc: KnowledgeFile): FolderId | null {
    if (localMode.value) {
      const local = localMappings.value[doc.id]
      return local ?? null
    }
    return doc.folder ?? null
  }

  /** 把文档归档到目录；本地模式只更新浏览器映射 */
  async function moveDocs(docs: KnowledgeFile[], targetFolderId: FolderId | null) {
    if (!docs.length) return 0
    if (localMode.value) {
      docs.forEach((doc) => {
        doc.folder = targetFolderId as number | null
        setLocalFolder(doc.id, targetFolderId)
      })
      return docs.length
    }
    const numericTarget =
      targetFolderId == null ? null : typeof targetFolderId === 'number' ? targetFolderId : null
    if (docs.length === 1) {
      await moveDocApi(docs[0].id, numericTarget)
      docs[0].folder = numericTarget
      return 1
    }
    const res = await batchMoveDocsApi(
      docs.map((doc) => doc.id),
      numericTarget,
    )
    docs.forEach((doc) => {
      doc.folder = numericTarget
    })
    return res.moved_count || docs.length
  }

  function folderIdBySystemKey(key: string): FolderId | null {
    const folder = folders.value.find((item) => item.system_key === key)
    return folder?.id ?? null
  }

  /** 依据标题与 AI 关键词推荐系统分类目录 */
  function suggestFolder(title: string, keywords: string[]): KnowledgeFolder | null {
    const haystack = `${title || ''} ${(keywords || []).join(' ')}`.toLowerCase()
    if (!haystack.trim()) return null
    const matched = SUGGEST_RULES.find(([tokens]) =>
      tokens.some((token) => haystack.includes(token.toLowerCase())),
    )
    if (!matched) return null
    const id = folderIdBySystemKey(matched[1])
    return id == null ? null : folderById(id) || null
  }

  return {
    folders,
    folderOptions,
    systemRootFolders,
    customRootFolders,
    localMode,
    loading,
    loadError,
    canManage,
    scopeKind,
    loadFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    moveDocs,
    folderIdForDoc,
    setLocalFolder,
    folderById,
    fullPath,
    childFolders,
    descendantsOf,
    suggestFolder,
    folderIdBySystemKey,
  }
}
