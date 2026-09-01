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
  docDownload: [docId: number, title: string]
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
    let raw = marked.parse(props.content) as string
    // 将知识库文档下载链接转换为「预览链接 + 下载按钮」组合
    raw = transformDocLinks(raw)
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['data-doc-id', 'data-doc-title', 'target', 'rel'],
      ADD_TAGS: ['button', 'span', 'svg', 'path'],
    })
  } catch {
    return `<p>${DOMPurify.sanitize(props.content)}</p>`
  }
})

/**
 * 将 <a href="/api/knowledge/docs/{id}/download/">文本</a>
 * 转换为 预览链接 + 下载按钮 的组合结构
 */
function transformDocLinks(html: string): string {
  // 匹配知识库文档链接
  const linkRegex = /<a[^>]*href="([^"]*\/api\/knowledge\/docs\/(\d+)\/[^"]*)"[^>]*>([^<]*)<\/a>/g
  return html.replace(linkRegex, (_match, _href, docId, linkText) => {
    const title = linkText.trim() || `文档${docId}`
    return `<span class="doc-link-wrapper">
      <a class="doc-preview-link" data-doc-id="${docId}" data-doc-title="${title}">${linkText}</a>
      <button class="doc-download-btn" data-doc-id="${docId}" data-doc-title="${title}" title="下载文件" type="button">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <path d="M8 2a.75.75 0 01.75.75v6.638l1.96-2.158a.75.75 0 111.08 1.04l-3.25 3.5a.75.75 0 01-1.08 0l-3.25-3.5a.75.75 0 111.08-1.04l1.96 2.158V2.75A.75.75 0 018 2z"/>
          <path d="M2.5 12a.75.75 0 01.75.75v.5c0 .138.112.25.25.25h9a.25.25 0 00.25-.25v-.5a.75.75 0 011.5 0v.5A1.75 1.75 0 0112.5 15h-9A1.75 1.75 0 011.75 13.25v-.5A.75.75 0 012.5 12z"/>
        </svg>
      </button>
    </span>`
  })
}

/**
 * 拦截点击：
 * - 点击预览链接 → 触发 docLinkClick（预览）
 * - 点击下载按钮 → 触发 docDownload（下载）
 */
function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement

  // 下载按钮点击
  const downloadBtn = target.closest('.doc-download-btn')
  if (downloadBtn) {
    e.preventDefault()
    const docId = parseInt(downloadBtn.getAttribute('data-doc-id') || '0', 10)
    const title = downloadBtn.getAttribute('data-doc-title') || `文档${docId}`
    if (docId > 0) emit('docDownload', docId, title)
    return
  }

  // 预览链接点击
  const previewLink = target.closest('.doc-preview-link')
  if (previewLink) {
    e.preventDefault()
    const docId = parseInt(previewLink.getAttribute('data-doc-id') || '0', 10)
    const title = previewLink.getAttribute('data-doc-title') || `文档${docId}`
    if (docId > 0) emit('docLinkClick', docId, title)
    return
  }

  // 兜底：其他知识库文档链接（未被转换的）
  const link = target.closest('a')
  if (!link) return
  const href = link.getAttribute('href') || ''
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

/* 文档链接 + 下载按钮 组合 */
.markdown-body :deep(.doc-link-wrapper) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.markdown-body :deep(.doc-preview-link) {
  color: var(--color-primary, #409eff);
  text-decoration: none;
  cursor: pointer;
}

.markdown-body :deep(.doc-preview-link:hover) {
  text-decoration: underline;
}

.markdown-body :deep(.doc-download-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: rgba(64, 158, 255, 0.08);
  color: var(--color-primary, #409eff);
  cursor: pointer;
  transition: all 0.15s ease;
  vertical-align: middle;
}

.markdown-body :deep(.doc-download-btn:hover) {
  background: rgba(64, 158, 255, 0.2);
}
</style>
