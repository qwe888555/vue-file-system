<template>
  <div class="base-table">
    <!-- 标题栏 -->
    <div class="table-header">
      <h3 class="table-title">{{ title }}</h3>
      <el-button v-if="createApi" type="primary" @click="handleAdd">+ 新增</el-button>
    </div>

    <!-- 搜索栏 -->
    <div v-if="$slots.search" class="table-search">
      <slot name="search" />
    </div>

    <!-- 批量操作栏 -->
    <div v-if="$slots['batch-actions'] && selectionRows.length > 0" class="table-batch">
      <span class="batch-info">已选择 {{ selectionRows.length }} 项</span>
      <slot name="batch-actions" :selection="selectionRows" />
    </div>

    <!-- 表格 -->
    <el-table
      ref="elTableRef"
      :data="tableData"
      v-loading="loading"
      :row-key="rowKey"
      @selection-change="handleSelectionChange"
      border
      stripe
      class="table-body"
    >
      <!-- 多选列 -->
      <el-table-column v-if="$slots['batch-actions']" type="selection" width="40" />

      <!-- 序号列 -->
      <el-table-column type="index" label="序号" width="60" align="center" />

      <!-- 动态列 -->
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        :align="col.align || 'left'"
        :sortable="col.sortable"
        :fixed="col.fixed"
      >
        <template #default="{ row, $index }">
          <slot :name="col.prop" :row="row" :index="$index">
            {{ row[col.prop] }}
          </slot>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column
        v-if="showActions"
        label="操作"
        align="center"
        width="200"
        fixed="right"
      >
        <template #default="{ row, $index }">
          <slot name="actions-prepend" :row="row" :index="$index" />
          <slot name="actions-append" :row="row" :index="$index" />
          <el-button
            v-if="deleteApi"
            type="danger"
            size="small"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 空态（自定义） -->
    <div v-if="$slots.empty && !loading && tableData.length === 0" class="table-empty">
      <slot name="empty" />
    </div>

    <!-- 分页（仅分页模式且数据不为空时显示） -->
    <div v-if="paginated && pagination.total > 0" class="table-pagination">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 15, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑' : '新增账号'"
      :width="dialogWidth"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="formModel" label-width="90px">
        <slot name="form" :form="formModel" :is-edit="isEdit" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// ── 通用 CRUD 表格组件 ──
// 内置：搜索栏、分页、新增/编辑弹窗、表单校验、删除确认、loading/空态/异常
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTableQuery } from '@/composables/useTableQuery'
import type { ColDef } from '@/types'

interface BaseTableProps {
  apiFn: (params: any) => Promise<any>
  columns: ColDef[]
  title?: string
  createApi?: (data: any) => Promise<any>
  updateApi?: (id: number, data: any) => Promise<any>
  deleteApi?: (id: number) => Promise<any>
  filters?: Record<string, any>
  immediate?: boolean
  showActions?: boolean
  pageSize?: number
  dialogWidth?: string
  rowKey?: string
  paginated?: boolean
}

const props = withDefaults(defineProps<BaseTableProps>(), {
  immediate: true,
  showActions: true,
  pageSize: 15,
  dialogWidth: '600px',
  rowKey: 'id',
  paginated: true,
})

const emit = defineEmits<{
  (e: 'delete', row: any): void
}>()

// ── 内部状态 ──
const elTableRef = ref()
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()
const formModel = reactive<Record<string, any>>({})
const selectionRows = ref<any[]>([])

// ── 非分页 API 包装 ──
const queryApi = props.paginated
  ? props.apiFn
  : async (params: any) => {
      const data = await props.apiFn(params)
      const list = Array.isArray(data) ? data : []
      return { list, total: list.length, page: 1, pageSize: list.length || 15 }
    }

const { tableData, pagination, loading, search, handleSearch, handlePageChange, handleSizeChange } =
  useTableQuery(queryApi, props.filters as any)

// ── 初始化加载 ──
onMounted(() => {
  if (props.immediate) search().catch(() => {})
})

// ── 触发表格搜索（重置到第一页） ──
function triggerSearch(params?: Record<string, any>) {
  return handleSearch(params as any)
}

// ── 重置筛选到默认值 ──
function resetFilters() {
  Object.keys(formModel).forEach((k) => delete formModel[k])
}

// ── 弹窗操作 ──
function handleAdd() {
  isEdit.value = false
  editingId.value = null
  Object.keys(formModel).forEach((k) => delete formModel[k])
  dialogVisible.value = true
}

function handleEdit(row: any) {
  isEdit.value = true
  editingId.value = row.id
  Object.keys(formModel).forEach((k) => delete formModel[k])
  Object.assign(formModel, { ...row })
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    if (isEdit.value && editingId.value && props.updateApi) {
      await props.updateApi(editingId.value, { ...formModel })
      ElMessage.success('更新成功')
    } else if (!isEdit.value && props.createApi) {
      await props.createApi({ ...formModel })
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    search()
  } catch (e: any) {
    // 表单校验不通过或 API 报错
    if (e?.message) ElMessage.error(e.message)
  }
}

async function handleDelete(row: any) {
  if (!props.deleteApi) return
  try {
    await ElMessageBox.confirm('确定删除该账号吗？此操作不可撤销。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await props.deleteApi(row.id)
    ElMessage.success('删除成功')
    emit('delete', row)
    search()
  } catch {
    // 用户取消
  }
}

function refresh() {
  pagination.page = 1
  search()
}

function getSelectionRows() {
  return selectionRows.value
}

function handleSelectionChange(rows: any[]) {
  selectionRows.value = rows
}

defineExpose({ refresh, handleAdd, handleEdit, getSelectionRows, triggerSearch })
</script>



<style scoped>
.base-table {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 8px);
  padding: var(--spacing-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
}

/* ── 弹窗美化 ── */
:deep(.el-dialog) {
  border-radius: var(--radius-xl, 12px) !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.06) !important;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  position: relative;
  padding: 20px 24px 16px;
  margin-right: 0;
  border-bottom: 1px solid var(--color-border, #e4e7ed);
}

:deep(.el-dialog__title) {
  font-size: 17px;
  font-weight: 500;
  color: var(--color-text, #303133);
}

:deep(.el-dialog__body) {
  padding: 24px;
}

:deep(.el-dialog__footer) {
  padding: 16px 24px 20px;
  border-top: 1px solid var(--color-border, #e4e7ed);
}

:deep(.el-dialog__footer .el-button) {
  padding: 8px 22px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

:deep(.el-dialog__footer .el-button--primary) {
  background: linear-gradient(135deg, #409eff, #337ecc);
  border: none;
}

:deep(.el-dialog__footer .el-button--primary:hover) {
  background: linear-gradient(135deg, #5aafff, #409eff);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.35);
}

:deep(.el-dialog__footer .el-button--default:hover) {
  background: #f5f7fa;
  border-color: #d9d9d9;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg, 16px);
}

.table-title {
  font-size: var(--font-size-lg, 16px);
  font-weight: 600;
  color: var(--color-text, #303133);
  margin: 0;
}

.table-search {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md, 12px);
  margin-bottom: var(--spacing-lg, 16px);
  padding: var(--spacing-md, 12px);
  background: var(--color-bg, #f5f7fa);
  border-radius: var(--radius-base, 6px);
}

.table-batch {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  margin-bottom: var(--spacing-md, 12px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  background: #ecf5ff;
  border-radius: var(--radius-base, 6px);
}

.batch-info {
  font-size: var(--font-size-sm, 13px);
  color: var(--color-primary, #409eff);
}

.table-body {
  width: 100%;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-lg, 16px);
}

.table-empty {
  padding: var(--spacing-xl, 24px) 0;
}
</style>
