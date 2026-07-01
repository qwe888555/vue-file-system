import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    role: localStorage.getItem('role') || 'user' // 默认普通用户
  }),
  actions: {
    // 登录存储信息
    setUserInfo(token, role) {
      this.token = token
      this.role = role
      localStorage.setItem('token', token)
      localStorage.setItem('role', role)
    },
    // 退出登录清空
    logout() {
      this.token = ''
      this.role = 'user'
      localStorage.removeItem('token')
      localStorage.removeItem('role')
    }
  }
})