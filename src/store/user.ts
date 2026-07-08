// ── 用户状态管理 ──
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, UserRole, LoginParams } from '@/types'
import { loginApi, getUserInfoApi, logoutApi } from '@/api/auth'
import { setAccessToken, setRefreshToken, clearToken, getAccessToken, getRefreshToken } from '@/api/request'

export const useUserStore = defineStore('user', () => {
  // ── State ──
  const token = ref<string>(getAccessToken())
  const refreshToken = ref<string>(getRefreshToken())
  function loadUser(): UserInfo | null {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  }
  const userInfo = ref<UserInfo | null>(loadUser())

  // ── Computed ──
  const isLoggedIn = computed(() => !!token.value)
  const role = computed<UserRole | null>(() => userInfo.value?.role ?? null)
  const displayName = computed(() => {
    if (!userInfo.value) return ''
    const { first_name, last_name, username } = userInfo.value
    return [first_name, last_name].filter(Boolean).join('') || username
  })
  const avatar = computed(() => userInfo.value?.avatar ?? '')

  // ── Actions ──
  async function login(params: LoginParams) {
    const res = await loginApi(params)
    token.value = res.access
    refreshToken.value = res.refresh
    userInfo.value = res.user
    setAccessToken(res.access)
    setRefreshToken(res.refresh)
    return res
  }

  async function getUserInfo() {
    const res = await getUserInfoApi()
    userInfo.value = res
    return res
  }

  function logout() {
    const rt = refreshToken.value
    if (rt) logoutApi(rt).catch(() => {}) // 发后即忘，不等后端
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    clearToken()
    // 清除缓存，避免切换账号后看到上个账号的对话记录
    localStorage.removeItem('chat_conversations_cache')
  }

  function clearTokenOnly() {
    token.value = ''
    refreshToken.value = ''
    clearToken()
  }

  return {
    token,
    refreshToken,
    userInfo,
    isLoggedIn,
    role,
    displayName,
    avatar,
    login,
    getUserInfo,
    logout,
    clearTokenOnly,
  }
})
