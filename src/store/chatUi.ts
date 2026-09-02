// ── 问答页 UI 共享状态 ──
// 跨路由共享：问答页后台生成完毕的红点，rail（问答页）与 Layout 侧边栏（管理页）共同读取
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatUiStore = defineStore('chatUi', () => {
  /** 是否有新生成的问答结果（切回问答页即清除） */
  const unread = ref(false)

  function setUnread(v: boolean) {
    unread.value = v
  }

  return { unread, setUnread }
})
