<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeFile } from '@/types'
import { CollectionTag, InfoFilled, PriceTag } from '@element-plus/icons-vue'

const props = defineProps<{
  file: KnowledgeFile | null
  fileTypeIcons: Record<string, any>
  fileTypeColors: Record<string, string>
  fileCategory: Record<string, string>
  fileExtension: string
}>()

interface MetaItem {
  text: string
  emphasis?: boolean
}

// 标题下的一行元信息：学院 · 文件类型 · 大小，空值直接省略，避免出现空标签
const metaItems = computed<MetaItem[]>(() => {
  const items: MetaItem[] = []
  if (props.file?.collegeName) items.push({ text: props.file.collegeName, emphasis: true })

  const format =
    props.fileCategory[props.fileExtension] ||
    (props.fileExtension ? props.fileExtension.toUpperCase() : '')
  if (format) items.push({ text: format })

  if (props.file?.fileSize) items.push({ text: formatFileSize(props.file.fileSize) })

  return items
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 统一显示为 YYYY-MM-DD HH:mm:ss，去掉时区/毫秒等后缀
function formatDateTime(raw?: string): string {
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return String(raw)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>

<template>
  <div class="file-info-card">
    <div class="info-header">
      <div class="icon-wrapper" :style="{ background: fileTypeColors[file?.fileType || 'doc'] + '15' }">
        <el-icon :size="48" :color="fileTypeColors[file?.fileType || 'doc'] || '#409eff'">
          <component :is="fileTypeIcons[file?.fileType || 'doc'] || 'Document'" />
        </el-icon>
      </div>
      <div class="file-meta">
        <h3 class="file-title">{{ file?.title }}</h3>
        <div v-if="metaItems.length" class="meta-tags">
          <template v-for="(item, index) in metaItems" :key="item.text">
            <span v-if="index" class="meta-divider" aria-hidden="true" />
            <span class="meta-item" :class="{ emphasis: item.emphasis }">{{ item.text }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="info-separator" />

    <div class="info-detail">
      <div class="detail-row">
        <span class="detail-label">作者</span>
        <span class="detail-value">{{ file?.author }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">格式</span>
        <span class="detail-value">{{ fileCategory[fileExtension] || '未知' }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">大小</span>
        <span class="detail-value">{{ formatFileSize(file?.fileSize || 0) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">上传时间</span>
        <span class="detail-value">{{ formatDateTime(file?.createdAt) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">更新时间</span>
        <span class="detail-value">{{ formatDateTime(file?.updatedAt) }}</span>
      </div>
    </div>

    <div class="info-separator" />

    <div class="info-description">
      <h4 class="desc-title">
        <el-icon><InfoFilled /></el-icon>
        文件描述
      </h4>
      <p class="desc-content">{{ file?.summary }}</p>
    </div>

    <div v-if="file?.keywords?.length" class="info-keywords">
      <h4 class="desc-title">
        <el-icon><PriceTag /></el-icon>
        关键词
      </h4>
      <div class="keyword-tags">
        <el-tag v-for="kw in file.keywords" :key="kw.id" size="small" effect="plain">{{ kw.phrase }}</el-tag>
      </div>
    </div>

    <div v-if="file?.tags?.length" class="info-keywords">
      <h4 class="desc-title">
        <el-icon><CollectionTag /></el-icon>
        标签
      </h4>
      <div class="keyword-tags">
        <el-tag
          v-for="tag in file.tags"
          :key="tag.id"
          size="small"
          type="success"
          effect="plain"
        >{{ tag.tag_name }}</el-tag>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 标题下方的元信息行：用分隔线代替并排标签，视觉更克制、正式 */
.meta-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #7a8ba3;
}

.meta-item {
  white-space: nowrap;
}

.meta-item.emphasis {
  color: #2563eb;
  font-weight: 550;
}

.meta-divider {
  flex-shrink: 0;
  width: 1px;
  height: 11px;
  background: #d8e2f0;
}
</style>
