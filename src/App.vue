<template>
  <!-- ═══ 桌面端已登录 · 全局 rail 外壳 ═══
       已登录用户在主模块内时，主导航 rail 常驻左侧、不随路由切换移动；
       rail 右侧为「内容舞台」，路由切换只在舞台内滑动。 -->
  <div v-if="isShell" class="app-shell">
    <AppRail />
    <div class="app-stage">
      <!-- KeepAlive：缓存问答页组件，切走时草稿/对话状态保留、SSE 后台继续生成 -->
      <!-- Transition：在 rail 主导航模块之间切换时，内容在舞台内按方向滑动 -->
      <!-- :key=stageKey：同一模块根内（如 /knowledge/list↔/knowledge/detail）复用实例直切；
           不同模块根则各自独立实例，保证模块间切换能被过渡捕获 -->
      <router-view v-slot="{ Component }">
        <transition :name="transitionName">
          <keep-alive :include="['ChatHome']">
            <component :is="Component" :key="stageKey" />
          </keep-alive>
        </transition>
      </router-view>
    </div>
  </div>

  <!-- ═══ 其它场景（未登录首页/登录卡、移动端、403/404 等）：原状整页渲染，不套外壳 ═══ -->
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppRail from '@/components/chat/AppRail.vue'
import { useUserStore } from '@/store/user'
import { allMenus } from '@/config/permission'

const route = useRoute()
const userStore = useUserStore()
const transitionName = ref('')

// ── 模块顺序：全部主模块按 allMenus 顺序（与 rail 展示顺序一致）──
// 用于 (1) 判断当前页是否处于「主模块」内（含不在角色菜单里的公共模块，如 admin 浏览 /faq）、
//     (2) 路由切换动画的方向依据
const moduleRoots = computed(() => allMenus.map((item) => item.path))

/** 路由 path → rail 模块序号；非主模块（首页/移动端/异常页/未授权模块）返回 -1 */
function moduleIndexOf(path?: string): number {
  if (!path) return -1
  const roots = moduleRoots.value
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i]
    // 边界安全的根前缀匹配：/faq 不命中 /faq-manage，/knowledge/list、/knowledge/detail/:id 都命中 /knowledge
    if (path === root || path.startsWith(root + '/')) return i
  }
  return -1
}

// rail 外壳仅在「已登录 + 当前处于主模块」时出现；登录前/退出后/移动端不出现
const isShell = computed(
  () => !!userStore.token && moduleIndexOf(route.path) >= 0,
)

// 内容舞台组件的 key：以「模块根」分组 —— 模块根间切换各自独立实例（触发滑动过渡），
// 模块根内子页切换（如文档列表↔详情）复用实例直切，不触发整页滑动
const stageKey = computed(() => {
  const idx = moduleIndexOf(route.path)
  return idx >= 0 ? moduleRoots.value[idx] : route.path
})

// ── 舞台内路由滑动过渡：在主模块之间切换时，方向跟随 rail 项的相对位置 ──
//   - 点到更靠下的模块（序号变大）→ 前进：新页自右滑入、旧页向左退
//   - 点到更靠上的模块（序号变小）→ 后退：新页自左滑入、旧页向右退
//   - 非主模块进出（首页/登录、403/404、移动端）或模块内子页切换 → 直切，不加动画
//     （登录后进入、退出登录回到首页均为直切，保持原有效果）
watch(
  () => route.path,
  (newPath, oldPath) => {
    const fromIdx = moduleIndexOf(oldPath)
    const toIdx = moduleIndexOf(newPath)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) {
      transitionName.value = ''
      return
    }
    transitionName.value = toIdx > fromIdx ? 'page-slide-fwd' : 'page-slide-back'
  },
)
</script>

<style>
/* ═══ 全局 rail 外壳：rail 常驻 + 内容舞台填满剩余空间 ═══ */
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.app-stage {
  position: relative; /* 舞台内路由滑动时作为绝对定位的包含块 */
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

/* ═══ 舞台内模块切换滑动 ═══
   两个页面均 absolute 铺满舞台、叠加过渡：新页在上（z-index 2）滑入，
   旧页在下（z-index 1）微移淡出，rail 保持不动。 */
.page-slide-fwd-enter-active,
.page-slide-fwd-leave-active,
.page-slide-back-enter-active,
.page-slide-back-leave-active {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  transition: transform 0.34s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.34s cubic-bezier(0.4, 0, 0.2, 1);
}
.page-slide-fwd-enter-active,
.page-slide-back-enter-active { z-index: 2; }
.page-slide-fwd-leave-active,
.page-slide-back-leave-active { z-index: 1; }

/* 前进（点到更靠下的模块）：新页自右滑入，旧页向左微退淡出 */
.page-slide-fwd-enter-from { transform: translateX(100%); }
.page-slide-fwd-leave-to   { transform: translateX(-18%); opacity: 0; }

/* 后退（点到更靠上的模块）：新页自左滑入，旧页向右微退淡出 */
.page-slide-back-enter-from { transform: translateX(-100%); }
.page-slide-back-leave-to   { transform: translateX(18%);  opacity: 0; }
</style>
