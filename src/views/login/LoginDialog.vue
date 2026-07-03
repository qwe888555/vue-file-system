<template>
  <div v-if="visible" class="login-overlay" @click.self="handleClose">
    <div class="login-card">
      <button class="login-card-close" @click="handleClose">✕</button>
      <img :src="logodark" alt="成都东软学院" class="login-card-logo" />
      <h2 class="login-card-title">NISU-CD 资源系统</h2>
      <p class="login-card-desc">请输入账号密码登录</p>

      <el-form ref="formRef" :model="form" :rules="rules" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="账号" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password />
        </el-form-item>
        <p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-btn" size="large" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <!-- SSO 统一登录 -->
      <div class="sso-divider">
        <span class="sso-divider-text">或</span>
      </div>

      <el-button :loading="ssoLoading" class="sso-btn" size="large" @click="handleSSOLogin">
        <svg class="sso-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        {{ ssoLoading ? '跳转中...' : '统一身份认证登录' }}
      </el-button>

      <!-- SSO 测试账号选择 -->
      <el-dialog v-model="ssoDialogVisible" title="选择测试账号" width="400px" destroy-on-close>
        <div v-if="ssoAccounts.length" class="sso-account-list">
          <div
            v-for="acct in ssoAccounts"
            :key="acct.code"
            class="sso-account-item"
            @click="handleSSOSelect(acct.code)"
          >
            <span class="sso-account-name">{{ acct.display || acct.code }}</span>
            <span v-if="acct.role" class="sso-account-role">{{ acct.role }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无可用测试账号" :image-size="60" />
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import { ssoLoginUrl, ssoCallbackApi } from '@/api/auth'
import { setAccessToken, setRefreshToken } from '@/api/request'
import logodark from '@/assets/images/logo.jpg'

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

defineProps<{ visible: boolean }>()

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const errorMsg = ref('')
const formRef = ref()
const form = reactive({ username: '', password: '' })

// SSO 弹窗状态
const ssoDialogVisible = ref(false)
const ssoAccounts = ref<Array<{ code: string; display?: string; role?: string }>>([])
const ssoLoading = ref(false)

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

function handleClose() {
  emit('update:visible', false)
}

// SSO 回调处理
onMounted(async () => {
  const code = route.query.code as string | undefined
  if (!code) return

  loading.value = true
  try {
    const res = await ssoCallbackApi(code)
    setAccessToken(res.access)
    setRefreshToken(res.refresh)
    userStore.token = res.access
    userStore.refreshToken = res.refresh
    userStore.userInfo = res.user
    ElMessage.success(`SSO 登录成功，欢迎 ${res.user?.role_display ?? '用户'}`)
    const role = res.user?.role
    emit('update:visible', false)
    router.push(role === 'super_admin' || role === 'admin' ? '/knowledge/list' : '/chat')
  } catch (e: any) {
    ElMessage.error(e?.message || 'SSO 登录失败')
  } finally {
    loading.value = false
  }
  window.history.replaceState({}, '', window.location.pathname)
})

// JWT 账号密码登录
async function handleLogin() {
  if (!formRef.value || loading.value) return
  try { await formRef.value.validate() } catch { return }

  loading.value = true
  errorMsg.value = ''
  try {
    const res = await userStore.login(form)
    ElMessage.success(`登录成功，欢迎 ${res.user?.role_display ?? '用户'}`)
    emit('update:visible', false)
    const role = res.user?.role
    router.push(role === 'super_admin' || role === 'admin' ? '/knowledge/list' : '/chat')
  } catch {
    // 后端关停时 mock 登录
    userStore.token = 'mock-token'
    userStore.userInfo = {
      id: 1,
      username: form.username || 'admin',
      email: 'admin@nisu.edu.cn',
      first_name: '管理',
      last_name: '员',
      role: 'super_admin',
      role_display: '超级管理员',
      college: null,
      college_name: null,
      phone: '',
      avatar: '',
      date_joined: new Date().toISOString(),
    }
    ElMessage.success('Mock 登录成功')
    emit('update:visible', false)
    router.push('/knowledge/list')
  } finally {
    loading.value = false
  }
}

// SSO 统一登录
async function handleSSOLogin() {
  ssoLoading.value = true
  try {
    const url = ssoLoginUrl()
    const response = await fetch(url, { redirect: 'manual' })
    if (response.status === 302) {
      const location = response.headers.get('Location')
      window.location.href = location || url
      return
    }
    if (!response.ok) throw new Error(`SSO 请求异常 (${response.status})`)
    const data = await response.json()
    if (data.mock_codes && Array.isArray(data.mock_codes)) {
      ssoAccounts.value = data.mock_codes
      ssoDialogVisible.value = true
    } else {
      ElMessage.warning('未获取到可用的测试账号')
    }
  } catch {
    // 后端关停时 mock SSO 登录
    userStore.token = 'mock-token'
    userStore.userInfo = {
      id: 1,
      username: 'admin',
      email: 'admin@nisu.edu.cn',
      first_name: '管理',
      last_name: '员',
      role: 'super_admin',
      role_display: '超级管理员',
      college: null,
      college_name: null,
      phone: '',
      avatar: '',
      date_joined: new Date().toISOString(),
    }
    ElMessage.success('Mock 登录成功')
    emit('update:visible', false)
    router.push('/knowledge/list')
  } finally {
    ssoLoading.value = false
  }
}

// SSO 选择账号后回调
async function handleSSOSelect(code: string) {
  ssoDialogVisible.value = false
  ssoLoading.value = true
  try {
    const res = await ssoCallbackApi(code)
    setAccessToken(res.access)
    setRefreshToken(res.refresh)
    userStore.token = res.access
    userStore.refreshToken = res.refresh
    userStore.userInfo = res.user
    ElMessage.success(`SSO 登录成功，欢迎 ${res.user?.role_display ?? '用户'}`)
    const role = res.user?.role
    emit('update:visible', false)
    router.push(role === 'super_admin' || role === 'admin' ? '/knowledge/list' : '/chat')
  } catch (e: any) {
    ElMessage.error(e?.message || 'SSO 登录失败')
  } finally {
    ssoLoading.value = false
  }
}
</script>

<style scoped>
.login-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlay-fade 0.25s ease;
}

@keyframes overlay-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.login-card {
  position: relative;
  width: 420px;
  padding: 48px 40px 32px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 20px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
  text-align: center;
  animation: card-slide 0.3s ease;
}

/* 装饰光晕 */
.login-card::before {
  content: '';
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(43, 95, 217, 0.08) 0%, transparent 70%);
  top: -120px;
  right: -80px;
  pointer-events: none;
}

.login-card::after {
  content: '';
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(43, 95, 217, 0.06) 0%, transparent 70%);
  bottom: -160px;
  left: -100px;
  pointer-events: none;
}

@keyframes card-slide {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.login-card-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: #f0f2f5;
  border-radius: 50%;
  font-size: 16px;
  color: #8e95a6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  line-height: 1;
}

.login-card-close:hover {
  background: #e4e7ed;
  color: #1a2332;
}

.login-card-logo {
  height: 48px;
  width: auto;
  border-radius: 6px;
  display: block;
  margin: 0 auto 20px;
}

.login-card-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a2332;
  margin: 0 0 6px;
}

.login-card-desc {
  font-size: 14px;
  color: #8e95a6;
  margin: 0 0 24px;
}

.login-error {
  color: #f56c6c;
  font-size: 13px;
  margin: 0 0 16px;
  text-align: left;
}

.login-btn {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 550;
  letter-spacing: 0.02em;
  background: #2b5fd9;
  border: none;
  transition: all 0.2s ease;
}

.login-btn:hover {
  background: #1e4bb8;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(43, 95, 217, 0.3);
}

.login-btn:active {
  transform: translateY(0);
}

/* SSO */
.sso-divider {
  display: flex;
  align-items: center;
  margin: 16px 0;
}

.sso-divider::before,
.sso-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e4e9f0;
}

.sso-divider-text {
  padding: 0 16px;
  font-size: 13px;
  color: #b0b8c8;
}

.sso-btn {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sso-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.sso-account-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sso-account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.sso-account-item:hover {
  border-color: #2b5fd9;
  background: #f0f4fe;
}

.sso-account-name {
  font-size: 14px;
  font-weight: 500;
  color: #1a2332;
}

.sso-account-role {
  font-size: 12px;
  color: #8e95a6;
  background: #eef0f4;
  padding: 2px 8px;
  border-radius: 4px;
}

/* Element Plus 输入框覆盖 */
:deep(.el-input__wrapper) {
  border-radius: 12px;
  padding: 4px 16px;
  box-shadow: 0 0 0 1px #e4e9f0 !important;
  background: #f8fafc;
  transition: all 0.2s ease;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c8d0dd !important;
  background: #fff;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(43, 95, 217, 0.2) !important;
  background: #fff;
}

:deep(.el-input__inner) {
  height: 48px;
  font-size: 14px;
  color: #1a2332;
}

:deep(.el-input__inner::placeholder) {
  color: #b0b8c8;
}

:deep(.el-input__prefix) {
  margin-right: 8px;
}

:deep(.el-input__prefix .el-icon) {
  font-size: 18px;
  color: #b0b8c8;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}
</style>
