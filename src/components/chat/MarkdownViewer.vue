<script setup lang="ts">
// ── Markdown 渲染组件 ──
// 功能：将 Markdown 文本渲染为 HTML，支持代码高亮
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
// 引入高亮主题（可根据设计选色）
import 'highlight.js/styles/github.css'

const props = defineProps<{
  content: string
}>()

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
})

const renderedHTML = computed(() => {
  try {
    return marked.parse(props.content) as string
  } catch {
    return `<p>${props.content}</p>`
  }
})
</script>

<template>
  <div class="markdown-body" v-html="renderedHTML" />
</template>

<style scoped>
/* GitHub 风格的 Markdown 样式子集 */
.markdown-body {
  line-height: 1.7;
  word-break: break-word;
  overflow-wrap: break-word;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 1em 0 0.5em;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-body :deep(h1) { font-size: 1.4em; }
.markdown-body :deep(h2) { font-size: 1.25em; }
.markdown-body :deep(h3) { font-size: 1.1em; }

.markdown-body :deep(p) {
  margin: 0.5em 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.markdown-body :deep(li) {
  margin: 0.25em 0;
}

.markdown-body :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.25em 1em;
  border-left: 3px solid var(--color-primary, #409eff);
  color: var(--color-text-secondary, #606266);
  background: rgba(64, 158, 255, 0.04);
  border-radius: 0 4px 4px 0;
}

.markdown-body :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
}

.markdown-body :deep(pre) {
  margin: 0.5em 0;
  padding: 1em;
  background: #f6f8fa;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.85em;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--color-border, #e4e7ed);
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--color-bg, #f5f7fa);
  font-weight: 600;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border, #e4e7ed);
  margin: 1em 0;
}

/* 链接 */
.markdown-body :deep(a) {
  color: var(--color-primary, #409eff);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

/* 图片 */
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}
</style>
