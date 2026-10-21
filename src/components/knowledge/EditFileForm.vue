<template>
  <el-dialog
    :model-value="visible"
    title="编辑文件"
    width="550px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <el-form :model="form" label-width="100px" class="edit-form">
      <el-form-item label="文件名" required>
        <el-input v-model="form.title" placeholder="请输入文件名" />
      </el-form-item>

      <el-form-item label="描述" required>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          placeholder="请输入文件描述"
        />
      </el-form-item>

      <el-form-item label="关键词" required>
        <div class="keywords-container">
          <div v-for="(kw, index) in form.keywords" :key="kw.id || index" class="keyword-item">
            <el-input
              v-model="kw.phrase"
              class="keyword-input"
              placeholder="关键词"
            />
            <el-icon class="keyword-remove" title="删除该关键词" @click="removeKeyword(index)"><Close /></el-icon>
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
/* eslint-disable no-console */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import type { KnowledgeFile, Keyword } from '@/types'
import { addKeywordApi, deleteKeywordApi, getKeywordsApi, isValidKeywordId, updateKeywordApi, updateDocApi } from '@/api/knowledge'

const props = defineProps<{
  visible: boolean
  file: KnowledgeFile | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: { title: string; description: string; keywords: Keyword[] }): void
}>()

const form = ref({
  title: '',
  description: '',
  keywords: [] as Keyword[],
})

const originalKeywords = ref<Keyword[]>([])

/** 深拷贝关键词，避免编辑表单与原始快照共享同一批对象导致改名无法被识别 */
function cloneKeywords(list: Keyword[] = []): Keyword[] {
  return list.map((kw) => ({ ...kw }))
}

/** 归一化服务端关键词字段（兼容 phrase / keyword / name 命名） */
function normalizeKeywords(
  list: Array<Partial<Keyword> & { keyword?: string; name?: string }> = [],
): Keyword[] {
  return list
    .map((kw) => ({
      id: Number(kw.id) || 0,
      phrase: kw.phrase || kw.keyword || kw.name || '',
      match_type: kw.match_type || 'exact',
      weight: kw.weight || 1,
    }))
    .filter((kw) => kw.phrase)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.file) {
      form.value.title = props.file.title
      // 优先使用 summary，其次 description（后端可能返回不同字段名）
      form.value.description = props.file.summary || (props.file as any).description || ''
      const initialKeywords = normalizeKeywords(props.file.keywords || [])
      form.value.keywords = cloneKeywords(initialKeywords)
      originalKeywords.value = cloneKeywords(initialKeywords)
    } else if (!visible) {
      resetForm()
    }
  }
)

function resetForm() {
  form.value.title = ''
  form.value.description = ''
  form.value.keywords = []
  originalKeywords.value = []
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

  if (!form.value.description.trim()) {
    ElMessage.warning('请输入文件描述')
    return
  }

  if (form.value.keywords.some((kw) => !kw.phrase.trim())) {
    ElMessage.warning('关键词不能为空，请填写或删除空白关键词')
    return
  }

  const validKeywords = form.value.keywords.map((kw) => ({
    ...kw,
    phrase: kw.phrase.trim(),
  }))

  if (validKeywords.length === 0) {
    ElMessage.warning('请至少填写一个关键词')
    return
  }

  try {
    if (props.file?.id) {
      // 描述清空后传空字符串保存（依赖后端序列化器 allow_blank 修复，见 2026-09-28 沟通）
      await updateDocApi(props.file.id, {
        title: form.value.title.trim(),
        description: form.value.description.trim(),
      })

      const originalById = new Map(
        originalKeywords.value
          .filter((kw) => isValidKeywordId(kw.id))
          .map((kw) => [Number(kw.id), kw] as const),
      )
      const currentValid = validKeywords.filter((kw) => isValidKeywordId(kw.id))
      const currentIds = new Set(currentValid.map((kw) => Number(kw.id)))

      // 删除：只处理服务端真实 id，避免请求 /keywords/0/delete/
      for (const id of originalById.keys()) {
        if (!currentIds.has(id)) {
          await deleteKeywordApi(id)
        }
      }

      // 新增：id 无效（0 或缺失）的行；去重只针对已保留的有效关键词
      const retainedPhrases = new Set(currentValid.map((kw) => kw.phrase))
      for (const kw of validKeywords) {
        if (isValidKeywordId(kw.id)) continue
        if (retainedPhrases.has(kw.phrase)) continue
        retainedPhrases.add(kw.phrase)
        await addKeywordApi(props.file.id, kw.phrase)
      }

      // 更新：真实 id 且短语有变化（原始快照已深拷贝，改名可被识别）
      for (const kw of currentValid) {
        const originalPhrase = originalById.get(Number(kw.id))?.phrase.trim()
        if (originalPhrase !== kw.phrase) {
          await updateKeywordApi(Number(kw.id), {
            phrase: kw.phrase,
            match_type: kw.match_type || 'exact',
            weight: kw.weight || 1,
          })
        }
      }
    }
  } catch (error) {
    console.error('编辑文件失败:', error)
    ElMessage.error('编辑文件失败，请重试')
    return
  }

  // 保存后重新拉取服务端关键词，让新增项拿到真实 id，避免下次编辑重复添加
  let latestKeywords = validKeywords
  if (props.file?.id) {
    try {
      latestKeywords = normalizeKeywords(await getKeywordsApi(props.file.id))
    } catch (error) {
      console.warn('[EditFileForm] 保存后刷新关键词失败，使用本地结果:', error)
    }
  }

  emit('submit', {
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    keywords: latestKeywords,
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

.keyword-remove {
  color: #f56c6c;
  cursor: pointer;
  flex-shrink: 0;
}

.keyword-remove:hover {
  color: #f78989;
}
</style>
