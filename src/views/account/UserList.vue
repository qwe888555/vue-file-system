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
          v-if="isSuperAdmin"
          v-model="collegeFilter"
          placeholder="全部学院/部门"
          clearable
          style="width: 160px"
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
          :hide-college="!isSuperAdmin"
        />
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
// ── 账号管理页面（合并版，纯前端本地数据） ──
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseTable from '@/components/account/BaseTable.vue'
import UserEdit from '@/components/account/UserEdit.vue'
import { useUserStore } from '@/store/user'
import { ROLE_CONFIG } from '@/config/roles'
import type { UserRole } from '@/types'

// ── 本地学院数据 ──
const colleges = [
  { id: 1, name: '计算机科学与技术学院', code: 'CS', sortOrder: 1, status: 1 },
  { id: 2, name: '数学与统计学院', code: 'MATH', sortOrder: 2, status: 1 },
]

// ── 本地账号数据 ──
interface LocalAccount {
  id: number
  username: string
  password: string
  role: UserRole
  collegeId: number
  collegeName: string
  status: number
  createdAt: string
}

const localAccounts = ref<LocalAccount[]>([
  {
    id: 1, username: 'zhangsan', password: '123456',
    role: 'admin_csic', collegeId: 1, collegeName: '计算机科学与技术学院',
    status: 1, createdAt: '2025-09-01',
  },
  {
    id: 2, username: 'lisi', password: '123456',
    role: 'user', collegeId: 2, collegeName: '数学与统计学院',
    status: 1, createdAt: '2025-09-15',
  },
  {
    id: 3, username: 'wangwu', password: '123456',
    role: 'admin_dept', collegeId: 1, collegeName: '计算机科学与技术学院',
    status: 1, createdAt: '2025-10-01',
  },
])

// ── 用户角色 ──
const userStore = useUserStore()
const isSuperAdmin = computed(() => userStore.role === 'superadmin')
const userCollegeId = computed(() => userStore.userInfo?.collegeId)
const tableRef = ref<InstanceType<typeof BaseTable>>()

// ── 搜索栏状态 ──
const keyword = ref('')
const roleFilter = ref('__all__')
const collegeFilter = ref<number | '__all__'>('__all__')

let nextId = 100

// ── 列定义（"用户名" → "账号"） ──
const columns = [
  { prop: 'username', label: '账号', width: '200' },
  { prop: 'role', label: '角色', width: '200', align: 'center' as const },
  { prop: 'collegeName', label: '所属学院/部门', minWidth: '200' },
  { prop: '_password', label: '密码', width: '200', align: 'center' as const },
]

// ── 角色筛选选项 ──
const roleOptions = computed(() =>
  (Object.keys(ROLE_CONFIG) as UserRole[])
    .filter((role) => (isSuperAdmin.value ? true : role !== 'superadmin'))
    .map((role) => ({ value: role, label: ROLE_CONFIG[role].label })),
)

// ── 默认筛选条件 ──
const defaultFilters = computed(() => {
  const f: Record<string, any> = {}
  if (!isSuperAdmin.value && userCollegeId.value) {
    f.collegeId = userCollegeId.value
  }
  return f
})

// ── 本地 API 方法 ──

/** 查询账号（本地过滤+分页） */
async function getLocalAccounts(params: {
  page: number
  pageSize: number
  keyword?: string
  role?: string
  collegeId?: number
}) {
  let list = [...localAccounts.value]

  if (params.keyword) {
    const kw = String(params.keyword).toLowerCase()
    list = list.filter((a) => a.username.toLowerCase().includes(kw))
  }
  if (params.role) {
    list = list.filter((a) => a.role === params.role)
  }
  if (params.collegeId) {
    list = list.filter((a) => a.collegeId === params.collegeId)
  }

  const total = list.length
  const start = (params.page - 1) * params.pageSize
  const sliced = list.slice(start, start + params.pageSize)
  return { list: sliced, total, page: params.page, pageSize: params.pageSize }
}

/** 新增账号 */
async function createLocalAccount(data: any) {
  const college = colleges.find((c) => c.id === data.collegeId)
  localAccounts.value.push({
    id: nextId++,
    username: data.username,
    password: data.password || '123456',
    role: data.role,
    collegeId: data.collegeId,
    collegeName: college?.name || '',
    status: 1,
    createdAt: new Date().toISOString().slice(0, 10),
  })
  ElMessage.success('新增成功')
}

/** 编辑账号（密码/角色/所属学院） */
async function updateLocalAccount(id: number, data: any) {
  const idx = localAccounts.value.findIndex((a) => a.id === id)
  if (idx === -1) return
  const college = colleges.find((c) => c.id === data.collegeId)
  localAccounts.value[idx] = {
    ...localAccounts.value[idx],
    password: data.password ?? localAccounts.value[idx].password,
    role: data.role ?? localAccounts.value[idx].role,
    collegeId: data.collegeId ?? localAccounts.value[idx].collegeId,
    collegeName: college?.name ?? localAccounts.value[idx].collegeName,
  }
  ElMessage.success('编辑成功')
}

/** 删除账号 */
async function deleteLocalAccount(id: number) {
  localAccounts.value = localAccounts.value.filter((a) => a.id !== id)
  ElMessage.success('删除成功')
}

// ── 搜索/重置 ──
function handleSearch() {
  const params: Record<string, any> = {}

  // 显式传所有筛选条件（空值 = 全部），覆盖 useTableQuery 内部残留的旧值
  if (keyword.value) params.keyword = keyword.value
  params.role = roleFilter.value !== '__all__' ? roleFilter.value : ''
  if (isSuperAdmin.value) {
    params.collegeId = collegeFilter.value !== '__all__' ? collegeFilter.value : ''
  }

  tableRef.value?.triggerSearch(params)
}

function handleReset() {
  keyword.value = ''
  roleFilter.value = '__all__'
  collegeFilter.value = '__all__'
  // watch 自动触发搜索
}

// ── 筛选条件变化时自动搜索 ──
watch([keyword, roleFilter, collegeFilter], () => {
  handleSearch()
})

// ── 编辑按钮（调用 BaseTable 的内置编辑弹窗） ──
function handleEdit(row: any) {
  // 把本地 password 也传到表单
  const account = localAccounts.value.find((a) => a.id === row.id)
  tableRef.value?.handleEdit({ ...row, password: account?.password || '' })
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
    const ids = selection.map((r) => r.id)
    localAccounts.value = localAccounts.value.filter((a) => !ids.includes(a.id))
    ElMessage.success(`成功删除 ${selection.length} 个账号`)
    tableRef.value?.refresh()
  } catch {
    // 用户取消
  }
}

// ── 批量修改密码 ──
async function handleBatchReset(selection: any[]) {
  if (!selection.length) return
  try {
    const { value } = await ElMessageBox.prompt('请输入新密码', '批量修改密码', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPlaceholder: '请输入新密码（至少6位）',
      inputPattern: /^.{6,}$/,
      inputErrorMessage: '密码至少6位',
    })
    for (const row of selection) {
      const idx = localAccounts.value.findIndex((a) => a.id === row.id)
      if (idx !== -1) localAccounts.value[idx].password = value
    }
    ElMessage.success(`成功将 ${selection.length} 个账号的密码修改为 ${value}`)
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.page-container {
  padding: var(--spacing-lg, 16px);
}
</style>
