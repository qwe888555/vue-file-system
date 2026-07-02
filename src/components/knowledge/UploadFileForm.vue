<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: UploadFormData): void
}>()

interface UploadFormData {
  title: string
  category: string
  author: string
  keywords: string
  description: string
}

const categories = [
  { label: '信息工程学院', value: '信息工程学院' },
  { label: '计算机学院', value: '计算机学院' },
  { label: '数字艺术学院', value: '数字艺术学院' },
  { label: '商学院', value: '商学院' },
  { label: '外国语学院', value: '外国语学院' },
  { label: '继续教育学院', value: '继续教育学院' },
  { label: '软件工程系', value: '软件工程系' },
  { label: '网络工程系', value: '网络工程系' },
  { label: '数字媒体系', value: '数字媒体系' },
  { label: '经济管理系', value: '经济管理系' },
  { label: '英语系', value: '英语系' },
]

const form = ref<UploadFormData>({
  title: '',
  category: '',
  author: '',
  keywords: '',
  description: '',
})

watch(() => props.visible, (val) => {
  if (val) {
    resetForm()
  }
})

function resetForm() {
  form.value = {
    title: '',
    category: '',
    author: '',
    keywords: '',
    description: '',
  }
}

function handleSubmit() {
  if (!form.value.title || !form.value.category || !form.value.author || !form.value.keywords) {
    ElMessage.warning('请填写必填项')
    return
  }

  const keywords = form.value.keywords
    .split(/[,，、\s]+/)
    .map((kw) => kw.trim())
    .filter((kw) => kw)

  emit('submit', {
    ...form.value,
    keywords: keywords.join(','),
  })
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="上传文件"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <el-form :model="form" label-width="100px" class="upload-form">
      <el-form-item label="文件名" required>
        <el-input v-model="form.title" placeholder="请输入文件名" />
      </el-form-item>

      <el-form-item label="学院/部门" required>
        <el-select v-model="form.category" placeholder="请选择学院/部门">
          <el-option v-for="cat in categories" :key="cat.value" :label="cat.label" :value="cat.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="作者" required>
        <el-input v-model="form.author" placeholder="请输入作者名称" />
      </el-form-item>

      <el-form-item label="关键词" required>
        <el-input v-model="form.keywords" placeholder="请输入关键词，用逗号或空格分隔" />
      </el-form-item>

      <el-form-item label="文件描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入文件描述..." />
      </el-form-item>

      <el-form-item label="文件上传">
        <el-upload
          :auto-upload="false"
          :on-change="() => {}"
          drag
          accept=".pdf,.doc,.docx,.txt,.jpg,.png,.gif,.mp3,.wav,.mp4,.avi,.mkv,.zip,.rar"
          class="upload-dragger"
        >
          <el-icon :size="48" color="#c0c4cc"><Upload /></el-icon>
          <div class="el-upload__text">
            将文件拖到此处，或<em>点击上传</em>
          </div>
          <div class="el-upload__tip" slot="tip">
            支持 PDF、Word、图片、音频、视频等格式
          </div>
        </el-upload>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确认上传</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.upload-form {
  margin-top: var(--spacing-md);
}

.upload-form :deep(.el-form-item) {
  margin-bottom: var(--spacing-md);
}

.upload-dragger {
  width: 100%;
}
</style>
