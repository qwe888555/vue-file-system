/** 上传前校验与文本提取（部门资料工作台上传队列使用）。 */

export const SUPPORTED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'md', 'html',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'amr',
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v',
  'zip', 'rar', '7z',
  'psd', 'ai',
  'stl', 'obj', 'fbx',
  'epub', 'pub',
]

const MB = 1024 * 1024

export const FILE_SIZE_LIMITS: Record<string, number> = {
  pdf: 50 * MB,
  doc: 30 * MB,
  docx: 30 * MB,
  xls: 30 * MB,
  xlsx: 30 * MB,
  csv: 30 * MB,
  ppt: 50 * MB,
  pptx: 50 * MB,
  txt: 50 * MB,
  md: 50 * MB,
  html: 50 * MB,
  jpg: 30 * MB,
  jpeg: 30 * MB,
  png: 30 * MB,
  gif: 30 * MB,
  webp: 30 * MB,
  bmp: 30 * MB,
  tiff: 30 * MB,
  tif: 30 * MB,
  mp3: 50 * MB,
  wav: 50 * MB,
  ogg: 50 * MB,
  flac: 50 * MB,
  aac: 50 * MB,
  m4a: 50 * MB,
  amr: 50 * MB,
  mp4: 500 * MB,
  webm: 500 * MB,
  mov: 500 * MB,
  avi: 500 * MB,
  mkv: 500 * MB,
  flv: 500 * MB,
  m4v: 500 * MB,
  zip: 80 * MB,
  rar: 80 * MB,
  '7z': 80 * MB,
  psd: 100 * MB,
  ai: 100 * MB,
  stl: 200 * MB,
  obj: 200 * MB,
  fbx: 200 * MB,
  epub: 50 * MB,
  pub: 50 * MB,
}

export function fileExtension(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() || ''
}

/** 返回错误文案；可上传时返回 null */
export function validateUploadFile(file: File): string | null {
  const ext = fileExtension(file)
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    return `不支持的文件格式「.${ext || '未知'}」`
  }
  if (file.size === 0) return '不能上传空文件'
  const maxSize = FILE_SIZE_LIMITS[ext] || 50 * MB
  if (file.size > maxSize) {
    const limit = Math.round(maxSize / MB)
    return `${ext.toUpperCase()} 文件最大 ${limit}MB，当前 ${(file.size / MB).toFixed(2)}MB`
  }
  return null
}

const BINARY_NO_TEXT = new Set([
  'mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma',
  'mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv',
  'zip', 'rar', '7z', 'tar', 'gz',
])

export function isBinaryNoText(file: File): boolean {
  return BINARY_NO_TEXT.has(fileExtension(file))
}

/** 为 AI 分类提取可读文本；无法提取时返回文件元信息 */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = fileExtension(file)
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }
  if (['txt', 'md', 'json', 'xml', 'csv', 'html'].includes(ext)) {
    return await file.text()
  }
  return `文件名: ${file.name}\n文件大小: ${(file.size / MB).toFixed(2)} MB\n文件类型: ${ext}`
}

export function formatUploadSize(size: number): string {
  if (size >= MB) return `${(size / MB).toFixed(2)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function fileBaseName(file: File): string {
  return file.name.replace(/\.[^/.]+$/, '')
}
