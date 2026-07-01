// ── 用户状态管理 ──
// 职责：维护登录态、用户信息、角色、Token
// 注意：不处理路由跳转，不处理菜单权限
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, UserRole, LoginParams } from '@/types'
import { loginApi, getUserInfoApi, logoutApi } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  // ── State ──
  const token = ref<string>('')
  const userInfo = ref<UserInfo | null>(null)

  // ── Computed ──
  const isLoggedIn = computed(() => !!token.value)
  const role = computed<UserRole | null>(() => userInfo.value?.role ?? null)
  const username = computed(() => userInfo.value?.realName ?? userInfo.value?.username ?? '')
  const avatar = computed(() => userInfo.value?.avatar ?? '')

  // ── Actions ──
  /** 账号密码登录 */
  async function login(params: LoginParams) {
    const res = await loginApi(params)
    token.value = res.token
    userInfo.value = res.user
    // Token 持久化（示例用 cookie，可按需替换为 localStorage）
    // ...
    return res
  }

  /** 获取当前用户信息 */
  async function getUserInfo() {
    const res = await getUserInfoApi()
    userInfo.value = res
    return res
  }

  /** 登出：清空状态 + 调后端登出接口 */
  async function logout() {
    try {
      await logoutApi()
    } finally {
      token.value = ''
      userInfo.value = null
      // 清除持久化 Token
    }
  }

  /** 修改密码后调用：清 Token 强制重新登录 */
  function clearToken() {
    token.value = ''
    // 清除持久化 Token
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    role,
    username,
    avatar,
    login,
    getUserInfo,
    logout,
    clearToken,
  }
})
