<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Calendar,
  CircleCheck,
  Clock,
  Close,
  Document,
  FolderOpened,
  Loading,
  MagicStick,
  Refresh,
  User,
  View,
  WarningFilled,
} from '@element-plus/icons-vue'
import type { FolderId, KnowledgeFile, KnowledgeFolder } from '@/types'
import type { AiDocMeta, InfoSavePayload, InfoTab } from '@/types/workbench'

const props = defineProps<{
  tabs: InfoTab[]
  activeKey: string | null
  doc: KnowledgeFile | null
  aiMeta: AiDocMeta | null
  currentFolderId: FolderId | null
  folderOptions: Array<KnowledgeFolder & { depth: number; full_path: string }>
  formVersion: number
  detailLoading: boolean
  canEditInfo: boolean
  canManageFolder: boolean
  canResubmit: boolean
  saving: boolean
  /** 我的专属空间：可见范围锁定为「仅本人可见」，目录只能使用专属目录 */
  lockPrivate?: boolean
  /** 上传前草稿：保存只会写回待上传队列，不会调用入库接口 */
  draftMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-tab', key: string): void
  (e: 'save', payload: InfoSavePayload): void
  (e: 'preview', doc: KnowledgeFile): void
  (e: 'resubmit', doc: KnowledgeFile): void
}>()

interface FormState {
  title: string
  description: string
  keywords: string[]
  tags: string[]
  visibility: 'public' | 'private'
  folderId: FolderId | null
}

const form = reactive<FormState>({
  title: '',
  description: '',
  keywords: [],
  tags: [],
  visibility: 'public',
  folderId: null,
})

const snapshot = ref('')
const newKeyword = ref('')
const newTag = ref('')

const activeTab = computed(
  () => props.tabs.find((tab) => tab.key === props.activeKey) || null,
)
const processing = computed(() => {
  const status = activeTab.value?.status
  return status === 'pending' || status === 'analyzing' || status === 'uploading'
})
const tabFailed = computed(() => activeTab.value?.status === 'error')
const editable = computed(() => props.canEditInfo || props.canManageFolder)

const aiTitle = computed(() => (props.aiMeta?.recommendedTitle || '').trim())
const showAiTitle = computed(
  () => !!aiTitle.value && aiTitle.value !== form.title.trim(),
)
const aiVisibility = computed(() => props.aiMeta?.visibility)
const showAiVisibility = computed(
  () =>
    !props.lockPrivate &&
    !!aiVisibility.value &&
    aiVisibility.value !== form.visibility,
)
const aiConfidenceLabel = computed(() => {
  const map: Record<string, string> = { high: '置信度高', medium: '置信度中', low: '置信度低' }
  return map[props.aiMeta?.confidence || ''] || ''
})

const currentFolderLabel = computed(() => {
  if (form.folderId == null) return '待分类（全部文件根目录）'
  return (
    props.folderOptions.find((folder) => String(folder.id) === String(form.folderId))?.full_path ||
    props.doc?.folder_name ||
    '已归档'
  )
})

const reviewStatus = computed(() => props.doc?.review_status)

const fileSizeLabel = computed(() => {
  const size = Number(props.doc?.fileSize ?? (props.doc as any)?.file_size ?? 0)
  if (!size) return '-'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
})

const fileTypeLabel = computed(() => {
  const ext = String(props.doc?.file_ext || props.doc?.fileType || '').toLowerCase()
  return ext ? ext.toUpperCase() : '文件'
})

const createdAtLabel = computed(() => {
  const raw = props.doc?.createdAt || (props.doc as any)?.created_at
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const uploaderLabel = computed(
  () => props.doc?.uploader_name || props.doc?.author || '-',
)

const dirty = computed(() => serialize() !== snapshot.value)

function serialize(): string {
  return JSON.stringify({
    title: form.title.trim(),
    description: form.description.trim(),
    keywords: form.keywords.map((item) => item.trim()).filter(Boolean),
    tags: form.tags.map((item) => item.trim()).filter(Boolean),
    visibility: form.visibility,
    folderId: form.folderId == null ? null : String(form.folderId),
  })
}

function keywordPhrases(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item: any) => {
      if (typeof item === 'string') return item
      return item?.phrase || item?.keyword || item?.name || ''
    })
    .map((item) => String(item).trim())
    .filter(Boolean)
}

function tagNames(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item: any) => (typeof item === 'string' ? item : item?.tag_name || item?.name || ''))
    .map((item) => String(item).trim())
    .filter(Boolean)
}

function resetForm() {
  newKeyword.value = ''
  newTag.value = ''
  if (!props.doc) {
    form.title = ''
    form.description = ''
    form.keywords = []
    form.tags = []
    form.visibility = props.lockPrivate ? 'private' : 'public'
    form.folderId = null
    snapshot.value = serialize()
    return
  }
  const docKeywords = keywordPhrases(props.doc.keywords)
  form.title = props.doc.title || ''
  form.description =
    props.doc.description || (props.doc as any).summary || (props.doc as any).description || ''
  form.keywords = docKeywords.length
    ? docKeywords
    : keywordPhrases(props.aiMeta?.keywords).slice(0, 5)
  form.tags = tagNames(props.doc.tags)
  form.visibility = props.lockPrivate
    ? 'private'
    : props.doc.visibility === 'private' || props.doc.visibility === 'public'
      ? props.doc.visibility
      : props.aiMeta?.visibility || 'public'
  form.folderId = props.currentFolderId
  snapshot.value = serialize()
}

watch(
  () => [props.doc?.id ?? null, props.formVersion],
  () => {
    resetForm()
  },
  { immediate: true },
)

// 切换到专属空间后，已打开的面板立即锁定为「仅本人可见」
watch(
  () => props.lockPrivate,
  (locked) => {
    if (locked) form.visibility = 'private'
  },
  { immediate: true },
)

function normalized(value: string): string {
  return value.trim().replace(/[,，;；]/g, '')
}

function addKeyword() {
  const value = normalized(newKeyword.value)
  if (!value) return
  if (form.keywords.includes(value)) {
    newKeyword.value = ''
    return
  }
  if (form.keywords.length >= 20) {
    ElMessage.warning('最多保留 20 个关键词')
    return
  }
  form.keywords.push(value)
  newKeyword.value = ''
}

function removeKeyword(index: number) {
  form.keywords.splice(index, 1)
}

function addTag() {
  const value = normalized(newTag.value)
  if (!value) return
  if (form.tags.includes(value)) {
    newTag.value = ''
    return
  }
  if (form.tags.length >= 12) {
    ElMessage.warning('最多添加 12 个标签')
    return
  }
  form.tags.push(value)
  newTag.value = ''
}

function removeTag(index: number) {
  form.tags.splice(index, 1)
}

function adoptAiTitle() {
  if (!aiTitle.value) return
  form.title = aiTitle.value
}

function adoptAiVisibility() {
  if (props.lockPrivate) return
  if (aiVisibility.value) form.visibility = aiVisibility.value
}

function onFolderChange(value: FolderId | '') {
  form.folderId = value === '' ? null : value
}

function submit() {
  if (!props.doc || props.saving) return
  if (!form.title.trim()) {
    ElMessage.warning('资料标题不能为空')
    return
  }
  emit('save', {
    title: form.title.trim(),
    description: form.description.trim(),
    keywords: [...new Set(form.keywords.map((item) => item.trim()).filter(Boolean))],
    tags: [...new Set(form.tags.map((item) => item.trim()).filter(Boolean))],
    scope: props.lockPrivate ? 'private' : form.visibility,
    folderId: form.folderId,
  })
}
</script>

<template>
  <section class="panel info-panel">
    <div class="info-head">
      <div>
        <h2>资料确认</h2>
        <p>
          {{
            draftMode
              ? '文件加入后立即开始识别，可在此核对并修改标题、摘要与存放目录。'
              : 'AI 识别完成后，请确认资料标题、摘要与归档位置。'
          }}
        </p>
      </div>
      <span v-if="doc && aiMeta" class="ai-badge">
        <el-icon><MagicStick /></el-icon>
        AI 已识别
      </span>
      <span v-else-if="doc" class="plain-badge">资料信息</span>
      <span v-else class="idle-badge">待上传</span>
    </div>

    <div v-if="tabs.length" class="info-tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="info-tab"
        :class="[tab.status, { active: tab.key === activeKey }]"
        :title="tab.title"
        :aria-selected="tab.key === activeKey"
        @click="emit('select-tab', tab.key)"
      >
        <span class="tab-dot">
          <el-icon v-if="tab.status === 'analyzing' || tab.status === 'uploading'" class="is-spinning">
            <Loading />
          </el-icon>
          <el-icon v-else-if="tab.status === 'done'"><CircleCheck /></el-icon>
          <el-icon v-else-if="tab.status === 'error'"><WarningFilled /></el-icon>
          <el-icon v-else><Clock /></el-icon>
        </span>
        <span class="tab-title">{{ tab.title }}</span>
        <span v-if="tab.status === 'uploading'" class="tab-percent">{{ Math.round(tab.progress || 0) }}%</span>
      </button>
    </div>

    <div v-if="!tabs.length && !doc" class="info-empty">
      <span class="empty-glyph"><el-icon><Document /></el-icon></span>
      <h3>等待文件加入队列</h3>
      <p>文件加入上传队列后立即开始 AI 识别，识别结果会显示在左侧队列与这里的信息面板。</p>
      <ol class="empty-steps">
        <li><em>1</em>拖入文件，立即开始 AI 识别</li>
        <li><em>2</em>核对标题、摘要与存放目录</li>
        <li><em>3</em>确认上传，完成后确认入库</li>
      </ol>
    </div>

    <div v-else-if="processing && !doc" class="processing-card">
      <div class="processing-mark">
        <el-icon v-if="activeTab?.status === 'pending'"><Clock /></el-icon>
        <el-icon v-else class="is-spinning"><Loading /></el-icon>
      </div>
      <h3>
        {{
          activeTab?.status === 'pending'
            ? '排队等待处理'
            : activeTab?.status === 'analyzing'
              ? 'AI 正在识别文件'
              : '文件上传中'
        }}
      </h3>
      <p>
        {{
          activeTab?.status === 'pending'
            ? '批量文件按顺序处理，前一个文件完成后会自动开始。'
            : activeTab?.status === 'analyzing'
              ? '正在提取标题、摘要、关键词与推荐目录，请稍候。'
              : '文件正在写入资料库，完成后将在此显示识别结果。'
        }}
      </p>
      <div v-if="activeTab?.status === 'uploading'" class="processing-progress">
        <i :style="{ width: `${Math.max(2, activeTab.progress || 0)}%` }"></i>
      </div>
      <div class="processing-steps">
        <span :class="{ done: true }">AI 识别</span>
        <i></i>
        <span :class="{ active: activeTab?.status === 'uploading', done: activeTab?.status === 'analyzing' }">
          文件上传
        </span>
        <i></i>
        <span>信息确认</span>
      </div>
      <div class="processing-file" :title="activeTab?.title">{{ activeTab?.title }}</div>
    </div>

    <div v-else-if="tabFailed && !doc" class="error-card">
      <el-icon><WarningFilled /></el-icon>
      <div>
        <h3>该文件上传失败</h3>
        <p>{{ activeTab?.error || '上传或识别过程中出现错误，请从左侧队列移除后重新添加。' }}</p>
      </div>
    </div>

    <div v-else-if="detailLoading" class="info-skeleton">
      <div class="skeleton-line w40"></div>
      <div class="skeleton-box"></div>
      <div class="skeleton-line w25"></div>
      <div class="skeleton-box short"></div>
      <div class="skeleton-row">
        <div class="skeleton-box half"></div>
        <div class="skeleton-box half"></div>
      </div>
    </div>

    <div v-else-if="doc" class="info-body">
      <div v-if="aiMeta" class="ai-strip">
        <el-icon><MagicStick /></el-icon>
        <span>以下信息由 AI 自动识别，可直接修改后保存。</span>
        <em v-if="aiConfidenceLabel">{{ aiConfidenceLabel }}</em>
      </div>

      <div class="field">
        <div class="field-label">
          <span>资料标题</span>
          <em v-if="dirty" class="dirty-dot">未保存</em>
        </div>
        <el-input
          v-model="form.title"
          size="default"
          maxlength="120"
          show-word-limit
          :disabled="!canEditInfo || saving"
          placeholder="请输入资料标题"
        />
        <div v-if="showAiTitle" class="ai-suggest">
          <span class="ai-suggest-label">AI 推荐标题</span>
          <span class="ai-suggest-value" :title="aiTitle">{{ aiTitle }}</span>
          <button
            type="button"
            class="ai-suggest-btn"
            :disabled="!canEditInfo || saving"
            @click="adoptAiTitle"
          >采用</button>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <span>智能摘要</span>
          <em class="field-hint">用于检索与知识问答</em>
        </div>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          resize="none"
          maxlength="500"
          show-word-limit
          :disabled="!canEditInfo || saving"
          placeholder="AI 将根据文件内容生成摘要，也可手动填写"
        />
      </div>

      <div class="field">
        <div class="field-label">
          <span>关键词</span>
          <em class="field-hint">{{ form.keywords.length }}/20 · 支持检索与推荐</em>
        </div>
        <div class="chip-box" :class="{ readonly: !canEditInfo }">
          <span v-for="(keyword, index) in form.keywords" :key="`kw-${keyword}-${index}`" class="chip ai-chip">
            {{ keyword }}
            <button
              v-if="canEditInfo && !saving"
              type="button"
              title="移除关键词"
              @click="removeKeyword(index)"
            >
              <el-icon><Close /></el-icon>
            </button>
          </span>
          <input
            v-if="canEditInfo && !saving && form.keywords.length < 20"
            v-model="newKeyword"
            class="chip-input"
            maxlength="24"
            placeholder="+ 添加关键词"
            @keydown.enter.prevent="addKeyword"
            @blur="addKeyword"
          />
          <span v-if="!form.keywords.length && !canEditInfo" class="chip-placeholder">暂无关键词</span>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <span>资料标签</span>
          <em class="field-hint">{{ form.tags.length }}/12 · 人工维护</em>
        </div>
        <div class="chip-box" :class="{ readonly: !canEditInfo }">
          <span v-for="(tag, index) in form.tags" :key="`tag-${tag}-${index}`" class="chip tag-chip">
            {{ tag }}
            <button
              v-if="canEditInfo && !saving"
              type="button"
              title="移除标签"
              @click="removeTag(index)"
            >
              <el-icon><Close /></el-icon>
            </button>
          </span>
          <input
            v-if="canEditInfo && !saving && form.tags.length < 12"
            v-model="newTag"
            class="chip-input"
            maxlength="16"
            placeholder="+ 添加标签"
            @keydown.enter.prevent="addTag"
            @blur="addTag"
          />
          <span v-if="!form.tags.length && !canEditInfo" class="chip-placeholder">暂无标签</span>
        </div>
      </div>

      <div class="field-grid">
        <div class="field">
          <div class="field-label"><span>可见范围</span></div>
          <div class="segment" :class="{ disabled: !canEditInfo || saving || lockPrivate }">
            <button
              type="button"
              :class="{ active: form.visibility === 'public' }"
              :disabled="!canEditInfo || saving || lockPrivate"
              @click="form.visibility = 'public'"
            >部门公开</button>
            <button
              type="button"
              :class="{ active: form.visibility === 'private' }"
              :disabled="!canEditInfo || saving || lockPrivate"
              @click="form.visibility = 'private'"
            >仅本人可见</button>
          </div>
          <div v-if="lockPrivate" class="lock-hint">我的专属空间：可见范围固定为「仅本人可见」</div>
          <div v-if="showAiVisibility" class="ai-suggest compact">
            <span class="ai-suggest-label">AI 建议</span>
            <span class="ai-suggest-value">{{ aiVisibility === 'private' ? '仅本人可见' : '部门公开' }}</span>
            <button
              type="button"
              class="ai-suggest-btn"
              :disabled="!canEditInfo || saving"
              @click="adoptAiVisibility"
            >采用</button>
          </div>
        </div>

        <div class="field">
          <div class="field-label">
            <span>归档目录</span>
            <em class="field-hint">
              {{ lockPrivate ? '仅归档到专属目录' : canManageFolder ? '可随时调整' : '由管理员维护' }}
            </em>
          </div>
          <el-select
            :model-value="form.folderId ?? ''"
            size="default"
            class="folder-select"
            :disabled="!canManageFolder || saving"
            placeholder="待分类（全部文件根目录）"
            @update:model-value="onFolderChange"
          >
            <el-option label="待分类（全部文件根目录）" value="" />
            <el-option
              v-for="folder in folderOptions"
              :key="folder.id"
              :label="folder.full_path"
              :value="folder.id"
            />
          </el-select>
          <div class="folder-current" :title="currentFolderLabel">
            <el-icon><FolderOpened /></el-icon>
            {{ currentFolderLabel }}
          </div>
        </div>
      </div>

      <div v-if="reviewStatus" class="review-strip" :class="reviewStatus">
        <el-icon>
          <CircleCheck v-if="reviewStatus === 'approved'" />
          <WarningFilled v-else-if="reviewStatus === 'rejected'" />
          <Loading v-else />
        </el-icon>
        <div class="review-main">
          <strong>
            {{
              reviewStatus === 'approved'
                ? '审核已通过'
                : reviewStatus === 'rejected'
                  ? '审核被驳回'
                  : '等待审核'
            }}
          </strong>
          <p v-if="reviewStatus === 'rejected'">
            {{ doc.review_comment || '未填写驳回理由' }}
            <span v-if="doc.reviewer_name">· {{ doc.reviewer_name }}</span>
          </p>
          <p v-else-if="reviewStatus === 'approved' && doc.reviewer_name">
            审核人：{{ doc.reviewer_name }}
          </p>
          <p v-else>提交后将进入审核队列，审核通过后参与知识检索。</p>
        </div>
        <button
          v-if="reviewStatus === 'rejected' && canResubmit"
          type="button"
          class="resubmit-btn"
          @click="emit('resubmit', doc)"
        >
          <el-icon><Refresh /></el-icon>
          重新提交
        </button>
      </div>

      <div class="file-meta">
        <span><el-icon><Document /></el-icon>{{ fileTypeLabel }}</span>
        <span>{{ fileSizeLabel }}</span>
        <span v-if="!draftMode"><el-icon><User /></el-icon>{{ uploaderLabel }}</span>
        <span v-if="!draftMode"><el-icon><Calendar /></el-icon>{{ createdAtLabel }}</span>
        <span v-if="draftMode" class="draft-hint">上传后自动记录上传者与入库时间</span>
      </div>

      <div v-if="!editable" class="readonly-note">
        仅上传者或超级管理员可修改资料信息；归档目录由部门管理员维护。
      </div>

      <div class="info-foot">
        <span class="save-state">{{ dirty ? '有未保存的修改' : '信息已同步' }}</span>
        <div class="foot-actions">
          <button
            type="button"
            class="btn btn-ghost"
            :disabled="!doc.file_name && !doc.title"
            @click="emit('preview', doc)"
          >
            <el-icon><View /></el-icon>
            预览
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving || detailLoading || !editable"
            :title="
              editable
                ? draftMode
                  ? '保存修改，随文件一起上传'
                  : '确认资料信息并正式入库'
                : '当前账号无编辑权限'
            "
            @click="submit"
          >
            {{ saving ? '保存中…' : draftMode ? '保存修改' : '确认入库' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: #fff;
  border: 1px solid #e8eef6;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.info-panel {
  display: flex;
  flex-direction: column;
  min-height: 360px;
  padding: 16px 18px;
}

.info-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.info-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: #0f172a;
}

.info-head p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.ai-badge,
.plain-badge,
.idle-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
}

.ai-badge {
  border: 1px solid #cfe0fa;
  background: #eef4ff;
  color: #2563eb;
}

.plain-badge {
  border: 1px solid #dbe6f7;
  background: #f8fbff;
  color: #3f6fb5;
}

.idle-badge {
  border: 1px solid #eceff4;
  background: #fafbfc;
  color: #94a3b8;
}

.info-tabs {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 13px;
  padding-bottom: 9px;
  border-bottom: 1px solid #eef2f7;
  overflow-x: auto;
  scrollbar-width: thin;
}

.info-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  max-width: 190px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid #e8eef6;
  border-radius: 5px;
  background: #fbfcfe;
  color: #64748b;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.info-tab:hover {
  border-color: #bcd2f5;
  color: #2563eb;
}

.info-tab.active {
  border-color: #bcd2f5;
  background: #eef4ff;
  color: #1d4ed8;
  font-weight: 600;
}

.info-tab.error {
  color: #b91c1c;
}

.info-tab.error.active {
  border-color: #fecaca;
  background: #fef2f2;
}

.tab-dot {
  display: inline-flex;
  font-size: 12px;
}

.info-tab.analyzing .tab-dot,
.info-tab.uploading .tab-dot {
  color: #b45309;
}

.info-tab.done .tab-dot {
  color: #15803d;
}

.tab-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-percent {
  color: #2563eb;
  font-size: 10.5px;
}

.is-spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.info-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 12px 20px;
  text-align: center;
}

.empty-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 1px solid #e3ecf8;
  border-radius: 10px;
  background: #f8fbff;
  color: #7ba1dc;
  font-size: 22px;
}

.info-empty h3 {
  margin: 13px 0 0;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.info-empty p {
  max-width: 420px;
  margin: 6px 0 0;
  color: #8a99ad;
  font-size: 12px;
  line-height: 1.7;
}

.empty-steps {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 16px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  color: #64748b;
  font-size: 11.5px;
}

.empty-steps li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.empty-steps em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #eef4ff;
  color: #2563eb;
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
}

.processing-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 26px 16px 16px;
  text-align: center;
}

.processing-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border: 1px solid #dbe8fb;
  border-radius: 50%;
  background: #f3f8ff;
  color: #2563eb;
  font-size: 20px;
}

.processing-card h3 {
  margin: 13px 0 0;
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
}

.processing-card p {
  margin: 5px 0 0;
  color: #7a8ba3;
  font-size: 12px;
  line-height: 1.65;
}

.processing-progress {
  width: min(320px, 80%);
  height: 4px;
  margin-top: 16px;
  border-radius: 3px;
  background: #eef2f8;
  overflow: hidden;
}

.processing-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
  transition: width 0.2s ease;
}

.processing-steps {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 18px;
  color: #a3b0c2;
  font-size: 11px;
}

.processing-steps span.done {
  color: #15803d;
}

.processing-steps span.active {
  color: #2563eb;
  font-weight: 600;
}

.processing-steps i {
  width: 26px;
  height: 1px;
  background: #e2e8f2;
}

.processing-file {
  max-width: 100%;
  margin-top: 12px;
  overflow: hidden;
  color: #94a3b8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-card {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
  padding: 16px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef7f7;
  color: #b91c1c;
}

.error-card .el-icon {
  margin-top: 1px;
  font-size: 18px;
}

.error-card h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.error-card p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.65;
}

.info-skeleton {
  padding-top: 18px;
}

.skeleton-line,
.skeleton-box {
  border-radius: 4px;
  background: linear-gradient(90deg, #f2f5f9 25%, #f8fafc 37%, #f2f5f9 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-line {
  height: 11px;
  margin-bottom: 9px;
}

.skeleton-line.w40 { width: 40%; }
.skeleton-line.w25 { width: 25%; }

.skeleton-box {
  height: 34px;
  margin-bottom: 18px;
}

.skeleton-box.short { height: 62px; }
.skeleton-box.half { width: calc(50% - 8px); height: 34px; margin-bottom: 0; }
.skeleton-row { display: flex; gap: 16px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.info-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 13px;
  padding-right: 2px;
  scrollbar-width: thin;
}

.ai-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 13px;
  padding: 8px 10px;
  border: 1px solid #dbe8fb;
  border-radius: 5px;
  background: #f6faff;
  color: #3f6fb5;
  font-size: 11.5px;
}

.ai-strip .el-icon {
  color: #2563eb;
  flex-shrink: 0;
}

.ai-strip span {
  flex: 1;
  line-height: 1.5;
}

.ai-strip em {
  flex-shrink: 0;
  color: #7a8ba3;
  font-style: normal;
  font-size: 10.5px;
}

.field {
  margin-bottom: 13px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.field-hint {
  margin-left: auto;
  color: #a3b0c2;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 400;
}

.dirty-dot {
  padding: 0 5px;
  border-radius: 3px;
  background: #fff7ed;
  color: #b45309;
  font-size: 9.5px;
  font-style: normal;
  font-weight: 500;
  line-height: 15px;
}

.info-body :deep(.el-input__wrapper),
.info-body :deep(.el-textarea__inner) {
  border-radius: 5px;
  box-shadow: 0 0 0 1px #e2e9f3 inset;
  font-size: 12.5px;
}

.info-body :deep(.el-input__wrapper.is-focus),
.info-body :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #93b4e8 inset;
}

.info-body :deep(.el-input__count),
.info-body :deep(.el-textarea .el-input__count) {
  font-size: 9.5px;
  color: #a3b0c2;
  background: transparent;
}

.ai-suggest {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  padding: 4px 7px;
  border: 1px dashed #d5e3f7;
  border-radius: 4px;
  background: #fbfdff;
  font-size: 11px;
}

.ai-suggest.compact {
  margin-top: 4px;
  padding: 3px 6px;
}

.ai-suggest-label {
  flex-shrink: 0;
  color: #6b93c9;
}

.ai-suggest-value {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #475569;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-suggest-btn {
  flex-shrink: 0;
  padding: 0 5px;
  border: 1px solid #cfe0fa;
  border-radius: 3px;
  background: #eef4ff;
  color: #2563eb;
  font: inherit;
  font-size: 10.5px;
  line-height: 17px;
  cursor: pointer;
}

.ai-suggest-btn:hover:not(:disabled) {
  background: #e0ecff;
}

.ai-suggest-btn:disabled {
  border-color: #eceff4;
  background: #f8fafc;
  color: #b6c0cd;
  cursor: not-allowed;
}

.chip-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 5px 7px;
  border: 1px solid #e2e9f3;
  border-radius: 5px;
  background: #fff;
}

.chip-box.readonly {
  background: #fbfcfe;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1;
}

.chip button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.65;
}

.chip button:hover {
  background: rgba(15, 23, 42, 0.08);
  opacity: 1;
}

.ai-chip {
  border: 1px solid #d5e3f7;
  background: #f3f8ff;
  color: #3f6fb5;
}

.tag-chip {
  border: 1px solid #f0e4cb;
  background: #fffbf1;
  color: #a16207;
}

.chip-input {
  flex: 1;
  min-width: 92px;
  height: 22px;
  padding: 0 3px;
  border: 0;
  background: transparent;
  color: #1e293b;
  font: inherit;
  font-size: 11.5px;
  outline: none;
}

.chip-input::placeholder {
  color: #a3b0c2;
}

.chip-placeholder {
  color: #a3b0c2;
  font-size: 11.5px;
}

.field-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 16px;
}

.segment {
  display: inline-flex;
  padding: 2px;
  border: 1px solid #e2e9f3;
  border-radius: 5px;
  background: #f8fafc;
}

.segment button {
  min-width: 64px;
  height: 25px;
  padding: 0 9px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.segment button.active {
  background: #fff;
  color: #2563eb;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.segment.disabled {
  opacity: 0.7;
}

.lock-hint {
  margin-top: 4px;
  color: #6b3fa0;
  font-size: 10.5px;
  line-height: 1.5;
}

.segment button:disabled {
  cursor: not-allowed;
}

.folder-select {
  width: 100%;
}

.folder-select :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px #e2e9f3 inset;
  font-size: 12px;
}

.folder-current {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
  color: #a3b0c2;
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-strip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 0 12px;
  padding: 8px 10px;
  border-radius: 5px;
  font-size: 11.5px;
}

.review-strip.pending {
  border: 1px solid #fde9c8;
  background: #fffbf2;
  color: #b45309;
}

.review-strip.approved {
  border: 1px solid #d3f0dd;
  background: #f6fdf8;
  color: #15803d;
}

.review-strip.rejected {
  border: 1px solid #fecaca;
  background: #fef7f7;
  color: #b91c1c;
}

.review-strip > .el-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.review-strip.pending > .el-icon {
  animation: spin 1.5s linear infinite;
}

.review-main {
  min-width: 0;
  flex: 1;
}

.review-main strong {
  font-size: 12px;
  font-weight: 600;
}

.review-main p {
  margin: 2px 0 0;
  line-height: 1.55;
  opacity: 0.85;
  word-break: break-word;
}

.resubmit-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 23px;
  padding: 0 7px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: #fff;
  color: inherit;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.resubmit-btn:hover {
  background: #fff1f1;
}

.file-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 12px;
  padding-top: 10px;
  border-top: 1px solid #f1f5fa;
  color: #8a99ad;
  font-size: 10.5px;
}

.file-meta span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.file-meta .draft-hint {
  color: #a3b0c2;
}

.readonly-note {
  margin-top: 9px;
  padding: 6px 8px;
  border-radius: 4px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 10.5px;
  line-height: 1.55;
}

.info-foot {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding-top: 11px;
  padding-bottom: 2px;
  border-top: 1px solid #f1f5fa;
  background: #fff;
}

.save-state {
  flex: 1;
  color: #a3b0c2;
  font-size: 10.5px;
}

.foot-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 29px;
  padding: 0 10px;
  border-radius: 5px;
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
}

.btn:disabled {
  cursor: not-allowed;
}

.btn-ghost {
  border: 1px solid #e2e9f3;
  background: #fff;
  color: #475569;
}

.btn-ghost:hover:not(:disabled) {
  border-color: #bcd2f5;
  color: #2563eb;
}

.btn-ghost:disabled {
  color: #b6c0cd;
}

.btn-primary {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.btn-primary:disabled {
  border-color: #bcd2f5;
  background: #bcd2f5;
  color: #f8fbff;
}
</style>
