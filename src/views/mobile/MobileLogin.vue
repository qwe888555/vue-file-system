<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import logodark from '@/assets/logo.png'

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
    <div class="m-login-scroll">
      <div class="m-login-content">
        <div class="m-login-top">
          <img :src="logodark" alt="成都东软学院" class="m-login-logo" />
          <h1 class="m-login-title">欢迎回来</h1>
          <p class="m-login-desc">登录后使用智能问答服务</p>
        </div>

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
  </div>
</template>

<style scoped>
.m-login-page {
  min-height: 100vh; background: #f8f9fc;
  display: flex; flex-direction: column; position: relative; overflow: hidden;
}
/* 背景光晕 */
.m-login-bg { position: fixed; inset: 0; pointer-events: none; }
.m-login-blob {
  position: absolute; width: 340px; height: 340px; border-radius: 50%;
  background: rgba(64,158,255,0.1); filter: blur(70px);
  top: -120px; left: 50%; transform: translateX(-50%);
}
.m-login-blob-2 {
  width: 260px; height: 260px;
  background: rgba(64,158,255,0.07); filter: blur(60px);
  bottom: -80px; left: 50%; transform: translateX(-50%); top: auto; right: auto;
}

.m-login-scroll {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px; position: relative; z-index: 1;
}

.m-login-content {
  width: 100%; max-width: 360px;
  background: #fff; border-radius: 24px;
  padding: 40px 28px 32px;
  box-shadow: 0 2px 24px rgba(0,0,0,0.06);
}

.m-login-top {
  display: flex; flex-direction: column; align-items: center;
  margin-bottom: 32px;
}
.m-login-logo {
  height: 48px; width: auto; display: block;
  margin-bottom: 20px;
}
.m-login-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0 0 6px; }
.m-login-desc { font-size: 14px; color: #8e8e93; margin: 0; }

.m-login-form { width: 100%; }
.m-input-wrap {
  display: flex; align-items: center; gap: 10px;
  padding: 0 16px; height: 48px;
  border: 2px solid #c8cdd5; border-radius: 12px;
  margin-bottom: 14px; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  background: #fff;
}
.m-input-wrap:focus-within {
  border-color: #409eff; box-shadow: 0 0 0 3px rgba(64,158,255,0.1);
  background: #fff;
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
  width: 100%; height: 48px; border-radius: 12px;
  border: none; background: linear-gradient(135deg, #409eff, #1e3a8a);
  color: #fff; font-size: 16px; font-weight: 600; cursor: pointer;
  transition: opacity 0.2s, transform 0.15s; display: flex; align-items: center; justify-content: center;
}
.m-login-btn:active { transform: scale(0.98); }
.m-login-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.m-login-loading {
  width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.m-login-back {
  width: 100%; text-align: center;
  background: none; border: none; font-size: 14px; color: #8e8e93;
  cursor: pointer; padding: 14px 0 0; margin-top: 2px;
}
</style>
