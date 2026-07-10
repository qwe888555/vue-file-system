<script setup lang="ts">
import type { KnowledgeFile } from '@/types'
import { InfoFilled, Tag } from '@element-plus/icons-vue'

defineProps<{
  file: KnowledgeFile | null
  fileTypeIcons: Record<string, any>
  fileTypeColors: Record<string, string>
  fileCategory: Record<string, string>
  fileExtension: string
}>()

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
        <div class="meta-tags">
          <el-tag size="medium" type="primary">{{ file?.collegeName }}</el-tag>
          <el-tag size="medium">{{ file?.categoryName }}</el-tag>
          <el-tag size="medium">{{ formatFileSize(file?.fileSize || 0) }}</el-tag>
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
        <span class="detail-value">{{ file?.createdAt }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">更新时间</span>
        <span class="detail-value">{{ file?.updatedAt }}</span>
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
        <el-icon><Tag /></el-icon>
        关键词
      </h4>
      <div class="keyword-tags">
        <el-tag v-for="kw in file.keywords" :key="kw.id" size="small" effect="plain">{{ kw.phrase }}</el-tag>
      </div>
    </div>
  </div>
</template>
