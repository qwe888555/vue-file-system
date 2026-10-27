<template>
  <el-dialog
    :model-value="visible"
    title="标签词表管理"
    width="640px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="tag-manager-toolbar">
      <span class="tag-manager-tip">词表全平台共享：重命名影响所有人；删除会移除该标签在所有文档上的关联。</span>
      <el-button type="primary" plain size="small" @click="openMerge">合并标签</el-button>
    </div>

    <el-table :data="tags" v-loading="loading" max-height="380" size="small" border>
      <el-table-column prop="name" label="标签名" min-width="140" show-overflow-tooltip />
      <el-table-column prop="doc_count" label="文档数" width="80" align="center" />
      <el-table-column label="创建时间" width="170" align="center">
        <template #default="scope">{{ formatTime(scope.row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="handleRename(scope.row)">重命名</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 合并标签 -->
    <el-dialog
      v-model="mergeVisible"
      title="合并重复标签"
      width="420px"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="merge-row">
        <span class="merge-label">源标签（被合并）</span>
        <el-select v-model="mergeSourceId" filterable placeholder="选择要合并掉的标签" class="merge-select">
          <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </div>
      <div class="merge-row">
        <span class="merge-label">目标标签（保留）</span>
        <el-select v-model="mergeTargetId" filterable placeholder="选择保留的标签" class="merge-select">
          <el-option v-for="t in mergeTargetOptions" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </div>
      <p class="merge-tip">源标签的所有文档关联将改指向目标标签，随后源标签被删除。</p>
      <template #footer>
        <el-button @click="mergeVisible = false">取消</el-button>
        <el-button type="primary" :loading="merging" :disabled="!mergeSourceId || !mergeTargetId" @click="handleMerge">确认合并</el-button>
      </template>
    </el-dialog>

    <template #footer>
      <el-button @click="emit('update:visible', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Tag } from '@/types'
import { getTagListApi, renameTagApi, mergeTagsApi, deleteTagApi } from '@/api/knowledge'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'changed'): void }>()

const tags = ref<Tag[]>([])
const loading = ref(false)

const mergeVisible = ref(false)
const mergeSourceId = ref<number | null>(null)
const mergeTargetId = ref<number | null>(null)
const merging = ref(false)

const mergeTargetOptions = computed(() => tags.value.filter((t) => t.id !== mergeSourceId.value))

async function loadTags() {
  loading.value = true
  try {
    tags.value = await getTagListApi()
  } catch (error) {
    console.error('获取标签词表失败:', error)
    ElMessage.error('获取标签词表失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) void loadTags()
  }
)

function formatTime(value?: string): string {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

async function handleRename(tag: Tag) {
  try {
    const { value } = await ElMessageBox.prompt(`将「${tag.name}」重命名为：`, '重命名标签', {
      inputValue: tag.name,
      inputValidator: (input: string) => (input.trim() ? true : '标签名不能为空'),
    })
    const name = value.trim()
    if (!name || name === tag.name) return
    await renameTagApi(tag.id, name)
    ElMessage.success('重命名成功')
    void loadTags()
    emit('changed')
  } catch (error: any) {
    if (error === 'cancel' || error?.message === 'cancel') return
    console.error('重命名标签失败:', error)
    ElMessage.error(error?.response?.data?.detail || error?.response?.data?.name || '重命名失败')
  }
}

async function handleDelete(tag: Tag) {
  try {
    await ElMessageBox.confirm(
      `确定删除标签「${tag.name}」？该标签在全部文档上的关联将被移除，文档本身不受影响。`,
      '删除标签',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await deleteTagApi(tag.id)
    ElMessage.success('删除成功')
    void loadTags()
    emit('changed')
  } catch (error: any) {
    console.error('删除标签失败:', error)
    ElMessage.error(error?.response?.data?.detail || '删除失败')
  }
}

function openMerge() {
  mergeSourceId.value = null
  mergeTargetId.value = null
  mergeVisible.value = true
}

async function handleMerge() {
  if (!mergeSourceId.value || !mergeTargetId.value) return
  if (mergeSourceId.value === mergeTargetId.value) {
    ElMessage.warning('源标签与目标标签不能相同')
    return
  }
  merging.value = true
  try {
    const res = await mergeTagsApi(mergeSourceId.value, mergeTargetId.value)
    ElMessage.success(`合并成功，已迁移 ${res.moved} 个文档关联`)
    mergeVisible.value = false
    void loadTags()
    emit('changed')
  } catch (error: any) {
    console.error('合并标签失败:', error)
    ElMessage.error(error?.response?.data?.detail || '合并失败')
  } finally {
    merging.value = false
  }
}
</script>

<style scoped>
.tag-manager-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.tag-manager-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.merge-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.merge-label {
  flex-shrink: 0;
  width: 120px;
  font-size: 14px;
  color: #606266;
}

.merge-select {
  flex: 1;
}

.merge-tip {
  margin: 0;
  font-size: 12px;
  color: #909399;
}
</style>
