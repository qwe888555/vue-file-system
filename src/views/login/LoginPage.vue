<script setup lang="ts">
// ── 独立登录页 ──
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import logodark from '@/assets/images/logo.jpg'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const errorMsg = ref('')
const formRef = ref()
const form = reactive({ username: '', password: '' })

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

// JWT 账号密码登录
async function handleLogin() {
  if (!formRef.value || loading.value) return
  try { await formRef.value.validate() } catch { return }

  loading.value = true
  errorMsg.value = ''
  try {
    const res = await userStore.login(form)
    ElMessage.success(`登录成功，欢迎 ${res.user?.role === 'admin' ? '普通管理员' : (res.user?.role_display ?? '用户')}`)
    const role = res.user?.role
    router.push(role === 'super_admin' || role === 'admin' ? '/knowledge/list' : '/chat')
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.detail || e?.message || '登录失败'
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <button class="login-close" @click="router.push('/')">✕</button>
      <img :src="logodark" alt="成都东软学院" class="login-logo" />
      <h2 class="login-title">NISU-CD 资源系统</h2>
      <p class="login-desc">请输入账号密码登录</p>

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

    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f0f2f5;
}

.login-card {
  position: relative;
  width: 420px;
  padding: 40px 40px 32px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  text-align: center;
  animation: card-in 0.3s ease;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.login-close {
  position: absolute;
  top: 14px;
  right: 14px;
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

.login-close:hover {
  background: #e4e7ed;
  color: #1a2332;
}

.login-logo {
  height: 48px;
  width: auto;

  border-radius: 6px;
  display: block;
  margin: 20px auto;
}

.login-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a2332;
  margin: 6px 0 6px;
}

.login-desc {
  font-size: 14px;
  color: #8e95a6;
  margin: 0 0 24px;
}

.login-error {
  color: #f56c6c;
  font-size: 13px;
  margin: -8px 0 16px;
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

:deep(.el-form-item) {
  margin-bottom: 20px;
}
</style>
