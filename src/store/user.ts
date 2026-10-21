// ── 用户状态管理 ──
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, UserRole, LoginParams } from '@/types'
import { loginApi, getUserInfoApi, getAdminMeApi, logoutApi } from '@/api/auth'
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
    try {
      const res = await loginApi(params)
      token.value = res.access
      refreshToken.value = res.refresh
      userInfo.value = res.user
      setAccessToken(res.access)
      setRefreshToken(res.refresh)
      return res
    } catch (error) {
      console.error('[user store] login failed:', error)
      throw error
    }
  }

  async function getUserInfo() {
    try {
      // /auth/me/ 提供姓名、邮箱、手机、头像等个人资料；
      // /admin/me/ 提供 college_id、department_id 和 permissions，两者字段互补，必须合并。
      // /admin/me/ 失败时退回资料接口，不阻断登录和角色判断。
      const [profile, adminMe] = await Promise.all([
        getUserInfoApi(),
        getAdminMeApi().catch(() => null),
      ])
      userInfo.value = { ...profile, ...(adminMe ?? {}) }
      return userInfo.value
    } catch (error) {
      console.error('[user store] getUserInfo failed:', error)
      return null
    }
  }

  function logout() {
    const rt = refreshToken.value
    if (rt) logoutApi(rt).catch(() => {}) // 发后即忘，不等后端
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    clearToken()
    // 清除缓存，避免切换账号后看到上个账号的对话记录
    // useChat 实际用 sessionStorage 存储（CACHE_KEY 相同），两者都需清理
    localStorage.removeItem('chat_conversations_cache')
    sessionStorage.removeItem('chat_conversations_cache')
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
