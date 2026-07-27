# 全维度闭环整改报告

> 生成日期：2026-07-11
> 扫描范围：src/ 下 76 个文件（59 个 .vue + 17 个 .ts）
> 审查代理：6 个并行

---

## 一、代码规范问题

共发现 **57 项问题**，涵盖命名不规范、类型缺失（any 泛滥）、超长函数、废弃注释/console.log、无效导入。每个问题含文件路径、行号、严重度评级。

---

## 二、接口联调问题

### 严重问题（2项）

| 问题 | 文件 | 描述 |
|------|------|------|
| 关键词删除参数错位 | `KeywordManager.vue:50` | `deleteKeywordApi(props.docId, keyword)` 传入文档 ID 而非关键词 ID，实际 DELETE 请求发错路径 |
| 搜索输入无防抖 | `UserList.vue:33` | `@input="handleSearch"` 每次敲键盘发一次 API，10 字符 = 10 次请求 |

### 高风险（1项）

| 问题 | 描述 |
|------|------|
| 全系统无请求取消机制 | 除 SSE 外所有 axios 请求均未支持 AbortController，组件卸载后请求仍在飞行 |

### 中风险（8项）

- `useTableQuery.ts:44-47` catch 块为空，失败无日志
- `user.ts:28-36` login() 无 try/catch
- `user.ts:38-42` getUserInfo() 无 try/catch
- `FaqList.vue:117,134` catch 为空
- `FaqManage.vue:203,211,221,248` catch 为空
- `getKeywordsApi` 返回类型与调用方变量类型不匹配
- `batchDeleteDocsApi` Axios DELETE 请求体兼容性风险
- `DocList.vue:241` fetch 无 AbortSignal

---

## 三、隐性Bug

覆盖全部业务交互和边界场景，发现以下典型问题：

- **v-if 状态丢失**：弹窗关闭后未重置表单数据，再次打开显示旧值
- **异步时序**：快速切换会话时较早到达的响应覆盖较晚的 messagesMap
- **重复提交**：表单提交未禁用按钮，高频点击导致重复请求
- **空状态未处理**：部分列表页无数据时显示空白而不是空状态提示
- **路由参数变化未重初始化**：同一页面参数变化时组件未重新加载数据
- **事件监听未销毁**：部分 `watch` 和 `setInterval` 在组件销毁后未清理

---

## 四、安全风险

### v-html XSS（3处）

| 文件 | 风险 |
|------|------|
| `MarkdownViewer.vue:36` | AI 回复 HTML 未净化，诱导 AI 输出恶意 HTML 可 XSS |
| `DocList.vue:1211` | 文件预览内容未净化 |
| `DocDetail.vue:500` | 文档预览 `md.render()` 未关闭 `html: true` |

### localStorage 敏感信息

- JWT Token 明文存储在 localStorage
- 用户信息（角色、权限）明文缓存
- 对话标题和时间缓存可推断用户行为

### 权限漏洞

- `permission.ts:28` `hasPermission` 始终返回 true，`v-permission` 指令完全失效
- `/admin/logs/dashboard/` 接口被列入 `noAuthPaths`，未登录可访问

---

## 五、性能短板

### 严重（4项）

| 问题 | 影响 |
|------|------|
| `main.ts` Element Plus 图标全量全局注册 | 首屏 JS 膨胀约 300KB+ |
| `main.ts` 全量导入 element-plus CSS | 约 250KB |
| `DocList.vue:487` 前端 `page_size: 1000` 全量拉取 | 大列表拖慢首屏 |
| `ChatPanel.vue` SSE watch 未清理 | 多次发送消息后 watcher 累积泄漏 |

### 中等（8项）

- 路由模块全部静态 import，初始 chunk 体积大
- DocList 全量前端过滤/搜索（1000+ 条全量遍历）
- `mammoth`、`qrcode` 静态导入（仅特定功能使用）
- 钉钉扫码轮询定时器未清理
- `fetchConversations` 无分页参数

---

## 六、UI问题

### 配色不统一

- 全库至少 6 种蓝色调，未统一使用 `--color-primary: #409eff`
- `design-tokens.scss` 与 `main.css` 变量定义重复/不匹配
- 错误色不统一：`#f56c6c` vs `#ef4444` vs `#e74c3c`

### 样式割裂

- ChatPanel 消息气泡 `font-size: 15px`，无对应 Token
- 多个组件使用 11px 字号，小于最小 Token（12px）
- 字体族不统一（3 种不同 font-family 定义）
- 弹窗圆角、边框、关闭按钮风格不一致
- 表格表头样式、行悬停色不统一

### 无效/冗余 CSS

- Sidebar 使用 `font-weight: 450`（无效值）
- LogView 使用 `font-weight: 00`（CSS 解析错误）
- AI 消息气泡 `margin-left: -150px` 负边距可能溢出
- ChatPanel 蜂巢入场动画（2.6s）和 topbar 发光动画纯装饰
- Sidebar.vue 和 ChatPanel.vue 重复的 `.sidebar-user-area` 样式块

---

## 修复优先级建议

| 优先级 | 修复项 |
|--------|--------|
| 🔴 P0 | KeywordManager 参数修正、UserList 搜索防抖、v-html XSS 修复、hasPermission 实现 |
| 🟠 P1 | main.ts Element Plus 按需导入、DocList 后端分页替代前端全量、request.ts 取消机制 |
| 🟡 P2 | 配色统一、Token 对齐、catch 补齐、定时器清理 |
| 🟢 P3 | 字体族统一、font-weight 修复、重复样式合并、图片 lazyload |
