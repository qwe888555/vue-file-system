<script setup lang="ts">
// ── 登录弹窗组件 ──
import { ref } from 'vue'
import { useUserStore } from '@/store/user'

const emit = defineEmits<{
  success: []
  cancel: []
}>()

const userStore = useUserStore()
const loginForm = ref({ username: '', password: '' })
const loginError = ref('')
const loginLoading = ref(false)

async function handleSubmit() {
  const { username, password } = loginForm.value
  if (!username || !password) {
    loginError.value = '请输入用户名和密码'
    return
  }
  loginLoading.value = true
  loginError.value = ''
  try {
    await userStore.login({ username, password })
    loginForm.value = { username: '', password: '' }
    loginError.value = ''
    emit('success')
  } catch (e: unknown) {
    loginError.value = (e as { message?: string })?.message || '登录失败，请检查用户名和密码'
  } finally {
    loginLoading.value = false
  }
}

function handleCancel() {
  loginForm.value = { username: '', password: '' }
  loginError.value = ''
  emit('cancel')
}
</script>

<template>
  <Transition name="panel">
    <div class="login-overlay" @click.self="handleCancel">
      <div class="login-dialog">
        <div class="login-dialog-header">
          <h3 class="login-dialog-title">登录</h3>
          <button class="dialog-close" @click="handleCancel">×</button>
        </div>
        <div class="login-dialog-body">
          <div class="login-field">
            <label>用户名</label>
            <input v-model="loginForm.username" type="text" placeholder="请输入用户名" />
          </div>
          <div class="login-field">
            <label>密码</label>
            <input v-model="loginForm.password" type="password" placeholder="请输入密码" @keyup.enter="handleSubmit" />
          </div>
          <p v-if="loginError" class="login-error">{{ loginError }}</p>
          <button class="login-submit-btn" :disabled="loginLoading" @click="handleSubmit">
            {{ loginLoading ? '登录中…' : '登 录' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.login-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 500; backdrop-filter: blur(2px);
}
.login-dialog {
  width: 380px; background: #fff;
  border-radius: var(--radius-xl, 12px);
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
  overflow: hidden; animation: dialogIn 0.25s ease;
}
@keyframes dialogIn {
  from { opacity: 0; transform: scale(0.92) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.login-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--spacing-lg, 16px) var(--spacing-xl, 24px);
  border-bottom: 1px solid var(--color-border, #e4e7ed);
}
.login-dialog-title {
  margin: 0; font-size: var(--font-size-lg, 16px);
  font-weight: 700; color: var(--color-text, #303133);
}
.dialog-close {
  background: transparent; border: none;
  color: var(--color-text-secondary, #909399);
  font-size: 20px; cursor: pointer;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; transition: all 0.2s ease;
}
.dialog-close:hover {
  background: var(--color-bg, #f5f7fa);
  color: var(--color-text, #303133);
}
.login-dialog-body {
  padding: var(--spacing-xl, 24px);
  display: flex; flex-direction: column; gap: var(--spacing-lg, 16px);
}
.login-field {
  display: flex; flex-direction: column; gap: var(--spacing-xs, 4px);
}
.login-field label {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600; color: var(--color-text-secondary, #606266);
}
.login-field input {
  height: 40px; padding: 0 var(--spacing-md, 12px);
  border: 1px solid var(--color-border, #e4e7ed);
  border-radius: var(--radius-base, 6px);
  font-size: var(--font-size-base, 14px); outline: none;
  transition: border-color 0.2s ease;
}
.login-field input:focus {
  border-color: var(--color-primary, #409eff);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
}
.login-error {
  margin: 0; font-size: var(--font-size-sm, 13px);
  color: var(--color-danger, #f56c6c);
  padding: var(--spacing-sm, 8px);
  background: rgba(245, 108, 108, 0.08);
  border-radius: var(--radius-sm, 4px);
}
.login-submit-btn {
  height: 42px; border: none;
  border-radius: var(--radius-base, 6px);
  background: var(--color-primary, #409eff); color: #fff;
  font-size: var(--font-size-base, 14px); font-weight: 600;
  cursor: pointer; transition: all 0.2s ease; letter-spacing: 4px;
}
.login-submit-btn:hover:not(:disabled) { background: var(--color-primary-dark, #3a8ee6); }
.login-submit-btn:disabled { background: var(--color-border, #e4e7ed); cursor: not-allowed; }
</style>
