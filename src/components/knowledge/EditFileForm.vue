<template>
  <el-dialog
    :model-value="visible"
    title="编辑文件"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <el-form :model="form" label-width="100px" class="edit-form">
      <el-form-item label="文件名" required>
        <el-input v-model="form.title" placeholder="请输入文件名" />
      </el-form-item>

      <el-form-item label="关键词">
        <div class="keywords-container">
          <div v-for="(kw, index) in form.keywords" :key="kw.id || index" class="keyword-item">
            <el-input
              :ref="(el) => keywordRefs[index] = el as HTMLInputElement"
              v-model="kw.phrase"
              class="keyword-input"
              placeholder="关键词"
            />
            <el-button
              size="small"
              type="text"
              danger
              @click="removeKeyword(index)"
              icon="Delete"
            />
          </div>
          <el-button
            size="small"
            type="primary"
            plain
            @click="addKeyword"
            icon="Plus"
          >
            添加关键词
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { KnowledgeFile, Keyword } from '@/types'
import { addKeywordApi, deleteKeywordApi, updateKeywordApi } from '@/api/knowledge'

const props = defineProps<{
  visible: boolean
  file: KnowledgeFile | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: { title: string; keywords: Keyword[] }): void
}>()

const form = ref({
  title: '',
  keywords: [] as Keyword[],
})

const originalKeywords = ref<Keyword[]>([])
const keywordRefs = ref<HTMLInputElement[]>([])

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.file) {
      form.value.title = props.file.title
      form.value.keywords = [...(props.file.keywords || [])]
      originalKeywords.value = [...(props.file.keywords || [])]
    } else if (!visible) {
      resetForm()
    }
  }
)

function resetForm() {
  form.value.title = ''
  form.value.keywords = []
  originalKeywords.value = []
  keywordRefs.value = []
}

function addKeyword() {
  form.value.keywords.push({ id: 0, phrase: '', match_type: 'exact', weight: 1 })
}

function removeKeyword(index: number) {
  form.value.keywords.splice(index, 1)
}

function handleClose() {
  emit('close')
}

async function handleSubmit() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请输入文件名')
    return
  }

  const validKeywords = form.value.keywords.filter((kw) => kw.phrase.trim())
  if (!validKeywords.length) {
    ElMessage.warning('关键词不能为空')
    return
  }

  try {
    if (props.file?.id) {
      const originalMap = new Map(originalKeywords.value.map((kw) => [kw.id, kw]))
      const currentMap = new Map(validKeywords.map((kw) => [kw.id, kw]))

      for (const [id, kw] of originalMap) {
        if (!currentMap.has(id)) {
          await deleteKeywordApi(id)
        }
      }

      const toAdd = validKeywords.filter((kw) => !kw.id)
      const toUpdate = validKeywords.filter((kw) => kw.id && originalMap.get(kw.id)?.phrase !== kw.phrase)

      if (toAdd.length > 0) {
        await addKeywordApi(props.file!.id, toAdd.map((kw) => kw.phrase))
      }

      for (const kw of toUpdate) {
        await updateKeywordApi(kw.id!, {
          phrase: kw.phrase.trim(),
          match_type: kw.match_type || 'exact',
          weight: kw.weight || 1,
        })
      }
    }
  } catch (error) {
    console.error('关键词操作失败:', error)
    ElMessage.error('关键词操作失败，请重试')
    return
  }

  emit('submit', {
    title: form.value.title.trim(),
    keywords: validKeywords,
  })
}
</script>

<style scoped>
.edit-form {
  padding: 10px 0;
}

.keywords-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.keyword-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.keyword-input {
  flex: 1;
}
</style>
