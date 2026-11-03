/**
 * 部门资料目录状态。
 *
 * 所有目录均由部门用户自行创建，不再生成 AI 默认分类目录。
 * 新后端提供 /knowledge/folders/ 目录接口时使用服务端目录；
 * 旧环境（例如尚未部署新版接口的测试服）自动降级为本地目录：
 * 自定义目录与文件归档关系保存在浏览器，页面功能不会被接口缺失阻断。
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

function sortFolders(list: KnowledgeFolder[]): KnowledgeFolder[] {
  return list.slice().sort((a, b) => {
    const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0)
    return orderDiff !== 0 ? orderDiff : String(a.name).localeCompare(String(b.name), 'zh-CN')
  })
}

/**
 * 过滤旧版 AI/系统自动生成的目录。
 * 旧服务器尚未执行清理迁移时接口仍会返回 is_system 目录，
 * 这里一律隐藏；其下文件由 folderIdForDoc 自动归入「待分类」。
 */
function sanitizeServerFolders(list: KnowledgeFolder[]): KnowledgeFolder[] {
  const visible = list.filter((folder) => !folder.is_system && !folder.system_key)
  const ids = new Set(visible.map((folder) => String(folder.id)))
  return visible.map((folder) =>
    folder.parent_id != null && !ids.has(String(folder.parent_id))
      ? { ...folder, parent_id: null }
      : folder,
  )
}

function stripLegacySystemMappings(mappings: Record<string, FolderId>): Record<string, FolderId> {
  return Object.fromEntries(
    Object.entries(mappings).filter(
      ([, folderId]) => folderId != null && !String(folderId).startsWith('local-sys:'),
    ),
  )
}

export function useDeptFolders(storageKey: () => string) {
  const folders = ref<KnowledgeFolder[]>([])
  const localMode = ref(false)
  const loading = ref(false)
  const loadError = ref('')
  const canManage = ref(true)
  const scopeKind = ref<'school' | 'college' | 'department' | 'personal'>('department')
  /** 当前是否处于超级管理员「我的专属空间」（目录仅本人可见） */
  const currentPersonal = ref(false)
  /** 超级管理员当前查看的部门；为空表示未按部门查看 */
  const currentDepartmentId = ref<number | null>(null)
  /** 超级管理员当前查看的二级学院；为空表示未按学院查看 */
  const currentCollegeId = ref<number | null>(null)
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

  /** 根目录列表 */
  const rootFolders = computed(() =>
    folders.value.filter((folder) => folder.parent_id == null),
  )

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
      sort_order: 0,
      created_at: item.created_at,
    }))
    return sortFolders(custom)
  }

  function activateLocalMode() {
    localMode.value = true
    canManage.value = true
    scopeKind.value = 'department'
    const state = readLocalState()
    localCustom.value = state.custom
    localMappings.value = stripLegacySystemMappings(state.mappings)
    // 清掉旧版系统目录留下的映射，避免文件仍指向不存在的目录
    persistLocalState()
    folders.value = buildLocalFolders()
  }

  async function loadFolders(options?: {
    departmentId?: number | null
    collegeId?: number | null
    personal?: boolean
  }) {
    const personal = Boolean(options?.personal)
    const departmentId = personal ? null : (options?.departmentId ?? null)
    const collegeId = personal ? null : (options?.collegeId ?? null)
    currentPersonal.value = personal
    currentDepartmentId.value = departmentId
    currentCollegeId.value = collegeId
    loading.value = true
    loadError.value = ''
    try {
      const res = await getFolderListApi({
        department_id: departmentId,
        college_id: collegeId,
        personal,
      })
      localMode.value = false
      folders.value = sortFolders(sanitizeServerFolders(res.folders || []))
      canManage.value = Boolean(res.scope?.can_manage)
      scopeKind.value = res.scope?.kind || 'department'
      currentPersonal.value = Boolean(res.scope?.personal ?? personal)
      if (res.scope?.department_id != null) {
        currentDepartmentId.value = Number(res.scope.department_id)
      }
      if (res.scope?.college_id != null) {
        currentCollegeId.value = Number(res.scope.college_id)
      }
      const state = readLocalState()
      localMappings.value = stripLegacySystemMappings(state.mappings)
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

  /** 切换范围时清空目录状态（全部部门 / 专属空间不加载目录） */
  function resetFolders() {
    folders.value = []
    localMode.value = false
    loading.value = false
    loadError.value = ''
    canManage.value = false
    scopeKind.value = 'school'
    currentPersonal.value = false
    currentDepartmentId.value = null
    currentCollegeId.value = null
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
    const created = await createFolderApi({
      name: cleanName,
      parent_id: parentId,
      department_id: currentDepartmentId.value,
      college_id: currentCollegeId.value,
      personal: currentPersonal.value,
    })
    await loadFolders({
      departmentId: currentDepartmentId.value,
      collegeId: currentCollegeId.value,
      personal: currentPersonal.value,
    })
    return created
  }

  async function renameFolder(id: FolderId, name: string): Promise<void> {
    const folder = folderById(id)
    if (!folder) throw new Error('目录不存在')
    const cleanName = name.trim()
    if (!cleanName) throw new Error('目录名称不能为空')
    if (localMode.value) {
      const target = localCustom.value.find((item) => String(item.id) === String(id))
      if (!target) throw new Error('目录不存在')
      target.name = cleanName
      persistLocalState()
      folders.value = buildLocalFolders()
      return
    }
    await updateFolderApi(id, { name: cleanName }, currentPersonal.value)
    await loadFolders({
      departmentId: currentDepartmentId.value,
      collegeId: currentCollegeId.value,
      personal: currentPersonal.value,
    })
  }

  async function deleteFolder(id: FolderId): Promise<{ movedDocs: number }> {
    const folder = folderById(id)
    if (!folder) throw new Error('目录不存在')
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
    const res = await deleteFolderApi(id, currentPersonal.value)
    await loadFolders({
      departmentId: currentDepartmentId.value,
      collegeId: currentCollegeId.value,
      personal: currentPersonal.value,
    })
    return { movedDocs: res.moved_doc_count || 0 }
  }

  function setLocalFolder(docId: number, folderId: FolderId | null) {
    if (folderId == null) delete localMappings.value[docId]
    else localMappings.value[docId] = folderId
    persistLocalState()
  }

  function folderIdForDoc(doc: KnowledgeFile): FolderId | null {
    const id = localMode.value ? (localMappings.value[doc.id] ?? null) : (doc.folder ?? null)
    if (id == null) return null
    // 目录已不存在（如被清理的系统目录）时视作待分类，避免文件从列表中消失
    return folderById(id) ? id : null
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
      await moveDocApi(docs[0].id, numericTarget, currentPersonal.value)
      docs[0].folder = numericTarget
      return 1
    }
    const res = await batchMoveDocsApi(
      docs.map((doc) => doc.id),
      numericTarget,
      currentPersonal.value,
    )
    docs.forEach((doc) => {
      doc.folder = numericTarget
    })
    return res.moved_count || docs.length
  }

  return {
    folders,
    folderOptions,
    rootFolders,
    localMode,
    loading,
    loadError,
    canManage,
    scopeKind,
    currentPersonal,
    currentDepartmentId,
    currentCollegeId,
    loadFolders,
    resetFolders,
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
  }
}
