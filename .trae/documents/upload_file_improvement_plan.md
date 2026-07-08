# 上传文件功能改进计划

## 需求分析

用户需要完成以下两个改进：

1. **上传框变大**：将上传文件的拖放区域变大，使其与外部大框差不多大，便于用户直接拖动上传文件

2. **创建文件接口重新接入**：
   - 用户在输入框输入内容后，点击"确认信息"调用 AI 智能分类接口 `/api/knowledge/upload/ai-classify/`
   - AI 返回后自动填写文件名、关键词、文件描述
   - 用户点击"确认创建"后调用录入文本接口 `/api/knowledge/upload/text/`

## 当前代码分析

### 上传框样式
- 当前 `.upload-center-empty` 类设置了 `padding: 40px` 和 `flex: 1`
- 外部大框 `.upload-section` 设置了 `min-height: 650px`
- 需要增大上传区域，使其占据更多空间

### 创建文件接口
- `handleConfirmInfo` 函数（第213行）：当前将 content 转为 Blob 后调用 `aiClassifyApi`，但 API 接收的是 FormData
- `aiClassifyApi`（第191行）：接收 FormData，发送到 `/knowledge/upload/ai-classify/`
- `uploadTextApi`（第142行）：接收对象数据，发送到 `/knowledge/upload/text/`

## 修改方案

### 1. 上传框样式调整

**文件**: `src/views/knowledge/DocList.vue`

修改 `.upload-center-empty` 样式，增加高度和内边距，使其与外部大框差不多大。

### 2. 创建文件接口调整

**文件**: `src/views/knowledge/DocList.vue`

修改 `handleConfirmInfo` 函数：
- 直接将 `uploadForm.content` 作为参数传给 AI 分类接口
- 需要检查 API 是否支持 `content` 参数，如果不支持则保持当前方式

**文件**: `src/api/knowledge.ts`

可能需要调整 `aiClassifyApi` 以支持文本内容输入。

## 具体步骤

### 步骤1：调整上传框样式
- 修改 `.upload-center-empty` 的 padding 和高度
- 确保上传区域占据外部大框的大部分空间

### 步骤2：修改创建文件流程
- 修改 `handleConfirmInfo` 函数，确保正确调用 AI 分类接口
- 确保 AI 返回的数据正确填充到表单中
- 确保 `handleUploadSubmit` 函数正确调用录入文本接口

### 步骤3：验证功能
- 构建项目确保无编译错误
- 测试上传文件和创建文件功能

## 风险处理

1. **API 兼容性问题**：如果 AI 分类接口不支持直接传 content 参数，需要保持当前的 Blob 转换方式
2. **样式冲突**：调整上传框样式可能影响其他布局，需要仔细测试
3. **数据绑定问题**：确保表单数据正确绑定和更新

## 依赖检查

- 确认 `aiClassifyApi` 支持的参数格式
- 确认 `uploadTextApi` 的参数是否正确映射

## 测试计划

1. 测试上传文件：拖放文件到上传区域，确认文件能正确识别并显示关键词和描述
2. 测试创建文件：输入内容，点击确认信息，确认 AI 正确填写表单，然后点击确认创建，确认文件能正确创建
3. 测试样式：确认上传框变大，便于拖放操作