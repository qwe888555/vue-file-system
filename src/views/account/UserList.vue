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
          @input="handleSearch"
          @clear="handleSearch"
        />
        <el-select v-model="roleFilter" placeholder="全部角色" clearable style="width: 160px" @change="handleSearch">
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
          @change="handleSearch"
        >
          <el-option label="全部学院/部门" value="__all__" />
          <el-option
            v-for="opt in orgOptions"
            :key="opt.id"
            :label="opt.name"
            :value="opt.id"
          />
        </el-select>
        <el-button @click="handleReset">重置</el-button>
      </template>

      <!-- 所属学院/部门列（优先学院名，没有则显示部门名） -->
      <template #college_name="{ row }">
        <span>{{ row.college_name || row.department_name || '-' }}</span>
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
          :departments="departments"
          :org-options="flattenOrgs"
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
          :rules="passwordRulesRequired"
        >
          <el-input
            v-model="batchResetPassword"
            type="password"
            placeholder="请输入新密码"
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
import { passwordRulesRequired } from '@/config/passwordRules'
import type { College, UserRole } from '@/types'
import {
  getAccountsApi,
  createAccountApi,
  updateAccountApi,
  deleteAccountApi,
  batchResetPasswordApi,
  batchDeleteAccountsApi,
  getCollegesApi,
  getDepartmentsApi,
} from '@/api/admin'
import type { Department } from '@/api/admin'

// ── 学院 & 部门 → 合并下拉选项 ──
// ── 学院列表（给 UserEdit 使用）+ 合并下拉选项（给筛选使用） ──
const colleges = ref<College[]>([])
const departments = ref<Department[]>([])
interface OrgOption { id: number | string; name: string }
const orgOptions = ref<OrgOption[]>([])

onMounted(async () => {
  try {
    const [colRes, deptRes] = await Promise.all([getCollegesApi(), getDepartmentsApi()])
    colleges.value = colRes.results || []
    departments.value = deptRes.results || []
    orgOptions.value = [
      ...colleges.value.map((c) => ({ id: `col_${c.id}`, name: c.name })),
      ...flattenDepts(departments.value),
    ]
  } catch {
    // 静默失败
  }
})

/** 合并学院+部门，供新增/编辑弹窗使用（带 group 标记） */
const flattenOrgs = computed(() => [
  ...colleges.value.map((c) => ({ id: `col_${c.id}`, name: c.name, group: '学院' as const })),
  ...flattenDepts(departments.value).map((d) => ({ ...d, group: '部门' as const })),
])

/** 部门树 → 一维列表 */
function flattenDepts(list: Department[], prefix = ''): OrgOption[] {
  const result: OrgOption[] = []
  for (const d of list) {
    result.push({ id: `dept_${d.id}`, name: `${prefix}${d.name}` })
    if (d.children?.length) result.push(...flattenDepts(d.children, `${prefix}  `))
  }
  return result
}

// ── 用户角色 ──
const userStore = useUserStore()
const isSuperAdmin = computed(() => userStore.role === 'super_admin')
const userCollegeId = computed(() => userStore.userInfo?.college_id)
const tableRef = ref<InstanceType<typeof BaseTable>>()

// ── 搜索栏状态 ──
const keyword = ref('')
const roleFilter = ref('__all__')
const collegeFilter = ref<string>('__all__')

// ── 列定义 ──
const columns = [
  { prop: 'username', label: '账号', width: '200', align: 'center' as const },
  { prop: 'role', label: '角色', width: '200', align: 'center' as const },
  { prop: 'college_name', label: '所属学院/部门', minWidth: '200', align: 'center' as const },
]

// ── 角色筛选选项 ──
const roleOptions = computed(() =>
  (Object.keys(ROLE_CONFIG) as UserRole[])
    .filter((role) => role !== 'admin' && (isSuperAdmin.value ? true : role !== 'super_admin'))
    .map((role) => ({ value: role, label: ROLE_CONFIG[role].label })),
)

// ── 默认筛选条件（学院管理员自动限定本院） ──
const defaultFilters = computed(() => {
  const f: Record<string, any> = {}
  if (!isSuperAdmin.value && userCollegeId.value) {
    f.college_id = userCollegeId.value
  }
  return f
})

// ── 从后端获取用户列表（前端 keyword/部门 过滤 + 分页） ──
async function getLocalAccounts(params: {
  page: number
  pageSize: number
  role?: string
  college_id?: number | null
  department_id?: number | null
  keyword?: string
}) {
  const res = await getAccountsApi({
    role: params.role,
    college: params.college_id ?? undefined,
  })
  const list = res.results

  let filtered = list
  if (params.keyword) {
    const kw = params.keyword.toLowerCase()
    filtered = filtered.filter(
      (a) =>
        a.username.toLowerCase().includes(kw) ||
        a.first_name.toLowerCase().includes(kw) ||
        a.last_name.toLowerCase().includes(kw) ||
        a.email.toLowerCase().includes(kw),
    )
  }
  // 前端部门过滤（后端暂不支持 ?department_id=）
  if (params.department_id) {
    filtered = filtered.filter((a) => a.department_id === params.department_id)
  }

  const total = filtered.length
  const start = (params.page - 1) * params.pageSize
  const sliced = filtered.slice(start, start + params.pageSize)
  return { list: sliced, total, page: params.page, pageSize: params.pageSize }
}

/** 从 prefixed ID（col_1 / dept_5）+ role 提取 org 入参 */
function buildOrgParams(orgId: string | undefined, role?: string) {
  if (!orgId) return {}
  const id = Number(orgId.replace(/^(col_|dept_)/, ''))
  if (isNaN(id)) return {}
  // dept_admin 角色 → 部门 ID；其他 → 学院 ID
  if (role === 'dept_admin' || orgId.startsWith('dept_')) {
    return { department: id }
  }
  return { college: id }
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
    ...buildOrgParams(data.college_id, data.role),
  })
  tableRef.value?.refresh()
}

/** 编辑账号 → 调后端 */
async function updateLocalAccount(id: number, data: any) {
  await updateAccountApi(id, {
    first_name: data.first_name,
    last_name: data.last_name,
    role: data.role,
    ...buildOrgParams(data.college_id, data.role),
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
  }

  // 始终显式传筛选值（null=不过滤），覆盖 useTableQuery 内部残留
  if (collegeFilter.value !== '__all__' && collegeFilter.value.startsWith('col_')) {
    params.college_id = Number(collegeFilter.value.slice(4))
  } else if (collegeFilter.value !== '__all__' && collegeFilter.value.startsWith('dept_')) {
    params.department_id = Number(collegeFilter.value.slice(5))
    params.college_id = null
  } else if (!isSuperAdmin.value && userCollegeId.value) {
    params.college_id = userCollegeId.value
  } else {
    params.college_id = null
    params.department_id = null
  }

  tableRef.value?.triggerSearch(params)
}

function handleReset() {
  keyword.value = ''
  roleFilter.value = '__all__'
  collegeFilter.value = '__all__'
  // 显式触发搜索，覆盖内部残留
  handleSearch()
}

watch([roleFilter, collegeFilter], () => {
  handleSearch()
})

// ── 编辑按钮 ──
function handleEdit(row: any) {
  // 把后端 college/department 映射为 prefixed ID 供下拉框匹配
  const orgId = row.college
    ? `col_${row.college}`
    : row.department
      ? `dept_${row.department}`
      : ''
  tableRef.value?.handleEdit({
    ...row,
    college_id: orgId,
    password: '',
  })
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
    await batchDeleteAccountsApi({ user_ids: selection.map((r) => r.id) })
    ElMessage.success('批量删除成功')
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
  const pw = batchResetPassword.value
  if (!pw || pw.length < 8) {
    ElMessage.warning('密码长度至少 8 位'); return
  }
  if (/^\d+$/.test(pw)) {
    ElMessage.warning('密码不能全是数字'); return
  }
  if (/^(password|12345678|qwerty123|admin123|iloveyou)$/i.test(pw)) {
    ElMessage.warning('密码过于常见，请更换'); return
  }
  try {
    await batchResetPasswordApi({
      user_ids: batchResetSelection.value.map((r: any) => r.id),
      new_password: batchResetPassword.value,
    })
    ElMessage.success('批量修改密码成功')
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
