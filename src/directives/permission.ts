// ── 按钮级权限指令 v-permission ──
// 使用：v-permission="'delete'" 或 v-permission="['delete', 'batch-delete']"
import type { DirectiveBinding } from 'vue'
import { usePermissionStore } from '@/store/permission'

export const vPermission = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const { value } = binding
    if (value === undefined || value === null) return

    const permissionStore = usePermissionStore()
    const actions = Array.isArray(value) ? value : [value]

    const hasAny = actions.some((action: string) => permissionStore.hasPermission(action))
    if (!hasAny && el.parentNode) {
      el.parentNode.removeChild(el)
    }
  },
}
