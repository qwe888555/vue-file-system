<script setup lang="ts">
// ── 登录页 ──
// 白色 + 蓝色(#409EFF) + 灰色(#909399)

import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'

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
      <div class="login-logo">Logo</div>
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
  background: linear-gradient(135deg, #409eff 0%, #7c3aed 100%);
}

.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  text-align: center;
}

.login-logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background: #f0f5ff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

.login-title {
  font-size: 22px;
  color: #303133;
  margin: 0 0 8px;
}

.login-desc {
  font-size: 14px;
  color: #909399;
  margin: 0 0 32px;
}

.login-btn {
  width: 100%;
}
</style>
