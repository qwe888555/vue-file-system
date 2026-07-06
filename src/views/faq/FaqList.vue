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
        class="faq-search-input"
        style="max-width: 300px"
        @input="handleSearch"
        @clear="handleSearch"
      >
        <template #prefix>
          <el-icon class="search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg></el-icon>
        </template>
      </el-input>
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

      <div v-if="!loading && filteredItems.length === 0" class="faq-empty">
        <div class="faq-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
        </div>
        <p class="faq-empty-text">暂无相关问题</p>
      </div>

      <!-- 分页 -->
      <div class="faq-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="allFiltered.length"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 15, 20]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getFaqCategoriesApi, getFaqItemsApi } from '@/api/faq'
import type { FaqCategory, FaqItem } from '@/api/faq'

const categories = ref<FaqCategory[]>([])
const items = ref<FaqItem[]>([])
const activeCategory = ref<number | null>(null)
const expandedId = ref<number | null>(null)
const searchQuery = ref('')
const loading = ref(true)

const page = ref(1)
const pageSize = ref(10)

onMounted(async () => {
  try {
    const [cats, faqs] = await Promise.all([
      getFaqCategoriesApi(),
      getFaqItemsApi(),
    ])
    categories.value = cats
    items.value = faqs.results || []
  } catch {
    // 静默
  } finally {
    loading.value = false
  }
})

async function loadItems() {
  page.value = 1
  loading.value = true
  try {
    const res = await getFaqItemsApi({
      category: activeCategory.value || undefined,
    })
    items.value = res.results || []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
}

function toggleItem(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

function handleSizeChange(s: number) {
  pageSize.value = s
  page.value = 1
}

function searchTag(tag: string) {
  searchQuery.value = tag
}

function handleSearch() {
  // computed 实时过滤
}

// 搜索 + 分类过滤后的全部数据（用于分页统计）
const allFiltered = computed(() => {
  let result = items.value
  if (activeCategory.value !== null) {
    result = result.filter((item) => item.category === activeCategory.value)
  }
  if (searchQuery.value) {
    const kw = searchQuery.value.toLowerCase()
    result = result.filter(
      (item) =>
        item.question.toLowerCase().includes(kw) ||
        (item.answer && item.answer.toLowerCase().includes(kw)) ||
        item.tags?.some((t) => t.toLowerCase().includes(kw)),
    )
  }
  return result
})

// 当前页展示的数据（搜索 + 客户端分页）
const filteredItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return allFiltered.value.slice(start, start + pageSize.value)
})
</script>

<style scoped>
.page-container {
  padding: var(--spacing-lg, 16px);
}


/* ── 头部 ── */
.faq-header { margin-bottom: 18px; }
.faq-header-title { font-size: 22px; font-weight: 700; color: #1a2332; margin: 0 0 4px; }
.faq-header-desc { font-size: 14px; color: #8e95a6; margin: 0; }

/* ── 搜索 ── */
.faq-search { margin-bottom: 20px; }
.faq-search-input :deep(.el-input__wrapper) {
  border-radius: 12px; padding: 4px 16px;
  box-shadow: 0 0 0 1px #e4e9f0 inset !important;
  background: #f8fafc !important; transition: all 0.25s ease;
}
.faq-search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(43, 95, 217, 0.18) inset !important;
  background: #fff !important;
}
.faq-search-input :deep(.el-input__inner) { height: 42px; font-size: 14px; }
.search-icon { color: #b0b8c8; font-size: 16px; }

/* ── 分类 pills ── */
.faq-categories { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.category-pill {
  padding: 6px 18px; border-radius: 20px; font-size: 13px; font-weight: 500;
  color: #5a6070; background: #f0f2f5; cursor: pointer;
  transition: all 0.25s ease; user-select: none; line-height: 1.6;
}
.category-pill:hover { background: #e4e9f0; color: #1a2332; }
.category-pill.active {
  background: #2b5fd9; color: #fff;
  box-shadow: 0 2px 10px rgba(43, 95, 217, 0.25);
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
  transform: translateY(-1px);
}
.faq-card.expanded { border-color: #d5dbe8; box-shadow: 0 4px 20px rgba(0,0,0,0.07); }

.faq-question {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px 14px 22px; cursor: pointer; user-select: none;
}

.faq-q-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.faq-q-text { font-size: 14.5px; font-weight: 500; color: #1a2332; line-height: 1.4; }
.faq-q-meta { font-size: 12px; color: #b0b8c8; line-height: 1.3; }

.faq-arrow {
  width: 20px; height: 20px; min-width: 20px; color: #c8cdd6;
  transition: transform 0.3s ease; flex-shrink: 0;
}
.faq-arrow.rotated { transform: rotate(180deg); color: #8e95a6; }

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
.faq-tag:hover { background: #e4e9f0; color: #2b5fd9; }

/* ── 空态 ── */
.faq-empty { text-align: center; padding: 60px 0; }
.faq-empty-icon { width: 48px; height: 48px; margin: 0 auto 12px; color: #c8cdd6; }
.faq-empty-text { font-size: 14px; color: #8e95a6; margin: 0; }

/* ── 分页 ── */
.faq-pagination { display: flex; justify-content: flex-start; margin-top: 20px; }

/* ── 响应式 ── */
@media (max-width: 768px) {
  .faq-list { grid-template-columns: 1fr; }
}
</style>
