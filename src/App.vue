<template>
  <!-- 路由页面渲染出口，必须要有这个标签 -->
  <!-- KeepAlive：缓存问答页组件，切走时草稿/对话状态保留、SSE 后台继续生成 -->
  <!-- Transition：点 rail 切换模块时滑动过渡；进问答页方向反转 -->
  <router-view v-slot="{ Component }">
    <transition :name="transitionName">
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
const transitionName = ref('page-slide')

// 进入问答页时方向反转（新页从右滑入、旧页向左退），其余正向
watch(
  () => route.name,
  (newName, oldName) => {
    const isEnteringChat = newName === 'Chat'
    const wasOnChat = oldName === 'Chat'
    transitionName.value = isEnteringChat && !wasOnChat
      ? 'page-slide-reverse'
      : 'page-slide'
  },
)
</script>

<style>
/* ═══ 正向：新页从左滑入，旧页向右退场（从问答切到其他模块）═══ */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: transform 0.42s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
}
.page-slide-enter-from { transform: translateX(-100%); opacity: 0; }
.page-slide-leave-to   { transform: translateX(32%);   opacity: 0; }
.page-slide-enter-active { z-index: 2; }
.page-slide-leave-active  { z-index: 1; }

/* ═══ 反向：新页从右滑入，旧页向左退场（从其他模块切进问答页）═══ */
.page-slide-reverse-enter-active,
.page-slide-reverse-leave-active {
  transition: transform 0.42s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
}
.page-slide-reverse-enter-from { transform: translateX(100%);  opacity: 0; }
.page-slide-reverse-leave-to   { transform: translateX(-32%); opacity: 0; }
.page-slide-reverse-enter-active { z-index: 2; }
.page-slide-reverse-leave-active  { z-index: 1; }
</style>
