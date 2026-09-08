/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SSO_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 无类型声明的子路径模块（预览降级加载用）
declare module 'mammoth/mammoth.browser.js'
declare module 'xlsx/xlsx.mjs'
