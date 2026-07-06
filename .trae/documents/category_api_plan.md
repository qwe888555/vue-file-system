# 分类接口接入计划

## 需求分析
用户需要将一级分类和二级分类接口正确接入到表单的下拉框中：
- 一级分类列表接口：`/api/categories/first-level/`
- 二级分类列表接口：`/api/categories/second-level/`

当前问题：下拉框显示"0"，说明接口路径不正确导致数据未加载。

## 代码分析

### 当前接口路径（错误）
[knowledge.ts](file:///e:/githubfirst/vue-file-system/src/api/knowledge.ts#L83-L91) 中分类接口使用了 `/knowledge/categories/` 前缀，需要修改为 `/categories/`。

### 表单组件
[UploadFileForm.vue](file:///e:/githubfirst/vue-file-system/src/components/knowledge/UploadFileForm.vue#L350-L375) 中的一级分类和二级分类下拉框已实现，但数据未正确加载。

## 修改计划

### 1. 修改 API 接口路径
**文件**: `src/api/knowledge.ts`

将分类接口路径从：
- `/knowledge/categories/first-level/` → `/categories/first-level/`
- `/knowledge/categories/second-level/` → `/categories/second-level/`

### 2. 验证接口调用
确保下拉框能正确显示分类数据，不再显示"0"。

## 潜在风险
- 接口路径变更可能影响其他使用分类接口的地方
- 需要确保 Vite 代理配置能正确转发 `/api/categories/` 请求

## 验证步骤
1. 构建项目确保无语法错误
2. 运行项目测试分类下拉框是否正常显示数据