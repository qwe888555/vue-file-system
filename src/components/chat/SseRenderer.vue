<script setup lang="ts">
// ── SSE 流式渲染组件 ──
import { computed, onMounted, ref } from 'vue'
import MarkdownViewer from './MarkdownViewer.vue'

const props = defineProps<{
  content: string
  streaming: boolean
}>()

const emit = defineEmits<{
  done: []
}>()

const containerRef = ref<HTMLElement | null>(null)

const showCursor = computed(() => props.streaming)

onMounted(() => {
  if (!props.streaming && props.content) {
    emit('done')
  }
})
</script>

<template>
  <div ref="containerRef" class="sse-renderer">
    <MarkdownViewer :content="content" />
    <span v-if="showCursor && content" class="typing-cursor">▍</span>
    <span v-if="!content && streaming" class="streaming-placeholder">
      <span class="thinking-dot" />
      <span class="thinking-dot" />
      <span class="thinking-dot" />
    </span>
  </div>
</template>

<style scoped>
.sse-renderer {
  position: relative;
}

.typing-cursor {
  display: inline-block;
  font-size: 1em;
  color: var(--color-primary, #409eff);
  animation: blink 0.8s step-end infinite;
  margin-left: 2px;
  vertical-align: middle;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* 等待中的思考动画 */
.streaming-placeholder {
  display: inline-flex;
  gap: 4px;
  padding: 4px 0;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary, #409eff);
  animation: dotBounce 1.2s ease-in-out infinite;
}

.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
