<script setup lang="ts">
// ── 问答页内联图标 ──
// 说明：图标全部为静态 SVG 路径，统一 1.7 描边，避免为几十个小图标引入额外依赖。
// 书页星芒（brand）使用 40×40 视窗，其余图标统一 24×24。
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  size?: number | string
}>(), {
  size: 18,
})

interface IconDef {
  viewBox?: string
  body: string
}

const ICONS: Record<string, IconDef> = {
  brand: {
    viewBox: '0 0 40 40',
    body: `
      <path d="M8.4 13.4c3.5-1.35 7.1-1.35 10.6 0v16.2c-3.5-1.35-7.1-1.35-10.6 0V13.4Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M21 13.4c3.5-1.35 7.1-1.35 10.6 0v16.2c-3.5-1.35-7.1-1.35-10.6 0V13.4Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M21 13.4v16.2" fill="none" stroke="currentColor" stroke-width="2.4"/>
      <path d="M31.6 3.2l1.1 3.1 3.1 1.1-3.1 1.1-1.1 3.1-1.1-3.1-3.1-1.1 3.1-1.1 1.1-3.1Z" fill="currentColor"/>
    `,
  },
  library: {
    body: `
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>
      <path d="M9 7h7"/>
    `,
  },
  plus: { body: '<path d="M12 5v14M5 12h14"/>' },
  search: { body: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>' },
  'panel-left': {
    body: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m15.8 9.4-2.6 2.6 2.6 2.6"/>',
  },
  'panel-right': {
    body: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m12.2 9.4 2.6 2.6-2.6 2.6"/>',
  },
  mic: {
    body: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3M8 22h8"/>',
  },
  'arrow-up': { body: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>' },
  stop: { body: '<rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none"/>' },
  book: {
    body: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z"/>',
  },
  copy: {
    body: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  },
  'thumb-up': {
    body: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  },
  'thumb-down': {
    body: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
  },
  chevron: { body: '<path d="m6 9 6 6 6-6"/>' },
  'arrow-up-right': { body: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>' },
  clock: { body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  sparkles: {
    body: '<path d="m12 3 1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7Z"/><path d="m19 14 .9 2.4 2.4.9-2.4.9L19 20.6l-.9-2.4-2.4-.9 2.4-.9Z"/>',
  },
  download: {
    body: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  },
  more: {
    body: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  },
  edit: { body: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' },
  trash: {
    body: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  },
  target: { body: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>' },
  clipboard: {
    body: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  },
  file: { body: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>' },
  compass: { body: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>' },
  chart: { body: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  users: {
    body: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  shield: { body: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>' },
  check: { body: '<path d="M20 6 9 17l-5-5"/>' },
  x: { body: '<path d="M18 6 6 18M6 6l12 12"/>' },
}

const def = computed<IconDef>(() => ICONS[props.name] || { body: '' })
</script>

<template>
  <svg
    class="chat-icon"
    :width="size"
    :height="size"
    :viewBox="def.viewBox || '0 0 24 24'"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="def.body"
  />
</template>

<style scoped>
.chat-icon {
  display: block;
  flex-shrink: 0;
}
</style>
