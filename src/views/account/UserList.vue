<template>
  <div class="page-container">
    <BaseTable
      ref="tableRef"
      :api-fn="getLocalAccounts"
      :columns="columns"
      title="账号管理"
      :create-api="createLocalAccount"
      :update-api="updateLocalAccount"
      :delete-api="deleteLocalAccount"
      :filters="defaultFilters"
      :page-size="15"
    >
      <!-- 搜索栏（输入即搜，无搜索按钮） -->
      <template #search>
        <el-input
          v-model="keyword"
          placeholder="搜索账号"
          clearable
          style="width: 200px"
        />
        <el-select v-model="roleFilter" placeholder="全部角色" clearable style="width: 160px">
          <el-option label="全部角色" value="__all__" />
          <el-option
            v-for="opt in roleOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-select
          v-model="collegeFilter"
          placeholder="全部学院/部门"
          clearable
          style="width: 160px"
          :disabled="false"
        >
          <el-option label="全部学院/部门" value="__all__" />
          <el-option
            v-for="col in colleges"
            :key="col.id"
            :label="col.name"
            :value="col.id"
          />
        </el-select>
        <el-button @click="handleReset">重置</el-button>
      </template>

      <!-- 密码列：固定显示蒙文 -->
      <template #_password>
        <span style="letter-spacing: 2px">••••••</span>
      </template>

      <!-- 角色列：中文标签 -->
      <template #role="{ row }">
        <el-tag
          :type="ROLE_CONFIG[row.role]?.tagType ?? 'info'"
          size="small"
        >
          {{ ROLE_CONFIG[row.role]?.label || row.role }}
        </el-tag>
      </template>

      <!-- 操作列前置：编辑 -->
      <template #actions-prepend="{ row }">
        <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
      </template>

      <!-- 批量操作 -->
      <template #batch-actions="{ selection }">
        <el-button type="danger" size="small" @click="handleBatchDelete(selection)">
          批量删除
        </el-button>
        <el-button type="warning" size="small" @click="handleBatchReset(selection)">
          批量修改密码
        </el-button>
      </template>

      <!-- 新增/编辑弹窗表单 -->
      <template #form="{ form, isEdit }">
        <UserEdit
          :form="form"
          :is-edit="isEdit"
          :colleges="colleges"
          :hide-college="false"
        />
      </template>
    </BaseTable>

    <!-- ═══ 批量修改密码弹窗 ═══ -->
    <el-dialog
      v-model="batchResetVisible"
      title="批量修改密码"
      width="420px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-width="0">
        <el-form-item
          label=""
          :rules="[{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }]"
        >
          <el-input
            v-model="batchResetPassword"
            type="password"
            placeholder="请输入新密码（至少6位）"
            show-password
            size="large"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchResetVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmBatchReset">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// ── 账号管理页面（对接后端 API） ──
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseTable from '@/components/account/BaseTable.vue'
import UserEdit from '@/components/account/UserEdit.vue'
import { useUserStore } from '@/store/user'
import { ROLE_CONFIG } from '@/config/roles'
import type { UserRole, College } from '@/types'
import {
  getAccountsApi,
  createAccountApi,
  updateAccountApi,
  deleteAccountApi,
  batchResetPasswordApi,
  batchDeleteAccountsApi,
  getCollegesApi,
} from '@/api/admin'

// ── 学院列表（从后端加载） ──
const colleges = ref<College[]>([])

onMounted(async () => {
  try {
    const res = await getCollegesApi()
    colleges.value = res.results
  } catch {
    // 静默失败
  }
})

// ── 用户角色 ──
const userStore = useUserStore()
const isSuperAdmin = computed(() => userStore.role === 'super_admin')
const userCollege = computed(() => userStore.userInfo?.college)
const tableRef = ref<InstanceType<typeof BaseTable>>()

// ── 搜索栏状态 ──
const keyword = ref('')
const roleFilter = ref('__all__')
const collegeFilter = ref<number | '__all__'>('__all__')

// ── 列定义 ──
const columns = [
  { prop: 'username', label: '账号', width: '200' },
  { prop: 'role', label: '角色', width: '200', align: 'center' as const },
  { prop: 'college_name', label: '所属学院/部门', minWidth: '200' },
  { prop: '_password', label: '密码', width: '200', align: 'center' as const },
]

// ── 角色筛选选项 ──
const roleOptions = computed(() =>
  (Object.keys(ROLE_CONFIG) as UserRole[])
    .filter((role) => (isSuperAdmin.value ? true : role !== 'super_admin'))
    .map((role) => ({ value: role, label: ROLE_CONFIG[role].label })),
)

// ── 默认筛选条件（学院管理员自动限定本院） ──
const defaultFilters = computed(() => {
  const f: Record<string, any> = {}
  if (!isSuperAdmin.value && userCollege.value) {
    f.college = userCollege.value
  }
  return f
})

// ── 从后端获取用户列表（前端 keyword 过滤 + 分页） ──
async function getLocalAccounts(params: {
  page: number
  pageSize: number
  role?: string
  college?: number
  keyword?: string
}) {
  const res = await getAccountsApi({
    role: params.role,
    college: params.college,
  })
  const list = res.results

  let filtered = list
  if (params.keyword) {
    const kw = params.keyword.toLowerCase()
    filtered = list.filter(
      (a) =>
        a.username.toLowerCase().includes(kw) ||
        a.first_name.toLowerCase().includes(kw) ||
        a.last_name.toLowerCase().includes(kw) ||
        a.email.toLowerCase().includes(kw),
    )
  }

  const total = filtered.length
  const start = (params.page - 1) * params.pageSize
  const sliced = filtered.slice(start, start + params.pageSize)
  return { list: sliced, total, page: params.page, pageSize: params.pageSize }
}

/** 新增账号 → 调后端 */
async function createLocalAccount(data: any) {
  await createAccountApi({
    username: data.username,
    email: data.email || '',
    password: data.password,
    password_confirm: data.password,
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    role: data.role,
    college: data.college,
  })
  // 成功后刷新列表
  tableRef.value?.refresh()
}

/** 编辑账号 → 调后端 */
async function updateLocalAccount(id: number, data: any) {
  await updateAccountApi(id, {
    first_name: data.first_name,
    last_name: data.last_name,
    role: data.role,
    college: data.college,
  })
}

/** 删除账号 → 调后端 */
async function deleteLocalAccount(id: number) {
  await deleteAccountApi(id)
}

// ── 搜索/重置 ──
function handleSearch() {
  const params: Record<string, any> = {
    keyword: keyword.value || '',
    role: roleFilter.value !== '__all__' ? roleFilter.value : '',
    college: undefined as number | undefined,
  }

  if (collegeFilter.value !== '__all__') {
    params.college = collegeFilter.value
  } else if (!isSuperAdmin.value && userCollege.value) {
    params.college = userCollege.value
  }

  tableRef.value?.triggerSearch(params)
}

function handleReset() {
  keyword.value = ''
  roleFilter.value = '__all__'
  collegeFilter.value = '__all__'
}

watch([keyword, roleFilter, collegeFilter], () => {
  handleSearch()
})

// ── 编辑按钮 ──
function handleEdit(row: any) {
  tableRef.value?.handleEdit({ ...row, password: '' })
}

// ── 批量删除 ──
async function handleBatchDelete(selection: any[]) {
  if (!selection.length) return
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selection.length} 个账号吗？此操作不可撤销。`,
      '批量删除',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
    )
    const res = await batchDeleteAccountsApi({ user_ids: selection.map((r) => r.id) })
    ElMessage.success(res.detail || `成功删除 ${selection.length} 个账号`)
    tableRef.value?.clearSelection()
    tableRef.value?.refresh()
  } catch {
    // 用户取消
  }
}

// ── 批量修改密码 ──
const batchResetVisible = ref(false)
const batchResetPassword = ref('')
const batchResetSelection = ref<any[]>([])

function handleBatchReset(selection: any[]) {
  batchResetSelection.value = selection
  batchResetPassword.value = ''
  batchResetVisible.value = true
}

async function confirmBatchReset() {
  if (!batchResetPassword.value || batchResetPassword.value.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  try {
    const res = await batchResetPasswordApi({
      user_ids: batchResetSelection.value.map((r: any) => r.id),
      new_password: batchResetPassword.value,
    })
    ElMessage.success(res.detail || `成功修改 ${batchResetSelection.value.length} 个账号的密码`)
    batchResetVisible.value = false
    tableRef.value?.clearSelection()
  } catch {
    // API 报错已在拦截器中提示
  }
}
</script>

<style scoped>
.page-container {
  padding: var(--spacing-lg, 16px);
}
</style>
