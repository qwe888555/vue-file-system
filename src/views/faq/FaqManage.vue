<template>
  <div class="page-container">
    <!-- 标题 -->
    <div class="fm-header">
      <h2 class="fm-title">FAQ 管理</h2>
      <p class="fm-desc">审核、编辑和管理常见问题</p>
    </div>

    <!-- 搜索 + 筛选 -->
    <div class="fm-toolbar">
      <el-input v-model="keyword" placeholder="搜索问题..." clearable size="default" class="fi kw" @input="onSearchInput" @keyup.enter="page = 1; loadData()" @clear="page = 1; loadData()">
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
      <div v-for="item in list" :key="item.id" class="fm-card" :class="['fm-status--' + item.status, { expanded: expandedId === item.id }]">
        <div class="fm-card-top">
          <div class="fm-card-info" @click="toggleItem(item.id)">
            <div class="fm-card-head">
              <span class="fm-card-q">{{ item.question }}</span>
            </div>
            <div class="fm-card-meta">
              <el-tag :type="item.status === 'published' ? 'success' : item.status === 'draft' ? 'warning' : 'info'" size="small">
                {{ item.status === 'published' ? '已发布' : item.status === 'draft' ? '草稿' : '已驳回' }}
              </el-tag>
              <span v-if="item.category_name">{{ item.category_name }}</span>
              <span v-if="item.frequency !== undefined">· 频率 {{ item.frequency }}</span>
              <span v-if="item.college_name">· {{ item.college_name }}</span>
            </div>
          </div>
          <div class="fm-card-actions">
            <!-- 仅草稿可编辑/发布；已发布、已驳回保持只读（后端仅允许 draft 状态修改） -->
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
          <!-- 后端从未返回 updated_at（实测 17 条均无该字段），沿用 created_at 并如实标注为「创建于」 -->
          <div v-if="item.created_at" class="fm-time">创建于 {{ item.created_at.slice(0, 10) }}</div>
        </div>
      </div>

      <div v-if="!loading && list.length === 0" class="fm-empty">
        <p>暂无数据</p>
      </div>

      <!-- 分页：文档 4.4 规定每页 20 条，故固定页长、不提供条数选择 -->
      <div class="faq-pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next, jumper"
          @current-change="handlePageChange"
        />
      </div>
    </div>

	    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑 FAQ" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="问题" prop="question">
          <el-input v-model="editForm.question" />
        </el-form-item>
        <el-form-item label="答案" prop="answer">
          <el-input v-model="editForm.answer" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.category" placeholder="选择分类" clearable class="w-full">
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
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getFaqManageItemsApi, deleteFaqItemApi, getFaqCategoriesApi, actionFaqDraftApi, updateFaqDraftApi } from '@/api/faq'
import type { FaqCategory, FaqItem } from '@/api/faq'

const keyword = ref('')
const categoryFilter = ref<number | ''>('')
const activeTab = ref('')
const categories = ref<FaqCategory[]>([])
const list = ref<FaqItem[]>([])
const loading = ref(false)
const expandedId = ref<number | null>(null)
const page = ref(1)
// 文档 4.4：/faq/manage/items/ 标准分页，每页 20 条
const pageSize = ref(20)
// 管理端接口为服务端分页，total 由后端 count 提供
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
const formRef = ref()
const editRules = {
  question: [{ required: true, message: '请输入问题', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入答案', trigger: 'blur' }],
}

// 请求序号守卫：Tab/搜索/分类切换与初次加载并发时，慢的旧请求不得覆盖新请求结果
// （FaqList/MobileFaq 已有同类防护，FaqManage 补齐）
let searchSeq = 0

onMounted(async () => {
  try {
    categories.value = await getFaqCategoriesApi()
  } catch { /* */ }
  await loadData()
})

// 输入搜索防抖：停止输入 300ms 后自动触发搜索
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadData()
  }, 300)
}

async function loadData() {
  const seq = ++searchSeq
  loading.value = true
  try {
    const data = await getFaqManageItemsApi({
      page: page.value,
      page_size: pageSize.value,
      status: activeTab.value || undefined,
      search: keyword.value || undefined,
      category: categoryFilter.value || undefined,
    })
    if (seq !== searchSeq) return
    // 文档 4.4：/faq/manage/items/ 为标准分页，后端已按 page/page_size 切好，直接使用
    list.value = data?.results || []
    total.value = data?.count || 0
  } catch {
    if (seq === searchSeq) {
      list.value = []
      total.value = 0
    }
  } finally {
    if (seq === searchSeq) loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
  loadData()
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
  } catch (e) { console.error('发布 FAQ 失败', e) }
}

async function handleReject(row: FaqItem) {
  try {
    await ElMessageBox.confirm(`确定驳回「${row.question}」吗？`, '驳回确认')
    await actionFaqDraftApi(row.id, 'reject')
    ElMessage.success('已驳回')
    await loadData()
  } catch (e) { console.error('驳回 FAQ 失败', e) }
}

async function handleDelete(row: FaqItem) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.question}」吗？此操作不可撤销。`, '删除确认', { type: 'warning' })
    await deleteFaqItemApi(row.id)
    ElMessage.success('删除成功')
    // 服务端分页下，若当前页仅剩这一条，删除后该页必为空，
    // 而 DRF 分页器对越界页码返回 404 而非空列表 → 主动回退一页
    if (list.value.length === 1 && page.value > 1) page.value -= 1
    await loadData()
  } catch (e) { console.error('删除 FAQ 失败', e) }
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
  // 提交前校验必填项，不通过则中断
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  editLoading.value = true
  try {
    await updateFaqDraftApi(editingId.value, {
      question: editForm.value.question,
      answer: editForm.value.answer,
      // 文档 4.2：category 传 null 表示清除分类。
      // el-select 清空时置为 undefined（element-plus 的 valueOnClear 默认值），
      // 而 axios 会丢弃 undefined 字段导致清不掉，故用 ?? 归一到 null
      category: editForm.value.category ?? null,
      tags: editForm.value.tags,
    })
    ElMessage.success('保存成功')
    editVisible.value = false
    await loadData()
  } catch (e) { console.error('编辑 FAQ 失败', e) } finally {
    editLoading.value = false
  }
}

</script>

<style scoped>
.page-container { padding: var(--spacing-lg, 16px); }

/* ── 头部（匹配日志页 log-title） ── */
.fm-header { margin-bottom: 24px; }
.fm-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
.fm-desc { font-size: 13px; color: var(--color-text-secondary, #64748b); margin: 4px 0 0; }

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
  background: #fff; color: var(--color-primary-deep, #2563eb); font-weight: 600;
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
.fm-card-q {
  font-size: 14.5px; font-weight: 500; color: #1a2332; line-height: 1.4;
  display: block; max-width: 100%;
}
.fm-card-meta { font-size: 12px; color: var(--color-text-secondary, #64748b); margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
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
.fm-tag:hover { background: #e4e9f0; color: var(--color-primary-deep, #2563eb); }
.fm-time { font-size: 12px; color: var(--color-text-secondary, #64748b); margin-top: 10px; }

.fm-empty { text-align: center; padding: 60px 0; color: var(--color-text-secondary, #64748b); font-size: 14px; }

/* ── 分页（居中） ── */
.faq-pagination { display: flex; justify-content: center; margin-top: 20px; }
</style>
