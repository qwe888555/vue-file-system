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
