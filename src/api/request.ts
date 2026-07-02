// ── Axios 统一请求封装 ──
// Token 注入、401 自动刷新、错误拦截
import axios from 'axios'
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { refreshTokenApi } from './auth'

const baseURL = import.meta.env.VITE_API_URL || '/api'

const instance: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token 读写 ──
function getAccessToken(): string {
  return localStorage.getItem('access_token') || ''
}
function setAccessToken(token: string) {
  localStorage.setItem('access_token', token)
}
function getRefreshToken(): string {
  return localStorage.getItem('refresh_token') || ''
}
function setRefreshToken(token: string) {
  localStorage.setItem('refresh_token', token)
}
function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}
function getToken(): string {
  return getAccessToken()
}
function clearToken() {
  clearTokens()
}

// 是否正在刷新 Token
let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = []

function processQueue(error: any, token: string | null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  pendingQueue = []
}

// ── 请求拦截 ──
// 公开接口白名单：这些接口绝对不能携带 Token，否则 DRF 会优先拦截 Token 鉴权
const noAuthPaths = ['/auth/login/', '/auth/refresh/']

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const isNoAuth = noAuthPaths.some(
      (p) =>
        config.url?.includes(p) ||
        config.url?.includes(`/api${p}`),
    )

    // 登录 / 刷新等公开接口 → 强制删除任何已携带的 Token 请求头
    if (isNoAuth) {
      delete config.headers.Authorization
      return config
    }

    const token = getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── 响应拦截 ──
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data
  },
  async (error) => {
    const originalRequest = error.config

    // 401 → 尝试刷新 Token
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return instance(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await refreshTokenApi({ refresh: refreshToken })
        setAccessToken(res.access)
        processQueue(null, res.access)
        originalRequest.headers.Authorization = `Bearer ${res.access}`
        return instance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearTokens()
        ElMessage.error('登录已过期，请重新登录')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // 业务错误提示
    const msg = error.response?.data?.detail || error.message || '网络异常'
    if (error.response?.status !== 401) {
      ElMessage.error(msg)
    }
    return Promise.reject(error)
  },
)

export { getToken, getAccessToken, setAccessToken, setRefreshToken, clearToken, getRefreshToken }
export default instance
