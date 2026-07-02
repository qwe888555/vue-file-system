// ── SSE 流式问答 Composable ──
// 功能：通过 EventSource 连接 AI 接口，返回流式文本和引用
import { ref, onUnmounted, type Ref } from 'vue'
import { getChatStreamUrl } from '@/api/chat'
import type { KnowledgeFile } from '@/types'

export interface SSEResult {
  /** 累积的完整文本 */
  content: Ref<string>
  /** 是否正在接收中 */
  streaming: Ref<boolean>
  /** 是否已完成 */
  done: Ref<boolean>
  /** 错误信息 */
  error: Ref<string | null>
  /** 引用文件列表 */
  references: Ref<KnowledgeFile[]>
  /** 关闭连接 */
  close: () => void
}

/** 解析 SSE 数据行 */
function parseSSELine(line: string): { type: string; data: any } | null {
  if (!line.startsWith('data:')) return null
  const jsonStr = line.slice(5).trim()
  try {
    const parsed = JSON.parse(jsonStr)
    return { type: parsed.type || 'text', data: parsed }
  } catch {
    // 非 JSON 则当成纯文本
    return { type: 'text', data: { content: jsonStr } }
  }
}

/**
 * 创建 SSE 连接
 * @param conversationId 对话 ID
 * @param question      用户问题
 * @param onDone        可选完成回调
 */
export function useSSE(conversationId: number, question: string, onDone?: () => void): SSEResult {
  const content = ref('')
  const streaming = ref(true)
  const done = ref(false)
  const error = ref<string | null>(null)
  const references = ref<KnowledgeFile[]>([])

  let eventSource: EventSource | null = null
  let closed = false

  function connect() {
    const url = getChatStreamUrl(conversationId, question)
    eventSource = new EventSource(url)

    const msgHandler = (event: MessageEvent) => {
      if (closed) return
      const result = parseSSELine(event.data)
      if (!result) return

      switch (result.type) {
        case 'text':
          content.value += result.data.content || ''
          break
        case 'reference':
          if (result.data.files) {
            references.value = result.data.files
          }
          break
        case 'done':
          done.value = true
          streaming.value = false
          eventSource?.close()
          onDone?.()
          break
        case 'error':
          error.value = result.data.message || 'SSE 连接错误'
          streaming.value = false
          eventSource?.close()
          break
      }
    }

    const errorHandler = () => {
      if (!closed) {
        error.value = 'SSE 连接中断'
        streaming.value = false
        done.value = true
      }
    }

    const openHandler = () => {
      // 连接已建立
    }

    eventSource.addEventListener('message', msgHandler)
    eventSource.addEventListener('error', errorHandler)
    eventSource.addEventListener('open', openHandler)
  }

  function close() {
    closed = true
    streaming.value = false
    eventSource?.close()
    eventSource = null
  }

  connect()

  // 组件卸载时自动断开
  onUnmounted(close)

  return { content, streaming, done, error, references, close }
}
