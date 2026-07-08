<template>
  <!-- 编辑超级管理员时禁用所有操作 -->
  <div v-if="isEdit && form.role === 'super_admin'" class="superadmin-hint">
    超级管理员的账号不可编辑
  </div>
  <template v-if="!(isEdit && form.role === 'super_admin')">
  <el-form-item
    label="账号"
    prop="username"
    :rules="[{ required: true, min: 3, max: 20, message: '请输入3-20个字符的账号', trigger: 'blur' }]"
  >
    <el-input v-model="form.username" :disabled="isEdit" placeholder="请输入账号" />
  </el-form-item>

  <el-form-item
    :label="isEdit ? '修改密码' : '密码'"
    prop="password"
    :rules="isEdit ? passwordRules : passwordRulesRequired"
  >
    <el-input v-model="form.password" type="password" :placeholder="isEdit ? '留空则不修改，至少8位' : '请输入密码（至少8位）'" show-password />
  </el-form-item>

  <el-form-item
    label="角色"
    prop="role"
    :rules="[{ required: true, message: '请选择角色', trigger: 'change' }]"
  >
    <el-select v-model="form.role" placeholder="请选择角色" filterable>
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
    prop="college_id"
    :rules="orgRules"
  >
    <el-select v-model="form.college_id" placeholder="请选择所属学院/部门" clearable filterable>
      <el-option
        v-for="opt in filteredOrgOptions"
        :key="opt.id"
        :label="opt.name"
        :value="opt.id"
      />
    </el-select>
  </el-form-item>
  </template>
</template>

<script setup lang="ts">
// ── 用户新增/编辑弹窗表单 ──
// 直接操作 form（即 BaseTable 的 formModel），无需本地拷贝
import { computed } from 'vue'
import type { College, UserRole } from '@/types'
import { ROLE_CONFIG } from '@/config/roles'
import { passwordRules, passwordRulesRequired } from '@/config/passwordRules'
import type { Department } from '@/api/admin'

interface OrgOption {
  id: string
  name: string
  group: '学院' | '部门'
}

interface Props {
  form: Record<string, any>
  isEdit: boolean
  colleges?: College[]
  departments?: Department[]
  orgOptions?: OrgOption[]
  hideCollege?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  colleges: () => [],
  departments: () => [],
  orgOptions: () => [],
  hideCollege: false,
})

/** 角色下拉选项（排除 admin 和 super_admin，UI 上不允许创建超级管理员） */
const roleOptions = computed(() =>
  (Object.keys(ROLE_CONFIG) as UserRole[])
    .filter((role) => role !== 'admin' && role !== 'super_admin')
    .map((role) => ({ value: role, label: ROLE_CONFIG[role].label })),
)

/** 根据角色筛选学院/部门选项 */
const filteredOrgOptions = computed(() => {
  if (props.form.role === 'college_admin') {
    return props.orgOptions.filter((opt) => opt.group === '学院')
  }
  if (props.form.role === 'dept_admin') {
    return props.orgOptions.filter((opt) => opt.group === '部门')
  }
  return props.orgOptions
})

/** 所属学院/部门校验规则 */
const orgRules = computed(() => {
  const role = props.form.role
  const rules: any[] = [{ required: true, message: '请选择所属学院/部门', trigger: 'change' }]
  if (role === 'college_admin') {
    rules.push({
      validator: (_: any, val: string, callback: Function) => {
        if (val && !val.startsWith('col_')) {
          callback(new Error('学院管理员不能选择部门，请选择学院'))
        } else { callback() }
      },
      trigger: 'change',
    })
  }
  if (role === 'dept_admin') {
    rules.push({
      validator: (_: any, val: string, callback: Function) => {
        if (val && !val.startsWith('dept_')) {
          callback(new Error('部门管理员不能选择学院，请选择部门'))
        } else { callback() }
      },
      trigger: 'change',
    })
  }
  return rules
})
</script>

<style scoped>
.superadmin-hint {
  text-align: center; padding: 24px 0; color: #909399;
}

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
