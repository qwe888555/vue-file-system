<script setup lang="ts">
// ── 钉钉扫码回调页 ──
// 钉钉扫码确认后重定向到此页，URL 上带 ?code=xxx
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { dingtalkCallbackApi } from '@/api/auth'
import { setAccessToken, setRefreshToken } from '@/api/request'
import { useUserStore } from '@/store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  const authCode = route.query.code as string | undefined
  if (!authCode) {
    errorMsg.value = '缺少授权码'
    loading.value = false
    return
  }

  try {
    const res = await dingtalkCallbackApi(authCode)
    setAccessToken(res.access)
    setRefreshToken(res.refresh)
    userStore.token = res.access
    userStore.refreshToken = res.refresh
    userStore.userInfo = res.user
    ElMessage.success(`登录成功，欢迎 ${res.user?.role_display ?? '用户'}`)
    const role = res.user?.role
    router.replace(role === 'super_admin' || role === 'admin' || role === 'college_admin' || role === 'dept_admin' ? '/knowledge/list' : '/chat')
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.detail || '钉钉登录失败，请重新扫码'
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-[100dvh] flex items-center justify-center bg-[#f8fafc]">
    <div class="text-center">
      <div v-if="loading" class="space-y-4">
        <svg class="w-10 h-10 mx-auto text-[#2563eb] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="text-[#475569] text-sm">钉钉登录中...</p>
      </div>
      <div v-else class="space-y-4">
        <p class="text-[#ef4444] text-sm">{{ errorMsg }}</p>
        <button class="px-6 py-2 rounded-lg bg-[#2563eb] text-white text-sm font-medium" @click="router.push('/login')">返回登录</button>
      </div>
    </div>
  </div>
</template>
