<script setup lang="ts">
/**
 * 超级管理员「全部部门」浏览态下的部门导航树。
 * 只负责筛选浏览范围，不改变顶部「查看范围」；
 * 需要进入某部门上传/维护时，由页面上的「进入该部门管理」按钮切换范围。
 */
import { computed, ref } from 'vue'
import { Files, FolderOpened, OfficeBuilding } from '@element-plus/icons-vue'
import type { College } from '@/types'
import type { Department } from '@/api/admin'

const props = defineProps<{
  colleges: College[]
  departments: Department[]
  /** 各学院直属资料数（不含下级部门） */
  collegeCounts: Record<number, number>
  /** 各部门直属资料数（组件内部会累加下级部门） */
  departmentCounts: Record<number, number>
  totalCount: number
  selectedKind: 'school' | 'college' | 'department'
  selectedId: number | null
  loading: boolean
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-school'): void
  (e: 'select-college', college: College): void
  (e: 'select-department', department: Department): void
}>()

interface DeptRow {
  department: Department
  depth: number
  hasChildren: boolean
}

const keyword = ref('')
const collegesOpen = ref(true)
const departmentsOpen = ref(true)
const expandedIds = ref<number[]>([])

const searching = computed(() => keyword.value.trim().length > 0)
const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())

const visibleColleges = computed(() => {
  if (!searching.value) return props.colleges
  return props.colleges.filter((college) =>
    college.name.toLowerCase().includes(normalizedKeyword.value),
  )
})

const visibleDepartments = computed<Department[]>(() => {
  if (!searching.value) return props.departments
  return filterDepartmentTree(props.departments)
})

function filterDepartmentTree(nodes: Department[]): Department[] {
  const query = normalizedKeyword.value
  return nodes.reduce<Department[]>((result, node) => {
    const children = filterDepartmentTree(node.children || [])
    const selfMatched = node.name.toLowerCase().includes(query)
    if (selfMatched) {
      // 命中自身时保留完整子树，方便直接查看下级部门
      result.push({ ...node, children: node.children || [] })
    } else if (children.length) {
      result.push({ ...node, children })
    }
    return result
  }, [])
}

/** 部门含下级部门的资料总数，父节点点击时也包含子部门资料 */
const subtreeCounts = computed<Record<number, number>>(() => {
  const counts: Record<number, number> = {}
  const visit = (node: Department): number => {
    const own = Number(props.departmentCounts[node.id] || 0)
    const children = (node.children || []).reduce(
      (sum, child) => sum + visit(child),
      0,
    )
    const total = own + children
    counts[node.id] = total
    return total
  }
  props.departments.forEach(visit)
  return counts
})

const collegeGroupCount = computed(() =>
  props.colleges.reduce(
    (sum, college) => sum + Number(props.collegeCounts[college.id] || 0),
    0,
  ),
)

const departmentGroupCount = computed(() =>
  props.departments.reduce(
    (sum, node) => sum + Number(subtreeCounts.value[node.id] || 0),
    0,
  ),
)

const departmentRows = computed<DeptRow[]>(() => {
  const rows: DeptRow[] = []
  const visit = (nodes: Department[], depth: number) => {
    nodes.forEach((node) => {
      const hasChildren = Boolean(node.children?.length)
      rows.push({ department: node, depth, hasChildren })
      if (hasChildren && isExpanded(node)) visit(node.children || [], depth + 1)
    })
  }
  visit(visibleDepartments.value, 0)
  return rows
})

function isExpanded(node: Department): boolean {
  return searching.value || expandedIds.value.includes(node.id)
}

function toggleDepartment(node: Department) {
  if (!node.children?.length) return
  const index = expandedIds.value.indexOf(node.id)
  if (index >= 0) expandedIds.value.splice(index, 1)
  else expandedIds.value.push(node.id)
}

function selectDepartment(node: Department) {
  if (node.children?.length && !expandedIds.value.includes(node.id)) {
    expandedIds.value.push(node.id)
  }
  emit('select-department', node)
}

function isCollegeSelected(college: College): boolean {
  return props.selectedKind === 'college' && props.selectedId === college.id
}

function isDepartmentSelected(node: Department): boolean {
  return props.selectedKind === 'department' && props.selectedId === node.id
}

function depthClass(depth: number): string {
  return `depth-${Math.min(depth, 3)}`
}
</script>

<template>
  <section class="dept-scope" :class="{ embedded }">
    <div class="scope-head">
      <h2>部门导航</h2>
      <p v-if="!embedded">按学院或部门快速筛选全校资料</p>
    </div>

    <el-input
      v-model="keyword"
      class="scope-search"
      size="small"
      placeholder="搜索学院或部门"
      prefix-icon="Search"
      clearable
    />

    <div class="tree-wrap">
      <div v-if="loading" class="tree-hint">部门信息加载中…</div>
      <template v-else>
        <div
          class="root-row"
          :class="{ selected: selectedKind === 'school' }"
          role="button"
          tabindex="0"
          :aria-current="selectedKind === 'school' ? 'true' : undefined"
          @click="emit('select-school')"
          @keydown.enter="emit('select-school')"
          @keydown.space.prevent="emit('select-school')"
        >
          <el-icon class="row-icon root-icon"><Files /></el-icon>
          <span class="row-name">全校总览</span>
          <span class="row-count">{{ totalCount }}</span>
        </div>

        <div class="group">
          <button type="button" class="group-label" @click="collegesOpen = !collegesOpen">
            <span class="caret-slot">
              <span class="caret" :class="{ open: collegesOpen || searching }"></span>
            </span>
            <span>二级学院</span>
            <span class="group-count">{{ collegeGroupCount }}</span>
          </button>
          <div v-if="collegesOpen || searching" class="group-body">
            <div
              v-for="college in visibleColleges"
              :key="`college-${college.id}`"
              class="tree-row"
              :class="{ selected: isCollegeSelected(college) }"
              role="button"
              tabindex="0"
              :aria-current="isCollegeSelected(college) ? 'true' : undefined"
              @click="emit('select-college', college)"
              @keydown.enter="emit('select-college', college)"
              @keydown.space.prevent="emit('select-college', college)"
            >
              <span class="caret-space"></span>
              <el-icon class="row-icon college-icon"><OfficeBuilding /></el-icon>
              <span class="row-name" :title="college.name">{{ college.name }}</span>
              <span class="row-count" :class="{ zero: !collegeCounts[college.id] }">
                {{ collegeCounts[college.id] || 0 }}
              </span>
            </div>
            <div v-if="!visibleColleges.length" class="tree-hint dense">
              未找到匹配的学院
            </div>
          </div>
        </div>

        <div class="group">
          <button
            type="button"
            class="group-label"
            @click="departmentsOpen = !departmentsOpen"
          >
            <span class="caret-slot">
              <span class="caret" :class="{ open: departmentsOpen || searching }"></span>
            </span>
            <span>行政部门</span>
            <span class="group-count">{{ departmentGroupCount }}</span>
          </button>
          <div v-if="departmentsOpen || searching" class="group-body">
            <div
              v-for="row in departmentRows"
              :key="`dept-${row.department.id}`"
              class="tree-row dept-row"
              :class="[
                depthClass(row.depth),
                { selected: isDepartmentSelected(row.department) },
              ]"
              role="button"
              tabindex="0"
              :aria-current="isDepartmentSelected(row.department) ? 'true' : undefined"
              @click="selectDepartment(row.department)"
              @keydown.enter="selectDepartment(row.department)"
              @keydown.space.prevent="selectDepartment(row.department)"
            >
              <button
                v-if="row.hasChildren"
                type="button"
                class="caret-btn"
                :aria-label="isExpanded(row.department) ? '收起下级部门' : '展开下级部门'"
                @click.stop="toggleDepartment(row.department)"
                @keydown.stop
              >
                <span class="caret" :class="{ open: isExpanded(row.department) }"></span>
              </button>
              <span v-else class="caret-space"></span>
              <el-icon class="row-icon dept-icon"><FolderOpened /></el-icon>
              <span class="row-name" :title="row.department.name">
                {{ row.department.name }}
              </span>
              <span
                class="row-count"
                :class="{ zero: !subtreeCounts[row.department.id] }"
              >
                {{ subtreeCounts[row.department.id] || 0 }}
              </span>
            </div>
            <div v-if="!departmentRows.length" class="tree-hint dense">
              未找到匹配的部门
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.dept-scope {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 14px 10px 10px;
}

.scope-head {
  padding: 0 4px;
}

.scope-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 13.5px;
  font-weight: 650;
}

.scope-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.scope-search {
  margin: 10px 4px 0;
}

.scope-search :deep(.el-input__wrapper) {
  min-height: 30px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px #e5ecf5 inset;
  font-size: 12px;
}

.scope-search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #93b4e8 inset;
}

.tree-wrap {
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  padding-right: 2px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.root-row,
.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  color: #334155;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  user-select: none;
}

.root-row {
  color: #1e293b;
  font-weight: 650;
}

.root-row:hover,
.tree-row:hover {
  background: #f5f8fd;
}

.root-row.selected,
.tree-row.selected {
  background: #eef4ff;
  color: #1d4ed8;
  font-weight: 650;
}

.row-icon {
  flex-shrink: 0;
  color: #7d93b2;
  font-size: 14px;
}

.root-icon {
  color: #5479a9;
}

.college-icon {
  color: #6b93c9;
}

.dept-icon {
  color: #b08c4f;
}

.root-row.selected .row-icon,
.tree-row.selected .row-icon {
  color: #2563eb;
}

.row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-count {
  flex-shrink: 0;
  min-width: 20px;
  padding: 0 5px;
  border-radius: 9px;
  background: #f1f5fa;
  color: #64748b;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 17px;
  text-align: center;
}

.row-count.zero {
  background: transparent;
  color: #a8b4c6;
}

.root-row.selected .row-count,
.tree-row.selected .row-count {
  background: #dfeaff;
  color: #1d4ed8;
}

.group {
  margin-top: 8px;
}

.group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  font: inherit;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-align: left;
  cursor: pointer;
}

.group-label:hover {
  color: #64748b;
}

.group-count {
  margin-left: auto;
  color: #a3b0c2;
  font-weight: 500;
  letter-spacing: 0;
}

.caret-slot,
.caret-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.caret-btn {
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.caret-btn:hover {
  background: #e8effa;
}

.caret {
  display: block;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid #94a3b8;
  transform-origin: 35% 50%;
  transition: transform 0.16s ease;
}

.caret.open {
  transform: rotate(90deg);
}

.caret-space {
  flex-shrink: 0;
  width: 16px;
}

.tree-row.depth-0 {
  padding-left: 10px;
}

.tree-row.depth-1 {
  padding-left: 26px;
}

.tree-row.depth-2 {
  padding-left: 42px;
}

.tree-row.depth-3 {
  padding-left: 58px;
}

.tree-hint {
  padding: 10px;
  color: #a3b0c2;
  font-size: 11.5px;
}

.tree-hint.dense {
  padding: 6px 10px 8px 26px;
}
</style>
