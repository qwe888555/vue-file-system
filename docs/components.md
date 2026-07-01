# 全局/通用组件文档

> 本文档记录项目中所有可复用组件，新增通用组件时务必更新此文档。
> 开发前在群内同步 Props/插槽约定，避免重复造轮。

---

## 全局公共组件（人员 A — src/components/common/）

### Loading.vue
- **路径：** `@/components/common/Loading.vue`
- **用途：** 全屏或区域 loading 状态展示
- **Props：**
  - `loading: boolean` — 是否显示加载态
  - `tip?: string` — 加载提示文字，默认 "加载中..."
  - `type?: 'fullscreen' | 'inline'` — 类型，默认 `inline`
- **使用示例：**
  ```vue
  <Loading :loading="isLoading" tip="数据加载中...">
    <div>加载完成后的内容</div>
  </Loading>
  ```

### Empty.vue
- **路径：** `@/components/common/Empty.vue`
- **用途：** 列表/页面无数据时统一展示
- **Props：**
  - `description?: string` — 空状态描述，默认 "暂无数据"
  - `image?: string` — 自定义图片
- **Slots：**
  - `action` — 空状态下方操作按钮
- **使用示例：**
  ```vue
  <Empty description="暂无文档">
    <template #action>
      <el-button @click="handleCreate">新建</el-button>
    </template>
  </Empty>
  ```

### Error403.vue / Error404.vue / Error500.vue
- **路径：** `@/components/common/Error403.vue` 等
- **用途：** 无权限/页面不存在/服务异常错误页
- **Props：** 无（独立页面）
- **使用：** 路由中直接 `component: () => import('@/components/common/Error403.vue')`

---

## 智能问答模块（人员 B — src/components/chat/）

### SseRenderer.vue
- **路径：** `@/components/chat/SseRenderer.vue`
- **用途：** EventSource 流式逐字打字渲染 + 光标闪烁动画 + 断连重连
- **Props：** `url: string` — SSE 接口地址
- **Emits：** `done`, `error(msg: string)`
- **Expose：** `start()`, `stop()`
- **使用示例：**
  ```vue
  <SseRenderer ref="sseRef" :url="streamUrl" @done="onDone" />
  ```

### MarkdownViewer.vue
- **路径：** `@/components/chat/MarkdownViewer.vue`
- **用途：** Markdown 富文本渲染（代码块、表格、引用）
- **Props：** `content: string` — Markdown 原始内容
- **使用示例：**
  ```vue
  <MarkdownViewer :content="aiResponse" />
  ```

### ReferencesPopover.vue
- **路径：** `@/components/chat/ReferencesPopover.vue`
- **用途：** 文件引用弹窗，根据角色区分展示（普通用户仅计数值）
- **Props：** `references: KnowledgeFile[]`
- **使用示例：**
  ```vue
  <ReferencesPopover :references="message.references" />
  ```

### SuggestedQuestions.vue
- **路径：** `@/components/chat/SuggestedQuestions.vue`
- **用途：** AI 回复下方推荐追问按钮
- **Emits：** `select(question: string)`
- **使用示例：**
  ```vue
  <SuggestedQuestions @select="handleSelectQuestion" />
  ```

---

## 知识库模块（人员 C — src/components/knowledge/）

### UploadProgress.vue
- **路径：** `@/components/knowledge/UploadProgress.vue`
- **用途：** 文件上传实时进度条
- **Props：** `percent: number`, `fileName?: string`
- **使用示例：**
  ```vue
  <UploadProgress :percent="progress" :file-name="fileName" />
  ```

### KeywordManager.vue
- **路径：** `@/components/knowledge/KeywordManager.vue`
- **用途：** 文档关键词 CRUD 弹窗
- **Props：** `fileId: number`
- **Expose：** `open()`
- **使用示例：**
  ```vue
  <KeywordManager ref="kwRef" :file-id="fileId" />
  <el-button @click="kwRef?.open()">管理关键词</el-button>
  ```

### FilterBar.vue
- **路径：** `@/components/knowledge/FilterBar.vue`
- **用途：** 名称搜索（300ms 防抖）、时间范围、文件分类、所属学院筛选
- **Emits：** `search`
- **使用示例：**
  ```vue
  <FilterBar @search="handleSearch" />
  ```

---

## 后台管理模块（人员 D — src/components/admin/）

### CrudTable.vue
- **路径：** `@/components/admin/CrudTable.vue`
- **用途：** 通用 CRUD 表格组件（内置搜索栏、分页、增编弹窗、表单校验、删除确认）
- **Props：**
  - `apiFn: (params) => Promise` — 列表查询接口函数
  - `columns: ColumnDef[]` — 表格列定义
  - `title?: string` — 卡片标题
  - `filters?: Record<string, any>` — 默认筛选条件
  - `showActions?: boolean` — 是否显示操作列，默认 true
- **Emits：** `delete(row)`, 预留自定义事件
- **Slots：** `search` — 搜索栏区域; `form` — 新增/编辑弹窗表单
- **使用示例：**
  ```vue
  <CrudTable
    ref="tableRef"
    :api-fn="getAccountsApi"
    :columns="columns"
    title="用户账号管理"
    @delete="handleDelete"
  >
    <template #search>
      <el-input v-model="keyword" placeholder="搜索..." />
    </template>
    <template #form="{ form, isEdit }">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" />
      </el-form-item>
    </template>
  </CrudTable>
  ```

### TreeTable.vue
- **路径：** `@/components/admin/TreeTable.vue`
- **用途：** 两级树形表格，支持展开折叠、父子关联
- **Props：**
  - `data: any[]` — 树形数据（需含 children）
  - `columns: any[]` — 列定义
  - `loading?: boolean`
- **Emits：** `edit(row)`, `delete(id)`, `addChild(parentId)`
- **使用示例：**
  ```vue
  <TreeTable :data="treeData" :columns="columns" @edit="handleEdit" @delete="handleDelete" />
  ```

### UserForm.vue
- **路径：** `@/components/admin/UserForm.vue`
- **用途：** 新增/编辑用户表单 + 角色/学院选择
- **Props：** `form: any`, `isEdit: boolean`
- **使用：** 配合 CrudTable 的 `#form` 插槽
  ```vue
  <template #form="{ form, isEdit }">
    <UserForm :form="form" :is-edit="isEdit" />
  </template>
  ```
