// ── 文档关联类型配置（与后端 DocRelation.RELATION_TYPE_CHOICES 对齐） ──
import type { DocRelationType } from '@/types'

export interface RelationTypeOption {
  value: DocRelationType
  label: string
}

export const RELATION_TYPE_OPTIONS: RelationTypeOption[] = [
  { value: 'prerequisite', label: '前置知识' },
  { value: 'supplement', label: '补充材料' },
  { value: 'same_course', label: '同课相关' },
  { value: 'citation', label: '引用来源' },
  { value: 'replaces', label: '替代/新版' },
]

const RELATION_TYPE_LABELS = RELATION_TYPE_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

/** 关联类型 → 中文名（后端已返回 relation_type_name 时优先用后端值） */
export function relationTypeLabel(type: string | null | undefined): string {
  if (!type) return ''
  return RELATION_TYPE_LABELS[type] || type
}
