<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleCheck, Clock, Close, FolderOpened, Loading, UploadFilled, View, WarningFilled } from '@element-plus/icons-vue'
import type { FolderId, KnowledgeFolder } from '@/types'
import type { UploadQueueItem } from '@/types/workbench'
import { formatUploadSize, fileExtension } from '@/utils/uploadValidation'

const props = defineProps<{
  items: UploadQueueItem[]
  targetFolderId: FolderId | null
  folderOptions: Array<KnowledgeFolder & { depth: number; full_path: string }>
  uploading: boolean
  disabledReason?: string
}>()

const emit = defineEmits<{
  (e: 'add-files', files: File[]): void
  (e: 'remove', key: string): void
  (e: 'update-title', payload: { key: string; title: string }): void
  (e: 'preview', item: UploadQueueItem): void
  (e: 'confirm'): void
  (e: 'update:targetFolderId', value: FolderId | null): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
let dragDepth = 0

const pendingCount = computed(() => props.items.length)
const analyzingCount = computed(() => props.items.filter((item) => item.status === 'analyzing').length)
const canConfirm = computed(
  () => !props.uploading && pendingCount.value > 0 && analyzingCount.value === 0,
)

const targetLabel = computed(() => {
  if (props.targetFolderId == null) return '待分类（全部文件根目录）'
  return (
    props.folderOptions.find((item) => item.id === props.targetFolderId)?.full_path ||
    '待分类（全部文件根目录）'
  )
})

function selectFiles() {
  if (props.uploading) return
  fileInput.value?.click()
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) emit('add-files', Array.from(input.files))
  input.value = ''
}

function onDragEnter(event: DragEvent) {
  event.preventDefault()
  dragDepth += 1
  dragging.value = true
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave() {
  dragDepth -= 1
  if (dragDepth <= 0) {
    dragDepth = 0
    dragging.value = false
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  if (props.uploading) return
  const files = event.dataTransfer?.files
  if (files?.length) emit('add-files', Array.from(files))
}

function onFolderChange(value: FolderId | null | undefined) {
  emit('update:targetFolderId', value ?? null)
}

function typeLabel(item: UploadQueueItem): string {
  return fileExtension(item.file).toUpperCase().slice(0, 4) || 'FILE'
}

function statusText(item: UploadQueueItem): string {
  if (item.status === 'analyzing') return 'AI 识别中'
  if (item.status === 'uploading') return `上传中 ${Math.round(item.progress)}%`
  if (item.status === 'done') return '已完成'
  if (item.status === 'error') return item.errorMessage || '上传失败'
  return '待上传'
}
</script>

<template>
  <section class="panel upload-panel">
    <div class="panel-head upload-head">
      <div>
        <h2>上传文件</h2>
        <p>支持批量选择文件，文件将暂存至待上传队列。</p>
      </div>
      <span class="head-badge">部门资料</span>
    </div>

    <div
      class="upload-drop"
      :class="{ active: dragging, disabled: uploading }"
      role="button"
      tabindex="0"
      @click="selectFiles"
      @keydown.enter.prevent="selectFiles"
      @keydown.space.prevent="selectFiles"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <el-icon class="drop-icon"><UploadFilled /></el-icon>
      <strong>拖拽文件到这里，或点击选择</strong>
      <span>支持多文件暂存，确认上传后才开始上传与 AI 分析</span>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="file-input"
        @change="onInputChange"
      />
    </div>

    <div class="queue-head">
      <span>待上传队列</span>
      <em>{{ pendingCount }}</em>
      <small v-if="analyzingCount">{{ analyzingCount }} 个正在识别</small>
    </div>

    <div class="queue-list" :class="{ empty: !items.length }">
      <div v-if="!items.length" class="queue-empty">
        队列为空，拖入或选择文件后会在这里暂存，点击「确认上传」才开始处理。
      </div>
      <div
        v-for="item in items"
        :key="item.key"
        class="queue-row"
        :class="[item.status, { failed: !!item.errorMessage && item.status === 'error' }]"
      >
        <span class="queue-type">{{ typeLabel(item) }}</span>
        <div class="queue-main">
          <input
            class="queue-title-input"
            :value="item.title"
            :disabled="item.status === 'uploading' || item.status === 'done'"
            maxlength="120"
            spellcheck="false"
            title="可修改文件名"
            @input="emit('update-title', { key: item.key, title: ($event.target as HTMLInputElement).value })"
          />
          <div class="queue-meta">
            <span>{{ formatUploadSize(item.file.size) }}</span>
            <i></i>
            <span class="queue-status" :class="item.status">
              <el-icon v-if="item.status === 'analyzing' || item.status === 'uploading'" class="is-spinning">
                <Loading />
              </el-icon>
              <el-icon v-else-if="item.status === 'ready'"><Clock /></el-icon>
              <el-icon v-else-if="item.status === 'done'"><CircleCheck /></el-icon>
              <el-icon v-else-if="item.status === 'error'"><WarningFilled /></el-icon>
              {{ statusText(item) }}
            </span>
          </div>
          <div v-if="item.status === 'uploading'" class="queue-progress">
            <i :style="{ width: `${Math.max(2, item.progress)}%` }"></i>
          </div>
        </div>
        <span class="queue-actions">
          <button
            type="button"
            class="queue-preview"
            title="预览文件"
            @click.stop="emit('preview', item)"
          >
            <el-icon><View /></el-icon>
          </button>
          <button
            v-if="item.status !== 'uploading' && item.status !== 'done'"
            type="button"
            class="queue-remove"
            title="从队列移除"
            @click.stop="emit('remove', item.key)"
          >
            <el-icon><Close /></el-icon>
          </button>
        </span>
      </div>
    </div>

    <div class="location-row">
      <span class="location-label">
        <el-icon><FolderOpened /></el-icon>
        存放位置
      </span>
      <el-select
        :model-value="targetFolderId"
        size="small"
        class="location-select"
        :disabled="uploading"
        placeholder="待分类（全部文件根目录）"
        @update:model-value="onFolderChange"
      >
        <el-option label="待分类（全部文件根目录）" :value="null" />
        <el-option
          v-for="folder in folderOptions"
          :key="folder.id"
          :label="folder.full_path"
          :value="folder.id"
        />
      </el-select>
      <span class="location-tip" :title="targetLabel">上传后仍可移动</span>
    </div>

    <div class="upload-foot">
      <button type="button" class="btn btn-soft" :disabled="uploading" @click="selectFiles">
        选择文件
      </button>
      <button
        type="button"
        class="btn btn-primary confirm-btn"
        :disabled="!canConfirm"
        :title="disabledReason || (canConfirm ? '开始上传并分析文件' : '请先添加文件并等待 AI 识别完成')"
        @click="emit('confirm')"
      >
        {{ uploading ? '上传中…' : '确认上传' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: #fff;
  border: 1px solid #e8eef6;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.upload-panel {
  padding: 16px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: #0f172a;
  letter-spacing: 0.01em;
}

.panel-head p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.head-badge {
  flex-shrink: 0;
  padding: 2px 7px;
  border: 1px solid #dbe6f7;
  border-radius: 4px;
  background: #f8fbff;
  color: #3f6fb5;
  font-size: 11px;
}

.upload-drop {
  margin-top: 14px;
  min-height: 120px;
  border: 1px dashed #c7d6ea;
  border-radius: 7px;
  background: linear-gradient(180deg, #fbfdff, #f7faff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  color: #334155;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.upload-drop:hover,
.upload-drop.active {
  border-color: #7ba1dc;
  background: #f3f8ff;
}

.upload-drop.disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.drop-icon {
  font-size: 25px;
  color: #7ba1dc;
}

.upload-drop strong {
  font-size: 13px;
  font-weight: 600;
}

.upload-drop span {
  font-size: 11.5px;
  color: #7a8ba3;
}

.file-input {
  display: none;
}

.queue-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 14px 0 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: #334155;
}

.queue-head em {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 9px;
  background: #eef4ff;
  color: #2563eb;
  font-style: normal;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.queue-head small {
  margin-left: auto;
  color: #b45309;
  font-weight: 400;
  font-size: 11px;
}

.queue-list {
  border: 1px solid #eef2f7;
  border-radius: 6px;
  max-height: 190px;
  overflow-y: auto;
  background: #fcfdff;
}

.queue-list.empty {
  min-height: 70px;
}

.queue-empty {
  padding: 16px 18px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.65;
  text-align: center;
}

.queue-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 10px;
  border-bottom: 1px solid #f1f5fa;
}

.queue-row:last-child {
  border-bottom: none;
}

.queue-type {
  flex-shrink: 0;
  margin-top: 2px;
  min-width: 31px;
  padding: 2px 4px;
  border: 1px solid #dbe6f7;
  border-radius: 3px;
  background: #f5f9ff;
  color: #3f6fb5;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}

.queue-main {
  min-width: 0;
  flex: 1;
}

.queue-title-input {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  color: #1e293b;
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  outline: none;
  text-overflow: ellipsis;
}

.queue-title-input:focus {
  box-shadow: 0 1px 0 #93b4e8;
}

.queue-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  color: #8a99ad;
  font-size: 10.5px;
}

.queue-meta i {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: #c4cfdd;
}

.queue-status {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.queue-status.ready {
  color: #15803d;
}

.queue-status.analyzing {
  color: #b45309;
}

.queue-status.error {
  color: #dc2626;
}

.queue-status.done {
  color: #15803d;
}

.queue-status .is-spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.queue-progress {
  margin-top: 5px;
  height: 3px;
  border-radius: 2px;
  background: #eaf0f8;
  overflow: hidden;
}

.queue-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
  transition: width 0.2s ease;
}

.queue-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1px;
}

.queue-preview,
.queue-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #a3b0c2;
  cursor: pointer;
}

.queue-preview:hover {
  background: #f1f5f9;
  color: #2563eb;
}

.queue-remove:hover {
  background: #f1f5f9;
  color: #dc2626;
}

.location-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5fa;
}

.location-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: #64748b;
  font-size: 11.5px;
}

.location-select {
  flex: 1;
  min-width: 0;
}

.location-select :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px #e8eef6 inset;
  font-size: 12px;
}

.location-tip {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 10.5px;
}

.upload-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 13px;
}

.btn {
  border-radius: 5px;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 550;
  height: 32px;
  padding: 0 14px;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.btn:disabled {
  cursor: not-allowed;
}

.btn-soft {
  border-color: #d9e3f0;
  background: #fff;
  color: #334155;
}

.btn-soft:hover:not(:disabled) {
  border-color: #93b4e8;
  color: #2563eb;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.btn-primary:disabled {
  background: #bcd2f5;
  border-color: #bcd2f5;
  color: #f8fbff;
}

.confirm-btn {
  flex: 1;
}
</style>
