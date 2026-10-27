<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
// ── 文档审核（reviewer 专用） ──
// 待审核：GET /knowledge/reviews/pending/
// 已审记录：GET /knowledge/reviews/history/
// 审核通过/驳回后文档才会进入索引流水线；审核范围由后端按账号归属自动收窄。
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Check,
  Close,
  DocumentChecked,
  Refresh,
  Search,
  View,
  WarningFilled,
} from '@element-plus/icons-vue'
import type { ReviewAction, ReviewDoc, ReviewRecord, ReviewStatus } from '@/types'
import {
  approveDocReviewApi,
  getPendingReviewsApi,
  getReviewHistoryApi,
  rejectDocReviewApi,
} from '@/api/knowledge'
import { useUserStore } from '@/store/user'
import DocPreviewDialog from '@/components/knowledge/DocPreviewDialog.vue'

const userStore = useUserStore()

const activeTab = ref<'pending' | 'history'>('pending')
const previewRef = ref<InstanceType<typeof DocPreviewDialog>>()

/** DRF PageNumberPagination 固定 PAGE_SIZE=20，page_size 参数在后端不生效 */
const PAGE_SIZE = 20

const FILE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Word' },
  { value: 'xls', label: 'Excel' },
  { value: 'ppt', label: 'PPT' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'md', label: 'Markdown' },
  { value: 'txt', label: '纯文本' },
  { value: 'html', label: 'HTML' },
  { value: 'other', label: '其他' },
]

const ACTION_OPTIONS: Array<{ value: ReviewAction; label: string }> = [
  { value: 'approve', label: '通过' },
  { value: 'reject', label: '驳回' },
  { value: 'resubmit', label: '重新提交' },
]

const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; type: 'warning' | 'success' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
}

/** 审核范围：后端按账号归属过滤，这里只做提示，不参与请求参数 */
const scopeLabel = computed(() => {
  const info = userStore.userInfo
  if (info?.department_name) return `审核范围：${info.department_name}（部门）`
  if (info?.college_name) return `审核范围：${info.college_name}（学院级文档）`
  return '审核范围：未配置归属'
})

// ═══ 待审核 ═══
const pendingList = ref<ReviewDoc[]>([])
const pendingCount = ref(0)
const pendingPage = ref(1)
const pendingLoading = ref(false)
const pendingError = ref('')

const pendingKeyword = ref('')
const pendingFileType = ref('')
const pendingDateRange = ref<[string, string] | null>(null)

let pendingSearchTimer: ReturnType<typeof setTimeout> | undefined

async function fetchPending(resetPage = false) {
  if (resetPage) pendingPage.value = 1
  pendingLoading.value = true
  pendingError.value = ''
  try {
    const res = await getPendingReviewsApi({
      page: pendingPage.value,
      search: pendingKeyword.value.trim() || undefined,
      file_type: pendingFileType.value || undefined,
      start_date: pendingDateRange.value?.[0],
      end_date: pendingDateRange.value?.[1],
    })
    pendingList.value = res.results || []
    pendingCount.value = res.count || 0
    // 当前页处理完变空时回退一页，避免停在空白页
    if (pendingCount.value > 0 && pendingList.value.length === 0 && pendingPage.value > 1) {
      pendingPage.value -= 1
      await fetchPending()
    }
  } catch {
    pendingError.value = '待审列表加载失败，请检查网络后重试'
  } finally {
    pendingLoading.value = false
  }
}

function onPendingSearchInput() {
  clearTimeout(pendingSearchTimer)
  pendingSearchTimer = setTimeout(() => fetchPending(true), 300)
}

function resetPendingFilters() {
  pendingKeyword.value = ''
  pendingFileType.value = ''
  pendingDateRange.value = null
  fetchPending(true)
}

function handlePendingPageChange(page: number) {
  pendingPage.value = page
  fetchPending()
}

// ═══ 已审记录 ═══
const historyList = ref<ReviewRecord[]>([])
const historyCount = ref(0)
const historyPage = ref(1)
const historyLoading = ref(false)
const historyError = ref('')

const historyAction = ref('')
const historyKeyword = ref('')

let historySearchTimer: ReturnType<typeof setTimeout> | undefined

async function fetchHistory(resetPage = false) {
  if (resetPage) historyPage.value = 1
  historyLoading.value = true
  historyError.value = ''
  try {
    const res = await getReviewHistoryApi({
      page: historyPage.value,
      action: historyAction.value || undefined,
      search: historyKeyword.value.trim() || undefined,
    })
    historyList.value = res.results || []
    historyCount.value = res.count || 0
  } catch {
    historyError.value = '已审记录加载失败，请检查网络后重试'
  } finally {
    historyLoading.value = false
  }
}

function onHistorySearchInput() {
  clearTimeout(historySearchTimer)
  historySearchTimer = setTimeout(() => fetchHistory(true), 300)
}

function resetHistoryFilters() {
  historyAction.value = ''
  historyKeyword.value = ''
  fetchHistory(true)
}

function handleHistoryPageChange(page: number) {
  historyPage.value = page
  fetchHistory()
}

// ═══ 审核动作 ═══
const actingId = ref<number | null>(null)

async function refreshAfterAction() {
  await Promise.all([fetchPending(), fetchHistory(true)])
}

async function handleApprove(row: ReviewDoc) {
  if (actingId.value !== null) return
  actingId.value = row.id
  try {
    await approveDocReviewApi(row.id)
    ElMessage.success('审核通过，文档已开始建立索引')
    await refreshAfterAction()
  } catch (error: any) {
    // 409：文档已被其他人处理，刷新列表即可；其他错误由请求拦截器统一提示
    if (error?.response?.status === 409) await refreshAfterAction()
  } finally {
    actingId.value = null
  }
}

const rejectVisible = ref(false)
const rejectTarget = ref<ReviewDoc | null>(null)
const rejectComment = ref('')
const rejectSubmitting = ref(false)
const REJECT_MAX_LENGTH = 500

const rejectCanSubmit = computed(() => {
  const text = rejectComment.value.trim()
  return text.length > 0 && text.length <= REJECT_MAX_LENGTH && !rejectSubmitting.value
})

function openReject(row: ReviewDoc) {
  if (actingId.value !== null) return
  rejectTarget.value = row
  rejectComment.value = ''
  rejectVisible.value = true
}

function closeReject() {
  if (rejectSubmitting.value) return
  rejectVisible.value = false
  rejectTarget.value = null
}

async function submitReject() {
  if (!rejectTarget.value || !rejectCanSubmit.value) return
  rejectSubmitting.value = true
  try {
    await rejectDocReviewApi(rejectTarget.value.id, rejectComment.value.trim())
    ElMessage.success('已驳回，文件保留，上传者可修改后重新提交')
    rejectVisible.value = false
    rejectTarget.value = null
    await refreshAfterAction()
  } catch (error: any) {
    if (error?.response?.status === 409) {
      rejectVisible.value = false
      rejectTarget.value = null
      await refreshAfterAction()
    }
  } finally {
    rejectSubmitting.value = false
  }
}

// ═══ 展示辅助 ═══
function openPreview(id: number, title: string) {
  previewRef.value?.openDoc(id, title)
}

function uploadScopeOf(row: ReviewDoc): string {
  return row.uploader_department_name || row.college_name || '—'
}

function fileExtOf(row: ReviewDoc): string {
  return (row.file_ext || row.file_type || '').toUpperCase() || '—'
}

function displayTime(value: string, display?: string): string {
  if (display) return display
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

function actionTagType(action: ReviewAction): 'success' | 'danger' | 'warning' {
  if (action === 'approve') return 'success'
  if (action === 'reject') return 'danger'
  return 'warning'
}

function reviewStatusMeta(status: string): { label: string; type: 'warning' | 'success' | 'danger' } {
  return REVIEW_STATUS_META[status as ReviewStatus] ?? REVIEW_STATUS_META.pending
}

onMounted(() => {
  fetchPending()
  fetchHistory()
})
</script>

<template>
  <div class="doc-review-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">文档审核</h2>
        <p class="page-subtitle">
          管理员上传的文档经审核通过后才会进入索引，可被 AI 问答检索。
        </p>
      </div>
      <el-tag class="scope-tag" type="info" effect="plain">{{ scopeLabel }}</el-tag>
    </div>

    <el-alert
      class="review-tip"
      type="info"
      :closable="false"
      show-icon
      title="审核通过后文档才会开始解析、分块与向量化；驳回不会删除文件，上传者修改后可重新提交。"
    />

    <div class="review-card">
      <el-tabs v-model="activeTab" class="review-tabs">
        <!-- ═══ 待审核 ═══ -->
        <el-tab-pane name="pending">
          <template #label>
            <span class="tab-label">待审核<span class="tab-count">{{ pendingCount }}</span></span>
          </template>

          <div class="filter-bar">
            <el-input
              v-model="pendingKeyword"
              placeholder="搜索标题 / 文件名 / 上传者"
              clearable
              class="filter-search"
              @input="onPendingSearchInput"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>

            <el-select
              v-model="pendingFileType"
              placeholder="全部格式"
              clearable
              class="filter-select"
              @change="fetchPending(true)"
            >
              <el-option
                v-for="opt in FILE_TYPE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>

            <el-date-picker
              v-model="pendingDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="上传开始日期"
              end-placeholder="上传结束日期"
              value-format="YYYY-MM-DD"
              class="filter-date"
              @change="fetchPending(true)"
            />

            <el-button :icon="Refresh" @click="resetPendingFilters">重置</el-button>
          </div>

          <div v-if="pendingError" class="error-state">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ pendingError }}</span>
            <el-button size="small" @click="fetchPending()">重试</el-button>
          </div>

          <el-table
            v-loading="pendingLoading"
            :data="pendingList"
            border
            stripe
            class="review-table"
            empty-text="暂无待审核文档"
          >
            <el-table-column label="资料名" min-width="240" align="center" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="doc-cell">
                  <el-icon class="doc-icon"><DocumentChecked /></el-icon>
                  <div class="doc-main">
                    <span class="doc-title" @click="openPreview(row.id, row.title)">
                      {{ row.title }}
                    </span>
                    <span class="doc-file-name">{{ row.file_name || '—' }}</span>
                  </div>
                  <el-tag
                    size="small"
                    effect="plain"
                    :type="reviewStatusMeta(row.review_status).type"
                  >
                    {{ reviewStatusMeta(row.review_status).label }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="上传单位 / 部门" min-width="150" align="center" show-overflow-tooltip>
              <template #default="{ row }">{{ uploadScopeOf(row) }}</template>
            </el-table-column>

            <el-table-column prop="uploader_name" label="上传者" min-width="110" align="center" show-overflow-tooltip />

            <el-table-column label="文件格式" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ fileExtOf(row) }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="文件大小" width="110" align="center">
              <template #default="{ row }">{{ formatFileSize(row.file_size) }}</template>
            </el-table-column>

            <el-table-column label="上传时间" min-width="150" align="center">
              <template #default="{ row }">{{ displayTime(row.created_at, row.created_at_display) }}</template>
            </el-table-column>

            <el-table-column label="操作" width="260" align="center" fixed="right">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    :icon="View"
                    :disabled="actingId !== null"
                    @click="openPreview(row.id, row.title)"
                  >
                    预览
                  </el-button>
                  <el-button
                    size="small"
                    type="success"
                    :icon="Check"
                    :loading="actingId === row.id"
                    :disabled="actingId !== null && actingId !== row.id"
                    @click="handleApprove(row)"
                  >
                    通过
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :icon="Close"
                    :disabled="actingId !== null"
                    @click="openReject(row)"
                  >
                    驳回
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="pendingCount > PAGE_SIZE" class="pagination-wrapper">
            <el-pagination
              background
              layout="prev, pager, next, total"
              :current-page="pendingPage"
              :page-size="PAGE_SIZE"
              :total="pendingCount"
              @current-change="handlePendingPageChange"
            />
          </div>
        </el-tab-pane>

        <!-- ═══ 已审记录 ═══ -->
        <el-tab-pane name="history">
          <template #label>
            <span class="tab-label">已审记录<span class="tab-count">{{ historyCount }}</span></span>
          </template>

          <div class="filter-bar">
            <el-input
              v-model="historyKeyword"
              placeholder="搜索文档标题"
              clearable
              class="filter-search"
              @input="onHistorySearchInput"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>

            <el-select
              v-model="historyAction"
              placeholder="全部操作"
              clearable
              class="filter-select"
              @change="fetchHistory(true)"
            >
              <el-option
                v-for="opt in ACTION_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>

            <el-button :icon="Refresh" @click="resetHistoryFilters">重置</el-button>
          </div>

          <div v-if="historyError" class="error-state">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ historyError }}</span>
            <el-button size="small" @click="fetchHistory()">重试</el-button>
          </div>

          <el-table
            v-loading="historyLoading"
            :data="historyList"
            border
            stripe
            class="review-table"
            empty-text="暂无已审记录"
          >
            <el-table-column label="文档" min-width="240" align="center" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="doc-cell">
                  <el-icon class="doc-icon"><DocumentChecked /></el-icon>
                  <div class="doc-main">
                    <span class="doc-title" @click="openPreview(row.doc, row.doc_title)">
                      {{ row.doc_title }}
                    </span>
                    <span class="doc-file-name">{{ row.doc_file_name || '—' }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="light" :type="actionTagType(row.action)">
                  {{ row.action_display }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="审核意见" min-width="220" align="center" show-overflow-tooltip>
              <template #default="{ row }">{{ row.comment || '—' }}</template>
            </el-table-column>

            <el-table-column prop="reviewer_name" label="审核人" min-width="110" align="center" />

            <el-table-column label="操作时间" min-width="150" align="center">
              <template #default="{ row }">{{ displayTime(row.created_at, row.created_at_display) }}</template>
            </el-table-column>
          </el-table>

          <div v-if="historyCount > PAGE_SIZE" class="pagination-wrapper">
            <el-pagination
              background
              layout="prev, pager, next, total"
              :current-page="historyPage"
              :page-size="PAGE_SIZE"
              :total="historyCount"
              @current-change="handleHistoryPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <DocPreviewDialog ref="previewRef" />

    <!-- 驳回弹窗：理由必填，≤500 字 -->
    <el-dialog
      v-model="rejectVisible"
      title="驳回文档"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="!rejectSubmitting"
      :show-close="!rejectSubmitting"
      @close="closeReject"
    >
      <div v-if="rejectTarget" class="reject-target">
        <span class="reject-target-label">文档：</span>
        <span class="reject-target-title">{{ rejectTarget.title }}</span>
      </div>

      <el-input
        v-model="rejectComment"
        type="textarea"
        :rows="5"
        :maxlength="REJECT_MAX_LENGTH"
        show-word-limit
        placeholder="请填写驳回理由，上传者需要据此修改后重新提交"
      />

      <template #footer>
        <el-button :disabled="rejectSubmitting" @click="closeReject">取消</el-button>
        <el-button
          type="danger"
          :loading="rejectSubmitting"
          :disabled="!rejectCanSubmit"
          @click="submitReject"
        >
          确认驳回
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.doc-review-page {
  min-height: 100%;
  padding-bottom: var(--spacing-xl);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.scope-tag {
  flex-shrink: 0;
  margin-top: 4px;
}

.review-tip {
  margin-bottom: var(--spacing-md);
}

.review-card {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.review-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--spacing-md);
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--spacing-md);
}

.filter-search {
  width: 280px;
}

.filter-select {
  width: 150px;
}

.filter-date {
  width: 300px;
}

.error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--spacing-md);
  padding: 10px 14px;
  border-radius: var(--radius-md, 8px);
  background: #fef0f0;
  color: #f56c6c;
  font-size: 13px;
}

.review-table {
  width: 100%;
}

.review-table :deep(.el-table__header th) {
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-bg);
}

.doc-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.doc-icon {
  flex-shrink: 0;
  color: var(--color-primary, #409eff);
}

.doc-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
}

.doc-title {
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.doc-title:hover {
  color: var(--color-primary, #409eff);
}

.doc-file-name {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 4px;
  flex-wrap: nowrap;
}

.action-buttons :deep(.el-button) {
  padding: 5px 8px;
  font-size: 12px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: var(--spacing-md);
}

.reject-target {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.reject-target-title {
  color: var(--color-text);
  font-weight: 500;
}
</style>
