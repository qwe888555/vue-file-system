# Vue File System — 项目规范

## 命名规范

- **文件夹**：kebab-case（小写短横线），如 `user-profile/`
- **Vue 组件文件**：PascalCase，如 `UserProfile.vue`
- **JS 工具文件**：camelCase，如 `usePagination.js`
- **常量/枚举文件**：camelCase，如 `fileConstants.js`
- 禁止项目内出现同名文件（含不同目录）
- 导入路径统一使用 `@/` 别名指向 `src/`，禁止 `../../` 多层相对路径

## 目录结构

```
src/
├── api/          # 接口请求层
├── assets/       # 静态资源、全局样式
├── components/   # 全局公共组件
├── composables/  # 组合式函数（Hooks）
├── constants/    # 枚举、字典、常量
├── router/       # 路由配置
├── store/        # 状态管理（Pinia）
├── utils/        # 工具函数
└── views/        # 页面级组件
```

## Vue 文件结构（强制顺序）

```
<script setup>
// 1. 外部依赖导入
// 2. 类型/接口定义
// 3. Props & Emits
// 4. Store / Composable
// 5. 响应式数据
// 6. Computed
// 7. Watch
// 8. 生命周期
// 9. 方法函数
</script>

<template>...</template>

<style scoped>...</style>
```

## 代码规范

- ESLint + Prettier 已配置，提交前自动格式化
- 模板中禁止出现复杂表达式，一律抽为 computed
- 禁止大量内联样式（仅允许动态计算值，且需注释说明）
- `<style>` 必须添加 `scoped`，确需全局样式用 `:global()` 并注释
- 使用 Design Token 变量（`--color-*`、`--spacing-*`、`--font-size-*` 等）

## 样式规范

- 优先使用 Tailwind 原子样式
- Design Token 在 `src/assets/main.css` 中统一管理
- 禁止在业务组件中直接覆写第三方组件库内部类名
