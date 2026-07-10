<template>
  <div class="page-container">
    <!-- 标题 -->
    <div class="fm-header">
      <h2 class="fm-title">FAQ 管理</h2>
      <p class="fm-desc">审核、编辑和管理常见问题</p>
    </div>

    <!-- 搜索 + 筛选 -->
    <div class="fm-toolbar">
      <el-input v-model="keyword" placeholder="搜索问题..." clearable size="default" class="fi kw" @keyup.enter="page = 1; loadData()" @clear="page = 1; loadData()">
        <template #append>
          <el-button :icon="Search" @click="page = 1; loadData()" />
        </template>
      </el-input>
      <el-select v-model="categoryFilter" placeholder="全部分类" clearable size="default" class="fi sl" @change="page = 1; loadData()">
        <el-option label="全部分类" value="" />
        <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
      </el-select>
      <el-button size="default" @click="handleReset">重置</el-button>
    </div>

    <!-- 状态 Tabs -->
    <div class="fm-tabs">
      <span v-for="tab in tabs" :key="tab.value" class="fm-tab" :class="{ active: activeTab === tab.value }" @click="activeTab = tab.value; page = 1; loadData()">
        {{ tab.label }}
      </span>
    </div>

    <!-- 列表 -->
    <div class="fm-list" v-loading="loading">
      <div v-for="item in displayedList" :key="item.id" class="fm-card" :class="['fm-status--' + item.status, { expanded: expandedId === item.id }]">
        <div class="fm-card-top">
          <div class="fm-card-info" @click="toggleItem(item.id)">
            <div class="fm-card-head">
              <span class="fm-card-q">{{ item.question }}</span>
              <el-tag :type="item.status === 'published' ? 'success' : item.status === 'draft' ? 'warning' : 'info'" size="small">
                {{ item.status === 'published' ? '已发布' : item.status === 'draft' ? '草稿' : '已驳回' }}
              </el-tag>
            </div>
            <div class="fm-card-meta">
              <span>{{ item.category_name }}</span>
              <span v-if="item.frequency !== undefined">· 频率 {{ item.frequency }}</span>
              <span v-if="item.college_name">· {{ item.college_name }}</span>
            </div>
          </div>
          <div class="fm-card-actions">
            <el-button v-if="item.status === 'draft'" size="small" @click.stop="openEdit(item)">编辑</el-button>
            <el-button v-if="item.status === 'draft'" type="primary" size="small" @click.stop="handlePublish(item)">发布</el-button>
            <el-button v-if="item.status === 'draft'" type="warning" size="small" @click.stop="handleReject(item)">驳回</el-button>
            <el-button type="danger" size="small" @click.stop="handleDelete(item)">删除</el-button>
          </div>
        </div>

        <!-- 展开详情 -->
        <div class="fm-card-detail">
          <div class="fm-answer">{{ item.answer }}</div>
          <div v-if="item.tags?.length" class="fm-tags">
            <span v-for="tag in item.tags" :key="tag" class="fm-tag">{{ tag }}</span>
          </div>
          <div v-if="item.updated_at" class="fm-time">更新于 {{ item.updated_at.slice(0, 10) }}</div>
        </div>
      </div>

      <div v-if="!loading && displayedList.length === 0" class="fm-empty">
        <p>暂无数据</p>
      </div>

      <!-- 分页 -->
      <div class="faq-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 15, 20]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

	    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑 FAQ" width="560px" destroy-on-close>
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="问题" required>
          <el-input v-model="editForm.question" />
        </el-form-item>
        <el-form-item label="答案" required>
          <el-input v-model="editForm.answer" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.category" placeholder="选择分类" class="w-full">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="editForm.tags" multiple filterable allow-create default-first-option placeholder="输入标签后回车" class="w-full">
            <el-option v-for="tag in existingTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="confirmEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getFaqItemsApi, deleteFaqItemApi, getFaqCategoriesApi, actionFaqDraftApi, updateFaqDraftApi } from '@/api/faq'
import type { FaqCategory, FaqItem } from '@/api/faq'

const keyword = ref('')
const categoryFilter = ref<number | ''>('')
const activeTab = ref('')
const categories = ref<FaqCategory[]>([])
const list = ref<FaqItem[]>([])
const loading = ref(false)
const expandedId = ref<number | null>(null)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const tabs = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已驳回' },
]

// 编辑
const editVisible = ref(false)
const editLoading = ref(false)
const editForm = ref({ question: '', answer: '', category: null as number | null, tags: [] as string[] })
const editingId = ref<number | null>(null)
const existingTags = ref<string[]>([])

onMounted(async () => {
  try {
    categories.value = await getFaqCategoriesApi()
  } catch { /* */ }
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const data = await getFaqItemsApi({
      status: activeTab.value || undefined,
      q: keyword.value || undefined,
      category: categoryFilter.value || undefined,
    })
    list.value = data || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

/** 分类过滤 + 前端分页 */
const displayedList = computed(() => {
  let filtered = list.value
  if (categoryFilter.value) {
    filtered = filtered.filter((item) => item.category === categoryFilter.value)
  }
  total.value = filtered.length
  const start = (page.value - 1) * pageSize.value
  return filtered.slice(start, start + pageSize.value)
})

function handlePageChange(p: number) {
  page.value = p
}

function handleSizeChange(s: number) {
  pageSize.value = s
  page.value = 1
}

function handleReset() {
  keyword.value = ''
  categoryFilter.value = ''
  activeTab.value = ''
  page.value = 1
  loadData()
}

function toggleItem(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

async function handlePublish(row: FaqItem) {
  try {
    await ElMessageBox.confirm(`确定发布「${row.question}」吗？`, '发布确认')
    await actionFaqDraftApi(row.id, 'publish')
    ElMessage.success('发布成功')
    await loadData()
  } catch { /* */ }
}

async function handleReject(row: FaqItem) {
  try {
    await ElMessageBox.confirm(`确定驳回「${row.question}」吗？`, '驳回确认')
    await actionFaqDraftApi(row.id, 'reject')
    ElMessage.success('已驳回')
    await loadData()
  } catch { /* */ }
}

async function handleDelete(row: FaqItem) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.question}」吗？此操作不可撤销。`, '删除确认', { type: 'warning' })
    await deleteFaqItemApi(row.id)
    ElMessage.success('删除成功')
    await loadData()
  } catch { /* */ }
}

function openEdit(row: FaqItem) {
  editingId.value = row.id
  editForm.value = {
    question: row.question,
    answer: row.answer,
    category: row.category ?? null,
    tags: [...(row.tags || [])],
  }
  existingTags.value = row.tags || []
  editVisible.value = true
}

async function confirmEdit() {
  if (!editingId.value) return
  editLoading.value = true
  try {
    await updateFaqDraftApi(editingId.value, {
      question: editForm.value.question,
      answer: editForm.value.answer,
      category: editForm.value.category || undefined,
      tags: editForm.value.tags,
    })
    ElMessage.success('保存成功')
    editVisible.value = false
    await loadData()
  } catch { /* */ } finally {
    editLoading.value = false
  }
}

</script>

<style scoped>
.page-container { padding: var(--spacing-lg, 16px); }

/* ── 头部（匹配日志页 log-title） ── */
.fm-header { margin-bottom: 24px; }
.fm-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
.fm-desc { font-size: 13px; color: #94a3b8; margin: 4px 0 0; }

/* ── 工具栏 ── */
.fm-toolbar { display: flex; gap: 10px; margin-bottom: 20px; }

/* ── Pill 式 Tabs（匹配日志页 .log-tabs） ── */
.fm-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  background: #f1f5f9; border-radius: 12px; padding: 4px;
}
.fm-tab {
  padding: 7px 18px; border: none; border-radius: 9px;
  font-size: 13px; font-weight: 500; color: #64748b;
  background: transparent; cursor: pointer; user-select: none;
  transition: all 0.2s ease;
}
.fm-tab:hover { color: #334155; }
.fm-tab.active {
  background: #fff; color: #2563eb; font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── 控件统一样式（匹配日志页 .fi） ── */
:deep(.fi .el-input__wrapper),
:deep(.fi .el-select__wrapper) {
  border-radius: 4px !important; box-shadow: 0 0 0 1px #e2e8f0 !important;
  transition: box-shadow 0.2s ease;
}
:deep(.fi .el-input__wrapper:hover),
:deep(.fi .el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd5e1 !important;
}
:deep(.fi .el-input__wrapper.is-focus),
:deep(.fi .el-select__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(37,99,235,0.15) !important;
}
:deep(.fi .el-input__inner) {
  height: 34px; font-size: 13px; color: #0f172a;
}
:deep(.kw) { width: 240px; }
:deep(.sl) { width: 140px; }

/* ── 按钮统一样式（匹配日志页 .fi-btn） ── */
:deep(.el-button) {
  border-radius: 4px !important; font-weight: 500 !important;
}

/* ── 列表 ── */
.fm-list { display: flex; flex-direction: column; gap: 10px; }

/* ── 卡片 ── */
.fm-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #edf0f5;
  overflow: hidden;
  position: relative;
  transition: all 0.25s ease;
}
.fm-card:hover {
  border-color: #d5dbe8;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}

.fm-card-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 16px 20px; gap: 16px;
}
.fm-card-info { flex: 1; min-width: 0; cursor: pointer; }
.fm-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fm-card-q { font-size: 14.5px; font-weight: 500; color: #1a2332; line-height: 1.4; }
.fm-card-meta { font-size: 12px; color: #b0b8c8; margin-top: 4px; display: flex; gap: 6px; }
.fm-card-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

/* ── 展开详情 ── */
.fm-card-detail {
  max-height: 0; overflow: hidden; opacity: 0;
  transition: max-height 0.35s ease, opacity 0.3s ease, padding 0.3s ease;
  padding: 0 20px;
  border-top: 1px solid transparent;
}
.fm-card.expanded .fm-card-detail {
  max-height: 600px; opacity: 1;
  padding: 14px 20px 18px;
  border-top-color: #f0f2f5;
}

.fm-answer {
  font-size: 13.5px; color: #4b5563; line-height: 1.7;
  background: #f8fafc; border-radius: 8px; padding: 12px 14px;
  white-space: pre-line;
}

.fm-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.fm-tag {
  padding: 3px 10px; border-radius: 12px; font-size: 11px;
  color: #6b7280; background: #f0f2f5; transition: all 0.2s; cursor: default;
}
.fm-tag:hover { background: #e4e9f0; color: #2b5fd9; }
.fm-time { font-size: 12px; color: #c8cdd6; margin-top: 10px; }

.fm-empty { text-align: center; padding: 60px 0; color: #94a3b8; font-size: 14px; }

/* ── 分页（居中） ── */
.faq-pagination { display: flex; justify-content: center; margin-top: 20px; }
</style>
