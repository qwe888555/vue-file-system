// ── 知识库文档本地缓存（描述/关键词） ──
// 后端列表接口不返回 description，编辑/上传后写入 localStorage 防刷新丢失
import type { Keyword } from '@/types'

const DESC_CACHE_KEY = 'doc_description_cache'
const KW_CACHE_KEY = 'doc_keywords_cache'

function loadJsonCache(key: string): Map<number, any> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return new Map(JSON.parse(raw))
  } catch {}
  return new Map()
}

function saveJsonCache(key: string, map: Map<number, any>) {
  try { localStorage.setItem(key, JSON.stringify([...map])) } catch {}
}

const descCache: Map<number, string> = loadJsonCache(DESC_CACHE_KEY) as Map<number, string>
const keywordsCache: Map<number, Keyword[]> = loadJsonCache(KW_CACHE_KEY) as Map<number, Keyword[]>

export function cacheDesc(id: number, desc: string) {
  if (!desc) return
  descCache.set(id, desc)
  saveJsonCache(DESC_CACHE_KEY, descCache)
}

export function getCachedDesc(id: number): string | undefined {
  return descCache.get(id)
}

export function hasCachedDesc(id: number): boolean {
  return descCache.has(id)
}

export function hasCachedKeywords(id: number): boolean {
  return keywordsCache.has(id)
}

export function getCachedKeywords(id: number): Keyword[] | undefined {
  return keywordsCache.get(id)
}

export function cacheKeywords(id: number, keywords: Keyword[]) {
  if (!keywords.length) return
  keywordsCache.set(id, keywords)
  saveJsonCache(KW_CACHE_KEY, keywordsCache)
}
