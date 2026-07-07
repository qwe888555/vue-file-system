<script setup lang="ts">
// ── 独立登录页（JWT + SSO） ──
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import { ssoLoginUrl, ssoCallbackApi } from '@/api/auth'
import { setAccessToken, setRefreshToken } from '@/api/request'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })

const loading = ref(false)
const errorMsg = ref('')
const formRef = ref()
const form = reactive({ username: '', password: '' })

// SSO 状态
const ssoDialogVisible = ref(false)
const ssoAccounts = ref<Array<{ code: string; username?: string; role?: string; description?: string }>>([])
const ssoLoading = ref(false)

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

// SSO 回调处理（?code=xxx）
onMounted(async () => {
  const code = route.query.code as string | undefined
  if (!code) return

  loading.value = true
  try {
    await ssoCallbackApi(code)
    if (!userStore.role) {
      try { await userStore.getUserInfo() } catch {}
    }
    const role = userStore.role
    const welcomeRole = role === 'super_admin' ? '超级管理员' : role === 'admin' || role === 'college_admin' || role === 'dept_admin' ? '普通管理员' : '普通用户'
    ElMessage.success(`登录成功，欢迎 ${welcomeRole}`)
    router.push(role === 'super_admin' || role === 'admin' || role === 'college_admin' || role === 'dept_admin' ? '/knowledge/list' : '/chat')
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
    await userStore.login(form)
    if (!userStore.role) {
      try { await userStore.getUserInfo() } catch {}
    }
    const role = userStore.role
    const welcomeRole = role === 'super_admin' ? '超级管理员' : role === 'admin' || role === 'college_admin' || role === 'dept_admin' ? '普通管理员' : '普通用户'
    ElMessage.success(`登录成功，欢迎 ${welcomeRole}`)
    router.push(role === 'super_admin' || role === 'admin' || role === 'college_admin' || role === 'dept_admin' ? '/knowledge/list' : '/chat')
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.detail || e?.message || '登录失败，请检查账号密码'
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
      window.location.href = response.headers.get('Location') || url
      return
    }
    if (response.ok) {
      const data = await response.json()
      if (data.mock_codes && Array.isArray(data.mock_codes)) {
        ssoAccounts.value = data.mock_codes
        ssoDialogVisible.value = true
        return
      }
    }
  } catch { /* 忽略 */ }
  // 后端不可用或未返回 mock_codes 时使用默认测试账号
  ssoAccounts.value = [
    { code: 'mock_college_admin', username: 'sso_college_admin', role: 'college_admin', description: '学院SSO管理员' },
    { code: 'mock_dept_admin', username: 'sso_dept_admin', role: 'dept_admin', description: '部门SSO管理员' },
  ]
  ssoDialogVisible.value = true
  ssoLoading.value = false
}

// SSO 选择测试账号
async function handleSSOSelect(code: string) {
  ssoDialogVisible.value = false
  ssoLoading.value = true
  try {
    const ssoRes = await ssoCallbackApi(code)
    setAccessToken(ssoRes.access)
    setRefreshToken(ssoRes.refresh)
    userStore.token = ssoRes.access
    userStore.refreshToken = ssoRes.refresh
    userStore.userInfo = ssoRes.user
    if (!userStore.role) {
      try { await userStore.getUserInfo() } catch {}
    }
    const role = userStore.role
    const welcomeRole = role === 'super_admin' ? '超级管理员' : role === 'admin' || role === 'college_admin' || role === 'dept_admin' ? '普通管理员' : '普通用户'
    ElMessage.success(`登录成功，欢迎 ${welcomeRole}`)
    router.push(role === 'super_admin' || role === 'admin' || role === 'college_admin' || role === 'dept_admin' ? '/knowledge/list' : '/chat')
  } catch {
    ElMessage.error('SSO 登录失败')
  } finally {
    ssoLoading.value = false
  }
}
</script>

<template>
  <div :class="['login-page', { 'login-page--embedded': embedded }]">
    <div class="login-card-w">
      <button v-if="!embedded" class="login-close" @click="router.push('/')">✕</button>

      <!-- 品牌 -->
      <div class="login-brand">
        <div class="brand-icon-box">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#2563eb" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>
        <h2 class="login-title">NISU-CD</h2>
        <p class="login-sub">资源系统 · 账号登录</p>
      </div>

      <!-- 表单 -->
      <el-form ref="formRef" :model="form" :rules="rules" @keyup.enter="handleLogin" class="login-form">
        <div class="field-grp">
          <label class="field-lbl">账号</label>
          <el-input v-model="form.username" placeholder="请输入工号或学号" size="large" />
        </div>
        <div class="field-grp">
          <label class="field-lbl">密码</label>
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password />
        </div>
        <p v-if="errorMsg" class="err-msg">{{ errorMsg }}</p>
        <button class="login-btn" :disabled="loading" @click="handleLogin">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </el-form>

      <!-- SSO -->
      <div class="sso-divider">
        <span class="sso-line" />
        <span class="sso-txt">或</span>
        <span class="sso-line" />
      </div>
      <button class="sso-btn" :disabled="ssoLoading" @click="handleSSOLogin">
        <svg class="sso-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 10-16 0" />
        </svg>
        <span>{{ ssoLoading ? '跳转中...' : '统一身份认证登录' }}</span>
      </button>

      <!-- SSO 弹窗 -->
      <el-dialog v-model="ssoDialogVisible" title="选择测试账号" width="400px" destroy-on-close>
        <div v-if="ssoAccounts.length" class="sso-accts">
          <div v-for="acct in ssoAccounts" :key="acct.code" class="sso-acct" @click="handleSSOSelect(acct.code)">
            <span class="sso-acct-name">{{ acct.username || acct.code }}</span>
            <span class="sso-acct-role">{{ acct.description || acct.role }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无可用测试账号" :image-size="60" />
      </el-dialog>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex; align-items: center; justify-content: center;
  height: 100vh; background: #f8fafc;
}
.login-page--embedded { height: auto; background: transparent; }

.login-card-w { width: 100%; }
.login-close {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  width: 30px; height: 30px; border: none; border-radius: 50%;
  background: #f1f5f9; color: #64748b; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; transition: all 0.2s;
}
.login-close:hover { background: #e2e8f0; color: #0f172a; }

/* 品牌 */
.login-brand { text-align: center; margin-bottom: 28px; }
.brand-icon-box {
  width: 46px; height: 46px; margin: 0 auto 12px;
  background: rgba(37,99,235,0.07); border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
}
.login-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
.login-sub { font-size: 13px; color: #64748b; margin: 0; }

/* 表单 */
.login-form { display: flex; flex-direction: column; gap: 18px; }
.field-grp { display: flex; flex-direction: column; gap: 5px; }
.field-lbl { font-size: 13px; font-weight: 600; color: #0f172a; }
.err-msg { color: #ef4444; font-size: 13px; margin: 0; padding: 6px 10px; background: #fef2f2; border-radius: 8px; }

.login-btn {
  width: 100%; height: 44px; border: none; border-radius: 10px;
  font-size: 15px; font-weight: 600;
  background: #2563eb; color: #fff; cursor: pointer;
  transition: all 0.2s;
}
.login-btn:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.25); }
.login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* SSO */
.sso-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
.sso-line { flex: 1; height: 1px; background: #e2e8f0; }
.sso-txt { font-size: 13px; color: #94a3b8; white-space: nowrap; }

.sso-btn {
  width: 100%; height: 42px; border: 1px solid #e2e8f0; border-radius: 10px;
  background: #fff; color: #475569; font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.2s;
}
.sso-btn:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; background: #f8faff; }
.sso-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sso-icon { width: 18px; height: 18px; flex-shrink: 0; }

/* SSO 弹窗 */
.sso-accts { display: flex; flex-direction: column; gap: 8px; }
.sso-acct {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-radius: 10px; background: #f8fafc;
  cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.sso-acct:hover { border-color: #2563eb; background: #f0f4fe; }
.sso-acct-name { font-size: 14px; font-weight: 500; color: #0f172a; }
.sso-acct-role { font-size: 12px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }

/* Element Plus 覆盖 */
:deep(.el-input__wrapper) {
  border-radius: 10px; padding: 2px 14px;
  box-shadow: 0 0 0 1px #e2e8f0 !important;
  background: #fff; transition: all 0.2s;
}
:deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px #cbd5e1 !important; }
:deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 2px rgba(37,99,235,0.15) !important; }
:deep(.el-input__inner) { height: 42px; font-size: 14px; color: #0f172a; }
:deep(.el-input__inner::placeholder) { color: #94a3b8; }
:deep(.el-form-item) { margin-bottom: 0; }
:deep(.el-form-item__error) { padding-top: 4px; font-size: 12px; }
</style>
