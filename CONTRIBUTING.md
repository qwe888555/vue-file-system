# 项目开发规范 CONTRIBUTING.md
## 1. 命名规则
1. 文件夹：全部小写短横线命名，例：`mobile-file`，禁止驼峰、中文
2. Vue组件文件：大驼峰 PascalCase，例：`FileCard.vue`
3. js工具文件：小驼峰，例：`usePagination.js`
4. 导入路径统一使用 `@/` 别名指向src，禁止 `../../` 多层相对路径

## 2. 目录使用规则
1. `composables`：存放全局通用业务Hook（分页、上传、权限、设备判断）
2. `constants`：存放枚举、字典、分类、角色、状态码，禁止页面硬编码文字
3. `api`：接口请求文件，按业务拆分，与页面业务解耦
4. `components`：全局公共组件，分pc、mobile子文件夹，复用≥2次才可抽为公共组件
5. `views/pc`：电脑端管理员页面（含上传管理）；`views/mobile`：移动端查看页面，**永久不引入上传组件**

## 3. Vue单文件书写顺序（强制）
`<script setup>` 固定顺序：导入VueAPI → 导入组件/路由 → 导入api/常量/hook → Props/Emits → Pinia仓库 → 响应式变量 → computed → watch → 生命周期 → 业务方法
`<template>` 结构从上至下布局，样式必须添加 `scoped`。

## 4. 权限硬性规则
1. 路由自动识别设备跳转PC/移动端，移动端路由屏蔽所有上传页面
2. 前端隐藏操作按钮为体验控制，后端接口必须二次鉴权，非admin账号禁止调用上传接口

## 5. 样式规范
全局样式变量统一在 `assets/style.css` 定义，页面优先使用Tailwind原子样式，零散色值、尺寸统一调用全局变量。