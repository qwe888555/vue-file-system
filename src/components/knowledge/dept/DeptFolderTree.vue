<script setup lang="ts">
import { computed, ref } from 'vue'
import { Clock, Files, FolderAdd, OfficeBuilding, Plus, Refresh } from '@element-plus/icons-vue'
import type { FolderId, KnowledgeFolder } from '@/types'
import FolderTreeItem from '@/components/knowledge/dept/FolderTreeItem.vue'

const props = defineProps<{
  folders: KnowledgeFolder[]
  counts: Record<string, number>
  selectedId: FolderId | 'root' | 'unfiled' | null
  unfiledCount: number
  totalCount: number
  scopeLabel: string
  scopeKind: 'school' | 'college' | 'department'
  canManage: boolean
  loading: boolean
  loadError: string
  localMode: boolean
}>()

const emit = defineEmits<{
  (e: 'select-root'): void
  (e: 'select-unfiled'): void
  (e: 'select', folder: KnowledgeFolder): void
  (e: 'create', parent: KnowledgeFolder | null): void
  (e: 'rename', folder: KnowledgeFolder): void
  (e: 'delete', folder: KnowledgeFolder): void
  (e: 'refresh'): void
  (e: 'drop-docs', payload: { folderId: FolderId | null; docIds: number[] }): void
}>()

const expanded = ref(true)
const unfiledActive = ref(false)

const scopeHint = computed(() => {
  if (props.scopeKind === 'school') return '校级目录，对全校部门可见'
  if (props.scopeKind === 'college') return '学院级目录，仅本学院可见'
  return '部门级目录，仅本部门可见'
})

function buildTree(predicate: (folder: KnowledgeFolder) => boolean): KnowledgeFolder[] {
  const childrenMap = new Map<string, KnowledgeFolder[]>()
  props.folders.forEach((folder) => {
    const key = folder.parent_id == null ? '__root__' : String(folder.parent_id)
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(folder)
  })
  const attach = (folder: KnowledgeFolder): KnowledgeFolder => ({
    ...folder,
    children: (childrenMap.get(String(folder.id)) || []).map(attach),
  })
  return props.folders
    .filter((folder) => folder.parent_id == null && predicate(folder))
    .map(attach)
}

const systemRoots = computed(() => buildTree((folder) => Boolean(folder.is_system)))
const customRoots = computed(() => buildTree((folder) => !folder.is_system))

function toggleRoot() {
  expanded.value = !expanded.value
}

function onUnfiledDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  unfiledActive.value = true
}

function onUnfiledDrop(event: DragEvent) {
  event.preventDefault()
  unfiledActive.value = false
  const raw = event.dataTransfer?.getData('application/x-kb-docs') || event.dataTransfer?.getData('text/plain')
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    const ids = Array.isArray(parsed) ? parsed : parsed?.ids
    if (Array.isArray(ids) && ids.length) {
      emit('drop-docs', {
        folderId: null,
        docIds: ids.map((item) => Number(item)).filter((item) => Number.isFinite(item)),
      })
    }
  } catch {
    // 忽略非文件拖拽
  }
}
</script>

<template>
  <section class="panel folder-panel">
    <div class="panel-head">
      <div>
        <h2>部门目录</h2>
        <p>上传后的资料按目录归档，支持拖拽移动。</p>
      </div>
      <div class="head-tools">
        <button
          v-if="canManage"
          type="button"
          class="icon-btn"
          title="新建文件夹"
          @click="emit('create', null)"
        >
          <el-icon><FolderAdd /></el-icon>
        </button>
        <button type="button" class="icon-btn" title="刷新目录" :disabled="loading" @click="emit('refresh')">
          <el-icon :class="{ spinning: loading }"><Refresh /></el-icon>
        </button>
      </div>
    </div>

    <div class="scope-row">
      <el-icon><OfficeBuilding /></el-icon>
      <span class="scope-name">{{ scopeLabel || '当前部门' }}</span>
      <span class="scope-hint">{{ scopeHint }}</span>
    </div>

    <div v-if="localMode" class="mode-note">
      当前环境未启用服务端目录接口，自定义文件夹暂存于本浏览器，不影响上传与 AI 识别。
    </div>
    <div v-else-if="loadError" class="mode-note error">
      {{ loadError }}
      <button type="button" @click="emit('refresh')">重试</button>
    </div>

    <div class="tree-wrap">
      <div
        class="root-row"
        :class="{ selected: selectedId === 'root' }"
        @click="emit('select-root')"
      >
        <button type="button" class="caret-btn" :class="{ open: expanded }" @click.stop="toggleRoot">
          <span class="caret-shape"></span>
        </button>
        <el-icon class="root-icon"><Files /></el-icon>
        <span class="root-name">全部文件</span>
        <span class="root-count">{{ totalCount }}</span>
      </div>

      <div v-show="expanded" class="tree-body">
        <div
          class="special-row"
          :class="{ selected: selectedId === 'unfiled', 'drag-active': unfiledActive }"
          @click="emit('select-unfiled')"
          @dragover="onUnfiledDragOver"
          @dragleave="unfiledActive = false"
          @drop="onUnfiledDrop"
        >
          <el-icon><Clock /></el-icon>
          <span class="special-name">待分类文件</span>
          <span class="special-count" :class="{ zero: !unfiledCount }">{{ unfiledCount }}</span>
        </div>

        <div class="group-label">
          <span>系统自动分类</span>
          <em>AI</em>
        </div>
        <div v-if="loading && !folders.length" class="tree-loading">目录加载中…</div>
        <template v-else-if="systemRoots.length">
          <FolderTreeItem
            v-for="folder in systemRoots"
            :key="folder.id"
            :folder="folder"
            :children="folder.children || []"
            :counts="counts"
            :selected-id="selectedId"
            :can-manage="canManage"
            :depth="0"
            @select="emit('select', $event)"
            @add-child="emit('create', $event)"
            @rename="emit('rename', $event)"
            @delete="emit('delete', $event)"
            @drop-docs="emit('drop-docs', $event)"
          />
        </template>
        <div v-else class="tree-empty">暂无系统分类目录</div>

        <div class="group-label custom-label">
          <span>自定义文件夹</span>
          <button
            v-if="canManage"
            type="button"
            class="group-add"
            title="新建自定义文件夹"
            @click="emit('create', null)"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <FolderTreeItem
          v-for="folder in customRoots"
          :key="folder.id"
          :folder="folder"
          :children="folder.children || []"
          :counts="counts"
          :selected-id="selectedId"
          :can-manage="canManage"
          :depth="0"
          @select="emit('select', $event)"
          @add-child="emit('create', $event)"
          @rename="emit('rename', $event)"
          @delete="emit('delete', $event)"
          @drop-docs="emit('drop-docs', $event)"
        />
        <button
          v-if="canManage && !customRoots.length"
          type="button"
          class="new-folder-row"
          @click="emit('create', null)"
        >
          <el-icon><Plus /></el-icon>
          新建文件夹
        </button>
      </div>
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

.folder-panel {
  padding: 16px 12px 12px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px;
}

.panel-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: #0f172a;
}

.panel-head p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.head-tools {
  display: flex;
  gap: 3px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #e2eaf4;
  border-radius: 5px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  border-color: #bcd2f5;
  color: #2563eb;
}

.icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.icon-btn .spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.scope-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 12px 2px 0;
  padding: 8px 9px;
  border: 1px solid #eef3fa;
  border-radius: 5px;
  background: #fafcff;
  color: #64748b;
  font-size: 11px;
}

.scope-row .el-icon {
  color: #6b93c9;
  flex-shrink: 0;
}

.scope-name {
  max-width: 55%;
  overflow: hidden;
  color: #334155;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-hint {
  margin-left: auto;
  color: #94a3b8;
  white-space: nowrap;
}

.mode-note {
  margin: 8px 2px 0;
  padding: 7px 9px;
  border: 1px solid #fde9c8;
  border-radius: 5px;
  background: #fffbeb;
  color: #b45309;
  font-size: 11px;
  line-height: 1.55;
}

.mode-note.error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.mode-note button {
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.tree-wrap {
  margin-top: 10px;
}

.root-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px;
  border-radius: 5px;
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.root-row:hover {
  background: #f5f8fd;
}

.root-row.selected {
  background: #eef4ff;
  color: #1d4ed8;
}

.caret-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.caret-shape {
  display: block;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid #94a3b8;
  transition: transform 0.16s ease;
  transform-origin: 35% 50%;
}

.caret-btn.open .caret-shape {
  transform: rotate(90deg);
}

.root-icon {
  font-size: 15px;
  color: #5479a9;
}

.root-row.selected .root-icon {
  color: #2563eb;
}

.root-name {
  flex: 1;
}

.root-count {
  min-width: 20px;
  padding: 0 5px;
  border-radius: 9px;
  background: #f1f5fa;
  color: #64748b;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 17px;
  text-align: center;
}

.tree-body {
  padding-left: 4px;
}

.special-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 29px;
  margin-top: 2px;
  padding: 0 7px 0 22px;
  border-radius: 5px;
  color: #64748b;
  font-size: 12.5px;
  cursor: pointer;
}

.special-row:hover {
  background: #f5f8fd;
}

.special-row.selected {
  background: #eef4ff;
  color: #1d4ed8;
  font-weight: 600;
}

.special-row.drag-active {
  background: #e8f1ff;
  box-shadow: inset 0 0 0 1px #93b4e8;
}

.special-row .el-icon {
  font-size: 13px;
  color: #b08c4f;
}

.special-name {
  flex: 1;
}

.special-count {
  min-width: 17px;
  padding: 0 4px;
  border-radius: 8px;
  background: #f1f5fa;
  color: #64748b;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.special-count.zero {
  background: transparent;
  color: #a8b4c6;
}

.group-label {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 11px 0 3px;
  padding-left: 24px;
  color: #94a3b8;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.group-label em {
  padding: 0 3px;
  border-radius: 2px;
  background: #eef4ff;
  color: #3b82f6;
  font-style: normal;
  font-size: 8.5px;
  font-weight: 700;
  line-height: 13px;
}

.custom-label {
  margin-top: 14px;
}

.group-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: auto;
  margin-right: 6px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.group-add:hover {
  background: #eef4ff;
  color: #2563eb;
}

.tree-loading,
.tree-empty {
  padding: 10px 24px;
  color: #a3b0c2;
  font-size: 11.5px;
}

.new-folder-row {
  display: flex;
  align-items: center;
  gap: 5px;
  width: calc(100% - 12px);
  height: 28px;
  margin: 3px 6px 2px;
  padding: 0 8px;
  border: 1px dashed #d9e3f0;
  border-radius: 5px;
  background: transparent;
  color: #7a8ba3;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.new-folder-row:hover {
  border-color: #93b4e8;
  background: #f8fbff;
  color: #2563eb;
}
</style>
