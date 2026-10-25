// ── 文档关联类型中文名（与后端 DocRelation.RELATION_TYPE_CHOICES 对齐） ──
// 关联边由后端 AI 自动生成，前端仅用于展示兜底（后端已返回 relation_type_name 时优先使用）
import type { DocRelationType } from '@/types'

const RELATION_TYPE_LABELS: Record<DocRelationType, string> = {
  prerequisite: '前置知识',
  supplement: '补充材料',
  same_course: '同课相关',
  citation: '引用来源',
  replaces: '替代/新版',
}

/** 关联类型 → 中文名 */
export function relationTypeLabel(type: string | null | undefined): string {
  if (!type) return ''
  return RELATION_TYPE_LABELS[type as DocRelationType] || type
}
