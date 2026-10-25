<script setup lang="ts">
// 文档关联选择器：维护「源文档 → 目标文档」的有向边列表（不负责落库，由父组件提交）
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { DocPickerOption, DocRelationInput, DocRelationType } from '@/types'
import { RELATION_TYPE_OPTIONS, relationTypeLabel } from '@/config/relation'

const props = withDefaults(
  defineProps<{
    modelValue: DocRelationInput[]
    /** 可选的目标文档候选 */
    docs: DocPickerOption[]
    /** 源文档 id（排除自身） */
    excludeDocId?: number
    /** 源文档标题（展示「本文档 → 目标文档」时使用） */
    sourceTitle?: string
    disabled?: boolean
  }>(),
  {
    excludeDocId: undefined,
    sourceTitle: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: DocRelationInput[]): void
  (e: 'open', targetDocId: number): void
}>()

const newTargetId = ref<number>()
const newType = ref<DocRelationType>('supplement')

const selectedTargetIds = computed(() => new Set(props.modelValue.map((rel) => rel.target_doc_id)))

const availableDocs = computed(() =>
  props.docs.filter((doc) => doc.id !== props.excludeDocId && !selectedTargetIds.value.has(doc.id)),
)

function titleOf(targetDocId: number): string {
  return props.docs.find((doc) => doc.id === targetDocId)?.title || `文档 #${targetDocId}`
}

function tagLabel(rel: DocRelationInput): string {
  const prefix = props.sourceTitle ? `${props.sourceTitle} → ` : ''
  return `${prefix}${titleOf(rel.target_doc_id)} · ${relationTypeLabel(rel.relation_type)}`
}

function addRelation() {
  if (props.disabled) return
  if (!newTargetId.value) {
    ElMessage.warning('请先选择要关联的目标文档')
    return
  }
  if (selectedTargetIds.value.has(newTargetId.value)) {
    ElMessage.warning('该文档已关联，请勿重复添加')
    return
  }
  emit('update:modelValue', [
    ...props.modelValue,
    { target_doc_id: newTargetId.value, relation_type: newType.value },
  ])
  newTargetId.value = undefined
  newType.value = 'supplement'
}

function removeRelation(index: number) {
  if (props.disabled) return
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
}
</script>

<template>
  <div class="relation-picker">
    <div v-if="modelValue.length > 0" class="relation-tags">
      <el-tag
        v-for="(rel, index) in modelValue"
        :key="`${rel.target_doc_id}-${rel.relation_type}`"
        type="info"
        effect="plain"
        :closable="!disabled"
        @click="emit('open', rel.target_doc_id)"
        @close="removeRelation(index)"
      >
        {{ tagLabel(rel) }}
      </el-tag>
    </div>
    <p v-else class="relation-empty">暂未关联其他文档</p>

    <div v-if="!disabled" class="relation-add-row">
      <el-select
        v-model="newTargetId"
        filterable
        clearable
        placeholder="选择目标文档"
        class="target-select"
      >
        <el-option
          v-for="doc in availableDocs"
          :key="doc.id"
          :label="doc.title || `文档 #${doc.id}`"
          :value="doc.id"
        />
      </el-select>
      <el-select v-model="newType" class="type-select">
        <el-option
          v-for="opt in RELATION_TYPE_OPTIONS"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-button type="primary" plain @click="addRelation">添加关联</el-button>
    </div>
    <p class="relation-tip">关联方向：本文档 → 目标文档；关联目标须在当前账号可浏览范围内。</p>
  </div>
</template>

<style scoped>
.relation-picker {
  width: 100%;
}

.relation-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.relation-empty {
  margin: 0 0 8px;
  font-size: 13px;
  color: #909399;
}

.relation-add-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 8px;
}

.target-select {
  flex: 1;
  min-width: 180px;
}

.type-select {
  width: 130px;
}

.relation-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
}
</style>
