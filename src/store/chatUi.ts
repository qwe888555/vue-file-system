// ── 问答页 UI 共享状态 ──
// 跨路由共享：问答页后台生成完毕的红点，rail（问答页）与 Layout 侧边栏（管理页）共同读取
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatUiStore = defineStore('chatUi', () => {
  /** 是否有新生成的问答结果（切回问答页即清除）—— 用户离开问答页时用此标记 rail */
  const unread = ref(false)

  /** 按会话 ID 索引的未读集合 —— 用户在问答页内切到其他对话时，给被切走的对话项标记 */
  const unreadConvIds = ref<Record<number, boolean>>({})

  function setUnread(v: boolean) {
    unread.value = v
  }

  /** 标记某个会话为未读（后台生成完毕但用户未在该会话） */
  function markConvUnread(convId: number) {
    unreadConvIds.value[convId] = true
  }

  /** 清除某个会话的未读（用户切回该会话时调用） */
  function clearConvUnread(convId: number) {
    delete unreadConvIds.value[convId]
  }

  /** 清除全部会话未读（登出时调用） */
  function clearAllConvUnread() {
    unreadConvIds.value = {}
  }

  return { unread, unreadConvIds, setUnread, markConvUnread, clearConvUnread, clearAllConvUnread }
})
