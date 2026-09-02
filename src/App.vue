<template>
  <!-- 路由页面渲染出口，必须要有这个标签 -->
  <!-- KeepAlive：缓存问答页组件，切走时草稿/对话状态保留、SSE 后台继续生成 -->
  <router-view v-slot="{ Component }">
    <keep-alive :include="['ChatHome']">
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>

<script setup>
// 无需额外代码
</script>
