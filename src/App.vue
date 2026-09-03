<template>
  <!-- 路由页面渲染出口，必须要有这个标签 -->
  <!-- KeepAlive：缓存问答页组件，切走时草稿/对话状态保留、SSE 后台继续生成 -->
  <!-- Transition：点 rail 切换模块时，新页从左滑入、旧页向右淡出（0.3s） -->
  <router-view v-slot="{ Component }">
    <transition name="page-slide">
      <keep-alive :include="['ChatHome']">
        <component :is="Component" />
      </keep-alive>
    </transition>
  </router-view>
</template>

<script setup>
// 无需额外代码
</script>

<style>
/* 路由切换过渡：新页统一从左侧滑入，旧页向右退场并淡出 */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* 绝对定位让新旧页面叠放，互不挤占布局 */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
}
/* 新页从左侧 100% 滑入 */
.page-slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
/* 旧页向右退 32% 并淡出 */
.page-slide-leave-to {
  transform: translateX(32%);
  opacity: 0;
}
/* 新页在上层覆盖，旧页在下层退场 */
.page-slide-enter-active {
  z-index: 2;
}
.page-slide-leave-active {
  z-index: 1;
}
</style>
