<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

const pwd = ref<HTMLInputElement | null>(null)
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await userStore.login({ username: username.value, password: password.value })
    // 登录接口可能未返回完整用户信息，补取
    if (!userStore.role) {
      try { await userStore.getUserInfo() } catch {}
    }
    localStorage.removeItem('chat_conversations_cache')
    ElMessage.success('登录成功')
    router.push('/mobile/chat')
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.detail || e?.message || '登录失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/mobile/chat')
}
</script>

<template>
  <div class="m-login-page">
    <div class="m-login-bg">
      <div class="m-login-blob" />
      <div class="m-login-blob m-login-blob-2" />
    </div>
    <div class="m-login-content">
      <div class="m-login-icon-wrap">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
      <h1 class="m-login-title">欢迎回来</h1>
      <p class="m-login-desc">登录后可查看历史对话记录</p>

      <div class="m-login-form">
        <div class="m-input-wrap">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" class="m-input-icon"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
          <input v-model="username" type="text" placeholder="账号" class="m-input" @keyup.enter="pwd?.focus()" />
        </div>
        <div class="m-input-wrap">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" class="m-input-icon"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm0-9a1 1 0 011 1v3a1 1 0 01-2 0V8a1 1 0 011-1z"/></svg>
          <input ref="pwd" v-model="password" type="password" placeholder="密码" class="m-input" @keyup.enter="handleLogin" />
        </div>
        <p v-if="errorMsg" class="m-login-error">{{ errorMsg }}</p>
        <button class="m-login-btn" :disabled="loading" @click="handleLogin">
          <span v-if="loading" class="m-login-loading" />
          <span v-else>登 录</span>
        </button>
        <button class="m-login-back" @click="goBack">返回首页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.m-login-page {
  min-height: 100vh; background: #fff;
  display: flex; flex-direction: column; position: relative; overflow: hidden;
}
/* 背景光晕 */
.m-login-bg { position: fixed; inset: 0; pointer-events: none; }
.m-login-blob {
  position: absolute; width: 300px; height: 300px; border-radius: 50%;
  background: rgba(64,158,255,0.08); filter: blur(60px);
  top: -80px; right: -60px;
}
.m-login-blob-2 {
  width: 200px; height: 200px;
  background: rgba(64,158,255,0.06); filter: blur(50px);
  bottom: -40px; left: -40px; top: auto; right: auto;
}

.m-login-content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center;
  padding: 80px 32px 40px;
}
.m-login-icon-wrap {
  width: 64px; height: 64px; border-radius: 20px;
  background: linear-gradient(135deg, #409eff, #1e3a8a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px; box-shadow: 0 4px 20px rgba(64,158,255,0.3);
}
.m-login-title { font-size: 24px; font-weight: 700; color: #1f1f1f; margin: 0 0 6px; }
.m-login-desc { font-size: 14px; color: #8e8e93; margin: 0 0 40px; }

.m-login-form { width: 100%; max-width: 320px; }
.m-input-wrap {
  display: flex; align-items: center; gap: 10px;
  padding: 0 14px; height: 50px;
  border: 1.5px solid #e8ecf0; border-radius: 14px;
  margin-bottom: 14px; transition: border-color 0.2s, box-shadow 0.2s;
}
.m-input-wrap:focus-within {
  border-color: #409eff; box-shadow: 0 0 0 3px rgba(64,158,255,0.1);
}
.m-input-icon { color: #b0b8c0; flex-shrink: 0; }
.m-input-wrap:focus-within .m-input-icon { color: #409eff; }
.m-input {
  flex: 1; border: none; background: none; outline: none;
  font-size: 15px; color: #1f1f1f; height: 100%;
}
.m-input::placeholder { color: #b0b8c0; }
.m-login-error { font-size: 13px; color: #f56c6c; margin: -8px 0 16px; text-align: center; }
.m-login-btn {
  width: 100%; height: 50px; border-radius: 14px;
  border: none; background: linear-gradient(135deg, #409eff, #1e3a8a);
  color: #fff; font-size: 16px; font-weight: 600; cursor: pointer;
  transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;
}
.m-login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.m-login-loading {
  width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.m-login-back {
  width: 100%; text-align: center;
  background: none; border: none; font-size: 14px; color: #8e8e93;
  cursor: pointer; padding: 16px 0; margin-top: 4px;
}
</style>
