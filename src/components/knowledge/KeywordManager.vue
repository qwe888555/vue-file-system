<script setup lang="ts">
/* eslint-disable no-console */
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getKeywordsApi, addKeywordApi, deleteKeywordApi } from '@/api/knowledge'

const props = defineProps<{
  docId: number
}>()

const keywords = ref<string[]>([])
const isLoading = ref(false)
const newKeyword = ref('')

async function loadKeywords() {
  isLoading.value = true
  try {
    keywords.value = await getKeywordsApi(props.docId)
  } catch (error) {
    console.error('加载关键词失败:', error)
    keywords.value = []
  } finally {
    isLoading.value = false
  }
}

async function handleAdd() {
  const keyword = newKeyword.value.trim()
  if (!keyword) {
    ElMessage.warning('请输入关键词')
    return
  }
  if (keywords.value.includes(keyword)) {
    ElMessage.warning('该关键词已存在')
    return
  }
  try {
    await addKeywordApi(props.docId, keyword)
    keywords.value.push(keyword)
    newKeyword.value = ''
    ElMessage.success('添加成功')
  } catch (error) {
    console.error('添加关键词失败:', error)
    ElMessage.error('添加失败')
  }
}

async function handleDelete(keyword: string) {
  try {
    await deleteKeywordApi(props.docId, keyword)
    keywords.value = keywords.value.filter((kw) => kw !== keyword)
    ElMessage.success('删除成功')
  } catch (error) {
    console.error('删除关键词失败:', error)
    ElMessage.error('删除失败')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleAdd()
  }
}

watch(
  () => props.docId,
  () => {
    if (props.docId) {
      loadKeywords()
    }
  }
)

onMounted(() => {
  if (props.docId) {
    loadKeywords()
  }
})
</script>

<template>
  <div class="keyword-manager">
    <div class="keyword-input-row">
      <el-input
        v-model="newKeyword"
        placeholder="输入关键词"
        size="small"
        @keydown="handleKeydown"
      />
      <el-button size="small" type="primary" @click="handleAdd">添加</el-button>
    </div>
    <div class="keyword-list">
      <el-tag
        v-for="kw in keywords"
        :key="kw"
        size="small"
        closable
        @close="handleDelete(kw)"
        class="keyword-tag"
      >
        {{ kw }}
      </el-tag>
      <div v-if="isLoading" class="loading-text">加载中...</div>
      <div v-if="!isLoading && keywords.length === 0" class="empty-text">暂无关键词</div>
    </div>
  </div>
</template>

<style scoped>
.keyword-manager {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.keyword-input-row {
  display: flex;
  gap: 8px;
}

.keyword-input-row :deep(.el-input) {
  flex: 1;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.keyword-tag {
  cursor: pointer;
}

.loading-text,
.empty-text {
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>