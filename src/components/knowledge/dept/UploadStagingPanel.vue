<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  CircleCheck,
  Clock,
  Close,
  FolderOpened,
  Loading,
  RefreshRight,
  UploadFilled,
  View,
  WarningFilled,
} from '@element-plus/icons-vue'
import type { FolderId, KnowledgeFolder } from '@/types'
import type { UploadQueueItem } from '@/types/workbench'
import { formatUploadSize, fileExtension } from '@/utils/uploadValidation'

const props = defineProps<{
  items: UploadQueueItem[]
  /** 新增文件默认继承的存放目录 */
  targetFolderId: FolderId | null
  folderOptions: Array<KnowledgeFolder & { depth: number; full_path: string }>
  uploading: boolean
  disabledReason?: string
  /** 我的专属空间：文件仅本人可见，目录为专属目录 */
  personalSpace?: boolean
  /** 当前上传范围名称（由角色/左侧范围决定，非本人可选） */
  scopeLabel?: string
  /** 右侧「资料确认」当前展示的文件 key，用于高亮队列行 */
  activeKey?: string | null
}>()

const emit = defineEmits<{
  (e: 'add-files', files: File[]): void
  (e: 'remove', key: string): void
  (e: 'remove-selected', keys: string[]): void
  (e: 'update-title', payload: { key: string; title: string }): void
  (e: 'preview', item: UploadQueueItem): void
  (e: 'retry-analysis', key: string): void
  /** 点击队列文件：在右侧「资料确认」中展示该文件 */
  (e: 'focus', key: string): void
  (e: 'confirm'): void
  (e: 'assign-folders', payload: { keys: string[]; folderId: FolderId | null }): void
  (e: 'update:targetFolderId', value: FolderId | null): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const selectedKeys = ref<Set<string>>(new Set())
const bulkFolderId = ref<FolderId | ''>('')
let dragDepth = 0

const pendingCount = computed(() => props.items.length)
const analyzingCount = computed(() => props.items.filter((item) => item.status === 'analyzing').length)
const canConfirm = computed(
  () => !props.uploading && pendingCount.value > 0 && analyzingCount.value === 0,
)

const selectableItems = computed(() =>
  props.items.filter((item) => item.status !== 'uploading' && item.status !== 'done'),
)
const selectedCount = computed(
  () => selectableItems.value.filter((item) => selectedKeys.value.has(item.key)).length,
)
const allSelected = computed(
  () => selectableItems.value.length > 0 && selectedCount.value === selectableItems.value.length,
)
const someSelected = computed(() => selectedCount.value > 0 && !allSelected.value)

const folderLabel = (id: FolderId | null): string => {
  if (id == null) return '待分类'
  return props.folderOptions.find((item) => item.id === id)?.full_path || '待分类'
}

const targetLabel = computed(() => folderLabel(props.targetFolderId))

watch(
  () => props.items.map((item) => item.key),
  (keys) => {
    const alive = new Set(keys)
    const next = new Set([...selectedKeys.value].filter((key) => alive.has(key)))
    if (next.size !== selectedKeys.value.size) selectedKeys.value = next
  },
)

function toggleSelect(key: string, checked: boolean) {
  const next = new Set(selectedKeys.value)
  if (checked) next.add(key)
  else next.delete(key)
  selectedKeys.value = next
}

function toggleAll(checked: boolean) {
  selectedKeys.value = checked ? new Set(selectableItems.value.map((item) => item.key)) : new Set()
}

function applyBulkFolder(value: FolderId | '') {
  if (!selectedCount.value) return
  emit('assign-folders', {
    keys: selectableItems.value
      .filter((item) => selectedKeys.value.has(item.key))
      .map((item) => item.key),
    folderId: value === '' ? null : value,
  })
  bulkFolderId.value = ''
}

function withdrawSelected() {
  if (!selectedCount.value) return
  emit(
    'remove-selected',
    selectableItems.value
      .filter((item) => selectedKeys.value.has(item.key))
      .map((item) => item.key),
  )
  selectedKeys.value = new Set()
}

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

function onFolderChange(value: FolderId | '') {
  emit('update:targetFolderId', value === '' ? null : value)
}

function typeLabel(item: UploadQueueItem): string {
  return fileExtension(item.file).toUpperCase().slice(0, 4) || 'FILE'
}

function onItemFolderChange(key: string, value: FolderId | '') {
  emit('assign-folders', { keys: [key], folderId: value === '' ? null : value })
}

function statusText(item: UploadQueueItem): string {
  if (item.status === 'analyzing') return 'AI 识别中'
  if (item.status === 'uploading') return `上传中 ${Math.round(item.progress)}%`
  if (item.status === 'done') return '已完成'
  if (item.status === 'error') return item.errorMessage || '上传失败'
  if (item.analysisError) return 'AI 识别失败，可直接上传'
  return item.description || item.keywords.length ? 'AI 识别完成' : '待上传'
}
</script>

<template>
  <section class="panel upload-panel">
    <div class="panel-head upload-head">
      <div>
        <h2>上传文件</h2>
        <p>支持批量选择文件，文件将暂存至待上传队列。</p>
      </div>
      <span
        class="head-badge"
        :class="{ private: personalSpace }"
        :title="personalSpace ? '专属空间 · 仅本人可见' : (scopeLabel || '当前范围')"
      >
        {{ personalSpace ? '专属空间 · 仅本人可见' : (scopeLabel || '当前范围') }}
      </span>
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
      <span>加入队列后立即开始 AI 识别，确认后上传并入库</span>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="file-input"
        @change="onInputChange"
      />
    </div>

    <div class="queue-head">
      <label v-if="selectableItems.length" class="select-all">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="someSelected"
          @change="toggleAll(($event.target as HTMLInputElement).checked)"
        />
        全选
      </label>
      <span>待上传队列</span>
      <em>{{ pendingCount }}</em>
      <small v-if="analyzingCount">{{ analyzingCount }} 个正在识别</small>
    </div>

    <div v-if="selectedCount" class="batch-bar">
      <span class="batch-count">已选 {{ selectedCount }} 个</span>
      <el-select
        v-model="bulkFolderId"
        size="small"
        class="batch-select"
        placeholder="批量指定目录"
        :disabled="uploading"
        @change="applyBulkFolder"
      >
        <el-option label="待分类（不指定目录）" value="" />
        <el-option
          v-for="folder in folderOptions"
          :key="folder.id"
          :label="folder.full_path"
          :value="folder.id"
        />
      </el-select>
      <button type="button" class="batch-withdraw" @click="withdrawSelected">撤回所选</button>
    </div>

    <div class="queue-list" :class="{ empty: !items.length }">
      <div v-if="!items.length" class="queue-empty">
        队列为空，拖入或选择文件后会在这里暂存，点击「确认上传」才开始处理。
      </div>
      <div
        v-for="item in items"
        :key="item.key"
        class="queue-row"
        :class="[
          item.status,
          {
            failed: !!item.errorMessage && item.status === 'error',
            picked: selectedKeys.has(item.key),
            active: activeKey === item.key,
          },
        ]"
        title="点击在右侧查看并编辑该文件的资料"
        @click="emit('focus', item.key)"
      >
        <label class="queue-check" @click.stop>
          <input
            type="checkbox"
            :checked="selectedKeys.has(item.key)"
            :disabled="item.status === 'uploading' || item.status === 'done'"
            @change="toggleSelect(item.key, ($event.target as HTMLInputElement).checked)"
          />
        </label>
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
            <span class="queue-target" :title="folderLabel(item.targetFolderId)">
              <el-icon><FolderOpened /></el-icon>
              {{ folderLabel(item.targetFolderId) }}
            </span>
          </div>
          <div v-if="item.analysisError" class="queue-analysis-error">
            <span :title="item.analysisError">{{ item.analysisError }}</span>
            <button
              type="button"
              :disabled="item.status === 'analyzing'"
              @click.stop="emit('retry-analysis', item.key)"
            >
              <el-icon><RefreshRight /></el-icon>
              重新识别
            </button>
          </div>
          <div class="queue-location">
            <el-select
              :model-value="item.targetFolderId ?? ''"
              size="small"
              class="row-folder-select"
              :disabled="uploading || item.status === 'uploading' || item.status === 'done'"
              placeholder="待分类"
              @update:model-value="onItemFolderChange(item.key, $event)"
            >
              <el-option label="待分类（不指定目录）" value="" />
              <el-option
                v-for="folder in folderOptions"
                :key="folder.id"
                :label="folder.full_path"
                :value="folder.id"
              />
            </el-select>
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
            title="撤回文件"
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
        新文件默认存放
      </span>
      <el-select
        :model-value="targetFolderId ?? ''"
        size="small"
        class="location-select"
        :disabled="uploading"
        placeholder="待分类（全部文件根目录）"
        @update:model-value="onFolderChange"
      >
        <el-option label="待分类（全部文件根目录）" value="" />
        <el-option
          v-for="folder in folderOptions"
          :key="folder.id"
          :label="folder.full_path"
          :value="folder.id"
        />
      </el-select>
      <span class="location-tip" :title="targetLabel">
        {{ personalSpace ? '仅本人可见，可归档到专属目录' : '上传后仍可移动' }}
      </span>
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 18px;
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
  max-width: 45%;
  overflow: hidden;
  padding: 2px 7px;
  border: 1px solid #dbe6f7;
  border-radius: 4px;
  background: #f8fbff;
  color: #3f6fb5;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-badge.private {
  border-color: #d8c7f5;
  background: #f7f3ff;
  color: #6b3fa0;
}

.upload-drop {
  flex: 1 1 auto;
  margin-top: 14px;
  min-height: 150px;
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

.select-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 2px;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.select-all input,
.queue-check input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #2563eb;
  cursor: pointer;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
  padding: 6px 8px;
  border: 1px solid #dbe7f8;
  border-radius: 5px;
  background: #f5f9ff;
}

.batch-count {
  flex-shrink: 0;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.batch-select {
  min-width: 0;
  flex: 1;
}

.batch-select :deep(.el-select__wrapper) {
  min-height: 26px;
  border-radius: 4px;
  font-size: 11.5px;
}

.batch-withdraw {
  flex-shrink: 0;
  margin-left: auto;
  height: 26px;
  padding: 0 9px;
  border: 1px solid #f0cfcf;
  border-radius: 4px;
  background: #fff;
  color: #b91c1c;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.batch-withdraw:hover {
  border-color: #e7a8a8;
  background: #fef5f5;
}

.queue-list {
  flex: 1 1 120px;
  min-height: 90px;
  max-height: 360px;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  overflow-y: auto;
  background: #fcfdff;
}

.queue-list.empty {
  min-height: 90px;
}

.queue-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px 18px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.65;
  text-align: center;
}

.queue-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid #f1f5fa;
  cursor: pointer;
  transition: background-color 0.14s ease;
}

.queue-row.picked {
  background: #f7faff;
}

.queue-row:hover {
  background: #f4f8ff;
}

/* 当前右侧资料确认面板对应的文件 */
.queue-row.active {
  background: #eef4ff;
  box-shadow: inset 2px 0 0 #2563eb;
}

.queue-row:last-child {
  border-bottom: none;
}

.queue-check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 18px;
  margin-top: 1px;
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

.queue-target {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 42%;
  overflow: hidden;
  color: #7c8da3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-analysis-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: #b45309;
  font-size: 10.5px;
}

.queue-analysis-error span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-analysis-error button {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font: inherit;
  cursor: pointer;
}

.queue-analysis-error button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.queue-location {
  margin-top: 5px;
}

.row-folder-select {
  width: min(220px, 100%);
}

.row-folder-select :deep(.el-select__wrapper) {
  min-height: 23px;
  padding: 0 7px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px #edf2f8 inset;
  font-size: 10.5px;
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
