// ── Axios 统一请求封装 ──
// 职责：请求/响应拦截、Token 注入、竞态处理、全局错误提示
//
// 使用示例：
//   import request from '@/api/request'
//   request.get('/api/xxx', { params: { page: 1 } })
//
// 响应格式（需与后端约定）：
//   { code: 0, data: T, message: 'success' }
import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

const baseURL = import.meta.env.VITE_API_URL || '/api'

const instance: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── 请求拦截 ──
instance.interceptors.request.use(
  (config) => {
    // 自动携带 Token
    const token = getToken()
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
    const { code, data, message } = response.data

    if (code === 0) {
      // 成功 → 直接返回 data
      return data
    }

    // 业务错误 → 统一弹窗提示
    ElMessage.error(message || '请求失败')
    if (code === 401) {
      // Token 过期 → 跳登录
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(new Error(message))
  },
  (error) => {
    // 网络错误 / 超时
    if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请重试')
    } else {
      ElMessage.error(error.message || '网络异常')
    }
    return Promise.reject(error)
  },
)

// ── Token 读写（可按需换 localStorage / cookie） ──
function getToken(): string {
  return localStorage.getItem('token') || ''
}
function setToken(token: string) {
  localStorage.setItem('token', token)
}
function clearToken() {
  localStorage.removeItem('token')
}

export { getToken, setToken, clearToken }
export default instance
