<script setup lang="ts">
// 标签选择器：从全平台共享词表联想，也允许直接输入新标签（后端自动建词条）
import { computed, onMounted, ref } from 'vue'
import { getTagListApi } from '@/api/knowledge'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    disabled?: boolean
    placeholder?: string
    /** 最多可选标签数（后端限制单次批量打标 1~20 个） */
    max?: number
  }>(),
  {
    disabled: false,
    placeholder: '选择或输入新标签，回车确认',
    max: 20,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

// 词表全局只拉一次，避免上传表单里多个选择器重复请求
let tagOptionsPromise: Promise<string[]> | null = null
function loadTagOptions(): Promise<string[]> {
  if (!tagOptionsPromise) {
    tagOptionsPromise = getTagListApi()
      .then((list) => list.map((tag) => tag.name).filter(Boolean))
      .catch(() => {
        tagOptionsPromise = null
        return []
      })
  }
  return tagOptionsPromise
}

const tagOptions = ref<string[]>([])

onMounted(async () => {
  tagOptions.value = await loadTagOptions()
})

/** 已选但不在词表中的标签也要能回显 */
const allOptions = computed(() => [...new Set([...tagOptions.value, ...props.modelValue])])

function handleChange(values: string[]) {
  const cleaned: string[] = []
  for (const raw of values) {
    const name = raw.trim().slice(0, 64)
    if (name && !cleaned.includes(name)) cleaned.push(name)
  }
  emit('update:modelValue', cleaned)
}
</script>

<template>
  <div class="tag-selector">
    <el-select
      :model-value="modelValue"
      multiple
      filterable
      allow-create
      default-first-option
      clearable
      :reserve-keyword="false"
      :disabled="disabled"
      :multiple-limit="max"
      :placeholder="placeholder"
      class="tag-select"
      @update:model-value="handleChange"
    >
      <el-option v-for="name in allOptions" :key="name" :label="name" :value="name" />
    </el-select>
    <p class="tag-tip">
      标签用于浏览/筛选用途，与 AI 检索权重无关；新标签会自动加入全平台共享词表。
    </p>
  </div>
</template>

<style scoped>
.tag-selector {
  width: 100%;
}

.tag-select {
  width: 100%;
}

.tag-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
}
</style>
