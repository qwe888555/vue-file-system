import { useUserStore } from '@/store/user'
import { useDevice } from './useDevice'

export function usePermission() {
  // 不要在这里 const userStore = useUserStore()
  const device = useDevice()

  // 判断是否管理员
  const isAdmin = () => {
    const userStore = useUserStore()
    return userStore.role === 'admin'
  }
  // 是否为普通用户
  const isUser = () => {
    const userStore = useUserStore()
    return userStore.role === 'user'
  }
  // 校验是否允许访问上传功能
  const canUpload = () => {
    return isAdmin() && !device.isMobile()
  }

  return {
    isAdmin,
    isUser,
    canUpload,
  }
}
