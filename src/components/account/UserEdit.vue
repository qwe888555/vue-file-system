<template>
  <el-form-item
    label="账号"
    prop="username"
    :rules="[{ required: true, min: 3, max: 20, message: '请输入3-20个字符的账号', trigger: 'blur' }]"
  >
    <el-input v-model="form.username" :disabled="isEdit" placeholder="请输入账号" />
  </el-form-item>

  <el-form-item
    label="密码"
    prop="password"
    :rules="[{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }]"
  >
    <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
  </el-form-item>

  <el-form-item
    label="角色"
    prop="role"
    :rules="[{ required: true, message: '请选择角色', trigger: 'change' }]"
  >
    <el-select v-model="form.role" placeholder="请选择角色">
      <el-option
        v-for="opt in roleOptions"
        :key="opt.value"
        :label="opt.label"
        :value="opt.value"
      />
    </el-select>
  </el-form-item>

  <el-form-item
    v-if="!hideCollege"
    label="所属学院/部门"
    prop="collegeId"
    :rules="[{ required: true, message: '请选择所属学院/部门', trigger: 'change' }]"
  >
    <el-select v-model="form.collegeId" placeholder="请选择所属学院/部门">
      <el-option
        v-for="col in colleges"
        :key="col.id"
        :label="col.name"
        :value="col.id"
      />
    </el-select>
  </el-form-item>
</template>

<script setup lang="ts">
// ── 用户新增/编辑弹窗表单 ──
// 直接操作 form（即 BaseTable 的 formModel），无需本地拷贝
import { computed } from 'vue'
import type { College, UserRole } from '@/types'
import { ROLE_CONFIG } from '@/config/roles'

interface Props {
  form: Record<string, any>
  isEdit: boolean
  colleges?: College[]
  hideCollege?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  colleges: () => [],
  hideCollege: false,
})

/** 角色下拉选项（超级管理员受 hideCollege 控制） */
const roleOptions = computed(() =>
  (Object.keys(ROLE_CONFIG) as UserRole[])
    .filter((role) => (props.hideCollege ? role !== 'superadmin' : true))
    .map((role) => ({ value: role, label: ROLE_CONFIG[role].label })),
)
</script>

<style scoped>
:deep(.el-form-item) {
  margin-bottom: 22px;
}

:deep(.el-form-item__label) {
  font-size: 14px;
  color: #2c3e50;
  padding-right: 12px;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0d9f5 inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.25), 0 0 0 1px #409eff inset !important;
}

:deep(.el-select) {
  width: 100%;
}
</style>
