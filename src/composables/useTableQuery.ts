// ── 表格查询 Composable ──
// 人员 C 实现
//
// 功能：分页 + 多条件搜索一体化，减少表格页面重复代码
//
// 使用示例：
//   const { tableData, pagination, loading, search, handleSearch, handlePageChange } = useTableQuery(getDocListApi)
//   await search()           // 初始化查询
//   handleSearch({ keyword: 'xxx' })  // 带参数查询
import { ref, reactive } from 'vue'
import type { PaginatedResult } from '@/types'

interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export function useTableQuery<T, F extends Record<string, any>>(
  apiFn: (params: { page: number; pageSize: number } & F) => Promise<PaginatedResult<T>>,
  defaultFilters?: F,
) {
  const tableData = ref<T[]>([])
  const loading = ref(false)
  const filters = reactive<F>({ ...(defaultFilters || {}) } as F)

  const pagination = reactive<PaginationState>({
    page: 1,
    pageSize: 15,
    total: 0,
  })

  async function search(params?: Partial<F>) {
    if (params) Object.assign(filters, params)
    loading.value = true
    try {
      const result = await apiFn({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...(filters as unknown as F),
      })
      tableData.value = result.list
      pagination.total = result.total
    } catch {
      tableData.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  /** 搜索条件变化时重置到第一页 */
  function handleSearch(params?: Partial<F>) {
    pagination.page = 1
    return search(params)
  }

  function handlePageChange(page: number) {
    pagination.page = page
    return search()
  }

  function handleSizeChange(size: number) {
    pagination.pageSize = size
    pagination.page = 1
    return search()
  }

  return {
    tableData,
    pagination,
    loading,
    filters,
    search,
    handleSearch,
    handlePageChange,
    handleSizeChange,
  }
}
