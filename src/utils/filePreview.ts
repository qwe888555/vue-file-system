/**
 * ── 知识库文件预览类型识别工具 ──
 *
 * 背景：知识库文档的 title 通常不带扩展名（上传时默认用「文件名去后缀」、
 * AI 分类后也会重写标题），后端 /knowledge/docs/{id}/preview/ 才是权威来源，
 * 它返回 file_name / file_type / preview_type / content。
 *
 * 前端过去按「title 的扩展名」推断文件类型，导致：
 *   - PDF 被误送进 Office 在线预览 → Office 服务器取不到文件，报 File not found
 *   - 图片/音视频被当成文本 fetch 后显示乱码，或提示「请下载后查看」
 *   - 分类结果不可靠
 *
 * 因此统一改为按后端返回的 file_name / file_type / preview_type 识别，
 * 多个预览组件（DocList / MessageBubble / ReferencesPopover）共用同一套判定。
 */
export type DocPreviewKind =
  | 'markdown'
  | 'text'
  | 'html'
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'office'
  | 'unsupported'

/** previewDocApi / previewDocApi 的返回结构（后端 preview 接口字段） */
export interface DocPreviewResult {
  preview_type?: string
  content?: string
  file_type?: string
  file_name?: string
}

export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
export const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma']
export const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv']
export const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'wps', 'et', 'dps']
export const MARKDOWN_EXTS = ['md', 'markdown']
export const HTML_EXTS = ['html', 'htm']
export const TEXT_EXTS = ['txt', 'json', 'xml', 'csv', 'yaml', 'yml']

function extOf(fileName: string): string {
  if (!fileName) return ''
  return (fileName.split('.').pop() || '').toLowerCase()
}

/**
 * 根据后端预览接口返回结果识别真正的预览类型。
 *
 * @param result  previewDocApi 返回：{ preview_type, content, file_type, file_name }
 * @param fallbackName 调用方手里的展示名（title / 文件名），仅当后端没给 file_name 时兜底
 */
export function classifyDocPreview(
  result: DocPreviewResult,
  fallbackName = '',
): { kind: DocPreviewKind; ext: string; fileName: string } {
  const fileName = result.file_name || fallbackName || ''
  const ext = extOf(fileName)
  const ft = (result.file_type || '').toLowerCase()
  const previewType = (result.preview_type || '').toLowerCase()

  // 纯文本类：后端直接返回原文 content
  if (previewType === 'text' || MARKDOWN_EXTS.includes(ft)) {
    if (
      MARKDOWN_EXTS.includes(ext) ||
      ft === 'markdown' ||
      isLikelyMarkdown(result.content || '')
    ) {
      return { kind: 'markdown', ext, fileName }
    }
    if (HTML_EXTS.includes(ext) || ft === 'html') {
      return { kind: 'html', ext, fileName }
    }
    return { kind: 'text', ext, fileName }
  }

  // preview_type === 'url'：二进制文件，content 是 OSS 签名预览地址。
  // file_type 对二进制文件后端返回的是 image/audio/video/document 分类，
  // document 里还要再用 file_name 扩展名区分 pdf / office。
  if (ft === 'image' || IMAGE_EXTS.includes(ext)) return { kind: 'image', ext, fileName }
  if (ft === 'audio' || AUDIO_EXTS.includes(ext)) return { kind: 'audio', ext, fileName }
  if (ft === 'video' || VIDEO_EXTS.includes(ext)) return { kind: 'video', ext, fileName }
  if (PDF_EXTS.includes(ext) || ft === 'pdf') return { kind: 'pdf', ext, fileName }
  if (OFFICE_EXTS.includes(ext)) return { kind: 'office', ext, fileName }
  if (MARKDOWN_EXTS.includes(ext)) return { kind: 'markdown', ext, fileName }
  if (TEXT_EXTS.includes(ext)) return { kind: 'text', ext, fileName }

  return { kind: 'unsupported', ext, fileName }
}

const PDF_EXTS = ['pdf']

/**
 * 生成可靠、可直接展示的媒体地址。
 *
 * - 图片/音视频：media 标签能自行嗅探内容，直接用 OSS 签名地址即可；
 * - PDF：若 OSS 上传时未带 content-type（application/pdf），iframe 会直接下载而不是渲染，
 *   这里先把文件 fetch 成 Blob 并用 object URL 交给 iframe，保证 PDF 一定能内嵌预览；
 *   fetch 被 CORS 拦截时回退到原地址（此时对象若是 application/pdf 也能正常渲染）。
 *
 * @returns {url, isBlob} isBlob=true 时调用方需在关闭预览时 revokeObjectURL(url)
 */
export async function resolvePreviewMediaUrl(
  kind: DocPreviewKind,
  content: string,
): Promise<{ url: string; isBlob: boolean }> {
  if (kind !== 'pdf' || !content) {
    return { url: content || '', isBlob: false }
  }
  try {
    const res = await fetch(content)
    if (res.ok) {
      const blob = await res.blob()
      const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
      return { url: URL.createObjectURL(pdfBlob), isBlob: true }
    }
  } catch {
    // CORS / 网络异常 → 回退原签名地址
  }
  return { url: content, isBlob: false }
}

/**
 * 智能检测文本是否更像 Markdown。
 * 文件无 .md 扩展名但内容是 Markdown 的场景（如「创建文件」生成的文档）。
 */
export function isLikelyMarkdown(text: string): boolean {
  if (!text || text.length < 10) return false
  const patterns = [
    /^#{1,6}\s/m,        // 标题 # ## ###
    /\*\*[^*]+\*\*/,     // 加粗 **text**
    /^>\s/m,             // 引用 >
    /^[-*+]\s/m,         // 列表项 - * +
    /^\|.+\|$/m,         // 表格行 | ... |
    /```/,               // 代码块
    /`[^`]+`/,           // 行内代码
    /!\[[^\]]*\]\(/,     // 图片 ![alt](url)
    /\[[^\]]+\]\(/,      // 链接 [text](url)
  ]
  return patterns.some((p) => p.test(text))
}

/** HTML 转义，用于把纯文本安全放进 v-html */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
