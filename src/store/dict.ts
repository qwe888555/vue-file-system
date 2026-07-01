// ── 字典状态管理 ──
// 职责：全项目字典数据统一入口，避免各页面硬编码文字
// 使用示例：const { getDictLabel } = useDictStore()
//           getDictLabel('fileCategory', 'doc')
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DictItem } from '@/types'

export const useDictStore = defineStore('dict', () => {
  const dictMap = ref<Record<string, DictItem[]>>({})

  /** 获取某类型字典列表 */
  const getDictByType = computed(() => {
    return (type: string): DictItem[] => dictMap.value[type] || []
  })

  /** 根据 type + value 取 label */
  function getDictLabel(type: string, value: string | number): string {
    const items = dictMap.value[type] || []
    return items.find((item) => item.value === value)?.label ?? String(value)
  }

  /** 批量加载字典 */
  async function loadDicts(types: string[]) {
    // TODO: 调后端 /api/dict/list?types=xxx 接口
    // 示例数据：
    const mockDicts: Record<string, DictItem[]> = {
      fileCategory: [
        { label: '教学资料', value: 'teaching', type: 'fileCategory' },
        { label: '科研论文', value: 'research', type: 'fileCategory' },
        { label: '行政文档', value: 'admin', type: 'fileCategory' },
      ],
      userRole: [
        { label: '普通用户', value: 'user', type: 'userRole' },
        { label: '管理员', value: 'admin', type: 'userRole' },
        { label: '超级管理员', value: 'superadmin', type: 'userRole' },
      ],
    }
    types.forEach((type) => {
      dictMap.value[type] = mockDicts[type] || []
    })
  }

  return { dictMap, getDictByType, getDictLabel, loadDicts }
})
