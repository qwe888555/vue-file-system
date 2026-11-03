<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Delete, EditPen, Folder, FolderOpened, Plus } from '@element-plus/icons-vue'
import type { FolderId, KnowledgeFolder } from '@/types'

const props = defineProps<{
  folder: KnowledgeFolder
  children: KnowledgeFolder[]
  counts: Record<string, number>
  selectedId: FolderId | string | null
  canManage: boolean
  depth?: number
}>()

const emit = defineEmits<{
  (e: 'select', folder: KnowledgeFolder): void
  (e: 'add-child', folder: KnowledgeFolder): void
  (e: 'rename', folder: KnowledgeFolder): void
  (e: 'delete', folder: KnowledgeFolder): void
  (e: 'drop-docs', payload: { folderId: FolderId; docIds: number[] }): void
}>()

const depth = computed(() => props.depth ?? 0)
const expanded = ref(true)
const dragActive = ref(false)
const count = computed(() => props.counts[String(props.folder.id)] || 0)
const selected = computed(() => String(props.selectedId) === String(props.folder.id))

function toggle(event: MouseEvent) {
  event.stopPropagation()
  expanded.value = !expanded.value
}

function onSelect() {
  emit('select', props.folder)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragActive.value = true
}

function onDragLeave(event: DragEvent) {
  event.stopPropagation()
  dragActive.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragActive.value = false
  const raw = event.dataTransfer?.getData('application/x-kb-docs') || event.dataTransfer?.getData('text/plain')
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    const ids = Array.isArray(parsed) ? parsed : parsed?.ids
    if (Array.isArray(ids) && ids.length) {
      emit('drop-docs', {
        folderId: props.folder.id,
        docIds: ids.map((item) => Number(item)).filter((item) => Number.isFinite(item)),
      })
    }
  } catch {
    // 非文件拖拽忽略
  }
}
</script>

<template>
  <div class="folder-node">
    <div
      class="folder-row"
      :class="{ selected, 'drag-active': dragActive }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      @click="onSelect"
      @dragover="canManage && onDragOver($event)"
      @dragleave="canManage && onDragLeave($event)"
      @drop="canManage && onDrop($event)"
    >
      <button
        v-if="children.length"
        type="button"
        class="caret-btn"
        :class="{ open: expanded }"
        :title="expanded ? '收起' : '展开'"
        @click="toggle"
      >
        <el-icon><ArrowRight /></el-icon>
      </button>
      <span v-else class="caret-space"></span>
      <el-icon class="folder-icon">
        <FolderOpened v-if="selected || (children.length && expanded)" />
        <Folder v-else />
      </el-icon>
      <span class="folder-name" :title="folder.name">{{ folder.name }}</span>
      <span class="folder-count" :class="{ zero: !count }">{{ count }}</span>
      <span v-if="canManage" class="row-actions" @click.stop>
        <button type="button" title="新建子文件夹" @click="emit('add-child', folder)">
          <el-icon><Plus /></el-icon>
        </button>
        <button type="button" title="重命名" @click="emit('rename', folder)">
          <el-icon><EditPen /></el-icon>
        </button>
        <button
          type="button"
          class="danger"
          title="删除文件夹"
          @click="emit('delete', folder)"
        >
          <el-icon><Delete /></el-icon>
        </button>
      </span>
    </div>
    <div v-if="children.length" v-show="expanded" class="folder-children">
      <FolderTreeItem
        v-for="child in children"
        :key="child.id"
        :folder="child"
        :children="child.children || []"
        :counts="counts"
        :selected-id="selectedId"
        :can-manage="canManage"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @add-child="emit('add-child', $event)"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
        @drop-docs="emit('drop-docs', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.folder-node {
  min-width: 0;
}

.folder-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 29px;
  padding-right: 7px;
  border-radius: 5px;
  color: #475569;
  font-size: 12.5px;
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}

.folder-row:hover {
  background: #f5f8fd;
  color: #1e293b;
}

.folder-row.selected {
  background: #eef4ff;
  color: #1d4ed8;
  font-weight: 600;
}

.folder-row.drag-active {
  background: #e8f1ff;
  box-shadow: inset 0 0 0 1px #93b4e8;
}

.caret-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: transform 0.16s ease;
}

.caret-btn.open {
  transform: rotate(90deg);
}

.caret-btn:hover {
  background: #e8eef7;
  color: #475569;
}

.caret-space {
  width: 15px;
  flex-shrink: 0;
}

.folder-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: #6b93c9;
}

.folder-row.selected .folder-icon {
  color: #2563eb;
}

.folder-row.custom .folder-icon {
  color: #7b8fae;
}

.folder-row.selected.custom .folder-icon {
  color: #2563eb;
}

.folder-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  flex-shrink: 0;
  min-width: 17px;
  padding: 0 4px;
  border-radius: 8px;
  background: #f1f5fa;
  color: #64748b;
  font-size: 10px;
  font-weight: 500;
  line-height: 16px;
  text-align: center;
}

.folder-count.zero {
  color: #a8b4c6;
  background: transparent;
}

.row-actions {
  display: none;
  align-items: center;
  gap: 1px;
  margin-left: 1px;
}

.folder-row:hover .row-actions {
  display: inline-flex;
}

.row-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #8a99ad;
  cursor: pointer;
}

.row-actions button:hover {
  background: #e8eef7;
  color: #2563eb;
}

.row-actions button.danger:hover {
  background: #fef2f2;
  color: #dc2626;
}
</style>
