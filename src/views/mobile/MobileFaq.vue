<script setup lang="ts">
// ── 手机端常见问题（FAQ）──
// 搜索 + 分类 + 手风琴列表；游客可浏览，401 时引导登录
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getFaqCategoriesApi, getFaqItemsApi } from '@/api/faq'
import type { FaqCategory, FaqItem } from '@/api/faq'

const router = useRouter()

const categories = ref<FaqCategory[]>([])
const items = ref<FaqItem[]>([])
const activeCategory = ref<number | null>(null)
const searchQuery = ref('')
const expandedId = ref<number | null>(null)
const loading = ref(true)
// 401（游客未登录）时展示登录引导
const authError = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined
let stale = false // 卸载保护：组件销毁后丢弃响应

// 请求序号守卫：分类/搜索/初次加载并发时，慢的旧请求不得覆盖新请求结果
let searchSeq = 0

const visibleItems = computed(() => items.value)

async function loadItems() {
  const seq = ++searchSeq
  loading.value = true
  authError.value = false
  const myStale = !stale
  try {
    const res = await getFaqItemsApi({
      status: 'published',
      category: activeCategory.value ?? undefined,
      q: searchQuery.value.trim() || undefined,
    })
    if (myStale && seq === searchSeq) items.value = res || []
  } catch (e: any) {
    if (myStale && seq === searchSeq) {
      if (e?.response?.status === 401) {
        authError.value = true
        items.value = []
      } else {
        items.value = []
      }
    }
  } finally {
    if (myStale && seq === searchSeq) loading.value = false
  }
}

function onSearchInput() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(loadItems, 300)
}

function clearSearch() {
  searchQuery.value = ''
  loadItems()
}

function selectCategory(id: number | null) {
  activeCategory.value = id
  loadItems()
}

function toggleItem(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

function goChat() {
  router.push('/mobile/chat')
}
function goLogin() {
  router.push('/mobile/login')
}

watch(searchQuery, onSearchInput)

onMounted(async () => {
  try {
    categories.value = await getFaqCategoriesApi()
  } catch {
    categories.value = []
  }
  await loadItems()
})

onUnmounted(() => {
  stale = true
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="mobile-faq">
    <!-- 顶栏 -->
    <header class="f-topbar">
      <span class="f-title">常见问题</span>
    </header>

    <!-- 搜索框 -->
    <div class="f-search">
      <div class="f-search-wrap">
        <svg class="f-search-icon" viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M8.5 3a5.5 5.5 0 014.2 9.02l4.14 4.14a.75.75 0 11-1.06 1.06l-4.14-4.14A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          class="f-input"
          placeholder="搜索问题关键词"
          enterkeyhint="search"
        />
        <button v-if="searchQuery" class="f-clear-btn" aria-label="清空搜索" @click="clearSearch">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M10 8.586l-3.293-3.293a1 1 0 10-1.414 1.414L8.586 10l-3.293 3.293a1 1 0 101.414 1.414L10 11.414l3.293 3.293a1 1 0 001.414-1.414L11.414 10l3.293-3.293a1 1 0 00-1.414-1.414L10 8.586z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 分类 chips -->
    <div v-if="categories.length" class="f-cats">
      <button class="f-cat" :class="{ active: activeCategory === null }" @click="selectCategory(null)">全部</button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="f-cat"
        :class="{ active: activeCategory === cat.id }"
        @click="selectCategory(cat.id)"
      >{{ cat.name }}</button>
    </div>

    <!-- 内容区 -->
    <div class="f-body">
      <!-- 加载骨架 -->
      <div v-if="loading" class="f-skeleton" aria-hidden="true">
        <div v-for="n in 5" :key="n" class="f-sk-item">
          <div class="f-sk-line f-sk-line-60" />
          <div class="f-sk-line f-sk-line-80" />
        </div>
      </div>

      <!-- 游客 / 401 -->
      <div v-else-if="authError" class="f-empty">
        <div class="f-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M7 9l3 3-3 3M13 15h4" />
            <rect x="3" y="3" width="18" height="18" rx="4" />
          </svg>
        </div>
        <p class="f-empty-text">登录后可查看更多常见问题</p>
        <button class="f-action-btn f-action-primary" @click="goLogin">去登录</button>
      </div>

      <!-- 空态 -->
      <div v-else-if="visibleItems.length === 0" class="f-empty">
        <div class="f-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9.5 11a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 3.5M12 18h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <p class="f-empty-text">暂无相关问题</p>
        <button class="f-action-btn" @click="goChat">去智能问答提问</button>
      </div>

      <!-- FAQ 列表 -->
      <div v-else class="f-list">
        <div
          v-for="item in visibleItems"
          :key="item.id"
          class="f-item"
          :class="{ expanded: expandedId === item.id }"
        >
          <button
            class="f-q"
            :aria-expanded="expandedId === item.id"
            @click="toggleItem(item.id)"
          >
            <span class="f-q-text">{{ item.question }}</span>
            <svg class="f-arrow" :class="{ rotated: expandedId === item.id }" viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </button>
          <div class="f-a-wrap">
            <div class="f-a-inner">
              <div class="f-a">{{ item.answer }}</div>
              <div v-if="item.tags?.length" class="f-tags">
                <span v-for="tag in item.tags" :key="tag" class="f-tag">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部 CTA -->
        <div class="f-cta">
          <p class="f-cta-text">没找到想要的答案？</p>
          <button class="f-action-btn" @click="goChat">去智能问答提问</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── iOS 默认样式重置 ── */
.mobile-faq button,
.mobile-faq input {
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}
.mobile-faq svg { flex-shrink: 0; color: inherit; }

.mobile-faq {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}

/* 顶栏 */
.f-topbar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  padding-top: constant(safe-area-inset-top); /* iOS 11.0 */
  padding-top: env(safe-area-inset-top);      /* iOS 11.2+ */
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #f0f1f4;
}
.f-title { font-size: 17px; font-weight: 600; color: #1f1f1f; }

/* 搜索框 */
.f-search { flex-shrink: 0; padding: 10px 12px 4px; background: #f7f8fa; }
.f-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 8px 0 14px;
  background: #fff;
  border: 2px solid #e4e7ed;
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.f-search-wrap:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
}
.f-search-icon { color: #a8b0bd; }
.f-search-wrap:focus-within .f-search-icon { color: #409eff; }
.f-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  outline: none;
  font-size: 16px; /* ≥16px 避免 iOS 聚焦自动缩放 */
  color: #1f1f1f;
  padding: 9px 0;
}
.f-input::placeholder { color: #b0b8c0; }
/* 隐藏 input[type=search] 默认清除按钮，用自定义清除按钮 */
.f-input::-webkit-search-cancel-button,
.f-input::-webkit-search-decoration { -webkit-appearance: none; }
.f-clear-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  border-radius: 50%;
  color: #a8b0bd;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.f-clear-btn:active { background: #f0f2f5; color: #64748b; }

/* 分类 chips（横向滚动） */
.f-cats {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 10px 12px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.f-cats::-webkit-scrollbar { display: none; }
.f-cat {
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #e8ebf0;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}
.f-cat:active { transform: scale(0.97); }
.f-cat.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
  font-weight: 500;
}

/* 内容区 */
.f-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 0 12px 16px;
}

/* 骨架屏 */
.f-skeleton { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.f-sk-item {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f1f4;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.f-sk-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, #f0f1f4 25%, #e7eaef 37%, #f0f1f4 63%);
  background-size: 400% 100%;
  animation: fShimmer 1.4s ease infinite;
}
.f-sk-line-60 { width: 60%; }
.f-sk-line-80 { width: 80%; }
@keyframes fShimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .f-sk-line { animation: none; }
}

/* 空态 */
.f-empty {
  padding: 72px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.f-empty-icon {
  width: 56px;
  height: 56px;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 14px;
}
.f-empty-text { font-size: 14px; color: var(--color-text-secondary, #64748b); margin: 0 0 20px; }

/* FAQ 列表 */
.f-list { display: flex; flex-direction: column; gap: 10px; padding-top: 2px; }
.f-item {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f1f4;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.f-item.expanded {
  border-color: #d5dbe8;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.f-q {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 12px 14px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}
.f-q:active { background: #f8f9fb; }
.f-q-text {
  flex: 1;
  min-width: 0;
  font-size: 14.5px;
  font-weight: 500;
  color: #1a2332;
  line-height: 1.45;
}
.f-arrow {
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary, #64748b);
  transition: transform 0.28s ease;
}
.f-arrow.rotated { transform: rotate(180deg); color: #64748b; }

/* 答案展开动画（grid-rows 方案，无需猜 max-height） */
.f-a-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.28s ease;
}
.f-item.expanded .f-a-wrap { grid-template-rows: 1fr; }
.f-a-inner { overflow: hidden; min-height: 0; }
.f-a {
  margin: 0 14px 4px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.7;
  white-space: pre-line;
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px 14px;
}
.f-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 14px 12px; }
.f-tag {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: #6b7280;
  background: #f0f2f5;
  line-height: 1.5;
}

/* 底部 CTA */
.f-cta {
  margin-top: 4px;
  padding: 28px 20px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.f-cta-text { font-size: 13px; color: var(--color-text-secondary, #64748b); margin: 0; }

.f-action-btn {
  min-height: 44px;
  padding: 0 24px;
  border: 1px solid #cbd5e1;
  border-radius: 22px;
  background: #fff;
  color: var(--color-primary-deep, #2563eb);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}
.f-action-btn:active { background: #f1f5f9; transform: scale(0.98); }
.f-action-primary {
  background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-deep, #2563eb));
  border: none;
  color: #fff;
}
.f-action-primary:active { background: linear-gradient(135deg, #3d8ee8, #172f70); }
</style>
