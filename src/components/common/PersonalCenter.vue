<script setup lang="ts">
// ── 个人中心弹窗：修改密码 + 个人资料 ──
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'
import { changePasswordApi, updateProfileApi, getUserInfoApi } from '@/api/auth'

const emit = defineEmits<{ close: [] }>()
const userStore = useUserStore()

const activeTab = ref<'profile' | 'password'>('profile')
const saving = ref(false)
const errors = reactive({ phone: '', email: '' })

// 个人资料表单
const profileForm = reactive({
  first_name: userStore.userInfo?.first_name || '',
  last_name: userStore.userInfo?.last_name || '',
  email: userStore.userInfo?.email || '',
  phone: userStore.userInfo?.phone || '',
})

// 修改密码表单
const pwdForm = reactive({ old_password: '', new_password: '' })

// 打开时从接口获取最新用户信息
onMounted(async () => {
  try {
    const res = await getUserInfoApi()
    userStore.userInfo = res
    profileForm.first_name = res.first_name || ''
    profileForm.last_name = res.last_name || ''
    profileForm.email = res.email || ''
    profileForm.phone = res.phone || ''
  } catch {
    // 静默，使用已有缓存
  }
})

function validatePhone(val: string) {
  if (!val) { errors.phone = ''; return }
  const cleaned = val.replace(/\D/g, '')
  if (cleaned.length !== 11) { errors.phone = '请输入 11 位手机号码'; return }
  if (!/^1[3-9]\d{9}$/.test(cleaned)) { errors.phone = '手机号格式不正确，请核对号码'; return }
  if (/^(\d)\1{10}$/.test(cleaned)) { errors.phone = '手机号格式不正确，请核对号码'; return }
  errors.phone = ''
}

function onPhoneInput(e: Event) {
  const input = e.target as HTMLInputElement
  const filtered = input.value.replace(/\D/g, '')
  if (filtered !== input.value) {
    input.value = filtered
    profileForm.phone = filtered
  }
}

function validateEmail(val: string) {
  if (!val) { errors.email = ''; return }
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? '' : '邮箱格式不正确'
}

async function handleSaveProfile() {
  validatePhone(profileForm.phone)
  validateEmail(profileForm.email)
  if (errors.phone || errors.email) return
  const phone = profileForm.phone.trim()
  const email = profileForm.email.trim()
  saving.value = true
  try {
    const res = await updateProfileApi({
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
      email,
      phone,
    })
    userStore.userInfo = res
    ElMessage.success('个人资料更新成功')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '更新失败')
  } finally {
    saving.value = false
  }
}

async function handleChangePassword() {
  if (!pwdForm.old_password || !pwdForm.new_password) {
    ElMessage.warning('请填写完整')
    return
  }
  if (pwdForm.new_password.length < 8) {
    ElMessage.warning('新密码至少 8 位')
    return
  }
  saving.value = true
  try {
    await changePasswordApi(pwdForm)
    ElMessage.success('密码修改成功')
    pwdForm.old_password = ''
    pwdForm.new_password = ''
  } catch (e: any) {
    const msg = e?.response?.data?.old_password?.[0] || e?.response?.data?.new_password?.[0] || e?.response?.data?.detail || e?.message || '修改失败'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="pc-overlay" @click.self="emit('close')">
    <div class="pc-card">
      <div class="pc-header">
        <h3>个人中心</h3>
        <button class="pc-close" @click="emit('close')">✕</button>
      </div>

      <!-- 选项卡 -->
      <div class="pc-tabs">
        <button :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">个人资料</button>
        <button :class="{ active: activeTab === 'password' }" @click="activeTab = 'password'">修改密码</button>
      </div>

      <!-- 个人资料 -->
      <div v-if="activeTab === 'profile'" class="pc-form">
        <div class="pc-field">
          <label>账号</label>
          <input :value="userStore.userInfo?.username" disabled class="pc-input" />
        </div>
        <div class="pc-field">
          <label>角色</label>
          <input :value="userStore.userInfo?.role_display || ''" disabled class="pc-input" />
        </div>
        <div class="pc-row">
          <div class="pc-field">
            <label>学院</label>
            <input :value="userStore.userInfo?.college_name || '-'" disabled class="pc-input" />
          </div>
          <div class="pc-field">
            <label>部门</label>
            <input :value="userStore.userInfo?.department_name || '-'" disabled class="pc-input" />
          </div>
        </div>
        <div class="pc-field">
          <label>注册时间</label>
          <input :value="userStore.userInfo?.date_joined?.slice(0, 10) || '-'" disabled class="pc-input" />
        </div>
        <div class="pc-row">
          <div class="pc-field">
            <label>姓</label>
            <input v-model="profileForm.last_name" class="pc-input" placeholder="姓" />
          </div>
          <div class="pc-field">
            <label>名</label>
            <input v-model="profileForm.first_name" class="pc-input" placeholder="名" />
          </div>
        </div>
        <div class="pc-field">
          <label>邮箱</label>
          <input v-model="profileForm.email" class="pc-input" :class="{ 'input-error': errors.email }" placeholder="邮箱" @input="validateEmail(profileForm.email)" />
          <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
        </div>
        <div class="pc-field">
          <label>手机号</label>
          <input v-model="profileForm.phone" class="pc-input" :class="{ 'input-error': errors.phone }" placeholder="手机号" maxlength="11" @input="onPhoneInput($event); validatePhone(profileForm.phone)" />
          <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
        </div>
        <button class="pc-submit" :disabled="saving" @click="handleSaveProfile">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>

      <!-- 修改密码 -->
      <div v-if="activeTab === 'password'" class="pc-form">
        <div class="pc-field">
          <label>旧密码</label>
          <input v-model="pwdForm.old_password" type="password" class="pc-input" placeholder="输入旧密码" />
        </div>
        <div class="pc-field">
          <label>新密码</label>
          <input v-model="pwdForm.new_password" type="password" class="pc-input" placeholder="至少 8 位" />
        </div>
        <button class="pc-submit" :disabled="saving" @click="handleChangePassword">
          {{ saving ? '提交中...' : '修改密码' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pc-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 700;
}
.pc-card {
  width: 420px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  overflow: hidden;
  animation: pc-in 0.25s ease;
}
@keyframes pc-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.pc-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 0;
}
.pc-header h3 { margin: 0; font-size: 18px; color: #1a2332; }
.pc-close {
  width: 28px; height: 28px; border: none; border-radius: 50%;
  background: #f0f2f5; cursor: pointer; font-size: 14px; color: #8e95a6;
  display: flex; align-items: center; justify-content: center;
}
.pc-close:hover { background: #e4e7ed; color: #1a2332; }
.pc-tabs {
  display: flex; gap: 0; margin: 16px 24px 0;
  border-bottom: 1px solid #f0f0f0;
}
.pc-tabs button {
  flex: 1; padding: 10px 0; border: none; background: none;
  font-size: 14px; color: #8e8e93; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s;
}
.pc-tabs button.active { color: #2b5fd9; border-bottom-color: #2b5fd9; font-weight: 600; }
.pc-form { padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.pc-row { display: flex; gap: 12px; }
.pc-row .pc-field { flex: 1; }
.pc-field { display: flex; flex-direction: column; gap: 4px; }
.pc-field label { font-size: 13px; color: #8e95a6; }
.pc-input {
  height: 40px; padding: 0 12px; border: 1px solid #e4e9f0; border-radius: 8px;
  font-size: 14px; color: #1a2332; outline: none; transition: border 0.15s;
}
.pc-input:focus { border-color: #2b5fd9; }
.pc-input:disabled { background: #f8fafc; color: #b0b8c8; }
.input-error { border-color: #e74c3c !important; }
.field-error { font-size: 12px; color: #e74c3c; margin-top: 2px; }
.optional { font-size: 11px; color: #b0b8c8; font-weight: 400; }
.pc-submit {
  height: 42px; border: none; border-radius: 10px;
  background: #2b5fd9; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.pc-submit:hover { background: #1e4bb8; }
.pc-submit:disabled { background: #a0b8e8; cursor: not-allowed; }
</style>
