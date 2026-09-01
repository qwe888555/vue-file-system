# E2E 自动化测试报告（Playwright）

**日期**：2026-09-01
**结论**：**75 个测试全部通过，0 失败**（桌面 chromium + 移动 Pixel 5 双 project，三连跑稳定）
**测试用时**：约 18–20 秒

---

## 1. 测试基建

| 项目 | 方案 |
|---|---|
| 测试框架 | Playwright（`fullyParallel: true`，`reuseExistingServer: !CI`） |
| 双端 project | `chromium`（桌面 1280×720）+ `mobile`（Pixel 5，390×844，isMobile 视口） |
| 鉴权策略 | **真实 JWT**：SSO mock 换取 `{access, refresh}` 后注入 localStorage；首次导航由路由守卫 `getUserInfo()` 校验真实 token（mock token 无效，已实证） |
| 登录方式 | UI 登录（首页嵌入式表单 / 移动端 `/mobile/login`）+ SSO 码登录（`mock_*` 8 角色）+ API 级 token 直取 |
| 数据 | 本地 MySQL 种子数据：11 用户、4 学院、4 部门、11 篇文档、12 条 FAQ、上传/查询/操作日志、反馈 |
| 报告 | `--reporter=html` → `playwright-report/index.html`（自包含单文件） |

核心 helper：[e2e/helpers.ts](../e2e/helpers.ts)
- `fetchSsoToken(code)` / `ssoLogin(page, role)` / `uiLogin` / `mobileUiLogin` / `ssoUiLogin`
- 角色速查：`super_admin` / `admin` / `college_admin` / `dept_admin` / `teacher` / `student` / `admin_csic` / `admin_dept`

---

## 2. 覆盖清单（按 spec 文件）

| Spec | 测试数 | 覆盖内容 |
|---|---|---|
| **auth.spec.ts** | 13 | 桌面/移动登录表单校验、SSO 各角色登录、错误文案、游客访问、退出登录、token 持久化 |
| **home.spec.ts** | 5 | 首页标题/Logo、**游客可见平台数据概览（已开放）**、统计数字为种子真实值、区间文案、移动端首页跳转 |
| **chat.spec.ts** | 10 | 游客提问引导、桌面/移动登录后提问收到 SSE 流式回复、会话创建/历史、热点问题、RBAC |
| **knowledge.spec.ts** | 9 | 超管 11 篇文档列表、搜索/空态、预览弹窗、详情页、上传控件、**学院管理员作用域（10 篇）**、学生 UI 重定向、**学生 API 级作用域（仅自己 2 篇）** |
| **admin.spec.ts** | 8 | 账号管理 9 行（排除超管）、搜索、角色 Pill（管理员=学院+部门=3）、所属单位页、日志页加载、RBAC：student→/admin/users 与 /logs、college_admin→/admin/orgs 均 /403 |
| **faq.spec.ts** | 10 | **游客可浏览 FAQ（已开放）**、分类过滤、搜索/空态、卡片展开收起、管理员管理页（全部 10 / 草稿 1 / 已驳回 1）、RBAC：student→/faq-manage /403 |
| **logs.spec.ts** | 8 | 日志页概览 6 Tab + 5 数据块、上传块总数、**查询块 ≥10（含 chat 测试写入）**、登录块时区表缺失优雅降级、上传/查询/操作日志 Tab 列表、RBAC：admin→/logs /403 |
| **mobile-faq.spec.ts** | 7 | 游客 FAQ 列表、分类 chips、分类过滤、搜索/空态、展开收起、底部 CTA 跳转问答 |
| **errors.spec.ts** | 5 | 404 页、未知路径重定向、403 页、移动端 404 重定向 |

**合计 75 个测试**，覆盖：6 类页面（首页/问答/FAQ/知识库/后台/日志）+ 移动端 3 屏、8 种角色、全部 RBAC 越权路径、游客访问、流式 SSE、数据作用域过滤、错误降级。

---

## 3. 测试发现并修复的真实 Bug（5 个）

### 3.1 移动端游客死循环（导航超时）
- **症状**：`/mobile/chat`、`/mobile/faq` 游客访问 → 守卫跳 `'/'` → 移动端又重定向回 `/mobile/chat` → 死循环，页面永不加载。
- **修复**：`src/router/mobile.ts` 给 chat/faq 子路由补 `meta.public: true`。

### 3.2 FAQ 游客无法访问（后端 401 + 前端重定向）
- **症状**：后端「公共接口」实际用 `IsAuthenticated`，游客请求 401；前端 `/faq` 无 `public` 标记，游客被守卫重定向回首页。
- **修复**：
  - `apps/faq/views.py`：`FAQCategoryListView` / `FAQItemListView` 改 `AllowAny`，`get_queryset` 处理匿名用户（游客仅见校级 FAQ，超管见全部，学院管理员额外见本院）。
  - `src/router/faq.ts`：`/faq` 路由加 `meta.public`。

### 3.3 聊天 SSE 崩溃（NameError）
- **症状**：`utils/rag.py` 引用未导入的 `CROSS_ENCODER_TOP_K_OUTPUT`，SSE 流直接抛 `NameError`。
- **修复**：常量随 `rerank_with_cross_encoder` 一并懒导入（sentence_transformers 未装时优雅降级 `candidates[:top_k]`）。

### 3.4 移动端聊天空气泡（死 watcher）
- **症状**：移动端提问后 `.msg-row-ai` 气泡挂载但内容永远为空；桌面端正常。后端已确认正常流式返回。
- **根因**：`MobileChat.vue` 在 setup 期创建 `watch(() => currentSSE?.content.value)` —— 此时 `currentSSE` 为 `null`，getter 短路**未捕获任何响应式依赖**；`currentSSE` 是普通 `let` 变量，赋值不会触发 watcher 重新求值 → watcher 永不触发。
- **修复**：仿照桌面端 `ChatHome.vue`，把 watcher 移入 `sendMessage`、在 `currentSSE = useSSE(...)` **之后**创建 `watch(currentSSE.content, ...)`，并支持解除前一轮 watcher（`stopContentWatch`），`onUnmounted` 清理。

### 3.5 FAQ 管理页请求覆盖竞态
- **症状**：`FaqManage` 点「草稿」Tab 后列表闪回「全部」；并行负载下 `.fm-card` 稳定停在 10 条 10 秒（旧「全部」响应覆盖新「草稿」响应）。
- **修复**：`FaqManage.vue` 的 `loadData()` 补 `searchSeq` 请求序号守卫（与 `FaqList` / `MobileFaq` 已修的同类竞态对齐）。

### 3.6 相关：前期竞态修复（本会话早期）
- `FaqList.vue` / `MobileFaq.vue`：搜索/初次加载并发时慢的旧请求覆盖新结果，补 `searchSeq` 守卫。

---

## 4. 测试中处理的环境依赖与降级

| 项 | 处理 |
|---|---|
| MySQL 时区表为空 | 登录日志统计返回错误 → 页面 `.db-error` 优雅降级（不断言成功，断言「显示错误态不崩溃」） |
| 查询日志总数随 chat 测试增长 | 断言改 `≥ 10`（种子 10 + chat 提问写入） |
| 并行请求竞态 | 全部列表测试先等初始渲染完成再触发搜索/点击 |
| 移动端视口 | FAQ 分类横向滚动、输入框 ≥16px、触控目标 ≥44px 已在视口下验证 |

---

## 5. 运行方式

```bash
# 前置：后端 http://127.0.0.1:3000 + 前端 http://localhost:5173 已启动，DB 已播种
cd vue-file-system
npx playwright test                 # 全套（双 project）
npx playwright test --project=mobile # 仅移动端
npx playwright test e2e/faq.spec.ts  # 单文件
npx playwright show-report           # 查看 HTML 报告
```
