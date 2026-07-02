// ── Mock 拦截器 ──
// 在开发环境中拦截 admin API 请求，返回假数据
// 页面代码无需任何改动
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import request from '@/api/request'
import { mockColleges, mockAccounts } from './data'
import { useUserStore } from '@/store/user'

/** URL 匹配规则 */
type MockHandler = (config: AxiosRequestConfig) => any

type RouteEntry = {
  test: (path: string, method: string) => boolean
  handler: MockHandler
}

const routes: RouteEntry[] = [
  // PUT /admin/accounts/:id/reset-password
  {
    test: (p, m) => m === 'PUT' && /^\/admin\/accounts\/\d+\/reset-password$/.test(p),
    handler: () => ({ success: true }),
  },
  // GET /admin/colleges
  {
    test: (p, m) => m === 'GET' && p === '/admin/colleges',
    handler: () => mockColleges,
  },
  // GET /admin/accounts
  {
    test: (p, m) => m === 'GET' && p.startsWith('/admin/accounts'),
    handler: (config) => {
      const params = config.params || {}
      let list = [...mockAccounts]

      // 支持 keyword 筛选（按用户名）
      if (params.keyword) {
        const kw = String(params.keyword).toLowerCase()
        list = list.filter((a) => a.username.toLowerCase().includes(kw))
      }
      // 支持 role 筛选
      if (params.role) {
        list = list.filter((a) => a.role === params.role)
      }
      // 支持 collegeId 筛选
      if (params.collegeId) {
        list = list.filter((a) => a.collegeId === params.collegeId)
      }

      const page = params.page || 1
      const pageSize = params.pageSize || 15
      return { list, total: list.length, page, pageSize }
    },
  },
]

/** 查找匹配的 Mock 处理器 */
function findHandler(url: string, method: string): MockHandler | null {
  const path = url.replace(/^\/api/, '') // 去掉 /api 前缀
  for (const entry of routes) {
    if (entry.test(path, method)) return entry.handler
  }
  return null
}

/** 启用 Mock（在请求拦截器中注入自定义 adapter） */
export function setupMock() {
  console.log('[Mock] 启用开发环境 Mock 数据')

  // 注入演示用户态，绕过登录校验，刷新页面不会跳登录
  const userStore = useUserStore()
  userStore.$patch({
    token: 'dev-mock-token',
    userInfo: {
      id: 1,
      username: 'admin',
      realName: '超级管理员',
      avatar: '',
      email: 'admin@nisu.edu.cn',
      role: 'superadmin',
    },
  })

  request.interceptors.request.use((config) => {
    const url = config.url || ''
    const method = (config.method || 'get').toUpperCase()
    const handler = findHandler(url, method)

    if (handler) {
      // 用 mock adapter 替代默认 HTTP adapter
      config.adapter = (cfg: AxiosRequestConfig): Promise<AxiosResponse> => {
        const data = handler(cfg)
        console.log(`[Mock] ← ${cfg.method?.toUpperCase()} ${cfg.url}`, data)

        return Promise.resolve({
          data: { code: 0, data, message: 'success' },
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          config: cfg,
        } as AxiosResponse)
      }
    }

    return config
  })
}
