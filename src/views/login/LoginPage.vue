<script setup lang="ts">
// ── 独立登录页（JWT + SSO） ──
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import { ssoLoginUrl, ssoCallbackApi, dingtalkQrApi } from '@/api/auth'
import { setAccessToken, setRefreshToken } from '@/api/request'
import request from '@/api/request'
import QRCode from 'qrcode'
import AccountLoginForm from '@/components/login/AccountLoginForm.vue'
import DingTalkQRLogin from '@/components/login/DingTalkQRLogin.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })

const loading = ref(false)
const errorMsg = ref('')
const loginMode = ref<'account' | 'qrcode'>('account')
const qrCodeDataUrl = ref('')
const qrLoading = ref(false)
const qrError = ref('')
const loginSuccess = ref(false)

// 钉钉扫码登录（v6.0 轮询方案）
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadDingTalkQr() {
  qrLoading.value = true
  qrError.value = ''
  qrCodeDataUrl.value = ''
  loginSuccess.value = false
  try {
    const redirectUri = 'https://visibly-sloppy-dairy.ngrok-free.dev/api/auth/dingtalk/redirect/'
    const res = await dingtalkQrApi(redirectUri)
    if (!res.auth_url) throw new Error('后端返回异常，请确认 Django 服务已启动')

    // 后端 /qr/ 接口直接返回 state，用于轮询（钉钉回调带同一个 state）
    const state = res.state || new URL(res.auth_url).searchParams.get('state')
    if (!state) throw new Error('获取 state 失败')
    const qrData = await QRCode.toDataURL(res.auth_url, { width: 240, margin: 1, color: { dark: '#1e293b', light: '#f8fafc' } })
      .catch(() => QRCode.toString(res.auth_url, { type: 'svg', width: 240 }))
      .catch(() => null)
    if (!qrData) throw new Error('二维码生成失败')
    qrCodeDataUrl.value = qrData.startsWith('data:') ? qrData : 'data:image/svg+xml,' + encodeURIComponent(qrData)

    // 轮询登录状态（每秒一次，pending=等待扫码，completed=登录成功）
    pollTimer = setInterval(async () => {
      try {
        const statusData: any = await request.get('/auth/dingtalk/status/', { params: { state } })
        if (statusData.status === 'completed') {
          clearInterval(pollTimer); pollTimer = null
          loginSuccess.value = true
          // 存 token 到当前浏览器
          localStorage.setItem('access_token', statusData.access)
          localStorage.setItem('refresh_token', statusData.refresh)
          localStorage.setItem('user', JSON.stringify(statusData.user))
          userStore.token = statusData.access
          userStore.refreshToken = statusData.refresh
          userStore.userInfo = statusData.user
          ElMessage.success('登录成功')
          setTimeout(() => {
            const target = userStore.role?.includes('admin') ? '/knowledge/list' : '/chat'
            if (props.embedded) window.location.href = target
            else router.push(target)
          }, 600)
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.log('status error:', e?.message || e)
      }
    }, 1000)

    // 2 分钟超时停止
    setTimeout(() => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }, 120000)
  } catch (e: any) {
    qrError.value = e?.response?.data?.detail || e?.message || '获取二维码失败'
  } finally {
    qrLoading.value = false
  }
}

watch(loginMode, (val) => {
  if (val === 'qrcode') loadDingTalkQr()
  else if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})

// 页面不可见时暂停轮询，减少无意义的请求
let pollingPaused = false
document.addEventListener('visibilitychange', () => {
  if (pollTimer) {
    if (document.hidden) {
      clearInterval(pollTimer)
      pollTimer = null
      pollingPaused = true
    } else if (pollingPaused && loginMode.value === 'qrcode') {
      pollingPaused = false
      loadDingTalkQr()
    }
  }
})

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

// SSO 状态
const ssoDialogVisible = ref(false)
const ssoAccounts = ref<Array<{ code: string; username?: string; role?: string; description?: string }>>([])
const ssoLoading = ref(false)

// SSO 回调处理（?code=xxx）
onMounted(async () => {
  const code = route.query.code as string | undefined
  if (!code) return

  loading.value = true
  try {
    const ssoRes = await ssoCallbackApi(code)
    setAccessToken(ssoRes.access)
    setRefreshToken(ssoRes.refresh)
    userStore.token = ssoRes.access
    userStore.refreshToken = ssoRes.refresh
    userStore.userInfo = ssoRes.user
    localStorage.setItem('user', JSON.stringify(ssoRes.user))
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
async function handleLogin(username: string, password: string) {
  if (loading.value) return

  loading.value = true
  errorMsg.value = ''
  try {
    await userStore.login({ username, password })
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
        ssoLoading.value = false
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

      <!-- 登录方式切换 -->
      <div class="login-tabs">
        <button class="tab-btn" :class="{ active: loginMode === 'account' }" @click="loginMode = 'account'">账号登录</button>
        <button class="tab-btn" :class="{ active: loginMode === 'qrcode' }" @click="loginMode = 'qrcode'">扫码登录</button>
      </div>

      <!-- 账号密码登录 -->
      <AccountLoginForm
        v-if="loginMode === 'account'"
        :loading="loading"
        :error-msg="errorMsg"
        :sso-loading="ssoLoading"
        @login="handleLogin"
        @sso-login="handleSSOLogin"
      />

      <!-- 钉钉扫码登录 -->
      <DingTalkQRLogin
        v-if="loginMode === 'qrcode'"
        :qr-code-data-url="qrCodeDataUrl"
        :qr-loading="qrLoading"
        :qr-error="qrError"
        :login-success="loginSuccess"
        @refresh="loadDingTalkQr"
      />

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

.login-card-w { width: 100%; padding: 2px 8px; }
.login-close {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  width: 30px; height: 30px; border: none; border-radius: 50%;
  background: #f1f5f9; color: #64748b; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; transition: all 0.2s;
}
.login-close:hover { background: #e2e8f0; color: #0f172a; }

/* ── 嵌入式亮色适配 ── */
.login-page--embedded .login-title { color: #fff; }
.login-page--embedded .login-sub { color: rgba(255,255,255,0.7); }
.login-page--embedded .field-lbl { color: rgba(255,255,255,0.9); font-weight: 700; }
.login-page--embedded .login-tabs { background: rgba(0,0,0,0.06); }
.login-page--embedded .tab-btn { color: rgba(255,255,255,0.5); }
.login-page--embedded .tab-btn.active { background: rgba(255,255,255,0.2); color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.login-page--embedded .tab-btn:hover:not(.active) { color: rgba(255,255,255,0.9); }
.login-page--embedded .sso-divider .sso-line { background: #e2e8f0; }
.login-page--embedded .sso-txt { color: rgba(255,255,255,0.5); }
.login-page--embedded .sso-btn {
  border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);
}
.login-page--embedded .sso-btn:hover:not(:disabled) { border-color: #60a5fa; color: #60a5fa; background: rgba(96,165,250,0.1); }
.login-page--embedded .err-msg { background: rgba(239,68,68,0.12); color: #fca5a5; }

/* Element Plus 输入框 — 半透明玻璃质感 */
.login-page--embedded :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px rgba(255,255,255,0.15) !important;
  background: rgba(255,255,255,0.1) !important;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 4px 16px !important;
}
.login-page--embedded :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px rgba(255,255,255,0.25) !important; }
.login-page--embedded :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 2px rgba(64,158,255,0.2) !important; }
.login-page--embedded :deep(.el-input__inner) { color: #0f172a !important; font-size: 15px !important; height: 46px !important; }
.login-page--embedded :deep(.el-input__inner::placeholder) { color: rgba(255,255,255,0.5) !important; }

/* ── 品牌 ── */
.login-brand { text-align: center; margin-bottom: 32px; }
.brand-icon-box {
  width: 46px; height: 46px; margin: 0 auto 12px;
  background: rgba(37,99,235,0.07); border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
}
.login-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
.login-sub { font-size: 14px; color: #64748b; margin: 0; }

/* ── 表单 ── */
.login-form { display: flex; flex-direction: column; gap: 22px; }
.field-grp { display: flex; flex-direction: column; gap: 6px; }
.field-lbl { font-size: 16px; font-weight: 600; color: #0f172a; }
.err-msg { color: #ef4444; font-size: 14px; margin: 0; padding: 8px 12px; background: #fef2f2; border-radius: 8px; }

.login-btn {
  width: 100%; height: 48px; border: none; border-radius: 10px;
  font-size: 16px; font-weight: 600;
  background: linear-gradient(135deg, #409eff, #3b82f6);
  color: #fff; cursor: pointer;
  transition: all 0.25s;
}
.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59,130,246,0.25);
}
.login-btn:active:not(:disabled) { transform: translateY(0); }
.login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* SSO */
.sso-divider { display: flex; align-items: center; gap: 14px; margin: 22px 0; }
.sso-line { flex: 1; height: 1px; background: #e2e8f0; }
.sso-txt { font-size: 14px; color: #94a3b8; white-space: nowrap; }

.sso-btn {
  width: 100%; height: 46px; border: 1px solid #e2e8f0; border-radius: 10px;
  background: #fff; color: #475569; font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  transition: all 0.2s;
}
.sso-btn:hover:not(:disabled) { border-color: #409eff; color: #409eff; background: #f8faff; }
.sso-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sso-icon { width: 20px; height: 20px; flex-shrink: 0; }

/* ── 登录方式切换 ── */
.login-tabs {
  display: flex; gap: 4px; margin-bottom: 28px;
  background: rgba(255,255,255,0.06); border-radius: 12px; padding: 4px;
}
.tab-btn {
  flex: 1; height: 44px; border: none; border-radius: 9px;
  font-size: 16px; font-weight: 700; cursor: pointer;
  background: transparent; color: rgba(255,255,255,0.35); transition: all 0.25s;
  letter-spacing: 0.02em;
}
.tab-btn.active {
  background: #fff;
  color: #1e293b;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.tab-btn:hover:not(.active) { color: rgba(255,255,255,0.8); }

/* ── 扫码登录 ── */
.qrcode-wrap {
  display: flex; justify-content: center; padding: 16px 0 8px;
}
.qrcode-img {
  width: 220px; height: 220px; border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.12); padding: 8px; background: rgba(255,255,255,0.06);
}
.qrcode-hint {
  text-align: center; font-size: 14px; color: rgba(255,255,255,0.4); margin: 6px 0 0;
}
.qrcode-actions {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.qrcode-refresh {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: rgba(255,255,255,0.35); background: none; border: none;
  cursor: pointer; transition: all 0.2s; padding: 4px 10px; border-radius: 6px;
}
.qrcode-refresh:hover { color: #409eff; background: rgba(64,158,255,0.1); }
.qrcode-refresh svg { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.qrcode-refresh:hover svg { transform: rotate(180deg); }
.qrcode-placeholder {
  width: 220px; height: 220px; border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}

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
:deep(.el-input__inner::placeholder) { color: rgba(255,255,255,0.5); }
:deep(.el-form-item) { margin-bottom: 0; }
:deep(.el-form-item__error) { padding-top: 4px; font-size: 12px; }
</style>
