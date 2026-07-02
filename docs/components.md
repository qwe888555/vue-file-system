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

## 后台管理模块（人员 D — src/components/account/）

### BaseTable.vue
- **路径：** `@/components/account/BaseTable.vue`
- **用途：** 通用 CRUD 表格组件（搜索、分页、新增弹窗、删除确认、loading/空态）
- **Props：**
  - `apiFn: (params) => Promise<PaginatedResult<T>>` — 列表查询函数
  - `columns: ColDef[]` — 列定义
  - `title?: string` — 卡片标题
  - `createApi?: (data) => Promise` — 新增接口
  - `deleteApi?: (id) => Promise` — 删除接口
  - `filters?: Record<string, any>` — 默认筛选条件
  - `pageSize?: number` — 每页条数，默认 15
  - `dialogWidth?: string` — 弹窗宽度，默认 '600px'
  - `rowKey?: string` — 行 key，默认 'id'
  - `paginated?: boolean` — 是否分页，默认 true
- **ColDef 类型（`@/types`）：** `prop / label / width / minWidth / align / sortable / fixed`
- **Slots：**
  - `search` — 搜索栏
  - `form` — 新增/编辑弹窗表单 `{ form, isEdit }`
  - `[prop]` — 自定义列渲染 `{ row, $index }`
  - `actions-prepend` — 操作列前置按钮 `{ row, $index }`
  - `batch-actions` — 批量操作栏 `{ selection }`
  - `empty` — 空态内容
- **Expose：** `refresh()` / `handleAdd()` / `handleEdit(row)` / `triggerSearch(params?)` / `getSelectionRows()`
- **使用示例：**
  ```vue
  <BaseTable ref="tableRef" :api-fn="getLocalAccounts" :columns="columns" title="账号管理"
    :create-api="createLocalAccount" :delete-api="deleteLocalAccount" :filters="defaultFilters">
    <template #search>
      <el-input v-model="keyword" placeholder="搜索账号" />
      <el-button @click="handleReset">重置</el-button>
    </template>
    <template #actions-prepend="{ row }">
      <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
    </template>
  </BaseTable>
  ```

### UserEdit.vue
- **路径：** `@/components/account/UserEdit.vue`
- **用途：** 新增/编辑用户表单（账号、密码、角色、所属学院）
- **Props：**
  - `form: Record<string, any>` — 表单数据
  - `isEdit: boolean` — 编辑模式
  - `colleges?: College[]` — 学院下拉列表
  - `hideCollege?: boolean` — 是否隐藏学院字段
- **注意：** 密码字段新增/编辑均显示
- **使用示例：**
  ```vue
  <template #form="{ form, isEdit }">
    <UserEdit :form="form" :is-edit="isEdit" :colleges="colleges" :hide-college="!isSuperAdmin" />
  </template>
  ```

### 页面文件

#### UserList.vue
- **路径：** `@/views/account/UserList.vue`
- **用途：** 账号管理页面（合并了学院管理功能）
- **功能：**
  - 搜索过滤：关键词 + 角色筛选 + 学院筛选（超级管理员可见），输入即搜
  - 新增：弹窗填写账号/密码/角色/所属学院
  - 编辑：点击"编辑"弹窗修改密码/角色/所属学院
  - 删除：确认弹窗后直接删除
  - 批量删除：确认后批量删除选中项
  - 批量编辑密码：确认后将选中账号密码重置为 12345678
- **数据源：** 纯前端本地数据（`localAccounts`），开发模式下使用

### 配置 / 工具文件

#### roles.ts
- **路径：** `@/config/roles.ts`
- **用途：** 集中管理角色元数据（中文名、标签颜色）
- **角色：** `user` / `admin_csic` / `admin_dept` / `superadmin`
- **导出：** `ROLE_CONFIG`（角色→配置映射）、`ROLE_OPTIONS`（下拉选项列表）

#### mock/
- **路径：** `@/mock/`
- **用途：** 开发环境 Mock 数据层，拦截 axios 请求返回假数据
- **文件：** `data.ts`（学院/账号假数据）、`index.ts`（拦截器 + 路由匹配）
- **控制：** `.env.development` 中 `VITE_USE_MOCK='true'` 启用
