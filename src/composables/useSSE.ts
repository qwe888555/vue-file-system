// ── SSE 流式问答 Composable ──
// 功能：通过 POST /api/chat/ask/ 连接 AI 接口，解析 SSE 事件流
import { ref, onUnmounted } from 'vue'
import { askQuestionApi } from '@/api/chat'
import type { KnowledgeFile } from '@/types'

export interface SSEResult {
  content: ReturnType<typeof ref<string>>
  streaming: ReturnType<typeof ref<boolean>>
  done: ReturnType<typeof ref<boolean>>
  error: ReturnType<typeof ref<string | null>>
  references: ReturnType<typeof ref<KnowledgeFile[]>>
  suggested: ReturnType<typeof ref<string[]>>
  messageId: ReturnType<typeof ref<number | null>>
  close: () => void
}

/**
 * 创建 SSE 连接（POST）
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
  const suggested = ref<string[]>([])
  const messageId = ref<number | null>(null)

  let abortController: AbortController | null = null
  let closed = false

  async function connect() {
    abortController = new AbortController()
    try {
      const response = await askQuestionApi(conversationId, question)
      if (!response.ok) {
        error.value = `请求失败 (${response.status})`
        streaming.value = false
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        error.value = '响应流不可读'
        streaming.value = false
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (closed || streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            handleEvent(currentEvent, dataStr)
            currentEvent = ''
          }
        }
      }
    } catch (e: any) {
      if (!closed) {
        error.value = e?.message || 'SSE 连接异常'
      }
    } finally {
      if (!closed) {
        streaming.value = false
        done.value = true
        onDone?.()
      }
    }
  }

  function handleEvent(eventType: string, dataStr: string) {
    try {
      switch (eventType) {
        case 'token': {
          const parsed = JSON.parse(dataStr)
          if (parsed.content) content.value += parsed.content
          break
        }
        case 'suggested': {
          const list = JSON.parse(dataStr)
          if (Array.isArray(list)) suggested.value = list
          break
        }
        case 'references': {
          const ref = JSON.parse(dataStr)
          // 后端返回 { count, summary }，前端的 references 是 KnowledgeFile[]
          // 有引用时从 summary 构造一个占位
          if (ref.count > 0) {
            references.value = [{ id: 0, title: ref.summary || '参考来源', summary: ref.summary, status: 1 } as KnowledgeFile]
          }
          break
        }
        case 'done':
          // done 事件由 connect() 的 finally 统一处理，避免重复调用
          break
        case 'error': {
          const parsed = JSON.parse(dataStr)
          error.value = parsed.message || 'SSE 返回错误'
          streaming.value = false
          break
        }
        case 'references_detail': {
          const refDetail = JSON.parse(dataStr)
          if (Array.isArray(refDetail) && refDetail.length > 0) {
            references.value = refDetail.map((r: any) => ({
              id: r.doc_id || 0,
              title: r.doc_title || '',
              fileType: r.file_type || '',
              summary: r.doc_title || '',
              status: 1,
            })) as any
          }
          break
        }
        case 'start': {
          const startData = JSON.parse(dataStr)
          messageId.value = startData?.message_id || null
          break
        }
      }
    } catch {
      // JSON parse 失败则忽略该事件
    }
  }

  function close() {
    closed = true
    streaming.value = false
    abortController?.abort()
    abortController = null
  }

  connect()

  onUnmounted(close)

  return { content, streaming, done, error, references, suggested, messageId, close }
}
