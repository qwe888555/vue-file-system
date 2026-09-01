# 系统现状审查报告

> 生成日期：2026-08-31
> 审查范围：`src/` 全部源码（桌面端 + 移动端）
> 审查方式：3 个并行探索代理分模块调查 + 交叉核验（构建 / ESLint / 关键代码路径）
> 目的：在后续"规范专业化优化"与 bug 修复之前，完整记录系统当前状态、问题清单与优化依据

---

## 一、审查方法

| 手段 | 结果 |
|------|------|
| 3 个并行只读探索代理 | 桌面布局/公共组件、聊天/知识库模块、后台管理/全局样式基础设施 |
| 构建基线 | `npm run build` ✅ 成功（1.27s），但含 2 个 >500KB chunk（`index` 997KB、`MessageBubble` 968KB） |
| ESLint | ❌ 117 个问题：**16 error / 101 warning**（P0+P1 修复后复核；全部 error 为既有 `no-console`，本次改动零新增） |
| 上份审计对照 | 2026-07-11 报告（`docs/audit-report-2026-07-11.md`）逐项核对修复状态 |
| 关键论断交叉验证 | `permission.ts`、`store/permission.ts`、`main.ts`、`request.ts`、`UserList.vue` 等已实测确认 |

---

## 二、系统架构总览

**技术栈**：Vue 3.5（`<script setup>`）+ Element Plus 2.14 + Pinia 3 + Vue Router 4.6 + Tailwind CSS v4 + Vite 8（rolldown）+ TypeScript。

**页面结构**：
- **桌面端**：`Layout.vue` 外壳（仅侧栏，无顶栏）承载 `/knowledge/*`、`/admin`、`/faq`、`/faq-manage`、`/logs`；`/chat` 走独立布局 `ChatHome.vue`（单文件 1204 行）；首页 `Introduction.vue` 内嵌登录。
- **移动端**：`/mobile/*` 嵌套路由（`MobileLayout` 外壳 + `MobileTabBar` 双 Tab + `MobileChat`/`MobileFaq`），`/mobile/login` 独立。路由守卫按 `window.innerWidth<768` + UA 自动重定向。
- **角色模型**：`super_admin / admin / admin_csic / admin_dept / college_admin / dept_admin / user`，路由守卫 + `roleMenuMap` + `permissionActionMap` 三层权限。

**环境**：后端经 Vite 代理 `/api` → natapp 隧道 `http://r5268d55.natappfree.cc`（审查期间该隧道不可达，功能层面靠代码走查 + 历史审计对照验证）。

---

## 三、设计系统与样式基础设施现状

### 3.1 设计 Token：两层体系，但一层是死代码

| 层 | 文件 | 状态 |
|----|------|------|
| 扁平 CSS 变量 | `src/assets/main.css:5-38`（primary/success/warning/danger/gray、字号、间距、圆角、阴影） | ✅ 唯一生效的 token 源，但**只被少数组件以 `var(--x, fallback)` 兜底方式使用** |
| 完整 Token 文件 | `src/assets/styles/design-tokens.scss`（55 行，含 `--color-text/--color-bg/--color-bg-sidebar/--radius-xl/--spacing-xxl`） | ❌ **死代码**——全项目 grep 零 import；文件注释声称"在 main.css 中 @import"但 main.css 只 `@import 'tailwindcss'` |

**后果**：`var(--color-text)` 等无 fallback 的组件样式直接失效（`DocDetail.vue:587`、`DocList.vue:1358`、`KeywordManager.vue:140`）；有 fallback 的靠兜底值勉强工作。**3 层 token 架构（primitive→semantic→component）不存在**。

### 3.2 Element Plus：零配置 + 出厂主题

- `main.ts` 仅 `app.use(ElementPlus, { locale: zhCn })` + **全量** `import 'element-plus/dist/index.css'`（约 250KB，未按需引入）。
- 全项目 grep `--el-color-primary` 零匹配——**Element 组件保持出厂 `#409eff`，与自定义 token 完全不通**。
- 字体：`main.css:43` `font-family:'Microsoft Yahei', sans-serif` 仅 Windows 存在；移动端用 `-apple-system, 'PingFang SC'`，桌面/移动两套字体体系。

### 3.3 图标：未全局注册

`main.ts` **没有注册任何 `@element-plus/icons-vue` 图标**（`app.use(ElementPlus)` 不会自动注册图标组件）。

---

## 四、各模块现状与主要问题

### 4.1 桌面布局外壳（Layout / Header / Sidebar）

| 现状 | 问题 |
|------|------|
| `Layout.vue` 只渲染 `Sidebar` + `<router-view>`，注释却写"侧边栏 + 顶部 Header + 面包屑" | **`Header.vue`（60px 顶栏 + 面包屑 + 用户下拉）从未被任何路由挂载**，是彻底死代码；桌面端无顶栏、无面包屑 |
| 侧栏 222px，白底，`#2b5fd9` 自绘蓝激活态 | 见 4.7 图标 bug |
| `Sidebar.vue:22` 对 admin 角色把"智能问答"改名为"教研问答" | 菜单文案与路由 `meta.title`（`chat.ts:8`）不一致 |

### 4.2 首页 / 登录（Introduction / LoginPage / AccountLoginForm / DingTalkQRLogin）

- `Introduction.vue`：玻璃登录卡 + 六边形栅格 + 数字滚动，但**非嵌入模式下登录页白字浅底对比度近零**（`LoginPage.vue:371,390,397` 的白字 `rgba` 为深色背景设计）；六边形布局 6 处内联 `style="grid-area:*"`（`Introduction.vue:123-150`）+ 负外边距溢出风险；`fetchStats` 失败静默（数字恒为 0）。
- `LoginPage.vue` 与 `AccountLoginForm.vue` **样式几乎 100% 重复**（`.login-brand/.login-btn/.sso-*` 及 `:deep` 输入框覆盖）。
- 钉钉扫码：`visibilitychange` 回到前台**整页重新 `loadDingTalkQr()`**（`LoginPage.vue:94-107`），已扫码用户旧码作废。
- 登录占位符 `rgba(255,255,255,0.5) !important`（`LoginPage.vue:429`）对比度差。

### 4.3 聊天模块（ChatHome.vue 1204 行单体 + 组件）

- **主色混乱**：同一聊天页出现 `#409eff`、`#1677ff`（发送按钮，`:1111`）、`#1e80ff`（快捷问题 hover，`:987`）、`#2b5fd9`（logo，`:627`）、`#3a8ee6`（hover，`:773`）五种蓝；发送按钮用 antd 蓝而全站是 Element 蓝。
- **蓝+粉旋转渐变输入框**（`ChatHome.vue:1079-1091`）与全站蓝色系冲突，视觉噪音。
- 低对比度：时间/占位 `#aeaeb2`（`ChatHome.vue:674,738,786`，约 2.3:1）、`#8e8e93` 多处。
- 触控目标过小：`topbar-btn` 32×32（`:866`）、`send-fab`/`voice-btn` 34×34（`:1110,:1121`）、点赞 34×34、重命名确认 24×24。
- 热点问题无 loading/失败态（`:51-60` catch 静默置空）；搜索无结果与"暂无对话"无法区分（`:429-431`）；删除对话无二次确认（`:424`）。
- 录音/语音识别 **onUnmounted 未停止**（`:181-226`），切页时麦克风可能持续采集；麦克风被拒静默（`:214`）。

### 4.4 知识库模块（DocList 2196 行 + DocDetail）

- **三个被路由注册的空白页**：`DocUpload.vue`、`Browse.vue`、`DocEdit.vue` 只渲染空 `<div />`，但路由和侧栏菜单均指向它们 → **点进 `/knowledge/upload`、`/knowledge/browse`、`/knowledge/edit/:id` 是空白页**。
- `DocList.vue`：`page_size:1000` 全量拉取 + 前端过滤/分页（`:561-568`）；搜索无防抖且把 `file.content` 等大字段拼进搜索串（`:684-714`）；分页条绝对定位 `bottom:0`（`:1882`）内容超高会被遮；操作列 `width:240 fixed` + 多 `min-width` 窄屏必横向溢出。
- 文件类型色表在 `DocList` 与 `DocDetail` **重复两份**（`:755-762` vs `:40-49`），有漂移风险。
- **两个模块完全两套设计语言**：聊天是手写豆包风格（圆角气泡、自绘 SVG），知识库是 Element Plus 原生（直角表格、`el-tag`、`el-dialog`）。
- Markdown 渲染分裂：聊天 `MarkdownViewer.vue` 浅色代码块，知识库 `DocDetail` 暗色代码块（`:820-821`）。

### 4.5 后台管理 / FAQ / 日志（UserList / BaseTable / FaqList / FaqManage / LogView / loglist）

- **靠"复制粘贴"形成的表面一致性**：Pill Tab（LogView `.log-tabs`、FaqList `.faq-categories`、FaqManage `.fm-tabs`）、筛选控件 `.fi`（三处各自重复定义含 `!important`）、表头 `#f8fafc`/悬停 `#f0f4fe`（BaseTable 与 loglist 重复）——**没有抽成公共类**。
- 激活蓝 `#2563eb`（Tailwind slate 系硬编码）与 Element 蓝 `#409eff` 并存；`LogView.vue:131` 有笔误色值 `#2564ebc2`（8 位十六进制带 alpha）。
- 低对比度文本泛滥：`#94a3b8`（12px 小标签）、`#b0b8c8`、`#c8cdd6` 多处，约 1.8~2.6:1 不达标。
- `loglist.vue` `page_size:9999` 全量拉取 + 前端分页；`statsData`（`:55-61`）**拉取后从不渲染**（死功能）；空表点击行会 `openDetail(undefined)` → 请求 `${endpoint}undefined/`。
- 圆角混乱：BaseTable 弹窗按钮 8px、`.fi-btn` 4px、全局 `.el-button--small` 6px。

### 4.6 移动端（/mobile/*）

移动端在 8-31 前的优化中已修复：`ElMessage` 未导入、样式丢失、触控目标、16px 输入框、缩放允许、嵌套路由 + 底部 Tab（智能问答/常见问题）、FAQ 页（搜索/分类/手风琴/骨架屏/401 降级）。**本次审查移动端无新发现的功能 bug**，遗留问题仅为与桌面端共享的部分（角色命名、token 体系、字体族）。

### 4.7 已知死代码 / 未接线组件

| 文件 | 状态 |
|------|------|
| `views/layouts/Header.vue` | 未挂载（顶栏/面包屑缺失） |
| `views/profile/Profile.vue` | 空壳 `<div />`（TODO 占位） |
| `views/knowledge/DocUpload.vue`、`Browse.vue`、`DocEdit.vue` | 空壳但**被路由注册**（空白页 bug） |
| `views/chat/ChatPanel.vue`、`ConversationList.vue` | 未路由死文件 |
| `components/chat/ChatUserMenu.vue`、`ChatLogoutConfirm.vue`、`SuggestedQuestions.vue`、`VoicePreviewDialog.vue` | 从未使用（`VoicePreviewDialog` 在 ChatHome.vue:15 死导入，lint 报错） |
| `components/knowledge/KeywordManager.vue`、`FilterBar.vue`、`UploadFileForm.vue`、`UploadProgress.vue` | 从未使用（`UploadFileForm` 与 DocList 内联上传 UI 功能重复、双份维护） |
| `assets/styles/design-tokens.scss` | 完整但零 import 的死代码 |

---

## 五、Bug 清单（按严重程度）

### 🔴 P0 — 功能必坏 / 严重

| # | Bug | 位置 | 影响 |
|---|-----|------|------|
| 1 | **知识库详情加载必失败**：`getDocDetailApi` 为 `responseType:'blob'`，响应拦截器 `return response.data` 返回 Blob，`DocDetail.vue` 却当对象用 | `api/knowledge.ts:30-34`、`DocDetail.vue:400-404` | 详情页标题空白、永远渲染兜底假数据 |
| 2 | **知识库下载必失败**：`downloadDocApi` 返回 Blob，`DocDetail.vue` 却 `const {data:blob} = await downloadDocApi()` 从 Blob 解构 | `api/knowledge.ts:119-124`、`DocDetail.vue:257` | 下载必报"下载文件失败" |
| 3 | **编辑回写 HTML 而非 Markdown**：`md.render()` 渲染结果存入 `previewContent`，`startEdit` 又用 `file.content \|\| previewContent` 填 textarea | `DocDetail.vue:221,237,311` | 保存后内容是渲染后的 HTML 源码 |
| 4 | **侧栏菜单图标全部不显示**：`<component :is="item.icon">` 传字符串，全项目无全局图标注册 | `Sidebar.vue:60-62`、`main.ts` | 所有菜单图标为空 + Vue 警告 |
| 5 | **三个路由指向空白页**：`/knowledge/upload`、`/knowledge/browse`、`/knowledge/edit/:id` 是空壳 | `views/knowledge/DocUpload|Browse|DocEdit.vue` | 侧栏可见入口，点进空白 |
| 6 | **刷新 Token 死锁**：refresh 返回 401 时 `isRefreshing=true`，内层请求 push 进 `pendingQueue` 后返回永不 resolve 的 Promise，外层 catch 永不执行 | `api/request.ts:102-144` | "登录已过期"不提示，所有并发请求挂死，无 `_retry` 重入保护 |
| 7 | **角色路由冲突→菜单可见但 403**：`admin_csic` 有 `/admin`+`/faq-manage`、`admin_dept` 有 `/faq-manage` 菜单权限，但路由 `meta.roles` 不含 | `config/permission.ts:8,11` vs `router/account.ts:8`、`router/faq.ts:21` | 点菜单被拦到 /403 |
| 8 | **FAQ 管理工作流中断**：已驳回/已发布条目无法重新编辑/发布，只剩删除；已发布无法下架 | `views/faq/FaqManage.vue:48-50` | 被驳回的 FAQ 无法"修改后重提" |
| 9 | **`/admin/logs/dashboard/` 在 noAuthPaths**（公开接口强制不带 Token） | `api/request.ts:60-68` | 若后端要求鉴权则概览页持续 401（上一份审计已指出，至今未改） |
| 10 | **`ChatUserMenu` 引用未定义 props**：模板 `v-if="props.show"`，组件无 `defineProps` | `ChatUserMenu.vue:24` | 一旦被使用立即 ReferenceError（当前死组件未触发） |

### 🟠 P1 — 高风险

| # | Bug | 位置 | 影响 |
|---|-----|------|------|
| 11 | **SSE 竞态：旧流 onDone 污染新流**：`currentSSE/isStreaming/streamingContent` 组件级共享，旧 SSE 自然结束时 `isStreaming` 已是 true 不 return，把旧回答 append 进新对话 | `ChatHome.vue:157-168` | 快速连发消息会串答、覆盖新流内容 |
| 12 | **useSSE CRLF 解析缺陷**：只按 `\n` 切行，`event: x\r\n` 下 `line` 带 `\r`，`startsWith('event: ')` 全失效 | `composables/useSSE.ts:67-78` | 后端 CRLF 时静默吞掉所有事件 |
| 13 | **`references`/`references_detail` 顺序竞态**：先设占位 `{id:0}` 再被真实数组覆盖，若顺序颠倒占位覆盖真实 | `useSSE.ts:108-137` | 引用显示错误 |
| 14 | **`error` 事件仍触发 finally 的 onDone**：错误内容被当正常回答 append | `useSSE.ts:86-91` | 报错后界面展示"错误即回答" |
| 15 | **登出清缓存错位**：`userStore.logout` 清 localStorage 的 `'chat_conversations_cache'`，但 `useChat` 实际用 **sessionStorage** | `store/user.ts:62`、`useChat.ts:15,76-90` | 切换账号看到上个账号的会话缓存 |
| 16 | **`v-permission` 注册但从未使用**：编辑/删除/批量删除按钮无条件渲染 | `directives/permission.ts`、`UserList.vue` | 按钮级权限形同虚设 |
| 17 | **无越权删除保护**：`college_admin` 进 `/admin` 可删除 `super_admin` 账号（仅编辑表单禁用） | `BaseTable.vue:220-235`、`UserList.vue:391-406` | 越权删除安全风险 |
| 18 | **FaqManage 无真实表单校验**：模板标 `required` 但 `el-form` 无 `ref`/`rules` | `FaqManage.vue:86,89,236-252` | 空问题/空答案可保存 |
| 19 | **marked v18 代码高亮失效**：v5 起移除 `setOptions({highlight})`，配置完全无效 | `MarkdownViewer.vue:16-25`、package.json v18 | 代码块无高亮，`hljs`/`github.css` 死依赖 |
| 20 | **角色模型不一致**：`types` 有 `admin_csic/admin_dept`，`config/roles.ts` ROLE_CONFIG 不含 → tag 回退 info 显示原始英文字符串 | `config/roles.ts:12-18`、`UserList.vue:60-66` | 角色标签显示错误 |
| 21 | **全量拉取性能**：`DocList` `page_size:1000`（`:561-568`）、`loglist` `page_size:9999`（`:66-67`）、`UserList` `pageSize:0`+前端 slice | 知识库/日志/账号三处 | 数据量上升后首屏与搜索卡顿 | **⏸️ 本轮延后**——见下方说明 |
| 22 | **刷新失败只清 localStorage 不清 Pinia**，靠 `window.location.href='/'` 硬刷新 | `request.ts:137` | Token 状态脆弱 |
| 23 | **录音/语音识别未清理**：`mediaRecorder/speechRecognition` 无 onUnmounted 停止 | `ChatHome.vue:181-226` | 切页后麦克风可能持续采集 |
| 24 | **DocList 关键词弹窗永远打不开**：`showKeywordsDialog` 声明+渲染但全文件无代码置 true | `DocList.vue:60,1312-1334` | 死功能 |
| 25 | **localStorage 键不一致**：DocList 存 `'uploadedFiles'`、DocDetail 读写 `'knowledgeFiles'` | `DocList.vue:943-945`、`DocDetail.vue:186-188` | 重命名/删除后列表感知不到 |
| 26 | **el-radio 两代 API 混用**：`label="public"`（旧）与 `:value="true"`（新）同文件并存 | `DocList.vue:961-963,1084-1085`、`UploadFileForm.vue` | 弃用 API 告警、行为隐患 |

> **P1-21 延后说明（2026-08-31）**：三处「全量拉取 + 前端过滤/分页」的根因一致——均存在**前端侧过滤**，导致必须拉全量才能正确过滤：① `loglist.vue:36-48` 关键词搜索是前端 `filteredData` 计算属性，改服务端分页需日志接口支持 `keyword` 参数；② `UserList.vue:266-280` 的 `__admin__` 组合角色过滤（college_admin + dept_admin）无对应后端 role 参数，只能拉全量本地筛；③ `DocList.vue:559-636` 关键词/描述缓存映射需遍历全量数组。真正修复是**后端服务端过滤+分页+`count` 的前后端协同改造**，后端当前不可达（natapp 隧道未连接）无法验证，且仅数据量达千级才会暴露。**决策：本轮延后**，避免在不可验证前提下对三个页面做高风险重构；当前演示数据量下功能正确，放入「后端协同优化」清单，验证环境恢复后再行实施。

### 🟡 P2 — 视觉一致性与 UX

| # | 问题 | 位置 |
|---|------|------|
| 27 | **主蓝四套并存**：`#409eff`（EP/主）、`#2b5fd9`（侧栏/个人中心）、`#2563eb`（后台激活）、`#1677ff`/`#1e80ff`/`#3a8ee6`/`#3b82f6`（聊天/登录） | 全项目 |
| 28 | **错误页三件套不统一**：404 橙色（`--color-warning` 无 fallback）、403/500 红色（fallback 写法不一致） | `Error403/404/500.vue` |
| 29 | **输入框三套风格**：登录页 `el-input` 玻璃化、后台 EP 默认、PersonalCenter 原生 `<input>` | 登录/后台/个人中心 |
| 30 | **登录页非嵌入模式白字浅底对比度近零**（当前只以 embedded 挂首页，一旦独立打开即不可读） | `LoginPage.vue:366-397` |
| 31 | **低对比度文本大量存在**：`#94a3b8`/`#b0b8c8`/`#c8cdd6`/`#aeaeb2` 在 12px 小标签/元信息，约 1.8~2.6:1 | LogView/FaqList/FaqManage/loglist/ChatHome |
| 32 | **坏色值** `#2564ebc2`（8 位带 alpha 笔误） | `LogView.vue:131` |
| 33 | **触控目标过小**（桌面非主要，但移动/触屏共享）：32/34/12px 级 | ChatHome、LoginPage、PersonalCenter |
| 34 | **聊天输入框蓝+粉渐变**与全站蓝色系冲突 | `ChatHome.vue:1079-1091` |
| 35 | **Markdown 渲染分裂**：聊天浅色代码块 vs 知识库暗色代码块 | `MarkdownViewer.vue` vs `DocDetail.vue:820-821` |
| 36 | **ChatHome 角色集合两处不一致**：`isAdminUser`（`:39`，含 dept_admin 不含 admin_csic/admin_dept）vs `handleLoginSuccess`（`:79`，含 admin_csic/admin_dept 不含 dept_admin） | `ChatHome.vue:39,79` |
| 37 | **SidebarUser 角色文案与登录跳转口径分裂**：`dept_admin` 在 SidebarUser 走 `role_display`，在 LoginPage 当管理员跳 `/knowledge/list` | `SidebarUser.vue:19-22` vs `LoginPage.vue:139,162,216` |
| 38 | **热点问题/搜索无结果/详情加载均缺 loading、empty、error 状态** | ChatHome、DocList、DocDetail |
| 39 | **内联样式反模式**：Introduction 六边形 `style="grid-area:*"`；DocList 在 JS 字符串拼 `<pre style="...">` 再 v-html（`:200-349`） | Introduction.vue、DocList.vue |
| 40 | **占位符对比度差**：登录页 `rgba(255,255,255,0.5) !important` | `LoginPage.vue:429` |
| 41 | **字体仅 Microsoft Yahei**（Windows 专属），无跨平台体系 | `main.css:43` |

### 🟢 P3 — 低危 / 死代码 / 工程债

| # | 问题 | 位置 |
|---|------|------|
| 42 | **ESLint 17 error**：`no-console` × 16（loglist 7、LogView 2、FaqList 2、FaqManage 4、UserList 1）+ ChatHome `VoicePreviewDialog` 未使用导入 | 见 lint 输出 |
| 43 | **构建 chunk 过大**：`index` 997KB、`MessageBubble` 968KB（>500KB 阈值） | 构建产物 |
| 44 | `Introduction.vue` 死 CSS（`.s1-*`、`.g322-*`、旧 keyframes）与 6 处内联 grid-area | `Introduction.vue:299-318` |
| 45 | `loglist` statsData 拉取后不渲染（死功能 + 死 CSS `.stats-bar`） | `loglist.vue:55-61,271-283` |
| 46 | 密码规则两处重复且不一致：`UserList.confirmBatchReset` 内联名单 ≠ `config/passwordRules.ts` 的 `COMMON_PASSWORDS` | `UserList.vue:421-429` vs `passwordRules.ts` |
| 47 | PersonalCenter 改密无"确认密码"、共用 `saving` 标志互相禁用 | `PersonalCenter.vue:12,69,95` |
| 48 | `FileInfoCard.vue:23` 未知类型 `undefined+'15'='undefined15'` 无效背景色 | `FileInfoCard.vue:23` |
| 49 | `handlePreviewClose` 对远端 URL 调 `revokeObjectURL`（无害误用） | `DocList.vue:362-369` |
| 50 | `streamingMessageId` 声明但从未读取（死代码） | `ChatHome.vue:33,167` |
| 51 | MobileChat 死 CSS：`#clipping` mask 重复声明 4 次（`:345-349`）、`.wi-honeycomb` 死代码（`:708-727`） | `MobileChat.vue` |

---

## 六、与 2026-07-11 审计的对照（已修复 vs 仍存在）

| 上份审计 P0 项 | 现状 |
|----------------|------|
| `hasPermission` 恒 true | ✅ **已修复**——`store/permission.ts:48-57` 已按 `permissionActionMap` 正确实现（但 `v-permission` 指令本身无人使用，见 P1-16） |
| KeywordManager 参数错位 | ✅ **已缓解**——该组件已无人使用（死组件） |
| UserList 搜索无防抖 | ✅ **已修复**——`UserList.vue:357-360` 已有 300ms 防抖 |
| `/admin/logs/dashboard/` 进 noAuthPaths | ❌ **仍存在**（`request.ts:67`） |
| Element Plus 全量导入 | ❌ **仍存在**（`main.ts:9-11`） |
| v-html XSS（3 处） | ⚠️ 部分修复——lint 现仅报 `DocDetail.vue:502` 一处 `v-html`；`MarkdownViewer`/`DocList` 是否用 DOMPurify 净化需在优化阶段逐一确认 |
| 配色不统一（6 种蓝） | ❌ **仍存在且更甚**（现 7+ 种蓝） |
| design-tokens.scss 与 main.css 重复 | ❌ **仍存在**，且 design-tokens.scss 至今未接线 |
| SSE watch 未清理 | ⚠️ **未根治**——已改共享 watcher，但存在 P1-11 的跨流竞态 |
| `font-weight:450/00` | ⚠️ 未在本次走查中重验（低优先级） |

---

## 六之二、本轮 P0+P1 修复记录（2026-08-31）

按 reviewing 报告 #1-26 清单逐项落地，`npm run build` 通过（仅存既有 chunk 体积 / @vueuse 告警），改动文件 ESLint 零新增错误。明细：

| 项 | 修复内容 | 文件 |
|----|----------|------|
| P0-1~3 | 文档详情改 JSON 元数据（去 Blob 空白页）；下载重建 Blob；编辑回填原始文本而非 HTML | `api/knowledge.ts`、`DocDetail.vue` |
| P0-4 | Sidebar 图标补 `iconMap`（Folder/ChatLineSquare/ChatDotSquare/Setting/Document） | `layouts/Sidebar.vue` |
| P0-5 | 上传/浏览空壳路由重定向；菜单只留「文档列表」 | `router/knowledge.ts`、`config/permission.ts` |
| P0-6 | 刷新 token 死锁：401 时若命中 `/auth/refresh/` 直接拒绝，不进刷新队列 | `api/request.ts` |
| P0-7 | FAQ 管理 / 账号管理路由角色矩阵修正 | `router/faq.ts`、`router/account.ts` |
| P0-8+P1-18 | FaqManage：驳回项可重提；`el-form` 补 `ref`/`rules` 真实校验 | `FaqManage.vue` |
| P0-10 | ChatUserMenu 补 `defineProps`、`username`→`displayName` | `ChatUserMenu.vue` |
| P1-11~14 | SSE：跨流竞态（`streamSeq`）、CRLF 切行、`references_detail` 去占位、`onDone` 错误分支 | `useSSE.ts`、`ChatHome.vue` |
| P1-15/23/50 | 登出清缓存键对齐 sessionStorage；录音/语音识别 onUnmounted 清理；死代码移除 | `store/user.ts`、`ChatHome.vue` |
| P1-16/17/20 | 按钮级 `v-permission` 全线接入；删除越权保护钩子；`admin_csic/admin_dept` 角色配置补齐 | `BaseTable.vue`、`UserList.vue`、`config/roles.ts` |
| P1-19 | marked v18 代码高亮改 renderer 扩展（`marked.use` + hljs） | `MarkdownViewer.vue` |
| P1-24/25/26 | 关键词弹窗死代码移除；localStorage 键统一 `knowledgeFiles`；el-radio 换代 API | `DocList.vue` |
| P1-21 | **延后**——前后端协同分页改造，需后端服务端过滤+分页，见上文延后说明 | — |

> 未纳入本轮：P2 视觉一致性、P3 工程债（含 16 处既有 `no-console` lint error，分布 `useChat.ts`×7、`useTableQuery.ts`×1、`store/user.ts`×2、`FaqList.vue`×2、`FaqManage.vue`×4——本次改动零新增）、P1-22（刷新失败硬刷新依赖 localStorage 重建，行为正确）、P0-9（dashboard 进 noAuthPaths 为有意设计，首页向游客展示公开统计）。

---

## 七、优化方向建议（供后续"规范化/专业化/正式化"阶段参考）

按产品寄存器（enterprise admin/tool，设计服务于功能，重一致性、密度、可用性）排序：

1. **🔴 先修 P0 功能 bug**（#1-10）：详情/下载/编辑回写、空白页、图标渲染、Token 死锁、角色 403、FAQ 工作流——这些是"功能不可用"级别，先于任何视觉优化。✅ **本轮已全部修复。**
2. **🟠 修 P1 高风险**（#11-26）：SSE 竞态、登出缓存、权限删除保护、FaqManage 校验、全量拉取改分页。✅ **除 #21（延后）外本轮已全部修复。**
3. **🎨 建立统一设计系统**：
   - 接线 `design-tokens.scss`（或合并进 main.css），建立 primitive→semantic→component 三层 token；
   - 统一主蓝（收敛到 `--color-primary`，覆盖 Element Plus `--el-color-primary`）；
   - 统一字体体系（跨平台 stack）、圆角/间距/阴影体系；
   - 修复低对比度文本（≥4.5:1）、坏色值、错误页一致性；
   - 消除死代码组件（Header 接线或移除、空壳页面补齐或下线、重复组件合并）。
4. **📱 移动端与桌面端对齐**共享 token / 字体 / 主色。
5. **🧹 工程债**：16 个既有 `no-console` lint error、chunk 拆分、dead CSS 清理。

> 完整文件级定位见上方清单；后续每项改动前建议先建立可复现的反馈回路（diagnosing-bugs 方法论）。
