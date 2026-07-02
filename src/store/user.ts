// ── 用户状态管理 ──
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, UserRole, LoginParams } from '@/types'
import { loginApi, getUserInfoApi } from '@/api/auth'
import { setAccessToken, setRefreshToken, clearToken, getAccessToken, getRefreshToken } from '@/api/request'

export const useUserStore = defineStore('user', () => {
  // ── State ──
  const token = ref<string>(getAccessToken())
  const refreshToken = ref<string>(getRefreshToken())
  const userInfo = ref<UserInfo | null>(null)

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
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    clearToken()
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
