<script setup lang="ts">
import { ref } from 'vue'
import { ElForm, ElInput } from 'element-plus'

defineProps<{
  loading: boolean
  errorMsg: string
  ssoLoading: boolean
}>()

const emit = defineEmits<{
  login: [username: string, password: string]
  ssoLogin: []
}>()

const formRef = ref()
const form = ref({ username: '', password: '' })

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

function handleLogin() {
  formRef.value?.validate((valid: boolean) => {
    if (valid) emit('login', form.value.username, form.value.password)
  })
}
</script>

<template>
  <div class="login-brand">
    <h2 class="login-title">NeuHub</h2>
    <p class="login-sub">资源系统 · 账号登录</p>
  </div>

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

  <div class="sso-divider">
    <span class="sso-line" />
    <span class="sso-txt">或</span>
    <span class="sso-line" />
  </div>
  <button class="sso-btn" :disabled="ssoLoading" @click="emit('ssoLogin')">
    <svg class="sso-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 10-16 0" />
    </svg>
    <span>{{ ssoLoading ? '跳转中...' : '统一身份认证登录' }}</span>
  </button>
</template>

<style scoped>
/* ── 品牌 ── */
.login-brand { text-align: center; margin-bottom: 32px; }
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

/* Element Plus 输入框 */
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
