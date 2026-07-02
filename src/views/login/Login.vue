<script setup lang="ts">
// ── 登录页 ──
// 白色 + 蓝色(#409EFF) + 灰色(#909399)

import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import logoImg from '@/assets/styles/logo.png'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const form = reactive({ username: '', password: '' })
const formRef = ref()

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }

  loading.value = true
  try {
    // 开发环境 mock 登录
    if (import.meta.env.DEV) {
      userStore.token = 'mock-token'
      userStore.userInfo = {
        id: 1,
        username: form.username,
        realName: '管理员',
        avatar: '',
        email: '',
        role: 'superadmin',
      }
    } else {
      await userStore.login(form)
    }
    ElMessage.success('登录成功')
    router.push('/knowledge/list')
  } catch (e: any) {
    ElMessage.error(e?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <img :src="logoImg" alt="成都东软学院" class="login-logo-img" />
      </div>
      <h2 class="login-title">NISU-CD 资源系统</h2>
      <p class="login-desc">请输入账号密码登录</p>

      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="账号" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-btn" size="large" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #e8edf5 0%, #d5dde8 50%, #e8edf5 100%);
  position: relative;
  overflow: hidden;
}

/* 装饰性背景光晕 */
.login-page::before {
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

.login-page::after {
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

.login-card {
  position: relative;
  width: 420px;
  padding: 48px 40px 40px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
  text-align: center;
  z-index: 1;
}

.login-logo {
  width: 200px;
  height: 56px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-logo-img {
  height: 100%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a2332;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.login-desc {
  font-size: 14px;
  color: #8e95a6;
  margin: 0 0 36px;
  line-height: 1.5;
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

/* 覆盖 Element Plus 输入框样式 */
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

/* 表单项间距 */
:deep(.el-form-item) {
  margin-bottom: 24px;
}
</style>
