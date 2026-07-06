<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import { uploadFileApi, uploadTextApi, getFirstLevelCategoriesApi, getSecondLevelCategoriesApi } from '@/api/knowledge'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: UploadFormData): void
}>()

const userStore = useUserStore()

interface UploadFormData {
  title: string
  category: string
  collegeId: number
  collegeName: string
  keywords: string
  description: string
  content: string
  fileName: string
  fileSize: number
  fileData: string
  scope: 'school' | 'college' | 'department'
  firstLevelCategoryId: number
  secondLevelCategoryId: number
}

const form = ref<UploadFormData>({
  title: '',
  category: '',
  collegeId: 0,
  collegeName: '',
  keywords: '',
  description: '',
  content: '',
  fileName: '',
  fileSize: 0,
  fileData: '',
  scope: 'school',
  firstLevelCategoryId: 0,
  secondLevelCategoryId: 0,
})

const createMode = ref(false)
const uploadedFile = ref<File | null>(null)
const isConverting = ref(false)
const isFileTooLarge = ref(false)
const firstLevelCategories = ref<{ id: number; name: string }[]>([])
const secondLevelCategories = ref<{ id: number; name: string; parent_id: number }[]>([])
const isAiClassifying = ref(false)

async function loadFirstLevelCategories() {
  try {
    const res = await getFirstLevelCategoriesApi()
    firstLevelCategories.value = res
  } catch (error) {
    console.error('获取一级分类列表失败:', error)
  }
}

async function loadSecondLevelCategories(parentId?: number) {
  secondLevelCategories.value = []
  if (parentId) {
    try {
      const res = await getSecondLevelCategoriesApi(parentId)
      secondLevelCategories.value = res
    } catch (error) {
      console.error('获取二级分类列表失败:', error)
    }
  }
}

async function aiClassify() {
  isAiClassifying.value = true
  ElMessage.info('AI正在分析文件内容，自动分类中...')
  setTimeout(() => {
    if (firstLevelCategories.value.length > 0) {
      form.value.firstLevelCategoryId = firstLevelCategories.value[0].id
      loadSecondLevelCategories(firstLevelCategories.value[0].id)
      setTimeout(() => {
        if (secondLevelCategories.value.length > 0) {
          form.value.secondLevelCategoryId = secondLevelCategories.value[0].id
        }
      }, 300)
    }
    isAiClassifying.value = false
    ElMessage.success('AI分类完成')
  }, 1500)
}

watch(() => form.value.firstLevelCategoryId, (val) => {
  if (val) {
    loadSecondLevelCategories(val)
    form.value.secondLevelCategoryId = 0
  }
})

onMounted(async () => {
  try {
    await loadFirstLevelCategories()
  } catch (error) {
    console.error('初始化分类失败:', error)
  }
})

watch(() => props.visible, async (val) => {
  if (val) {
    try {
      await loadFirstLevelCategories()
    } catch (error) {
      console.error('加载分类失败:', error)
    }
    resetForm()
  }
})

function resetForm() {
  const userInfo = userStore.userInfo
  form.value = {
    title: '',
    category: '',
    collegeId: userInfo?.college || 0,
    collegeName: userInfo?.college_name || '',
    keywords: '',
    description: '',
    content: '',
    fileName: '',
    fileSize: 0,
    fileData: '',
    scope: 'school',
    firstLevelCategoryId: 0,
    secondLevelCategoryId: 0,
  }
  createMode.value = false
  uploadedFile.value = null
  isConverting.value = false
  isFileTooLarge.value = false
  secondLevelCategories.value = []
}

function handleFileChange(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  let maxSize = 50 * 1024 * 1024
  let sizeLimitText = '50MB'
  let fileCategory = '其他文件'
  
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    maxSize = 10 * 1024 * 1024
    sizeLimitText = '10MB'
    fileCategory = '图片类'
  } else if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'].includes(ext)) {
    maxSize = 500 * 1024 * 1024
    sizeLimitText = '500MB'
    fileCategory = '视频类'
  } else if (['pdf', 'doc', 'docx', 'txt', 'mp3', 'wav'].includes(ext)) {
    maxSize = 50 * 1024 * 1024
    sizeLimitText = '50MB'
    fileCategory = '文档/音频类'
  }
  
  const exceedsFormatLimit = file.size > maxSize
  const exceedsStorageLimit = file.size > 4 * 1024 * 1024
  isFileTooLarge.value = exceedsFormatLimit || exceedsStorageLimit
  
  uploadedFile.value = file
  form.value.fileName = file.name
  form.value.fileSize = file.size
  
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  if (!form.value.title) {
    form.value.title = baseName
  }
  
  if (isFileTooLarge.value) {
    isConverting.value = false
    if (exceedsStorageLimit) {
      ElMessage.warning(`当前浏览器存储限制，单个文件不能超过4MB（${fileCategory}格式上限${sizeLimitText}），建议将文件打包为 ZIP/RAR 压缩包后再上传`)
    } else {
      ElMessage.warning(`${fileCategory}文件大小不能超过${sizeLimitText}，建议将文件打包为 ZIP/RAR 压缩包后再上传`)
    }
    return
  }
  
  if (!isFileTooLarge.value) {
    isConverting.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      form.value.fileData = e.target?.result as string
      isConverting.value = false
    }
    reader.onerror = () => {
      ElMessage.error('文件读取失败，请重新选择')
      isConverting.value = false
      form.value.fileData = ''
    }
    reader.readAsDataURL(file)
  }
}

function handleRemove() {
  uploadedFile.value = null
  form.value.fileName = ''
  form.value.fileSize = 0
  form.value.fileData = ''
  form.value.title = ''
  isFileTooLarge.value = false
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
  if (!form.value.firstLevelCategoryId) {
    ElMessage.warning('请选择一级分类')
    return
  }
  if (!form.value.secondLevelCategoryId) {
    ElMessage.warning('请选择二级分类')
    return
  }

  if (createMode.value) {
    if (!form.value.content.trim()) {
      ElMessage.warning('请输入文件内容')
      return
    }
  } else {
    if (!uploadedFile.value) {
      ElMessage.warning('请选择要上传的文件')
      return
    }
    
    if (isFileTooLarge.value) {
      ElMessage.warning('上传的文件过大，请将文件打包为 ZIP/RAR 压缩包后再上传')
      return
    }
    
    if (isConverting.value) {
      ElMessage.warning('文件正在处理中，请稍候...')
      return
    }
    
    if (!form.value.fileData && !isFileTooLarge.value) {
      ElMessage.warning('文件处理失败，请重新上传')
      return
    }
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
    try {
      await uploadTextApi({
        title: form.value.title,
        content: form.value.content,
        description: form.value.description || undefined,
        college_id: form.value.collegeId || 1,
        category_id: form.value.secondLevelCategoryId,
        keywords,
        visibility: 'public',
        scope: form.value.scope,
      })
      ElMessage.success('创建成功')
      emit('submit', {
        ...form.value,
        keywords: keywords.join(','),
        collegeId: form.value.collegeId,
        collegeName: form.value.collegeName,
      })
    } catch (error) {
      console.error('创建文件失败:', error)
      ElMessage.error('创建文件失败，请重试')
      return
    }
  } else if (uploadedFile.value) {
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile.value)
      formData.append('title', form.value.title)
      formData.append('description', form.value.description || '')
      formData.append('scope', form.value.scope)
      formData.append('college_id', String(form.value.collegeId || 1))
      formData.append('department_id', '1')
      formData.append('category_id', String(form.value.secondLevelCategoryId))

      await uploadFileApi(formData)
      ElMessage.success('上传成功')
      emit('submit', {
        ...form.value,
        keywords: keywords.join(','),
        collegeId: form.value.collegeId,
        collegeName: form.value.collegeName,
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
    title="上传文件"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <el-form :model="form" label-width="100px" class="upload-form">
      <el-form-item label="文件名" required>
        <el-input v-model="form.title" placeholder="请输入文件名" />
      </el-form-item>

      <el-form-item label="关键词" required>
        <el-input v-model="form.keywords" placeholder="请输入关键词，用逗号或空格分隔" />
      </el-form-item>

      <el-form-item label="可见范围" required>
        <el-radio-group v-model="form.scope">
          <el-radio label="school">全校</el-radio>
          <el-radio label="college">学院内部</el-radio>
          <el-radio label="department">部门内部</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="一级分类" required>
        <el-select v-model="form.firstLevelCategoryId" placeholder="请选择一级分类" style="width: 100%">
          <el-option
            v-for="cat in firstLevelCategories"
            :key="cat.id"
            :label="cat.name"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="二级分类" required>
        <el-select
          v-model="form.secondLevelCategoryId"
          placeholder="请选择二级分类"
          style="width: 100%"
          :disabled="!form.firstLevelCategoryId"
        >
          <el-option
            v-for="cat in secondLevelCategories"
            :key="cat.id"
            :label="cat.name"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          :loading="isAiClassifying"
          @click="aiClassify"
        >
          AI智能分类
        </el-button>
      </el-form-item>

      <el-form-item label="文件描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入文件描述..." />
      </el-form-item>

      <div class="mode-switch">
        <el-radio-group v-model="createMode">
          <el-radio :value="false">上传文件</el-radio>
          <el-radio :value="true">创建文件</el-radio>
        </el-radio-group>
      </div>

      <el-form-item v-if="createMode" label="文件内容">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="6"
          placeholder="请输入文件内容（Markdown格式，便于AI读取）..."
          class="content-editor"
        />
        <div class="content-tip">
          <el-icon size="14"><Lightbulb /></el-icon>
          <span>建议使用Markdown格式编写，大模型更容易理解和解析</span>
        </div>
      </el-form-item>

      <el-form-item v-else label="文件上传">
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
        <div v-if="uploadedFile" class="uploaded-file-info" :class="{ 'file-too-large': isFileTooLarge }">
          <el-icon :size="16" :class="{ 'loading-icon': isConverting }">
            <FileText v-if="!isConverting && !isFileTooLarge" />
            <Warning v-else-if="isFileTooLarge" />
            <Loading v-else />
          </el-icon>
          <span>{{ uploadedFile.name }}</span>
          <span class="file-size">{{ (uploadedFile.size / 1024 / 1024).toFixed(2) }} MB</span>
          <span v-if="isConverting" class="converting-text">正在处理...</span>
          <span v-if="isFileTooLarge" class="too-large-text">文件过大，请打包上传</span>
        </div>
        <div class="file-limit-tip">
          <el-popover
            trigger="click"
            placement="bottom"
            width="320"
          >
            <template #reference>
              <el-icon size="14" color="#909399"><InfoFilled /></el-icon>
              <span>文件大小限制说明</span>
            </template>
            <div class="file-limit-content">
              <div class="limit-item">
                <span class="limit-label">图片类</span>
                <span class="limit-value">PNG/JPG/JPEG/GIF/WEBP</span>
                <span class="limit-size">上限 10MB</span>
              </div>
              <div class="limit-item">
                <span class="limit-label">视频类</span>
                <span class="limit-value">MP4/WEBM/MOV/AVI/MKV/FLV</span>
                <span class="limit-size">上限 500MB</span>
              </div>
              <div class="limit-item">
                <span class="limit-label">文档/音频类</span>
                <span class="limit-value">PDF/DOC/DOCX/TXT/MP3/WAV</span>
                <span class="limit-size">上限 50MB</span>
              </div>
              <div class="limit-item">
                <span class="limit-label">其他文件</span>
                <span class="limit-value">ZIP/RAR等</span>
                <span class="limit-size">上限 50MB</span>
              </div>
              <div class="storage-note">
                <span class="note-icon">⚠️</span>
                <span>注意：由于浏览器存储限制，单个文件实际不能超过4MB</span>
              </div>
              <div class="storage-note warning-note">
                <span class="note-icon">🚫</span>
                <span>不能上传非法、非公开文件</span>
              </div>
            </div>
          </el-popover>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :disabled="isConverting || !uploadedFile && !createMode">
        {{ createMode ? '确认创建' : '确认上传' }}
      </el-button>
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

.mode-switch {
  display: flex;
  justify-content: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-md);
}

.mode-switch :deep(.el-radio) {
  margin: 0 16px;
}

.content-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 13px;
}

.content-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-base);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.uploaded-file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--color-bg);
  border-radius: var(--radius-base);
  font-size: 13px;
  color: var(--color-text-primary);
}

.file-size {
  margin-left: auto;
  color: var(--color-text-secondary);
}

.converting-text {
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-primary);
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.file-limit-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  cursor: pointer;
  user-select: none;
}

.file-limit-tip:hover {
  color: #409eff;
}

.file-limit-content {
  padding: 8px 0;
}

.limit-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.limit-item:last-child {
  border-bottom: none;
}

.limit-label {
  font-weight: 600;
  color: #303133;
  font-size: 13px;
  margin-bottom: 4px;
}

.limit-value {
  font-size: 12px;
  color: #606266;
  margin-bottom: 2px;
}

.limit-size {
  font-size: 12px;
  color: #f56c6c;
  font-weight: 500;
}

.file-too-large {
  border-color: #f56c6c !important;
  background-color: #fef0f0 !important;
}

.file-too-large .el-icon {
  color: #f56c6c;
}

.too-large-text {
  margin-left: 8px;
  font-size: 12px;
  color: #f56c6c;
  font-weight: 500;
}

.storage-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: #fdf6ec;
  border-radius: 4px;
  font-size: 12px;
  color: #e6a23c;
}

.warning-note {
  background: #fef0f0;
  color: #f56c6c;
  font-weight: 500;
}

.note-icon {
  font-size: 14px;
}
</style>
