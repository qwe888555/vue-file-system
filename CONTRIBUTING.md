# 项目开发规范 CONTRIBUTING.md

## 1. 文件职责说明

```
src/api/            # 接口层：封装请求，按业务模块拆分
src/assets/         # 样式资源：全局 CSS + Design Token 变量
src/components/     # 组件层：common 放全局公共组件，其余按模块分包
src/composables/    # 组合式函数：封装可复用的业务逻辑（useXxx）
src/router/         # 路由配置：index 入口 + 按模块拆分，含路由守卫
src/store/          # 状态管理：Pinia，按业务域拆 Store，每文件 ≤200 行
src/types/          # TypeScript 类型定义
src/views/          # 页面级组件 + layouts 布局
```

## 2. 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件夹 | kebab-case | `user-profile/` |
| Vue 文件 | PascalCase | `UserProfile.vue` |
| TS 文件 | camelCase | `useRequest.ts` |

- 禁止同名文件（含不同目录），禁止 `../../` 导入

## 3. 代码约束

- **行数**：单 `.vue` 文件 ≤ **600 行**，超限必须拆子组件
- **内联样式**：禁止（动态计算值例外，需注释说明）
- **`<style>`**：必须加 `scoped`，覆写第三方组件用 `:deep()` 并 CR 备注
- **Design Token**：统一使用 `--color-*`、`--spacing-*`、`--font-size-*`
- **字段来源**：禁止自行编造，必须来自接口文档或后端返回

## 4. 增删改查规范

### 查询
- 输入搜索字段加 **300ms 防抖**，避免高频请求
- 搜索后翻页时查询条件必须保持
- 重置功能必须清空所有条件并重新查询

### 新增/编辑
- 弹窗打开时加载详情数据 → 整体 Loading
- 弹窗内下拉框数据获取 → 下拉框自身 Loading
- 点击确定提交 → 按钮 Loading + 禁用态，防止重复提交
- 弹窗关闭后清空旧数据，下次打开重新 Loading
- 表单校验通过后才可调接口

### 删除
- 删除前必须弹出确认框（`ElMessageBox.confirm`）
- 删除成功后刷新列表，重置分页到第一页
- 批量删除需支持多选 + 确认框

### 数据反显
- 使用可选链 `?.` 和空值合并 `??` 兜底，禁止模板中写三元表达式判断空值
- 字典值统一通过 Store 转换，禁止模板硬编码 `{1: '启用'}`
- 日期/金额统一用工具函数格式化
- 至少验证三种数据场景：正常数据、空数据、异常数据

## 5. 状态与数据流

- **跨模块通信**：Pinia Store > composable > provide/inject（需注释下游） > emit/props
- **禁止**：直接修改另一模块的内部状态或 ref
- **增删改后**：必须刷新列表，相关联组件同步更新
- **接口字段名**：以接口文档或后端返回为准，禁止前端编造

## 6. 工程配置

| 工具 | 作用 | 说明 |
|------|------|------|
| ESLint | 代码质量检查 | 强制启用，禁止 `eslint-disable` |
| Prettier | 代码格式化 | `printWidth:100, singleQuote, semi:false` |
| Husky | 提交前自动检查 | 自动 `eslint --fix` + `prettier --write` |

## 7. Git 协作

- **分支**：`feature/<模块名>-<功能>` / `fix/<描述>`
- **Commit**：`<type>(<scope>): <description>`（如 `feat(chat): 添加流式渲染`）
