<script setup lang="ts">
// ── 全局加载态组件 ──
// 人员 A 实现
//
// 功能：全屏或区域 loading 状态展示
// 使用：<Loading :loading="isLoading" />
//       <Loading :loading="isLoading" type="fullscreen" />

import { Loading } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    loading: boolean
    tip?: string
    type?: 'fullscreen' | 'inline'
  }>(),
  {
    tip: '加载中...',
    type: 'inline',
  },
)
</script>

<template>
  <template v-if="loading">
    <div :class="['loading-wrap', `loading-${type}`]">
      <div class="loading-content">
        <el-icon class="loading-icon" :size="32">
          <Loading />
        </el-icon>
        <p class="loading-tip">{{ tip }}</p>
      </div>
    </div>
  </template>
  <slot v-else />
</template>

<style scoped>
.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-fullscreen {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.8);
  z-index: 9999;
}

.loading-inline {
  min-height: 200px;
}

.loading-content {
  text-align: center;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

.loading-tip {
  margin-top: 12px;
  color: var(--color-gray);
  font-size: var(--font-size-sm);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
