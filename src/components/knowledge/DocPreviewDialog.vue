<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed } from 'vue'
import { ElButton } from 'element-plus'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import { previewDocApi, downloadDocApi } from '@/api/knowledge'
import { classifyDocPreview } from '@/utils/filePreview'
import DOMPurify from 'dompurify'
import MarkdownViewer from '@/components/chat/MarkdownViewer.vue'

const showPreviewDialog = ref(false)
const previewContent = ref('')
const sanitizedPreviewContent = computed(() => DOMPurify.sanitize(previewContent.value))
const previewFileName = ref('')
const previewFileUrl = ref('')
// 内嵌媒体类型（图片/音频/视频/PDF），通过 previewFileUrl 承载 src
const previewMediaKind = ref<'image' | 'audio' | 'video' | 'pdf' | ''>('')
const isOfficePreview = ref(false)
const isMarkdownPreview = ref(false)
const rawMarkdownContent = ref('')

// 初始化 MarkdownIt 实例，支持代码高亮
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch {
        // 忽略高亮错误
      }
    }
    return ''
  },
})

// 预览文本 HTML 转义（DOMPurify 会再兜底净化）
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
const PRE_WRAP = '<pre class="preview-pre">'
const PRE_SUFFIX = '</pre>'
function previewPre(text: string): string {
  return `${PRE_WRAP}${escapeHtml(text)}${PRE_SUFFIX}`
}
function previewPlaceholder(msg: string): string {
  return `<div class="preview-placeholder">${msg}</div>`
}

function releasePreviewObjectUrl() {
  // 只回收本组件用 blob URL 生成的地址（OSS http 地址 revoke 是安全的空操作）
  if (previewFileUrl.value && previewFileUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewFileUrl.value)
  }
}

/** 媒体加载失败（签名过期/防盗链/CORS 等）时改为下载提示，避免对话框留空白 */
function handlePreviewMediaError() {
  if (previewMediaKind.value) {
    releasePreviewObjectUrl()
    previewMediaKind.value = ''
    previewFileUrl.value = ''
    previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
  }
}

const UNSUPPORTED_TIP = '该文件类型暂不支持在线预览，请下载后查看'
const OFFICE_PDF_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'wps', 'et', 'dps']
const BINARY_EXT_SET = new Set([
  ...OFFICE_PDF_EXTS,
  'zip', 'rar', '7z', 'tar', 'gz',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'svg',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'amr', 'wma',
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v', 'wmv',
  'psd', 'ai', 'stl', 'obj', 'fbx', 'epub', 'pub',
])

function isPdfMagic(u8: Uint8Array): boolean {
  return u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46
}
function isZipMagic(u8: Uint8Array): boolean {
  return u8[0] === 0x50 && u8[1] === 0x4b
}
function isOleMagic(u8: Uint8Array): boolean {
  return u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0
}

async function loadMammothLib(): Promise<any> {
  try {
    const m: any = await import('mammoth')
    return m && m.default ? m.default : m
  } catch {
    const m: any = await import('mammoth/mammoth.browser.js')
    return m && m.default ? m.default : m
  }
}

async function loadXlsxLib(): Promise<any> {
  try {
    const m: any = await import('xlsx/xlsx.mjs')
    return m && m.default && m.default.read ? m.default : m
  } catch {
    const m: any = await import('xlsx')
    return m && m.default ? m.default : m
  }
}

async function inflateRaw(u8: Uint8Array): Promise<Uint8Array> {
  const DS: any = (globalThis as any).DecompressionStream
  const ds = new DS('deflate-raw')
  const stream = new Blob([u8]).stream().pipeThrough(ds)
  const ab = await new Response(stream).arrayBuffer()
  return new Uint8Array(ab)
}

/** 按中央目录读取 zip 中满足正则的条目文本（仅支持 method 0/8，够 pptx 用） */
async function zipEntryTexts(buf: ArrayBuffer, want: RegExp): Promise<Map<string, string>> {
  const u8 = new Uint8Array(buf)
  const dv = new DataView(buf)
  const decoder = new TextDecoder('utf-8')

  let eocd = -1
  for (let i = u8.length - 22; i >= 0; i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('不是有效的 zip 文件')

  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  const out = new Map<string, string>()

  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.byteLength || dv.getUint32(off, true) !== 0x02014b50) break
    const method = dv.getUint16(off + 10, true)
    const compSize = dv.getUint32(off + 20, true)
    const nameLen = dv.getUint16(off + 28, true)
    const extraLen = dv.getUint16(off + 30, true)
    const commentLen = dv.getUint16(off + 32, true)
    const localOff = dv.getUint32(off + 42, true)
    const name = decoder.decode(u8.subarray(off + 46, off + 46 + nameLen))

    if (want.test(name)) {
      if (method !== 0 && method !== 8) continue
      const lNameLen = dv.getUint16(localOff + 26, true)
      const lExtraLen = dv.getUint16(localOff + 28, true)
      const dataStart = localOff + 30 + lNameLen + lExtraLen
      if (dataStart + compSize > buf.byteLength) continue
      const comp = u8.subarray(dataStart, dataStart + compSize)
      let text: string
      if (method === 0) {
        text = decoder.decode(comp)
      } else {
        text = decoder.decode(await inflateRaw(comp))
      }
      out.set(name, text)
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function renderPdfBlob(buf: ArrayBuffer) {
  previewFileUrl.value = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
  previewMediaKind.value = 'pdf'
}

async function renderDocxHtml(buf: ArrayBuffer) {
  const mammoth = await loadMammothLib()
  const out = await mammoth.convertToHtml({ arrayBuffer: buf })
  const html: string = (out && out.value) || ''
  if (!html.replace(/<[^>]+>/g, '').trim()) {
    previewContent.value = previewPlaceholder('未提取到文档内容，请下载后查看')
    return
  }
  previewContent.value = `<div class="word-preview">${html}</div>`
}

async function renderXlsxHtml(buf: ArrayBuffer) {
  const XLSX = await loadXlsxLib()
  const workbook = XLSX.read(buf, { type: 'array' })
  const sheetName: string = (workbook.SheetNames || [])[0]
  if (!sheetName || !workbook.Sheets[sheetName]) throw new Error('空工作表')
  const html = XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { editable: false })
  previewContent.value = `<div class="excel-preview">${html}</div>`
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** 提取 pptx 单个 slide XML 的逐段文字（<a:p> 为一段，段落内合并 <a:t>） */
function slideTextOf(xml: string): string[] {
  const tRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g
  const textsIn = (part: string): string => {
    const chunks: string[] = []
    let m: RegExpExecArray | null
    while ((m = tRe.exec(part)) !== null) {
      if (m[1]) chunks.push(decodeXmlEntities(m[1]))
    }
    return chunks.join('').replace(/\s+/g, ' ').trim()
  }
  const parts = xml.split('</a:p>')
  const lines: string[] = []
  for (const part of parts) {
    const line = textsIn(part)
    if (line) lines.push(line)
  }
  return lines
}

async function renderPptxHtml(buf: ArrayBuffer) {
  const entries = await zipEntryTexts(buf, /^ppt\/slides\/slide\d+\.xml$/i)
  const slideFiles = [...entries.keys()].sort((a, b) => {
    const na = Number(/slide(\d+)\.xml/i.exec(a)?.[1] || 0)
    const nb = Number(/slide(\d+)\.xml/i.exec(b)?.[1] || 0)
    return na - nb
  })
  if (!slideFiles.length) throw new Error('未找到幻灯片')
  const blocks: string[] = []
  for (const name of slideFiles) {
    const num = /slide(\d+)\.xml/i.exec(name)?.[1] || ''
    const lines = slideTextOf(entries.get(name) || '')
    if (!lines.length) continue
    const body = lines.map((l) => escapeHtml(l)).join('<br/>')
    blocks.push(`<section class="pptx-slide"><h4 class="pptx-slide-title">第 ${num} 页</h4><div class="pptx-slide-body">${body}</div></section>`)
  }
  if (!blocks.length) throw new Error('幻灯片无文字内容')
  previewContent.value = `<div class="pptx-preview">${blocks.join('')}</div>`
}

/**
 * 下载接口若返回 JSON（{download_url} 链接模式而非二进制流），解析出真实文件地址。
 * 返回 null 表示不是 JSON 或没有链接字段。
 */
async function pickJsonFileUrl(buf: ArrayBuffer): Promise<string | null> {
  if (buf.byteLength === 0 || buf.byteLength > 65536) return null
  const head = new Uint8Array(buf.slice(0, 1))
  // 真实二进制（PDF/zip/OLE）不可能以 { 或 [ 开头
  if (head[0] !== 0x7b && head[0] !== 0x5b) return null
  try {
    const text = new TextDecoder('utf-8').decode(buf)
    const json = JSON.parse(text)
    if (json && typeof json === 'object') {
      return json.download_url || json.url || json.file_url || json.fileUrl || null
    }
  } catch {}
  return null
}

/**
 * 已上传文档本地渲染：通过同源下载接口取原始字节，再按文件真实格式解析渲染。
 * 不依赖后端 preview 接口的 URL/文本，也不受 OSS 跨域与微软 Office Online 限制。
 * pdf → Blob；docx → mammoth 转 HTML；xls/xlsx → SheetJS 转表格；pptx → 逐页文字；
 * doc/ppt 旧二进制、压缩包、设计源/3D/电子书等 → 提示不支持在线预览。
 * 下载接口返回 JSON 链接时，自动改为拉取链接内容再解析。
 */
async function renderLocalBytes(id: number, extHint: string) {
  let blob: Blob
  try {
    blob = await downloadDocApi(id)
  } catch (e: any) {
    console.error('获取文件内容失败:', e)
    previewContent.value = previewPlaceholder(`预览失败：${e?.message || '网络异常'}，请下载后查看`)
    return
  }
  if (!blob || blob.size === 0) {
    previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
    return
  }

  let buf: ArrayBuffer
  try {
    buf = await blob.arrayBuffer()
  } catch (e) {
    console.error('读取文件字节失败:', e)
    previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
    return
  }

  // 后端把下载改成返回 {download_url} JSON 时，这里改为拉取链接的真实内容
  const jsonUrl = await pickJsonFileUrl(buf)
  if (jsonUrl) {
    try {
      const remote = await fetch(jsonUrl)
      if (!remote.ok) throw new Error(`HTTP ${remote.status}`)
      const remoteBuf = await remote.arrayBuffer()
      if (remoteBuf.byteLength > 0) buf = remoteBuf
    } catch (e) {
      console.error('拉取文件真实地址失败（可能是 OSS 跨域限制）:', e)
      previewContent.value = previewPlaceholder('该文件以链接方式存储，受浏览器跨域限制暂无法在线预览，请下载后查看')
      return
    }
  }
  const u8 = new Uint8Array(buf)

  try {
    if (isPdfMagic(u8)) {
      await renderPdfBlob(buf)
      return
    }
    if (isZipMagic(u8)) {
      const hint = (extHint || '').toLowerCase()
      const attempts: Array<() => Promise<void>> = []
      if (hint === 'docx' || hint === 'doc' || hint === 'wps') attempts.push(() => renderDocxHtml(buf))
      else if (hint === 'xls' || hint === 'xlsx' || hint === 'et') attempts.push(() => renderXlsxHtml(buf))
      else if (hint === 'ppt' || hint === 'pptx') attempts.push(() => renderPptxHtml(buf))
      else {
        attempts.push(() => renderDocxHtml(buf))
        attempts.push(() => renderXlsxHtml(buf))
        attempts.push(() => renderPptxHtml(buf))
      }
      for (const attempt of attempts) {
        try {
          await attempt()
          return
        } catch (e) {
          console.error('解析失败，尝试下一种格式:', e)
        }
      }
      previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
      return
    }
    if (isOleMagic(u8)) {
      const hint = (extHint || '').toLowerCase()
      if (hint === 'doc' || hint === 'ppt' || hint === 'wps' || hint === 'dps') {
        previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
        return
      }
      // 旧版二进制 Excel（.xls）可被 SheetJS 读取
      await renderXlsxHtml(buf)
      return
    }
  } catch (e) {
    console.error('文件解析失败:', e)
  }
  // 既不是 PDF/zip/OLE：若像 HTML 错误页说明下载接口异常，给出针对性提示
  if (u8[0] === 0x3c || u8[0] === 0xEF) {
    try {
      const text = new TextDecoder('utf-8').decode(buf.slice(0, 2048)).toLowerCase()
      if (text.includes('<html') || text.includes('<!doctype') || text.includes('gateway') || text.includes('error')) {
        previewContent.value = previewPlaceholder('服务器返回异常，暂时无法预览，请稍后重试或下载后查看')
        return
      }
    } catch {}
  }
  previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
}

/**
 * 预览已上传文档。
 * 文件真实类型以后端返回的 file_name 扩展名为第一依据（title 多为「文件名去后缀」不含扩展名），
 * office/pdf 类一律走同源下载字节 + 本地解析；文本类用后端原文；其余类型提示不支持在线预览。
 */
async function openDoc(id: number, title: string) {
  releasePreviewObjectUrl()
  previewFileName.value = title
  previewContent.value = ''
  previewFileUrl.value = ''
  previewMediaKind.value = ''
  isOfficePreview.value = false
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''

  let result: Awaited<ReturnType<typeof previewDocApi>> | undefined
  try {
    result = await previewDocApi(id)
  } catch (error) {
    console.error('获取文件预览失败:', error)
  }
  showPreviewDialog.value = true

  // 预览接口异常时无法获知类型，直接用同源字节嗅探渲染
  if (!result) {
    await renderLocalBytes(id, '')
    return
  }

  const { kind, ext, fileName } = classifyDocPreview(result, title)
  if (fileName) previewFileName.value = fileName
  const content = result?.content || ''
  const realExt = (ext || '').toLowerCase()

  // 1. 二进制 Office / PDF：一律同源取字节本地解析，规避后端 preview_type 误标 text 造成乱码
  if (OFFICE_PDF_EXTS.includes(realExt)) {
    await renderLocalBytes(id, realExt)
    return
  }

  // 2. 图片/音视频：直接展示后端签名地址
  if (kind === 'image' || kind === 'audio' || kind === 'video') {
    if (!content) {
      previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
      return
    }
    previewMediaKind.value = kind
    previewFileUrl.value = content
    return
  }

  // 3. 文本类（md/txt/html/csv/json 等，后端回原文可正常预览）
  if (kind === 'markdown' || kind === 'html' || kind === 'text') {
    if (BINARY_EXT_SET.has(realExt)) {
      previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
      return
    }
    if (kind === 'markdown') {
      isMarkdownPreview.value = true
      rawMarkdownContent.value = content || '无法查看文件内容'
      return
    }
    if (kind === 'html') {
      previewContent.value = content || '无法查看文件内容'
      return
    }
    previewContent.value = previewPre(content || '无法查看文件详细内容')
    return
  }

  // 4. 其余二进制（pdf/office 在第 1 步已拦截，此处兜底再按字节嗅探一次）
  if (kind === 'pdf' || kind === 'office' || (realExt && BINARY_EXT_SET.has(realExt))) {
    await renderLocalBytes(id, realExt)
    return
  }

  previewContent.value = previewPlaceholder(UNSUPPORTED_TIP)
}

/** 本地未上传文件预览（上传列表内的预览图标） */
async function openLocalFile(file: File, docId?: number) {
  const item = { file, docId }
  previewFileName.value = item.file.name
  previewContent.value = ''
  previewFileUrl.value = ''

  const ext = item.file.name.split('.').pop()?.toLowerCase()

  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const arrayBuffer = await item.file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      previewContent.value = previewPre(result.value)
      showPreviewDialog.value = true
    } catch (error) {
      console.error('预览Word文档失败:', error)
      previewContent.value = previewPlaceholder('浏览器无法直接预览此文件。请下载文件后使用Word等文档软件打开查看。')
      showPreviewDialog.value = true
    }
  } else if (ext === 'pdf') {
    if (item.docId) {
      try {
        const result = await previewDocApi(item.docId)
        if (result.preview_type === 'url') {
          previewFileUrl.value = result.content
          showPreviewDialog.value = true
        } else {
          previewContent.value = previewPlaceholder('浏览器无法直接预览此文件。请下载文件后使用PDF阅读器打开查看。')
          showPreviewDialog.value = true
        }
      } catch (error) {
        console.error('预览文件失败:', error)
        previewContent.value = previewPlaceholder('预览失败，请重试。')
        showPreviewDialog.value = true
      }
    } else {
      previewContent.value = previewPlaceholder('PDF文件需要先上传才能预览。')
      showPreviewDialog.value = true
    }
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
    previewContent.value = previewPlaceholder('图片文件请下载后使用图片查看器打开查看')
    showPreviewDialog.value = true
  } else if (['xls', 'xlsx'].includes(ext || '')) {
    // Excel 文件：用 xlsx 库解析首个工作表为 HTML 表格预览
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await item.file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const html = XLSX.utils.sheet_to_html(firstSheet, { editable: false })
      previewContent.value = `<div class="excel-preview">${html}</div>`
      showPreviewDialog.value = true
    } catch (error) {
      console.error('预览Excel文件失败:', error)
      previewContent.value = previewPlaceholder('Excel文件预览失败，请下载后使用Excel打开查看')
      showPreviewDialog.value = true
    }
  } else if (ext === 'pub') {
    previewContent.value = previewPlaceholder('Publisher(.pub)文件暂不支持在线预览，请下载后使用Microsoft Publisher打开查看')
    showPreviewDialog.value = true
  } else if (['md', 'markdown'].includes(ext || '')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      previewContent.value = md.render(content || '无法查看文件内容')
      showPreviewDialog.value = true
    }
    reader.readAsText(item.file)
  } else if (['txt', 'json', 'xml', 'csv'].includes(ext || '')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      previewContent.value = previewPre(content)
      showPreviewDialog.value = true
    }
    reader.readAsText(item.file)
  } else {
    previewContent.value = previewPlaceholder('浏览器无法直接预览此文件格式。请下载文件后使用相应软件打开查看。')
    showPreviewDialog.value = true
  }
}

function handlePreviewClose() {
  releasePreviewObjectUrl()
  previewFileUrl.value = ''
  previewContent.value = ''
  previewMediaKind.value = ''
  isOfficePreview.value = false
  isMarkdownPreview.value = false
  rawMarkdownContent.value = ''
}

defineExpose({ openDoc, openLocalFile })
</script>

<template>
  <el-dialog
    v-model="showPreviewDialog"
    :title="previewFileName"
    width="800px"
    top="5vh"
    @close="handlePreviewClose"
  >
    <div class="preview-content">
      <img
        v-if="previewMediaKind === 'image'"
        :src="previewFileUrl"
        :alt="previewFileName"
        class="preview-media preview-media-image"
        @error="handlePreviewMediaError"
      />
      <video v-else-if="previewMediaKind === 'video'" :src="previewFileUrl" controls class="preview-media preview-media-video" @error="handlePreviewMediaError"></video>
      <audio v-else-if="previewMediaKind === 'audio'" :src="previewFileUrl" controls class="preview-media preview-media-audio" @error="handlePreviewMediaError"></audio>
      <iframe v-else-if="previewMediaKind === 'pdf'" class="preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
      <iframe v-else-if="isOfficePreview" class="preview-iframe" :src="previewFileUrl" frameborder="0"></iframe>
      <MarkdownViewer v-else-if="isMarkdownPreview" :content="rawMarkdownContent" class="preview-markdown" />
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else v-html="sanitizedPreviewContent" class="preview-text" :class="{ 'markdown-body': previewFileName.endsWith('.md') || previewFileName.endsWith('.markdown') }"></div>
    </div>
    <template #footer>
      <el-button @click="showPreviewDialog = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.preview-content {
  max-height: 600px;
  overflow-y: auto;
}

/* Excel 预览表格样式 */
.excel-preview {
  overflow-x: auto;
}
.excel-preview table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}
.excel-preview td, .excel-preview th {
  border: 1px solid #dcdfe6;
  padding: 6px 10px;
  text-align: left;
  white-space: nowrap;
}
.excel-preview tr:nth-child(even) {
  background: #f5f7fa;
}
.excel-preview tr:hover {
  background: #ecf5ff;
}

/* Word 预览样式 */
.word-preview {
  line-height: 1.7;
}
.word-preview img {
  max-width: 100%;
  height: auto;
}
.word-preview table {
  border-collapse: collapse;
}
.word-preview td,
.word-preview th {
  border: 1px solid #dcdfe6;
  padding: 4px 8px;
}
.word-preview ul,
.word-preview ol {
  padding-left: 1.5em;
}

/* PPTX 预览样式 */
.pptx-slide {
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
}
.pptx-slide:last-child {
  border-bottom: none;
}
.pptx-slide-title {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--color-primary, #409eff);
}
.pptx-slide-body {
  line-height: 1.7;
  word-break: break-word;
}

/* Markdown 渲染样式 */
.preview-text.markdown-body {
  line-height: 1.7;
  word-break: break-word;
  overflow-wrap: break-word;
  padding: 0;
}

.preview-text.markdown-body :deep(h1),
.preview-text.markdown-body :deep(h2),
.preview-text.markdown-body :deep(h3),
.preview-text.markdown-body :deep(h4) {
  margin: 1em 0 0.5em;
  font-weight: 600;
  line-height: 1.3;
  padding-left: 0;
}

.preview-text.markdown-body :deep(h1) { font-size: 1.4em; }
.preview-text.markdown-body :deep(h2) { font-size: 1.25em; }
.preview-text.markdown-body :deep(h3) { font-size: 1.1em; }

.preview-text.markdown-body :deep(p) {
  margin: 0.5em 0;
  padding-left: 0;
}

.preview-text.markdown-body :deep(ul),
.preview-text.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.preview-text.markdown-body :deep(li) {
  margin: 0.25em 0;
}

.preview-text.markdown-body :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.25em 1em;
  border-left: 3px solid var(--color-primary, #409eff);
  color: var(--color-text-secondary, #606266);
  background: rgba(64, 158, 255, 0.04);
  border-radius: 0 4px 4px 0;
}

.preview-text.markdown-body :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
}

.preview-text.markdown-body :deep(pre) {
  margin: 0.5em 0;
  padding: 1em;
  background: #f6f8fa;
  border-radius: 6px;
  overflow-x: auto;
}

.preview-text.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.85em;
}

.preview-text.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.preview-text.markdown-body :deep(th),
.preview-text.markdown-body :deep(td) {
  border: 1px solid var(--color-border, #e4e7ed);
  padding: 8px 12px;
  text-align: left;
}

.preview-text.markdown-body :deep(th) {
  background: var(--color-bg, #f5f7fa);
  font-weight: 600;
}

.preview-text.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border, #e4e7ed);
  margin: 1em 0;
}

.preview-text.markdown-body :deep(a) {
  color: var(--color-primary, #409eff);
  text-decoration: none;
}

.preview-text.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.preview-text.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}

.preview-text {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 预览内容容器：pre 包裹 / 占位 / 图片 / iframe */
.preview-pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  margin: 0;
}
.preview-placeholder {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary, #64748b);
}
.preview-img {
  display: block;
  max-width: 100%;
  max-height: 600px;
  margin: 0 auto;
  object-fit: contain;
}
.preview-iframe {
  width: 100%;
  height: 600px;
  border: none;
}

/* 内嵌图片/音视频预览（配合 previewMediaKind） */
.preview-media-image {
  display: block;
  max-width: 100%;
  max-height: 600px;
  margin: 0 auto;
  object-fit: contain;
}
.preview-media-video {
  display: block;
  width: 100%;
  max-height: 600px;
  margin: 0 auto;
  background: #000;
  border-radius: 4px;
}
.preview-media-audio {
  display: block;
  width: 100%;
  margin: 40px auto;
}

/* Markdown 预览容器 */
.preview-markdown {
  font-size: 14px;
  color: #303133;
  background: #fff;
  padding: 4px 0;
}
</style>
