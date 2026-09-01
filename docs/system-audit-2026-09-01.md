# 校园虚拟资源管理系统 — 全端综合审计报告

- **日期**：2026-09-01
- **审计对象**：前端 `vue-file-system`（Vue 3 + Element Plus + Tailwind v4）+ 后端 `campus_resource`（Django + DRF + SimpleJWT + MySQL）
- **方法**：三技能并行审计（`ui-ux-pro-max` 设计 / `diagnosing-bugs` Bug 扫描 / `redesign-existing-projects` 升级方案）+ 在线 API 回归验证
- **性质**：只审计、未改任何代码。修复需另行审批后执行。

---

## 〇、执行摘要

| 维度 | 结论 | 严重度 |
|---|---|---|
| 后端安全 | **存在 1 个可一键提权的 P0 严重漏洞（SSO mock 后门，已实测拿到超管 JWT）**，另有 SSRF、文档越权预览/下载、角色自我提权等共 5 个 P0 | 🔴 立即处理 |
| 后端健壮性 | 外部调用（LLM/OSS/抓取）均有重试兜底，不会 500；但部署默认配置危险、登出不失效 token、登录无限流 | 🟠 高 |
| 前端昨日修复 | 24 项 P0/P1 修复**全部生效**（代码已核实） | ✅ |
| 前端残留 bug | 移动端遗漏 3 项同步（SSE 竞态、游客静默失败、SSE error 卡死）；路由守卫用 `meta.hidden` 当免鉴权白名单（**可绕过登录**）；文档详情页 7 个图标未导入全空白 | 🟠 高 |
| 设计体系 | 双 token 层失效（`design-tokens.scss` 是死代码）、Element Plus 主题未接线、零字体加载 —— 三大系统性问题，导致"看似有设计系统、实则 529 处硬编码色各自为政" | 🟠 中 |
| 在线回归 | 登录 / me / 知识库列表 / 管理列表 / FAQ 分类全部 200；未认证 401、错误 token 401、不存在资源 404 处理正确 | ✅ |

**一句话结论**：功能完整度高于多数 AI 样板站，昨日改动是一次高质量收敛；但**后端存在可被匿名直接利用的提权后门**，必须先修；前端差在移动端一致性；视觉差在"工程默认"而非"专业产品"，按 P0 五条升级半天内可见显著提升。

---

## 一、diagnosing-bugs — 未修复 Bug 清单

### 1.1 后端安全与逻辑问题（P0 ×5 / P1 ×9 / P2 ×11）

标注说明：`[实测]` = 已通过在线接口验证；`[代码]` = 代码级确认（新库无数据，无法在线触发）。引用为 `文件:行号`。

#### 🔴 P0 — 严重（可导致提权 / 越权 / 内网被探测）

| # | 问题 | 位置 | 影响 | 状态 |
|---|---|---|---|---|
| P0-1 | **SSO Mock 后门：任何人可用固定 code 换 super_admin JWT**。`SSO_MOCK_ENABLED` 默认开启，`GET /api/auth/sso/login/` 匿名返回全部 mock code（含 `mock_super_admin`），`POST /callback/` 用该 code 直接签发超管令牌 | `apps/accounts/views.py:116-124, 238-257, 285-357` | 匿名攻击者一键接管全平台 | **[实测] 确认** |
| P0-2 | **未认证 SSRF**：`AskView` 为 `AllowAny`，从问题文本提取 URL 后服务端请求任意地址，无 scheme/host/内网段校验 | `apps/chat/views.py:294, 336-347, 580-635`; `utils/web_fetcher.py:40` | 探测内网 / 云元数据（169.254.169.254）/ 读内网页面 | [代码] |
| P0-3 | **文档预览越权**：`KnowledgeDocPreviewView` 无范围过滤，任一管理员枚举 pk 即可预览全平台任意文档（含 private、未发布）原文 | `apps/knowledge/views.py:947-974, 986-1003` | 跨学院/跨部门读文档全文 | [代码] |
| P0-4 | **普通用户可下载他人私密文档**：`_admin_scope_filter` 的 user 分支放行「本院 + 本部门」，不校验 `visibility`/`status` | `apps/knowledge/views.py:138-170, 389-415` | 违反接口文档声明；private 文档被他人下载；failed/parsing 文档泄露 | [代码] |
| P0-5 | **低管理员可自我提权**：`UserUpdateSerializer.role` 可写且不校验管理范围，`perform_update` 只查更新前角色 | `apps/admin_panel/serializers.py:91-127`; `apps/admin_panel/views.py:142-153, 172-174` | college_admin 把学生改成同级/跨级管理员 | [代码] |

#### 🟠 P1 — 高（信息泄露 / 越权读 / 权限缺口 / 数据错误）

| # | 问题 | 位置 | 状态 |
|---|---|---|---|
| P1-6 | 平台统计接口完全匿名暴露（用户数/上传量/登录聚合） | `apps/admin_panel/views.py:972-997` | **[实测] 确认** |
| P1-7 | FAQ 列表默认返回全部状态（含 draft/rejected 内部口径），仅详情强制 published | `apps/faq/views.py:60-99` | [代码] |
| P1-8 | `AskView` 的 RAG 检索漏传 `department_id`，dept_admin 检索不到本部门文档（VoiceAskView 有传，两链路不一致） | `apps/chat/views.py:307-311`; `utils/rag.py:701-706` | [代码] |
| P1-9 | `_handle_web_query` / `_handle_search_query` 会话所有权未校验（IDOR），可向他人会话注入消息 | `apps/chat/views.py:593-596, 681-684` | [代码] |
| P1-10 | 文档关键词接口无范围过滤，任意登录用户可读任意文档关键词元数据 | `apps/knowledge/views.py:424-438` | [代码] |
| P1-11 | 上传回调允许跨学院归属（`college_id` 可提交任意值），污染他人检索范围 | `apps/knowledge/views.py:690-695, 741-746`; `serializers.py:152-153` | [代码] |
| P1-12 | **语音问答绕过敏感内容拦截**：VoiceAskView 不先 `check_sensitive`，文本被拦的涉密问题可走语音通道 | `apps/chat/views.py:877-927` | [代码] |
| P1-13 | 部署默认配置危险：`SECRET_KEY` 硬编码、`DEBUG=True`、`ALLOWED_HOSTS='*'`、CORS 全开 | `config/settings.py:8-12, 120` | [代码] |
| P1-14 | `ErrorReportingMiddleware` 在 DEBUG 下把异常与堆栈原样返回给客户端 | `config/middleware.py:22-29` | [代码] |

#### 🟡 P2 — 中（一致性 / 功能性 / 性能 / 收尾）

| # | 问题 | 位置 |
|---|---|---|
| P2-15 | Logout 不失效 token（`token_blacklist` 未安装，静默失败） | `apps/accounts/views.py:413-435` |
| P2-16 | 重置/修改密码不失效已签发 token | `apps/admin_panel/views.py:216-244`; `accounts/views.py:201-223` |
| P2-17 | 登录/SSO 无限流，可爆破 | `config/settings.py:124-138` |
| P2-18 | 用户列表 `resource_count` N+1 查询 | `apps/admin_panel/serializers.py:35` |
| P2-19 | 日期提取接口只放行 super_admin/admin，college_admin/dept_admin 被排除 | `apps/knowledge/views.py:1042-1080` |
| P2-20 | data_query 角色范围与 RAG/列表不一致；`admin` 可通过 LLM 拿到全院他人下载链接 | `utils/data_query.py:25-33, 66-75, 191-200, 245` |
| P2-21 | MD5 去重泄露文档存在性；并发上传同 MD5 非原子可产生重复文档 | `apps/knowledge/views.py:679-686`; `utils/oss.py:183-195` |
| P2-22 | Feedback 管理仅 IsAdmin，college_admin/dept_admin 无法处理本院待回复 | `apps/feedback/views.py:30, 63` |
| P2-23 | 上传日志 `complete` 接口越权改状态（不校验归属） | `apps/resources/views.py:255-288` |
| P2-24 | FAQ 列表无服务端分页（全量返回，前端自行分页）—— 即昨日文档 P1-21 的遗留 | `apps/faq/views.py:58` |
| P2-25 | 细项：mock SSO 固定用户名可被占用、HotQuestions 匿名聚合、dept_admin 可建 role×归属不一致数据、关键词重复行、`User.clean()` 在 DRF save 路径不执行、crawler 冗余 `django.setup()` | 多处 |

**后端健康项（无致命问题）**：DeepSeek LLM 调用有指数退避 + Mock 兜底；外部 HTTP 有超时 + 熔断器；OSS 异常均降级不 500；索引/爬取/FAQ 任务有 retry + 终态收尾；启动健康检查为 daemon 线程不会阻塞启动；`apps/classify` 无越权；部门增删接口权限实现正确。注意 `utils/oss.py` 的 STS 生产分支代码被注释（未完成实现，部署需补齐）。

### 1.2 前端 — 昨日（08-31）修复核验：全部生效 ✅

| 编号 | 修复 | 结论 |
|---|---|---|
| P0-1 | 知识库详情改 JSON（非 Blob） | ✅ `src/api/knowledge.ts:30` |
| P0-2 | 下载改 Blob | ✅ `knowledge.ts:118` / `DocDetail.vue:262` |
| P0-3 | 编辑回填原始 Markdown | ✅ `DocDetail.vue:306-309` |
| P0-4 | Sidebar 图标映射 | ✅ `Sidebar.vue iconMap` |
| P0-5 | 空壳路由重定向 | ✅ `router/knowledge.ts:27-43` |
| P0-6 | 刷新 token 死锁 | ✅ `src/api/request.ts:106-108` |
| P0-8 | FAQ 驳回可重新提交 + 校验 | ✅ `FaqManage.vue` |
| P0-10 | ChatUserMenu 用 props.show | ✅（组件本身已死，见 P3-2） |
| P1-11 | SSE 竞态 | ✅ `ChatHome.vue streamSeq` |
| P1-12 | CRLF 解析 | ✅ `useSSE.ts:70` |
| P1-13 | 引用占位不覆盖真实数据 | ✅ `useSSE.ts:115-140` |
| P1-14 | 错误不污染 content | ✅ `useSSE.ts:123-128` |
| P1-15 | 登出清会话缓存 | ✅ `store/user.ts logout()` |
| P1-16/17 | 权限指令 + 删除保护 | ✅ `BaseTable.vue` / `UserList.vue:393-401` |
| P1-19 | marked v18 高亮渲染器 | ✅ `MarkdownViewer.vue` |
| P1-20 | 角色配置补 admin_csic/admin_dept | ✅ `config/roles.ts` |
| P1-22 | 刷新失败跳登录 | ✅ `request.ts:141-146` |
| P1-23 | 桌面录音清理 | ✅ `ChatHome.vue:352,379-386` |
| P1-24 | 关键词弹窗移除 | ✅ `DocList.vue:76` |
| P1-25 | localStorage key 统一 | ✅ `DocList.vue:951` |
| P1-26 | el-radio 新版 API | ✅ `DocList.vue:968+` |

### 1.3 前端 — 新发现 / 仍未修复的 Bug

#### 🟠 P1（功能缺失 / 逻辑错误）

| # | 问题 | 位置 | 状态 |
|---|---|---|---|
| P1-1 | **路由守卫把 `meta.hidden` 当"免鉴权白名单"**，放在登录/角色校验之前 → 未登录可直达 `/knowledge/detail/:id`、`/knowledge/edit/:id`、`/mobile/chat`、`/mobile/faq` | `src/router/index.ts:55-58`（`hidden` 标记见 `knowledge.ts:21,42`、`mobile.ts:11-29`） | **[代码] 确认** |
| P1-2 | 移动端 `MobileChat` 无 `streamSeq`，流中途切会话把 AI 回复写入错误会话 | `MobileChat.vue:112-133` / `useChat.ts:198-220` | [代码] |
| P1-3 | 移动端 `sendMessage` 无登录校验，游客操作静默失败无反馈 | `MobileChat.vue:110-133` | [代码] |
| P1-4 | `useSSE` 收到 `error` 事件不退出读取循环；移动端无看门狗 → `isStreaming` 永久 true，界面卡死 | `useSSE.ts:123-128` | [代码] |

#### 🟡 P2（可见缺陷）

| # | 问题 | 位置 |
|---|---|---|
| P2-1 | **文档详情页 7 个 Element Plus 图标未导入**（ArrowLeft/Edit/Download/Delete/Eye/Loading），渲染全空白 + Vue 警告 | `DocDetail.vue`（导入 L6，使用 L425-551） |
| P2-2 | 移动端清会话缓存用了 localStorage，实际缓存是 sessionStorage → 清不干净，可能串号 | `MobileChat.vue:286,291`; `MobileLogin.vue:29`; `useChat.ts:15,77,97` |
| P2-3 | txt 预览走 `v-html`，`<pre>` 分支永不执行，换行折叠成空格 | `DocDetail.vue:498-504` |
| P2-4 | 聊天/移动端硬编码低对比色 `#8e9ebd`、`rgba(22,119,255,.1)` 未走 token | `ChatHome.vue:1093,1186,1203`; `MobileChat.vue:566`; `MobileTabBar.vue:72` |
| P2-5 | 首页统计接口失败静默吞掉，7 项指标永远显示 0 | `Introduction.vue:89-102` |
| P2-6 | 引用弹窗角色类型是 `'admin'/'superadmin'`，与真实角色 `super_admin/admin_csic/...` 不匹配，管理员权限判断失效 + TS 类型冲突 | `ReferencesPopover.vue:9,16`; `MessageBubble.vue:13` |

#### 🟢 P3（低危 / 清理）

P3-1 `design-tokens.scss` 未接入，`DocDetail.vue:584+`、`DocList.vue:1348+` 的 `var(--color-text)` 无 fallback 全部失效。
P3-2 死代码组件 11 个（Header/Profile/ChatPanel/ConversationList/KeywordManager/FilterBar/UploadFileForm/UploadProgress/ChatUserMenu/SuggestedQuestions/VoicePreviewDialog，全零引用；UploadFileForm 还在用旧版 el-radio）。
P3-3 DocList 重复标题检测只查当前页 8 条。
P3-4 DocList 搜索无防抖且遍历 content/fileData，大列表卡顿。
P3-5 `previewDocApi` 类型缺 `content_type` → TS 类型错误。
P3-6 钉钉二维码切回标签页重建，正在扫码作废。
P3-7 MobileChat 残留全局 style 死类 `.wi-honeycomb` + 重复 mask。
P3-8 `useUpload.calcFileHash` 是伪 MD5（`hash_${name}_${size}_${Date.now()}`），秒传永远走不通。
P3-9 `useTableQuery` 期望 `{list,total}`，与 DRF `{count,results}` 不一致，直接接 DRF 接口会空白。
P3-10 FaqList 客户端二次过滤（后端已带参数）+ 无效 media query。
P3-11 `request.ts` 刷新重试中 `delete originalRequest.baseURL` 冗余写法。
P3-12 ChatHome 语音 ASR 用 `split("\n")` 未处理 CRLF。

---

## 二、ui-ux-pro-max — 专业设计评估

### 2.1 产品类型与推荐风格

校园虚拟资源管理系统 = **教育机构内部管理工具**（企业级 Admin 产品），同时承担官网式门户（首页）+ 客服式交互（智能问答）双角色。推荐 **Accessible & Ethical**（无障碍优先、克制的专业风格）—— 当前色板（主色 `#475569`/slate + 强调 `#2563EB` + 背景 `#F8FAFC`）方向正确。

### 2.2 逐维度评估

| 维度 | 现状 | 评级 | 关键缺口 |
|---|---|---|---|
| **可访问性** | 输入框有焦点环；错误走 ElMessage 非 alert | 🟡 | 无全局 `:focus-visible`，键盘用户无焦点指示；`#8e9ebd` 等小号灰字 <4.5:1 |
| **触控与交互** | 移动端 tabbar/主按钮尺寸合格 | 🟡 | 桌面大量按钮只有 hover 无 active 按压反馈 |
| **性能** | Vite 秒级构建；路由懒加载 | 🟢 | favicon 732KB 拖慢首字节；首页 hero 图未 preload |
| **风格一致性** | 蓝色已收敛为 4 档 | 🟡 | Element Plus 组件仍走出厂 `#409eff`，与自定义 token 两套语言并排；529 处硬编码色值 |
| **布局与响应式** | 有移动端独立页 | 🟢 | 后台各页无 max-width 约束，宽屏贴边拉伸 |
| **字体排印** | `--font-sans` 系统栈；h2 负字距已用 | 🟡 | 零字体加载；欢迎标题 22px/400 撑不起重心；数字非 tabular-nums |
| **动效** | SSE 流式 + 三态加载 | 🟢 | `transition: all` 多处（layout 属性动画）；ChatHome 输入框 8s 旋转渐变噪音大 |
| **表单与反馈** | 校验、错误提示齐全 | 🟢 | 首页统计失败静默吞 0；txt 预览换行丢失 |
| **导航** | 后台侧栏 + 聊天独立侧栏 | 🟢 | 双侧栏实现心智不一；Header.vue 死代码 |

### 2.3 与市场标准的差距（三点最致命）

1. **"看似有设计系统，实则没有"** —— 最核心问题。`design-tokens.scss` 从未被 import，`main.css` 的 token 又只被少数 `var(--x, fallback)` 兜底使用，实际靠 529 处硬编码色各自为政。
2. **Element Plus 主题未接线** —— `--el-color-primary` 全项目零覆盖，后台所有按钮/菜单/表格走出厂蓝，与聊天页手写风格并排，是"两套设计语言"的根源。
3. **零字体加载** —— 标题全靠 700 字重硬撑，"展示感"弱。

**正面确认**：无 `window.alert` 滥用；成功文案无感叹号；FAQ 手风琴/Pill Tab 交互模式本身合理（只改技法不改模式）；昨日已修复主色混乱、空白页、SSE 竞态、录音清理等。

---

## 三、redesign-existing-projects — 升级方案

> 原则：不重写、不用新框架、逐步收敛。按「低风险高收益 → 中风险 → 高风险」排序。**执行前先处理第一部分的后端 P0 安全项**。

### 3.1 三大系统性问题（根治项）

| # | 问题 | 表现 | 修法 |
|---|---|---|---|
| S1 | 双 token 层失效 | `design-tokens.scss` 死代码；`--color-primary-dark` 两处冲突（`#3a8ee6` vs `#337ecc`） | 删除或并入 `main.css` 单一 `:root`，补 `--color-text/--color-bg/--radius-xl/--spacing-xxl` |
| S2 | Element Plus 主题未接线 | 全站组件出厂蓝 | 在 `main.css` 覆盖 `--el-color-primary(-dark-2/-light-3..9)`、`--el-border-radius-base:8px`、`--el-text-color-*` |
| S3 | 零字体加载 | 标题无存在感 | 自托管中文字体（MiSans/HarmonyOS Sans SC 子集）做 `--font-display`；或至少完成负字距 + tabular-nums + 字重三件套 |

### 3.2 P0 — 低风险高收益（建议一次会话做完，约半天）

| # | 项目 | 要点 |
|---|---|---|
| P0-1 | 字体加载 + 标题字阶 | 建 `--text-display/hero/h1/h2/body/caption` 字号阶；欢迎标题 400→600/26px；全局 `tabular-nums`；删 LogView 无效 `uppercase` |
| P0-2 | 收敛灰色双族 + 消灭杂色 | slate 单族统一；`#9b59b6`(紫)、`#1e3a8a`(深海军蓝)、`#22c55e`(绿)、`#ffbf48/#be4a1d`(橙褐) 四类漏网色全部入 token |
| P0-3 | 全局 `:focus-visible` 焦点环 | 约 10 行 CSS，无障碍达标 |
| P0-4 | 按钮 active 按压态 + 统一 transition | 全局 `:active` transform；`transition: all` 收窄为具体属性 |
| P0-5 | 关键数值列 tabular-nums + 低对比文本治理 | 表格/分页/时间数字；`#8e9ebd/#8e8e93` 提亮到 `--color-text-secondary` |

### 3.3 P1 — 中风险（建议按模块分批，约一天）

| # | 项目 | 要点 |
|---|---|---|
| P1-6 | Element Plus 主题接线 | 覆盖 EP 变量，删 BaseTable/登录页为颜色写的 `:deep` |
| P1-7 | 删死 token 层 & 建三层 token | 单一来源；primitive→semantic→component 增量生长 |
| P1-8 | 阴影带色 + 表面质感 | 蓝调阴影；后台内容区加 radial 环境光；卡片"去边框靠阴影"或"无阴影纯色块"二选一 |
| P1-9 | 通用容器 + 圆角刻度 | `max-width:1280px; margin-inline:auto` 容器类；圆角收敛 容器16/卡片12/控件8/药丸全圆 |
| P1-10 | 聊天/登录/MobileFaq 颜色与渐变统一 | 删 ChatHome 输入框 3 层 spin + `#0005` 黑框 + `#111111aa` 背板，改聚焦光晕；用户气泡渐变改纯色 |
| P1-11 | FAQ 展开动画改 grid-rows | 对齐 MobileFaq 正确实现，删 `max-height` 魔法值 |
| P1-12 | 侧栏折叠改 transform | `width` 动画触发 reflow，改 `translateX` + opacity |
| P1-13 | z-index 刻度化 | `--z-base/sticky/overlay/modal/toast` |
| P1-14 | favicon + meta | title 改全称；补 description/og;favicon 压到 ≤8KB |

### 3.4 P2 — 高风险（单独立项，做完先回归）

| # | 项目 | 要点 |
|---|---|---|
| P2-15 | 首页 hero 光影与内容密度 | 压暗层改 90° 渐变（左文右卡各自稳定底）；登录卡去 `min-height` 改 `align-self:stretch`；stat-grid 破三等分 |
| P2-16 | 全局 loading 骨架化 | `DocList/FaqList/BaseTable` 补同构骨架行，转圈仅留按钮内联 |
| P2-17 | 侧栏/导航重构评估 | 抽共享 logo/用户区组件；决策 Header.vue 接线或删除 |
| P2-18 | 死代码与空壳清理 | 删 11 个未接线组件；`DocDetail` 兜底假数据改明确空态 |
| P2-19 | 重复样式合并 | LoginPage 与 AccountLoginForm 登录样式、三处 `.fi` 覆盖、三处 Pill Tab 抽公共类 |

### 3.5 执行顺序建议

```
第 1 步（半天）：后端 P0-1/P0-5（一键提权）→ P0-2/P0-3/P0-4（SSRF/越权）
第 2 步（半天）：前端 redesign P0-1~5（字体、颜色收敛、焦点环、按压态、tabular）
第 3 步（一天）：前端 redesign P1-6~14（EP 接线、死 token、阴影/容器/圆角、动效治理）
第 4 步（单独立项）：前端 P2-15~19 与后端 P1 批量 + P2 治理
```

---

## 四、综合行动建议

### 4.1 必须立即处理（红色）

1. **后端 P0-1 SSO mock 后门** —— 将 `SSO_MOCK_ENABLED` 默认 `False`、生产移除 mock code、`sso/login` 未对接前 404。**上线前不改等于裸奔。**
2. **前端 P1-1 路由守卫** —— `meta.hidden` 与鉴权解耦，引入显式 `meta.public`；仅首页/403/404 放行。
3. **后端 P0-5 角色提权** —— `role/college/department` 仅 super_admin 可写，或写入前按变更后值校验。

### 4.2 建议尽快处理（橙色）

- 后端 P0-2 SSRF、P0-3/P0-4 文档越权、P1-6~P1-14（信息泄露批量）
- 前端 P1-2/3/4 移动端一致性 + P2-1 图标空白 + P2-2 缓存串号

### 4.3 随迭代治理（黄色）

- 后端 P2 全部（token 失效、限流、N+1、分页）
- 前端 P2-3~6、P3 全部（死代码、类型、样式残留）

### 4.4 其他

- **本地环境**：本机 `.env` 的 `SECRET_KEY` 为开发占位符，正式部署必须替换并关闭 DEBUG；`.env.development` 的 `VITE_API_PROXY=http://127.0.0.1:3000` 仅本地有效。
- **昨日文档 P1-21 服务端分页**：确认在后端全目录未找到对应实现，对应现状为 `FAQItemListView.pagination_class=None`（P2-24），前端 `useTableQuery` 的 `{list,total}` 约定与 DRF `{count,results}` 不一致（P3-9），两项需一起规划。
- 修复后应跑一次与本次相同的在线回归（登录/鉴权边界/列表/上传）确认无回归。

---

### 附：本报告数据来源

- 后端扫描：`campus_resource/backend`（只读），引用文件均含行号
- 前端核查：`vue-file-system/src` 当前工作区（含昨日未提交改动）
- 在线实测：`http://127.0.0.1:3000/api/*`（登录、me、知识库、管理、FAQ、SSO、鉴权边界）
- 相关旧档：`docs/system-review-2026-08-31.md`、`docs/future-requirements-assessment-2026-08-31.md`、`campus_resource/docs/code-changes/2026-08-31.md`
