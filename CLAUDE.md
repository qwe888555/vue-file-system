# NISU-CD 资源系统 — 项目规范

## 目录功能

```
src/
├── api/
│   ├── request.ts        # Axios 封装（Token 注入、错误拦截）
│   ├── auth.ts           # 登录/用户接口
│   ├── chat.ts           # 智能问答接口（B 负责）
│   ├── knowledge.ts      # 知识库接口（C 负责）
│   └── admin.ts          # 后台管理接口（D 负责）
│
├── assets/
│   ├── main.css           # Tailwind 入口 + CSS 变量
│   └── styles/design-tokens.scss  # 设计 Token（颜色/间距/圆角/阴影）
│
├── components/
│   ├── common/            # 全局公共组件（Loading/Error404/Error500）
│   ├── account/           # 后台管理组件（D 负责）
│   ├── chat/              # 智能问答组件（B 负责）
│   └── knowledge/         # 知识库组件（C 负责）
│
├── composables/           # 组合式函数
│   ├── useRequest.ts      # 通用请求（loading/error/data）
│   ├── useTableQuery.ts   # 表格分页+筛选（C 使用）
│   └── useUpload.ts       # 文件上传封装（C 使用）
│
├── router/
│   ├── index.ts           # 路由入口 + 角色守卫
│   ├── common.ts          # 登录/404 路由
│   ├── chat.ts            # 智能问答路由
│   ├── knowledge.ts       # 知识库路由
│   └── account.ts         # 后台管理路由
│
├── store/                 # Pinia 状态管理
│   ├── user.ts            # 用户信息/Token/角色
│   ├── permission.ts      # 动态菜单/按钮权限
│   └── dict.ts            # 字典数据统一入口
│
├── types/index.ts         # 全局 TS 类型定义
│
├── views/
│   ├── layouts/           # Layout 布局（Header/Sidebar/主体容器）
│   ├── login/             # 登录页
│   ├── profile/           # 个人中心
│   ├── chat/              # 智能问答页面（B 负责）
│   ├── knowledge/         # 知识库页面（C 负责）
│   └── account/           # 后台管理页面（D 负责）
│
└── main.ts                # 应用入口
```

## 命名规范

- 文件夹：`kebab-case`（如 `user-profile/`）
- Vue 文件：`PascalCase`（如 `UserProfile.vue`）
- TS 文件：`camelCase`（如 `useRequest.ts`）
- 导入统一用 `@/` 别名，禁止 `../../`

## 文件结构

```
<script setup>
// 1. 外部导入  2. 类型定义  3. Props/Emits
// 4. Store    5. 响应式    6. Computed
// 7. Watch    8. 生命周期  9. 方法
</script>
<template>...</template>
<style scoped>...</style>
```

## 代码规范

- ESLint + Prettier + husky 已配置，提交前自动格式化
- `<style>` 必须加 `scoped`
- 使用 Design Token 变量（`--color-*`、`--spacing-*` 等）
- 禁止内联样式（动态值需注释说明）
- 优先用 Tailwind 原子样式
