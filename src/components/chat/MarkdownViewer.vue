<script setup lang="ts">
// ── Markdown 渲染组件 ──
// 功能：将 Markdown 文本渲染为 HTML，支持代码高亮
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import DOMPurify from 'dompurify'
// 高亮主题（可根据设计选色）
import 'highlight.js/styles/github.css'

// ── 按需注册常用语言 ──
// 全量 highlight.js（~900kB）只注册常用语言后降至 ~60kB；未注册语言自动降级为纯文本
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import diff from 'highlight.js/lib/languages/diff'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('python', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('diff', diff)

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  docLinkClick: [docId: number, title: string]
}>()

// 配置 marked（marked v18 已移除 setOptions({highlight})，改用 renderer 扩展实现代码高亮）
marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      const html = hljs.highlight(text, { language }).value
      return `<pre><code class="hljs language-${language}">${html}</code></pre>`
    },
  },
})

const renderedHTML = computed(() => {
  try {
    const raw = marked.parse(props.content) as string
    return DOMPurify.sanitize(raw)
  } catch {
    return `<p>${DOMPurify.sanitize(props.content)}</p>`
  }
})

/**
 * 拦截链接点击：知识库文档链接改为触发预览事件，不直接下载
 */
function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('a')
  if (!link) return

  const href = link.getAttribute('href') || ''
  // 匹配知识库文档链接：/api/knowledge/docs/{id}/download/ 或 /preview/
  const match = href.match(/\/api\/knowledge\/docs\/(\d+)\//)
  if (match) {
    e.preventDefault()
    const docId = parseInt(match[1], 10)
    const title = link.textContent || `文档${docId}`
    emit('docLinkClick', docId, title)
  }
}
</script>

<template>
  <div class="markdown-body" v-html="renderedHTML" @click="handleClick" />
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
