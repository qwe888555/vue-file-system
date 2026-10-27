<template>
  <!-- 路由页面渲染出口，必须要有这个标签 -->
  <!-- KeepAlive：缓存问答页组件，切走时草稿/对话状态保留、SSE 后台继续生成 -->
  <!-- Transition：进出问答页时仅做交叉淡入淡出；其他模块切换直接渲染，无动画 -->
  <router-view v-slot="{ Component }">
    <!-- 有动画时包裹 transition -->
    <transition
      v-if="transitionName"
      :name="transitionName"
      :duration="220"
      mode="default"
    >
      <keep-alive :include="['ChatHome']">
        <component :is="Component" />
      </keep-alive>
    </transition>
    <!-- 无动画时直接渲染 -->
    <keep-alive v-else :include="['ChatHome']">
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const transitionName = ref('')

// 路由切换过渡：仅进出问答页（Chat）时加淡入淡出，其余切换保持原状（无动画）
//   - 问答页与其他模块共用全局侧栏，整页位移/缩放会让侧栏跟着跳，故只做透明度过渡
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
   问答页进出过渡（220ms · 纯交叉淡入淡出）
   ── 问答页与其他模块现在共用同一个 222px 全局侧栏；
      若整页做位移/缩放，侧栏会跟着移动，产生"跳一下"的观感
   ── 因此只保留透明度过渡：两层页面严格重叠，侧栏原地不动
   ════════════════════════════════════════════════════════════════════ */

/* ── 正向（page-slide）：从问答页切到其他模块 ── */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: opacity 0.22s ease;
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  height: 100%;
  will-change: opacity;
}

.page-slide-enter-from { opacity: 0; }
.page-slide-leave-to { opacity: 0; }

.page-slide-enter-active { z-index: 2; }
.page-slide-leave-active  { z-index: 1; }


/* ── 反向（page-slide-reverse）：从其他模块切进问答页 ── */
.page-slide-reverse-enter-active,
.page-slide-reverse-leave-active {
  transition: opacity 0.22s ease;
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  height: 100%;
  will-change: opacity;
}

.page-slide-reverse-enter-from { opacity: 0; }
.page-slide-reverse-leave-to { opacity: 0; }

.page-slide-reverse-enter-active { z-index: 2; }
.page-slide-reverse-leave-active  { z-index: 1; }
</style>
