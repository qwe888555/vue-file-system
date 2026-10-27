<template>
  <el-tooltip :disabled="!tooltipText" effect="dark" placement="top" :show-after="150">
    <template #content>
      <div class="review-tooltip">{{ tooltipText }}</div>
    </template>
    <el-tag :type="meta.type" size="small" effect="light" class="review-status-tag">
      {{ meta.label }}
    </el-tag>
  </el-tooltip>
</template>

<script setup lang="ts">
// ── 文档审核状态徽章（列表 / 详情共用） ──
import { computed } from 'vue'
import type { ReviewStatus } from '@/types'

const props = defineProps<{
  status?: ReviewStatus | string | null
  /** 驳回理由 */
  comment?: string
  /** 审核人用户名 */
  reviewer?: string
  /** 审核时间（ISO 字符串） */
  reviewedAt?: string | null
}>()

type TagType = 'warning' | 'success' | 'danger' | 'info'

const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; type: TagType }> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
}

const meta = computed(() => {
  return REVIEW_STATUS_META[props.status as ReviewStatus] ?? { label: '未审核', type: 'info' as TagType }
})

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const tooltipText = computed(() => {
  if (props.status === 'rejected') {
    const lines = [`驳回理由：${props.comment?.trim() || '未填写'}`]
    if (props.reviewer) lines.push(`审核人：${props.reviewer}`)
    if (props.reviewedAt) lines.push(`驳回时间：${formatTime(props.reviewedAt)}`)
    return lines.join('\n')
  }
  if (props.status === 'pending') {
    return '待审核：审核通过后才会被 AI 问答检索'
  }
  if (props.status === 'approved') {
    const lines = ['已通过审核，可被 AI 问答检索']
    if (props.reviewer) lines.push(`审核人：${props.reviewer}`)
    if (props.reviewedAt) lines.push(`审核时间：${formatTime(props.reviewedAt)}`)
    return lines.join('\n')
  }
  return ''
})
</script>

<style scoped>
.review-tooltip {
  max-width: 320px;
  line-height: 1.6;
  white-space: pre-line;
  word-break: break-word;
}

.review-status-tag {
  font-weight: 500;
}
</style>
