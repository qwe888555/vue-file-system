// ── 通用请求 Composable ──
// 人员 A 实现
//
// 功能：统一管理请求的 loading/error/data 状态，避免每个页面重复写 try/catch
//
// 使用示例：
//   const { data, loading, error, execute } = useRequest(getDocListApi)
//   await execute({ page: 1, pageSize: 10 })
//   watch(loading, (v) => { if (!v) console.log('请求完成') })
import { ref, type Ref } from 'vue'

export function useRequest<T, P extends any[]>(
  apiFn: (...args: P) => Promise<T>,
) {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function execute(...args: P): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const result = await apiFn(...args)
      data.value = result
      return result
    } catch (e: any) {
      error.value = e?.message || '请求失败'
      return null
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, execute }
}
