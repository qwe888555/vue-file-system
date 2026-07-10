<script setup lang="ts">
/* eslint-disable no-console */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadTextApi, uploadFileApi } from '@/api/knowledge'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: UploadFormData): void
}>()

interface UploadFormData {
  title: string
  keywords: string
  description: string
  content: string
  scope: 'public' | 'private'
}

const createMode = ref(true)
const uploadedFile = ref<File | null>(null)

const form = ref<UploadFormData>({
  title: '',
  keywords: '',
  description: '',
  content: '',
  scope: 'public',
})

watch(() => props.visible, (val) => {
  if (val) {
    resetForm()
  }
})

function resetForm() {
  createMode.value = true
  uploadedFile.value = null
  form.value = {
    title: '',
    keywords: '',
    description: '',
    content: '',
    scope: 'public',
  }
}

function handleFileChange(file: File) {
  uploadedFile.value = file
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  if (!form.value.title) {
    form.value.title = baseName
  }
}

function handleRemove() {
  uploadedFile.value = null
  form.value.title = ''
}

async function handleSubmit() {
  if (!form.value.title) {
    ElMessage.warning('请输入文件名')
    return
  }
  if (!form.value.keywords) {
    ElMessage.warning('请输入关键词')
    return
  }
  if (!form.value.scope) {
    ElMessage.warning('请选择可见范围')
    return
  }

  const keywords = form.value.keywords
    .split(/[,，、\s]+/)
    .map((kw) => kw.trim())
    .filter((kw) => kw)

  if (keywords.length === 0) {
    ElMessage.warning('请输入关键词')
    return
  }

  if (createMode.value) {
    if (!form.value.content.trim()) {
      ElMessage.warning('请输入文件内容')
      return
    }

    try {
      const result = await uploadTextApi({
        title: form.value.title,
        content: form.value.content,
        description: form.value.description || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        scope: form.value.scope === 'public' ? 'school' : 'college',
      })
      console.log('创建文件结果:', result)
      ElMessage.success('创建成功')
      emit('submit', {
        ...form.value,
        keywords: keywords.join(','),
      })
    } catch (error) {
      console.error('创建文件失败:', error)
      ElMessage.error('创建文件失败，请重试')
      return
    }
  } else {
    if (!uploadedFile.value) {
      ElMessage.warning('请选择要上传的文件')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile.value)
      formData.append('title', form.value.title)
      if (form.value.description) {
        formData.append('description', form.value.description)
      }
      formData.append('scope', form.value.scope === 'public' ? 'school' : 'college')
      if (keywords.length > 0) {
        formData.append('keywords', JSON.stringify(keywords))
      }

      const result = await uploadFileApi(formData)
      console.log('文件上传结果:', result)
      ElMessage.success('上传成功')
      emit('submit', {
        ...form.value,
        keywords: keywords.join(','),
      })
    } catch (error) {
      console.error('文件上传失败:', error)
      ElMessage.error('文件上传失败，请重试')
      return
    }
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="createMode ? '创建文件' : '上传文件'"
    width="600px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <div class="mode-switch-wrapper">
      <el-radio-group v-model="createMode">
        <el-radio :value="true">创建文件</el-radio>
        <el-radio :value="false">上传文件</el-radio>
      </el-radio-group>
    </div>

    <div class="form-container">
      <div v-if="!createMode" class="upload-area">
        <div class="upload-header">
          <el-input
            v-model="form.title"
            placeholder="请输入文件名"
            class="title-input"
          />
        </div>

        <div class="upload-center">
          <el-upload
            :auto-upload="false"
            :file-list="uploadedFile ? [{ name: uploadedFile.name, size: uploadedFile.size }] : []"
            :on-change="(file) => { if (file.raw) handleFileChange(file.raw) }"
            :on-remove="handleRemove"
            drag
            accept=".pdf,.doc,.docx,.txt,.jpg,.png,.gif,.mp3,.wav,.mp4,.avi,.mkv,.zip,.rar"
            class="upload-dragger"
          >
            <el-icon :size="48" color="#c0c4cc"><Upload /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
          </el-upload>
        </div>

        <div class="upload-footer">
          <div class="footer-left">
            <el-input
              v-model="form.keywords"
              placeholder="关键词，用逗号或空格分隔"
              class="keywords-input"
            />
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="2"
              placeholder="文件描述..."
              class="description-input"
            />
            <el-radio-group v-model="form.scope" class="scope-group">
              <el-radio label="public">公开</el-radio>
              <el-radio label="private">私密</el-radio>
            </el-radio-group>
          </div>
        </div>
      </div>

      <div v-else class="create-area">
        <div class="create-header">
          <el-input
            v-model="form.title"
            placeholder="请输入文件名"
            class="title-input"
          />
        </div>

        <div class="create-center">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="10"
            placeholder="请输入文件内容（Markdown格式，便于AI读取）..."
            class="content-editor"
          />
          <div class="content-tip">
            <span>建议使用Markdown格式编写，大模型更容易理解和解析</span>
          </div>
        </div>

        <div class="create-footer">
          <div class="footer-left">
            <el-input
              v-model="form.keywords"
              placeholder="关键词，用逗号或空格分隔"
              class="keywords-input"
            />
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="2"
              placeholder="文件描述..."
              class="description-input"
            />
            <el-radio-group v-model="form.scope" class="scope-group">
              <el-radio label="public">公开</el-radio>
              <el-radio label="private">私密</el-radio>
            </el-radio-group>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ createMode ? '确认创建' : '确认上传' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.mode-switch-wrapper {
  position: absolute;
  right: 20px;
  top: 16px;
}

.form-container {
  margin-top: 40px;
}

.upload-area,
.create-area {
  display: flex;
  flex-direction: column;
  height: 400px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  overflow: hidden;
}

.upload-header,
.create-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.title-input {
  width: 100%;
}

.upload-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.create-center {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-editor {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 14px;
  resize: none;
}

.content-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.upload-footer,
.create-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.footer-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.keywords-input {
  width: 100%;
}

.description-input {
  width: 100%;
  resize: none;
}

.scope-group {
  display: flex;
  gap: 16px;
}

.upload-dragger {
  width: 100%;
  height: 100%;
}
</style>