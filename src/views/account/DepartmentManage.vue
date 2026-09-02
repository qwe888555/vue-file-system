<script setup lang="ts">
// ── 部门管理（组织架构维护） ──
// 接口（文档 v1.0 2026-09-01）：GET 列表（所有管理员）/ POST 新建 / DELETE 删除（仅超级管理员）
// 部门最多两级：parent 只能指向一级部门；删除一级部门级联删除其子部门（用户保留、department 置空）
import { ref, reactive, computed, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getDepartmentsApi, createDepartmentApi, deleteDepartmentApi } from '@/api/admin'
import type { Department } from '@/api/admin'

// ── 部门树（GET 已归一化为「一级部门 + children 二级部门」） ──
const tree = ref<Department[]>([])
const loading = ref(false)

const firstLevelCount = computed(() => tree.value.length)
const secondLevelCount = computed(() =>
  tree.value.reduce((n, d) => n + (d.children?.length || 0), 0),
)

async function loadList() {
  loading.value = true
  try {
    tree.value = await getDepartmentsApi()
  } catch {
    // 错误提示由 request.ts 拦截器统一处理
  } finally {
    loading.value = false
  }
}
onMounted(loadList)

// ── 新建部门 ──
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<{ name: string; parent: number | null }>({
  name: '',
  parent: null,
})
const rules: FormRules = {
  name: [
    { required: true, message: '请输入部门名称', trigger: 'blur' },
    { max: 128, message: '部门名称最长 128 个字符', trigger: 'blur' },
  ],
}

/** 上级部门候选：仅一级部门（接口两级限制，二级部门不能再挂子部门） */
const parentOptions = computed(() => tree.value)

function openCreateDialog() {
  form.name = ''
  form.parent = null
  dialogVisible.value = true
}

async function handleCreate() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    await createDepartmentApi({
      name: form.name.trim(),
      // clearable 清空后可能为 ''，统一归一化：null = 一级部门
      parent: form.parent == null || (form.parent as unknown) === '' ? null : Number(form.parent),
    })
    ElMessage.success('部门创建成功')
    dialogVisible.value = false
    loadList()
  } catch {
    // 错误提示由 request.ts 拦截器统一处理（如两级限制 400：parent 字段错误）
  } finally {
    submitting.value = false
  }
}

// ── 删除部门（级联语义：子部门一并删除；用户保留、department 置空） ──
async function handleDelete(row: Department) {
  const childCount = row.children?.length || 0
  const tip =
    childCount > 0
      ? `「${row.name}」为一级部门，删除后将同时删除其 ${childCount} 个子部门；归属用户不会被删除，其所属部门将被置空。是否继续？`
      : `确定删除部门「${row.name}」吗？归属该部门的用户不会被删除，其所属部门将被置空。`
  try {
    await ElMessageBox.confirm(tip, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await deleteDepartmentApi(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 错误提示由 request.ts 拦截器统一处理（如 404）
  }
}
</script>

<template>
  <div class="dept-manage">
    <!-- 标题栏 -->
    <div class="page-header">
      <div class="page-title-wrap">
        <h3 class="page-title">部门列表</h3>
        <span class="page-sub"
          >共 {{ firstLevelCount }} 个一级部门 · {{ secondLevelCount }} 个二级部门</span
        >
      </div>
      <div class="page-actions">
        <el-button :icon="Refresh" @click="loadList">刷新</el-button>
        <el-button v-permission="'department-manage'" type="primary" @click="openCreateDialog"
          >+ 新建部门</el-button
        >
      </div>
    </div>

    <!-- 树形表格：一级/二级层级缩进展示 -->
    <el-table
      v-loading="loading"
      :data="tree"
      row-key="id"
      :tree-props="{ children: 'children' }"
      default-expand-all
      border
      stripe
      class="dept-table"
    >
      <el-table-column prop="name" label="部门名称" min-width="260" />
      <el-table-column label="层级" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.parent == null ? 'primary' : 'info'" size="small">
            {{ row.parent == null ? '一级部门' : '二级部门' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下级部门" width="100" align="center">
        <template #default="{ row }">
          {{ row.children?.length || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button
            v-permission="'department-manage'"
            type="danger"
            size="small"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新建部门弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="新建部门"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="部门名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入部门名称"
            maxlength="128"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="上级部门" prop="parent">
          <el-select
            v-model="form.parent"
            placeholder="不选则创建为一级部门"
            clearable
            class="w-full"
          >
            <el-option v-for="d in parentOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
          <span class="form-tip">部门最多两级，仅可选择一级部门作为上级</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dept-manage {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 8px);
  padding: var(--spacing-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg, 16px);
}
.page-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.page-title {
  font-size: var(--font-size-lg, 16px);
  font-weight: 600;
  color: var(--color-text, #303133);
  margin: 0;
}
.page-sub {
  font-size: var(--font-size-sm, 13px);
  color: var(--color-text-secondary, #64748b);
}
.page-actions {
  display: flex;
  gap: var(--spacing-sm, 8px);
}

/* ── 表格（匹配 BaseTable 风格） ── */
.dept-table {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}
:deep(.dept-table th.el-table__cell) {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
  font-size: 13px;
}
:deep(.dept-table .el-table__body tr:hover > td) {
  background: #f0f4fe;
}

.form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
}
.w-full {
  width: 100%;
}
</style>
