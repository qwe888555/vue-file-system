<template>
  <div class="page-container">
    <div class="faq-header">
      <h1 class="faq-header-title">常见问题</h1>
      <p class="faq-header-desc">为你解答使用过程中的常见疑问</p>
    </div>

    <!-- 搜索框 -->
    <div class="faq-search">
      <el-input
        v-model="searchQuery"
        placeholder="搜索问题..."
        clearable
        size="default"
        class="faq-search-input kw"
        @input="onSearchInput"
        @keyup.enter="page = 1; loadItems()"
        @clear="page = 1; loadItems()"
      >
        <template #append>
          <el-button :icon="Search" @click="page = 1; loadItems()" />
        </template>
      </el-input>
      <el-button size="default" @click="handleReset">重置</el-button>
    </div>

    <!-- 分类标签 -->
    <div class="faq-categories">
      <span
        class="category-pill"
        :class="{ active: activeCategory === null }"
        @click="activeCategory = null; loadItems()"
      >全部</span>
      <span
        v-for="cat in categories"
        :key="cat.id"
        class="category-pill"
        :class="{ active: activeCategory === cat.id }"
        @click="activeCategory = cat.id; loadItems()"
      >{{ cat.name }}</span>
    </div>

    <!-- FAQ 列表 -->
    <div class="faq-list">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="faq-card"
        :class="{ expanded: expandedId === item.id }"
      >
        <div class="faq-question" @click="toggleItem(item.id)">
          <div class="faq-q-main">
            <span class="faq-q-text">{{ item.question }}</span>
            <span class="faq-q-meta" v-if="item.category_name">{{ item.category_name }}</span>
          </div>
          <svg class="faq-arrow" :class="{ rotated: expandedId === item.id }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
        <div class="faq-answer-wrap">
          <div class="faq-answer">
            <div class="faq-answer-text">{{ item.answer }}</div>
            <div class="faq-tags" v-if="item.tags?.length">
              <span class="faq-tag" v-for="tag in item.tags" :key="tag" @click.stop="searchTag(tag)">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 游客 / 401：陈旧 Token 被 DRF 拦截 → 引导登录（与移动端一致） -->
      <div v-if="authError" class="faq-empty">
        <div class="faq-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9l3 3-3 3M13 15h4"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
        </div>
        <p class="faq-empty-text">登录后可查看更多常见问题</p>
        <el-button type="primary" @click="goLogin">去登录</el-button>
      </div>

      <div v-else-if="!loading && filteredItems.length === 0" class="faq-empty">
        <div class="faq-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
        </div>
        <p class="faq-empty-text">暂无相关问题</p>
      </div>

      <!-- 分页：/faq/items/ 无后端分页（文档 3.2），此处为固定 20 条/页的客户端切片 -->
      <div v-if="!authError" class="faq-pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="items.length"
          layout="total, prev, pager, next, jumper"
          @current-change="handlePageChange"
        />
      </div>
    </div>

</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { getFaqCategoriesApi, getFaqItemsApi } from '@/api/faq'
import type { FaqCategory, FaqItem } from '@/api/faq'

const router = useRouter()

const categories = ref<FaqCategory[]>([])
const items = ref<FaqItem[]>([])
const activeCategory = ref<number | null>(null)
const expandedId = ref<number | null>(null)
const searchQuery = ref('')
const loading = ref(true)
// 401（陈旧 Token 被 DRF 拦下）时展示登录引导，避免误导性的「暂无相关问题」
const authError = ref(false)

const page = ref(1)
// /faq/items/ 无后端分页（文档 3.2），页长固定为 20 条
const pageSize = ref(20)

// ── 请求序号守卫：丢弃过期响应 ──
// 搜索/分类/初次加载并发时，慢的旧请求不得覆盖新请求结果
// （移动端 MobileFaq 已有同类防护，桌面端补齐）
let searchSeq = 0

onMounted(async () => {
  const seq = ++searchSeq
  try {
    const [cats, faqs] = await Promise.all([
      getFaqCategoriesApi(),
      getFaqItemsApi({ status: 'published' }),
    ])
    categories.value = cats
    if (seq === searchSeq) items.value = faqs || []
  } catch (e) {
    console.error('获取 FAQ 分类失败', e)
    if (seq === searchSeq && (e as { response?: { status?: number } })?.response?.status === 401) {
      authError.value = true
    }
  } finally {
    if (seq === searchSeq) loading.value = false
  }
})

// 输入搜索防抖：停止输入 300ms 后自动触发搜索
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadItems()
  }, 300)
}

async function loadItems() {
  const seq = ++searchSeq
  page.value = 1
  loading.value = true
  authError.value = false
  try {
    const res = await getFaqItemsApi({
      status: 'published',
      category: activeCategory.value || undefined,
      q: searchQuery.value || undefined,
    })
    if (seq === searchSeq) items.value = res || []
  } catch (e) {
    console.error('获取 FAQ 列表失败', e)
    if (seq === searchSeq) {
      items.value = []
      if ((e as { response?: { status?: number } })?.response?.status === 401) {
        authError.value = true
      }
    }
  } finally {
    if (seq === searchSeq) loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
}

function toggleItem(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

function handleReset() {
  searchQuery.value = ''
  activeCategory.value = null
  page.value = 1
  loadItems()
}

function searchTag(tag: string) {
  searchQuery.value = tag
  page.value = 1
  loadItems()
}

// 桌面端登录为嵌入首页的登录卡片（与 Sidebar 的 @login 约定一致）
function goLogin() {
  router.push('/')
}

// 当前页展示的数据（客户端分页）
// 分类与关键词筛选均已交由后端（文档 3.2 支持 ?category= / ?q=），此处只做分页切片
const filteredItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return items.value.slice(start, start + pageSize.value)
})
</script>

<style scoped>
.page-container {
  padding: var(--spacing-lg, 16px);
}

/* ── 头部（匹配 FaqManage 页） ── */
.faq-header { margin-bottom: 24px; }
.faq-header-title {
  font-size: 24px; font-weight: 700; color: #0f172a;
  margin: 0 0 4px; letter-spacing: -0.02em;
}
.faq-header-desc { font-size: 14px; color: var(--color-text-secondary, #64748b); margin: 0; }

/* ── 搜索框（匹配 .fi 风格） ── */
.faq-search { margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.faq-search-input :deep(.el-input__wrapper) {
  border-radius: 4px !important;
  box-shadow: 0 0 0 1px #e2e8f0 !important;
  transition: box-shadow 0.2s ease;
}
.faq-search-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd5e1 !important;
}
.faq-search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(37,99,235,0.15) !important;
}
.faq-search-input :deep(.el-input__inner) {
  height: 34px; font-size: 13px; color: #0f172a;
}
:deep(.kw) { width: 240px; }
.search-icon { color: var(--color-text-secondary, #64748b); font-size: 16px; }

/* ── 分类 Pills（匹配 FaqManage .fm-tabs） ── */
.faq-categories {
  display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 20px;
  background: #f1f5f9; border-radius: 12px; padding: 4px;
}
.category-pill {
  padding: 7px 18px; border: none; border-radius: 9px;
  font-size: 13px; font-weight: 500; color: #64748b;
  background: transparent; cursor: pointer; user-select: none;
  transition: all 0.2s ease; line-height: 1.6;
}
.category-pill:hover { color: #334155; }
.category-pill.active {
  background: #fff; color: var(--color-primary-deep, #2563eb); font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── FAQ 卡片 ── */
.faq-list { display: flex; flex-direction: column; gap: 10px; }

.faq-card {
  background: #fff; border-radius: 12px; border: 1px solid #edf0f5;
  position: relative; overflow: hidden;
  transition: all 0.25s ease;
}
.faq-card:hover {
  border-color: #d5dbe8; box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}
.faq-card.expanded { border-color: #d5dbe8; box-shadow: 0 4px 20px rgba(0,0,0,0.07); }

.faq-question {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px 14px 22px; cursor: pointer; user-select: none;
}

.faq-q-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.faq-q-text { font-size: 14.5px; font-weight: 500; color: #1a2332; line-height: 1.4; }
.faq-q-meta { font-size: 12px; color: var(--color-text-secondary, #64748b); line-height: 1.3; }

.faq-arrow {
  width: 20px; height: 20px; min-width: 20px; color: var(--color-text-secondary, #64748b);
  transition: transform 0.3s ease; flex-shrink: 0;
}
.faq-arrow.rotated { transform: rotate(180deg); color: #64748b; }

/* ── 答案 ── */
.faq-answer-wrap {
  max-height: 0; overflow: hidden; opacity: 0;
  transition: max-height 0.35s ease, opacity 0.3s ease;
}
.faq-card.expanded .faq-answer-wrap { max-height: 600px; opacity: 1; }

.faq-answer { padding: 0 18px 0 22px; }
.faq-card.expanded .faq-answer { padding: 0 18px 16px 22px; }

.faq-answer-text {
  font-size: 14px; color: #4b5563; line-height: 1.7; white-space: pre-line;
  background: #f8fafc; border-radius: 8px; padding: 12px 14px;
}

.faq-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.faq-tag {
  padding: 3px 10px; border-radius: 12px; font-size: 12px;
  color: #6b7280; background: #f0f2f5; cursor: pointer; transition: all 0.2s; line-height: 1.5;
}
.faq-tag:hover { background: #e4e9f0; color: var(--color-primary-deep, #2563eb); }

/* ── 空态 ── */
.faq-empty { text-align: center; padding: 60px 0; }
.faq-empty-icon { width: 48px; height: 48px; margin: 0 auto 12px; color: var(--color-text-secondary, #64748b); }
.faq-empty-text { font-size: 14px; color: var(--color-text-secondary, #64748b); margin: 0; }

/* ── 分页（居中，匹配 FaqManage） ── */
.faq-pagination { display: flex; justify-content: center; margin-top: 20px; }

@media (max-width: 768px) {
  .faq-list { grid-template-columns: 1fr; }
}
</style>
