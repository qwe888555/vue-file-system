<script setup lang="ts">
// ── 所属单位维护（学院 / 部门 CRUD） ──
// 学院 + 部门双 Tab，复用 BaseTable 的增删改查/弹窗/状态
import { ref } from 'vue'
import BaseTable from '@/components/account/BaseTable.vue'
import {
  getCollegesApi,
  createCollegeApi,
  updateCollegeApi,
  deleteCollegeApi,
  getDepartmentsApi,
  createDepartmentApi,
  updateDepartmentApi,
  deleteDepartmentApi,
} from '@/api/admin'
import type { Department } from '@/api/admin'
import type { College } from '@/types'

const activeTab = ref('college')

// ── 全量组织数据（供部门父级选择 + 上级单位显示） ──
const colleges = ref<College[]>([])
const departments = ref<Department[]>([])

/** 部门树 → 一维列表（与 UserList 同款缩进） */
function flattenDepts(list: Department[], prefix = ''): Array<{ id: number; name: string; label: string }> {
  const result: Array<{ id: number; name: string; label: string }> = []
  for (const d of list) {
    result.push({ id: d.id, name: d.name, label: `${prefix}${d.name}` })
    if (d.children?.length) result.push(...flattenDepts(d.children, `${prefix}  `))
  }
  return result
}

/** 部门表单父级选项：顶级 + 学院 + 其他部门（编辑时排除自身） */
function buildParentOptions(excludeId?: number) {
  const options: Array<{ value: number | null; label: string }> = [{ value: null, label: '（顶级）' }]
  options.push(...colleges.value.map((c) => ({ value: c.id, label: `学院：${c.name}` })))
  options.push(
    ...flattenDepts(departments.value)
      .filter((d) => d.id !== excludeId)
      .map((d) => ({ value: d.id, label: `部门：${d.label}` })),
  )
  return options
}

/** 上级单位显示：优先部门名，其次学院名，null → 「—」 */
function parentName(id: number | null | undefined): string {
  if (id == null) return '—'
  const dept = flattenDepts(departments.value).find((d) => d.id === id)
  if (dept) return `部门：${dept.name}`
  const col = colleges.value.find((c) => c.id === id)
  if (col) return `学院：${col.name}`
  return String(id)
}

// ── 学院列定义 ──
const collegeColumns = [
  { prop: 'name', label: '学院名称', minWidth: '200' },
  { prop: 'code', label: '学院编码', width: '160', align: 'center' as const },
  { prop: 'sort_order', label: '排序', width: '100', align: 'center' as const },
]

/** 学院 apiFn：返回数组给 BaseTable，同时刷新组织 ref 供部门父级选择 */
function loadColleges() {
  return getCollegesApi().then((r) => {
    colleges.value = r.results || []
    return colleges.value
  })
}

// ── 部门列定义 ──
const departmentColumns = [
  { prop: 'name', label: '部门名称', minWidth: '200' },
  { prop: 'parent', label: '上级单位', minWidth: '200', align: 'center' as const },
  { prop: 'sort_order', label: '排序', width: '100', align: 'center' as const },
]

/** 部门树 → 扁平列表（children 仅用于递归，不进入表格行，避免回传后端） */
function flattenDeptList(list: Department[]): Department[] {
  const result: Department[] = []
  for (const d of list) {
    result.push(d)
    if (d.children?.length) result.push(...flattenDeptList(d.children))
  }
  return result
}

/** 部门 apiFn：扁平化后返回数组，同时刷新组织 ref 供父级选择 */
function loadDepartments() {
  return getDepartmentsApi().then((r) => {
    departments.value = r.results || []
    return flattenDeptList(departments.value).map(({ children: _c, ...rest }) => rest)
  })
}
</script>

<template>
  <div class="org-manage">
    <el-tabs v-model="activeTab" class="org-tabs">
      <!-- ═══ 学院管理 ═══ -->
      <el-tab-pane label="学院管理" name="college">
        <BaseTable
          :api-fn="loadColleges"
          :columns="collegeColumns"
          title="学院列表"
          :create-api="createCollegeApi"
          :update-api="updateCollegeApi"
          :delete-api="deleteCollegeApi"
          :paginated="false"
          row-key="id"
          dialog-width="480px"
          dialog-title="学院"
          delete-confirm-text="确定删除该学院吗？删除后其下属部门可能受影响。"
        >
          <template #form="{ form }">
            <el-form-item label="学院名称" prop="name" :rules="[{ required: true, message: '请输入学院名称', trigger: 'blur' }]">
              <el-input v-model="form.name" placeholder="请输入学院名称" maxlength="50" />
            </el-form-item>
            <el-form-item label="学院编码" prop="code">
              <el-input v-model="form.code" placeholder="如：school_xx（可选）" maxlength="30" />
            </el-form-item>
            <el-form-item label="排序" prop="sort_order">
              <el-input-number v-model="form.sort_order" :min="0" :max="999" controls-position="right" />
              <span class="form-tip">数值越小越靠前</span>
            </el-form-item>
          </template>
        </BaseTable>
      </el-tab-pane>

      <!-- ═══ 部门管理 ═══ -->
      <el-tab-pane label="部门管理" name="department">
        <BaseTable
          :api-fn="loadDepartments"
          :columns="departmentColumns"
          title="部门列表"
          :create-api="createDepartmentApi"
          :update-api="updateDepartmentApi"
          :delete-api="deleteDepartmentApi"
          :paginated="false"
          row-key="id"
          dialog-width="480px"
          dialog-title="部门"
          delete-confirm-text="确定删除该部门吗？其下级部门可能受影响。"
        >
          <template #parent="{ row }">
            {{ parentName(row.parent) }}
          </template>
          <template #form="{ form }">
            <el-form-item label="部门名称" prop="name" :rules="[{ required: true, message: '请输入部门名称', trigger: 'blur' }]">
              <el-input v-model="form.name" placeholder="请输入部门名称" maxlength="50" />
            </el-form-item>
            <el-form-item label="上级单位" prop="parent">
              <el-select v-model="form.parent" placeholder="选择上级学院或部门" clearable class="w-full">
                <el-option
                  v-for="opt in buildParentOptions(form.id)"
                  :key="String(opt.value)"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="排序" prop="sort_order">
              <el-input-number v-model="form.sort_order" :min="0" :max="999" controls-position="right" />
              <span class="form-tip">数值越小越靠前</span>
            </el-form-item>
          </template>
        </BaseTable>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.org-manage {
  padding: 4px;
}
.org-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
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
