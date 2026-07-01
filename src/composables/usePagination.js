import { ref, computed } from 'vue'
export function usePagination(fetchApi) {
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const loading = ref(false)

  // 分页对象直接给el-pagination使用
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    onChange: (page) => {
      pageNum.value = page
      getList()
    },
    onSizeChange: (size) => {
      pageSize.value = 1
      pageSize.value = size
      getList()
    }
  }))

  // 请求列表
  async function getList(extraParams = {}) {
    loading.value = true
    try {
      const res = await fetchApi({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        ...extraParams
      })
      total.value = res.total
      return res.list
    } finally {
      loading.value = false
    }
  }

  // 重置分页
  function resetPage() {
    pageNum.value = 1
    total.value = 0
  }

  return { pageNum, pageSize, total, loading, pagination, getList, resetPage }
}