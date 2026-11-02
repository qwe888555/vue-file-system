<script setup lang="ts">
import {
  Delete,
  Document,
  Download,
  Edit,
  Files,
  FolderOpened,
  Grid,
  Headset,
  Picture,
  Refresh,
  VideoCamera,
  View,
} from '@element-plus/icons-vue'
import type { KnowledgeFile } from '@/types'
import ReviewStatusTag from '@/components/knowledge/ReviewStatusTag.vue'

const props = defineProps<{
  docs: KnowledgeFile[]
  viewMode: 'list' | 'grid'
  selectedIds: number[]
  activeDocId?: number | null
  canManage: boolean
  showFolderPath: boolean
  folderPathOf: (doc: KnowledgeFile) => string
  isUploader?: (doc: KnowledgeFile) => boolean
}>()

const emit = defineEmits<{
  (e: 'select', doc: KnowledgeFile): void
  (e: 'toggle-select', payload: { id: number; checked: boolean }): void
  (e: 'select-all', checked: boolean): void
  (e: 'preview', doc: KnowledgeFile): void
  (e: 'download', doc: KnowledgeFile): void
  (e: 'edit', doc: KnowledgeFile): void
  (e: 'delete', doc: KnowledgeFile): void
  (e: 'resubmit', doc: KnowledgeFile): void
  (e: 'tag-filter', tag: { id: number; name: string }): void
}>()

const EXT_CATEGORY: Record<string, string> = {
  pdf: 'pdf',
  doc: 'word', docx: 'word', wps: 'word',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet',
  ppt: 'slide', pptx: 'slide',
  txt: 'text', md: 'text', html: 'text',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', tiff: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video',
  zip: 'archive', rar: 'archive', '7z': 'archive',
}

const CATEGORY_ICON: Record<string, any> = {
  pdf: Document,
  word: Files,
  sheet: Grid,
  slide: Document,
  text: Document,
  image: Picture,
  audio: Headset,
  video: VideoCamera,
  archive: FolderOpened,
}

const CATEGORY_LABEL: Record<string, string> = {
  pdf: 'PDF',
  word: 'Word',
  sheet: 'Excel',
  slide: 'PPT',
  text: '文本',
  image: '图片',
  audio: '音频',
  video: '视频',
  archive: '压缩包',
}

function extOf(file: KnowledgeFile): string {
  const direct = String(file.file_ext || '').toLowerCase().replace(/^\./, '')
  if (direct) return direct
  const name = String(file.file_name || file.fileUrl || file.title || '')
  const segment = name.split(/[?#/\\]/).pop() || ''
  const dot = segment.lastIndexOf('.')
  return dot > 0 ? segment.slice(dot + 1).toLowerCase() : ''
}

function categoryOf(file: KnowledgeFile): string {
  return EXT_CATEGORY[extOf(file)] || 'other'
}

function iconOf(file: KnowledgeFile): any {
  return CATEGORY_ICON[categoryOf(file)] || Document
}

function typeLabel(file: KnowledgeFile): string {
  const ext = extOf(file)
  if (ext && EXT_CATEGORY[ext]) return CATEGORY_LABEL[ext]
  return ext ? ext.toUpperCase() : '文件'
}

function sizeLabel(file: KnowledgeFile): string {
  const size = Number(file.fileSize ?? (file as any).file_size ?? 0)
  if (!size) return '-'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function dateLabel(file: KnowledgeFile): string {
  const raw = file.createdAt || (file as any).created_at
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function tagsOf(file: KnowledgeFile): Array<{ id: number; name: string }> {
  const list: any[] = (file as any).tags || []
  return list
    .map((tag) => ({ id: tag.tag_id ?? tag.id, name: tag.tag_name ?? tag.name ?? '' }))
    .filter((tag) => tag.id != null && tag.name)
}

function isSelected(id: number): boolean {
  return props.selectedIds.includes(id)
}

function allSelected(): boolean {
  return props.docs.length > 0 && props.docs.every((doc) => isSelected(doc.id))
}

function toggleAll(checked: boolean) {
  emit('select-all', checked)
}

function onToggle(doc: KnowledgeFile, event: Event) {
  emit('toggle-select', {
    id: doc.id,
    checked: (event.target as HTMLInputElement).checked,
  })
}

function onDragStart(doc: KnowledgeFile, event: DragEvent) {
  if (!props.canManage || !event.dataTransfer) {
    event.preventDefault()
    return
  }
  const ids = isSelected(doc.id) ? [...props.selectedIds] : [doc.id]
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-kb-docs', JSON.stringify({ ids }))
  event.dataTransfer.setData('text/plain', JSON.stringify({ ids }))
}

function canResubmit(doc: KnowledgeFile): boolean {
  return doc.review_status === 'rejected' && Boolean(props.isUploader?.(doc))
}
</script>

<template>
  <div v-if="viewMode === 'list'" class="doc-list">
    <div class="list-head">
      <label class="check-wrap">
        <input type="checkbox" :checked="allSelected()" @change="toggleAll(($event.target as HTMLInputElement).checked)" />
      </label>
      <span class="head-name">资料名称</span>
      <span class="head-review">审核</span>
      <span class="head-meta">上传者 / 时间</span>
      <span class="head-size">大小</span>
      <span class="head-actions">操作</span>
    </div>

    <div
      v-for="doc in docs"
      :key="doc.id"
      class="doc-row"
      :class="{ selected: isSelected(doc.id), active: activeDocId === doc.id }"
      :draggable="canManage"
      @click="emit('select', doc)"
      @dragstart="onDragStart(doc, $event)"
    >
      <label class="check-wrap" @click.stop>
        <input type="checkbox" :checked="isSelected(doc.id)" @change="onToggle(doc, $event)" />
      </label>

      <div class="doc-main">
        <span class="doc-icon" :class="`cat-${categoryOf(doc)}`">
          <el-icon><component :is="iconOf(doc)" /></el-icon>
        </span>
        <div class="doc-copy">
          <button type="button" class="doc-title" :title="doc.title" @click.stop="emit('select', doc)">
            {{ doc.title || '未命名资料' }}
          </button>
          <div class="doc-sub">
            <span class="type-badge">{{ typeLabel(doc) }}</span>
            <span v-if="showFolderPath" class="folder-line" :title="folderPathOf(doc)">
              <el-icon><FolderOpened /></el-icon>
              {{ folderPathOf(doc) }}
            </span>
            <span
              v-for="tag in tagsOf(doc).slice(0, 2)"
              :key="tag.id"
              class="mini-tag"
              @click.stop="emit('tag-filter', tag)"
            >{{ tag.name }}</span>
          </div>
        </div>
      </div>

      <div class="cell-review">
        <ReviewStatusTag
          :status="doc.review_status"
          :comment="doc.review_comment"
          :reviewer="doc.reviewer_name"
          :reviewed-at="doc.reviewed_at"
        />
      </div>

      <div class="cell-meta" :title="`${doc.uploader_name || doc.author || '未知'} · ${dateLabel(doc)}`">
        <strong>{{ doc.uploader_name || doc.author || '未知' }}</strong>
        <span>{{ dateLabel(doc) }}</span>
      </div>

      <div class="cell-size">{{ sizeLabel(doc) }}</div>

      <div class="row-actions" @click.stop>
        <button type="button" title="预览" @click="emit('preview', doc)">
          <el-icon><View /></el-icon>
        </button>
        <button type="button" title="下载" @click="emit('download', doc)">
          <el-icon><Download /></el-icon>
        </button>
        <button type="button" title="编辑信息" @click="emit('edit', doc)">
          <el-icon><Edit /></el-icon>
        </button>
        <button
          v-if="canResubmit(doc)"
          type="button"
          class="success"
          title="重新提交审核"
          @click="emit('resubmit', doc)"
        >
          <el-icon><Refresh /></el-icon>
        </button>
        <button type="button" class="danger" title="删除" @click="emit('delete', doc)">
          <el-icon><Delete /></el-icon>
        </button>
      </div>
    </div>
  </div>

  <div v-else class="doc-grid">
    <article
      v-for="doc in docs"
      :key="doc.id"
      class="doc-card"
      :class="{ selected: isSelected(doc.id), active: activeDocId === doc.id, dragging: canManage }"
      :draggable="canManage"
      @click="emit('select', doc)"
      @dragstart="onDragStart(doc, $event)"
    >
      <div class="card-top">
        <span class="doc-icon" :class="`cat-${categoryOf(doc)}`">
          <el-icon><component :is="iconOf(doc)" /></el-icon>
        </span>
        <label class="check-wrap" @click.stop>
          <input type="checkbox" :checked="isSelected(doc.id)" @change="onToggle(doc, $event)" />
        </label>
        <ReviewStatusTag
          class="card-review"
          :status="doc.review_status"
          :comment="doc.review_comment"
          :reviewer="doc.reviewer_name"
          :reviewed-at="doc.reviewed_at"
        />
      </div>
      <button type="button" class="card-title" :title="doc.title" @click.stop="emit('select', doc)">
        {{ doc.title || '未命名资料' }}
      </button>
      <div class="card-tags">
        <span class="type-badge">{{ typeLabel(doc) }}</span>
        <span
          v-for="tag in tagsOf(doc).slice(0, 2)"
          :key="tag.id"
          class="mini-tag"
          @click.stop="emit('tag-filter', tag)"
        >{{ tag.name }}</span>
      </div>
      <div v-if="showFolderPath" class="card-folder" :title="folderPathOf(doc)">
        <el-icon><FolderOpened /></el-icon>
        {{ folderPathOf(doc) }}
      </div>
      <div class="card-foot">
        <span>{{ doc.uploader_name || doc.author || '未知' }} · {{ dateLabel(doc) }}</span>
        <span>{{ sizeLabel(doc) }}</span>
      </div>
      <div class="card-actions" @click.stop>
        <button type="button" title="预览" @click="emit('preview', doc)"><el-icon><View /></el-icon></button>
        <button type="button" title="下载" @click="emit('download', doc)"><el-icon><Download /></el-icon></button>
        <button type="button" title="编辑信息" @click="emit('edit', doc)"><el-icon><Edit /></el-icon></button>
        <button
          v-if="canResubmit(doc)"
          type="button"
          class="success"
          title="重新提交审核"
          @click="emit('resubmit', doc)"
        ><el-icon><Refresh /></el-icon></button>
        <button type="button" class="danger" title="删除" @click="emit('delete', doc)"><el-icon><Delete /></el-icon></button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.doc-list {
  border: 1px solid #edf1f7;
  border-radius: 6px;
  overflow: hidden;
}

.list-head {
  display: grid;
  grid-template-columns: 24px minmax(180px, 2fr) 110px 120px 68px 116px;
  align-items: center;
  gap: 8px;
  min-height: 31px;
  padding: 0 10px;
  background: #f8fafd;
  border-bottom: 1px solid #edf1f7;
  color: #94a3b8;
  font-size: 10.5px;
  font-weight: 500;
}

.head-review,
.head-actions {
  text-align: center;
}

.doc-row {
  display: grid;
  grid-template-columns: 24px minmax(180px, 2fr) 110px 120px 68px 116px;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 6px 10px;
  border-bottom: 1px solid #f2f5fa;
  background: #fff;
  cursor: pointer;
  transition: background-color 0.14s ease;
}

.doc-row:last-child {
  border-bottom: none;
}

.doc-row:hover {
  background: #f8fafd;
}

.doc-row.selected {
  background: #f5f9ff;
}

.doc-row.active {
  box-shadow: inset 2px 0 0 #2563eb;
  background: #f4f8ff;
}

.check-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-wrap input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #2563eb;
  cursor: pointer;
}

.doc-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.doc-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  border-radius: 5px;
  background: #f3f7fd;
  color: #5b85bb;
  font-size: 14px;
}

.doc-icon.cat-pdf { background: #fef2f2; color: #dc5a5a; }
.doc-icon.cat-word { background: #f0f6ff; color: #3b82f6; }
.doc-icon.cat-sheet { background: #f2fbf4; color: #22a06b; }
.doc-icon.cat-slide { background: #fff7ed; color: #d97706; }
.doc-icon.cat-image { background: #f5f3ff; color: #7c6bd6; }
.doc-icon.cat-archive { background: #f8f5ee; color: #92723e; }

.doc-copy {
  min-width: 0;
  flex: 1;
}

.doc-title {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1e293b;
  font: inherit;
  font-size: 12.5px;
  font-weight: 550;
  text-align: left;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.doc-title:hover {
  color: #2563eb;
}

.doc-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  min-width: 0;
  color: #97a3b4;
  font-size: 10px;
}

.type-badge {
  flex-shrink: 0;
  padding: 0 4px;
  border: 1px solid #e6edf6;
  border-radius: 2px;
  background: #fbfcfe;
  color: #7c8da3;
  font-size: 9px;
  line-height: 14px;
}

.folder-line {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 160px;
  overflow: hidden;
  color: #94a3b8;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-tag {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 3px;
  background: #fff8ec;
  color: #a16207;
  font-size: 9.5px;
  line-height: 15px;
  cursor: pointer;
}

.mini-tag:hover {
  background: #ffefd0;
}

.cell-review {
  min-width: 0;
  display: flex;
  justify-content: center;
}

.cell-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: #8a99ad;
  font-size: 10px;
  line-height: 1.5;
}

.cell-meta strong {
  overflow: hidden;
  color: #5b6b80;
  font-size: 10.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-size {
  color: #7c8da3;
  font-size: 10.5px;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  justify-content: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.14s ease;
}

.doc-row:hover .row-actions,
.doc-row.active .row-actions {
  opacity: 1;
}

.row-actions button,
.card-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #7c8da3;
  font-size: 12px;
  cursor: pointer;
}

.row-actions button:hover,
.card-actions button:hover {
  border-color: #dbe6f7;
  background: #f5f9ff;
  color: #2563eb;
}

.row-actions button.success:hover,
.card-actions button.success:hover {
  border-color: #c8efd7;
  background: #f3fdf6;
  color: #15803d;
}

.row-actions button.danger:hover,
.card-actions button.danger:hover {
  border-color: #fecaca;
  background: #fef5f5;
  color: #dc2626;
}

.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}

.doc-card {
  position: relative;
  padding: 11px 12px 9px;
  border: 1px solid #e9eef6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.doc-card:hover {
  border-color: #c7d8ee;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.06);
}

.doc-card.selected,
.doc-card.active {
  border-color: #a9c6ef;
  background: #fbfdff;
}

.doc-card.dragging {
  cursor: grab;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-top .check-wrap {
  margin-left: auto;
  order: 2;
}

.card-review {
  order: 3;
}

.card-title {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1e293b;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  text-align: left;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.card-title:hover {
  color: #2563eb;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  min-height: 16px;
}

.card-folder {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 6px;
  overflow: hidden;
  color: #8a99ad;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid #f2f5fa;
  color: #97a3b4;
  font-size: 9.5px;
}

.card-foot span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  position: absolute;
  right: 7px;
  top: 7px;
  display: none;
  gap: 1px;
  padding: 1px;
  border: 1px solid #e8eef6;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.96);
}

.doc-card:hover .card-actions {
  display: flex;
}

.doc-card:hover .card-top .check-wrap,
.doc-card:hover .card-review {
  visibility: hidden;
}
</style>
