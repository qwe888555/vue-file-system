<template>
  <!-- 路由页面渲染出口，必须要有这个标签 -->
  <!-- KeepAlive：缓存问答页组件，切走时草稿/对话状态保留、SSE 后台继续生成 -->
  <!-- Transition：点 rail 切换模块时使用方案 C（缩回+轻推） -->
  <router-view v-slot="{ Component }">
    <transition
      :name="transitionName"
      :duration="340"
      mode="default"
    >
      <keep-alive :include="['ChatHome']">
        <component :is="Component" />
      </keep-alive>
    </transition>
  </router-view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const transitionName = ref('')

// 路由切换过渡：仅进出问答页（Chat）时加动画，其余切换保持原状（无动画）
//   - 从其他模块切进问答页 → 反向（page-slide-reverse）
//   - 从问答页切到其他模块 → 正向（page-slide）
//   - 其他模块之间切换 / 涉及登录页 → 不加动画（直切）
watch(
  () => route.name,
  (newName, oldName) => {
    // 涉及首页/登录页（Home，内嵌登录卡）的切换一律不加滑动动画：
    // 登录后进入问答页、退出登录回到登录页均直切，恢复原有效果
    if (newName === 'Home' || oldName === 'Home') {
      transitionName.value = ''
      return
    }

    const isEnteringChat = newName === 'Chat'
    const isLeavingChat = oldName === 'Chat'

    if (isEnteringChat && !isLeavingChat) {
      transitionName.value = 'page-slide-reverse'
    } else if (isLeavingChat && !isEnteringChat) {
      transitionName.value = 'page-slide'
    } else {
      transitionName.value = ''
    }
  },
)
</script>

<style>
/* ════════════════════════════════════════════════════════════════════
   方案 C · 分层叙事动画（340ms · cubic-bezier(0.32, 0.72, 0, 1)）
   ── 旧页"缩回"（轻微下沉 + scale 缩小 + 淡出）
   ── 新页"轻推入"（同向 8px 偏移 + scale 0.985 + 淡入）
   ── 避免新旧页同时大面积占满视口，方向跟随 rail 纵向轴
   ════════════════════════════════════════════════════════════════════ */

/* ── 正向（page-slide）：从问答页切到其他模块 ── */
.page-slide-enter-active,
.page-slide-leave-active {
  transition:
    transform 0.34s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.34s cubic-bezier(0.32, 0.72, 0, 1);
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  will-change: transform, opacity;
}

/* 旧页退场：向下沉 8px + 缩到 0.97 + 淡出（"被按回抽屉"） */
.page-slide-leave-to {
  transform: translate3d(0, 8px, 0) scale(0.97);
  opacity: 0;
}

/* 新页进场：从上方 -8px 轻推入 + 缩到 0.985 → 0 + 淡入 */
.page-slide-enter-from {
  transform: translate3d(0, -8px, 0) scale(0.985);
  opacity: 0;
}

.page-slide-enter-active { z-index: 2; }
.page-slide-leave-active  { z-index: 1; }


/* ── 反向（page-slide-reverse）：从其他模块切进问答页 ── */
.page-slide-reverse-enter-active,
.page-slide-reverse-leave-active {
  transition:
    transform 0.34s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.34s cubic-bezier(0.32, 0.72, 0, 1);
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  will-change: transform, opacity;
}

/* 旧页退场：向上升 8px + 缩到 0.97 + 淡出（"让位给问答页"） */
.page-slide-reverse-leave-to {
  transform: translate3d(0, -8px, 0) scale(0.97);
  opacity: 0;
}

/* 新页进场：从下方 +8px 轻推入 + 缩到 0.985 → 0 + 淡入（"升起进入"） */
.page-slide-reverse-enter-from {
  transform: translate3d(0, 8px, 0) scale(0.985);
  opacity: 0;
}

.page-slide-reverse-enter-active { z-index: 2; }
.page-slide-reverse-leave-active  { z-index: 1; }
</style>
