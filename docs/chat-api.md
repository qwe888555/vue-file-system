# 智能问答模块 — 后端接口需求文档

> 负责人：人员 B
> 最后更新：2026-07-08

---

## 全局说明

### 认证方式

- 所有接口统一使用 **Bearer Token** 认证：`Authorization: Bearer <token>`
- **未登录用户也能提问和创建对话**，但无法查看历史记录、无法删除对话
- 以下接口**必须允许匿名访问**（`AllowAny`）：
  - `POST /chat/ask/`
  - `POST /chat/conversations/`
  - `GET /chat/hot-questions/`
  - `POST /chat/voice-ask/`
- 以下接口**仅限已登录用户**（`IsAuthenticated`）：
  - `GET /chat/conversations/`
  - `DELETE /chat/conversations/{id}/`
  - `PATCH /chat/conversations/{id}/`
  - `GET /chat/message/`
  - `POST /chat/message/{id}/rate/`
  - `GET /chat/message/{id}/references/`

### 基础 URL

```
/api/chat/
```

### 通用响应格式

- 分页列表格式：`{ count: number, results: T[] }`
- 错误格式：`{ detail: string }` 或 `{ field_name: [string] }`

---

## 接口清单

### 1. 创建会话

```
POST /api/chat/conversations/
```

**说明：** 创建一个新对话。未登录用户也可以创建，此时后端不关联用户，而是返回一个会话 ID 供后续提问使用。登录用户创建时自动关联当前用户。

**请求 Body（可选）：**

```json
{
  "title": "新对话"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 否 | 对话标题，默认由前端自动生成 |

**响应 201：**

```json
{
  "id": 1,
  "title": "新对话",
  "created_at": "2026-07-08T10:00:00Z",
  "updated_at": "2026-07-08T10:00:00Z"
}
```

**权限：** AllowAny

---

### 2. 获取会话列表

```
GET /api/chat/conversations/
```

**说明：** 获取当前登录用户的所有会话列表。**未登录用户返回空数组**（前端根据是否有 token 决定是否调用）。

**响应 200：**

```json
{
  "count": 2,
  "results": [
    {
      "id": 1,
      "title": "关于课程的问题",
      "created_at": "2026-07-08T10:00:00Z",
      "updated_at": "2026-07-08T11:30:00Z"
    },
    {
      "id": 2,
      "title": "图书馆借书",
      "created_at": "2026-07-07T09:00:00Z",
      "updated_at": "2026-07-07T10:00:00Z"
    }
  ]
}
```

**权限：** IsAuthenticated（未登录返回空）

---

### 3. 获取会话详情（含消息列表）

```
GET /api/chat/conversations/{id}/
```

**说明：** 获取单条会话及其全部消息。

**响应 200：**

```json
{
  "id": 1,
  "title": "关于课程的问题",
  "created_at": "2026-07-08T10:00:00Z",
  "updated_at": "2026-07-08T11:30:00Z",
  "messages": [
    {
      "id": 10,
      "role": "user",
      "content": "如何选课？",
      "references": null,
      "created_at": "2026-07-08T10:00:00Z"
    },
    {
      "id": 11,
      "role": "assistant",
      "content": "选课流程如下：...",
      "references": [
        { "doc_id": 5, "doc_title": "选课指南", "file_type": "pdf" }
      ],
      "created_at": "2026-07-08T10:00:05Z"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 消息 ID |
| `role` | string | `"user"` 或 `"assistant"` |
| `content` | string | 消息内容 |
| `references` | array | 引用文件列表（可为 null） |
| `created_at` | string | ISO 8601 |

**权限：** 仅创建者可访问

---

### 4. 删除会话

```
DELETE /api/chat/conversations/{id}/
```

**说明：** 删除指定会话及其所有消息。

**响应 204：** 无内容

**权限：** 仅创建者

---

### 5. 重命名会话

```
PATCH /api/chat/conversations/{id}/
```

**说明：** 修改会话标题。

**请求 Body：**

```json
{
  "title": "新的对话名称"
}
```

**响应 200：**

```json
{
  "id": 1,
  "title": "新的对话名称",
  "created_at": "2026-07-08T10:00:00Z",
  "updated_at": "2026-07-08T12:00:00Z"
}
```

**权限：** 仅创建者

**前端行为：** 前端已做乐观更新（先改本地再发请求），后端失败不影响本地显示，但返回正确的 title 会覆盖本地。

---

### 6. 流式问答（核心接口）

```
POST /api/chat/ask/
```

**说明：** 发送用户问题，后端返回 **SSE（Server-Sent Events）** 流式响应。**未登录用户也可以使用。**

**请求 Body：**

```json
{
  "conversation_id": 1,
  "question": "如何重置密码？"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `conversation_id` | number | 是 | 会话 ID |
| `question` | string | 是 | 用户问题 |

**响应：** `text/event-stream` 格式

**事件类型：**

| 事件名 | 触发时机 | data 格式 | 说明 |
|--------|---------|-----------|------|
| `start` | 开始回复 | `{ "message_id": 42 }` | AI 回复的消息 ID |
| `token` | 逐 token 输出 | `{ "content": "选" }` | 每段文本内容，前端拼接显示 |
| `msg` | 逐 token 输出（同 token） | `{ "content": "课" }` | 与 token 事件完全相同 |
| `references` | 引用文件 | `{ "count": 2, "summary": "参考了《选课指南》等" }` | 知识库引用摘要 |
| `references_detail` | 引用详情 | `[{ "doc_id": 5, "doc_title": "选课指南", "file_type": "pdf" }]` | 引用文件详细列表 |
| `suggested` | 建议问题 | `["如何退课？", "学分多少？"]` | 后续建议问题列表 |
| `done` | 回复完成 | `{ "message_id": 42 }` | AI 回复结束 |
| `error` | 出错 | `{ "message": "服务器内部错误" }` | 错误信息 |

**SSE 格式示例：**

```
event: start
data: {"message_id": 42}

event: token
data: {"content": "你好"}

event: token
data: {"content": "，选课流程"}

event: done
data: {"message_id": 42}
```

**权限：** AllowAny（未登录用户可调用）

> ⚠️ **重要：** 前端无论用户是否登录，都会先 POST 创建会话（接口 1），再 POST 此接口提问。如果后端创建会话时不要求登录，但接受未登录用户的 conversation_id 时返回 401，未登录用户将完全无法使用。**请确保未登录用户也能正常使用这两个接口。**

---

### 7. 语音问答

```
POST /api/chat/voice-ask/
```

**说明：** 上传音频文件，后端返回 SSE 流（格式同接口 6）或返回 ASR 文本。

**请求：** `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `audio_file` | File | 是 | 音频文件（支持 webm/ogg/wav/mp4） |
| `conversation_id` | number | 否 | 会话 ID |

**响应：** `text/event-stream`（格式同接口 6），额外支持：

| 事件名 | data 格式 | 说明 |
|--------|-----------|------|
| `asr_text` | `{ "text": "识别出的文字" }` | 语音转文字结果，填入输入框 |

**权限：** AllowAny

---

### 8. 获取热点问题

```
GET /api/chat/hot-questions/?top_k=9
```

**说明：** 获取系统热点问题，显示在欢迎页。建议从 FAQ 高频问题 + 知识库热门文档标题 + 聊天高频问题中综合生成。

**响应 200：**

```json
[
  { "question": "如何重置密码？", "count": 42 },
  { "question": "怎么连接校园网？", "count": 38 },
  { "question": "论文格式要求", "count": 35 }
]
```

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `top_k` | number | 否 | 返回条数，默认 9 |
| `days` | number | 否 | 统计天数范围 |

**权限：** AllowAny

---

### 9. 赞/踩消息

```
POST /api/chat/message/{message_id}/rate/
```

**请求 Body：**

```json
{
  "rating": "like"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `rating` | string | `"like"` 或 `"dislike"` |

**响应 200：** `{ "status": "ok" }`

**权限：** IsAuthenticated

---

### 10. 删除单个会话

```
DELETE /api/chat/conversations/{id}/
```

**说明：** 只允许创建者删除自己的会话。

**响应 204**

**权限：** IsAuthenticated

---

## 前端流量图

```
未登录用户：
  POST /conversations/ → 得到 conv_id
  POST /ask/ → SSE 流式回答
  （看不到历史 / 无法重命名 / 无法删除）

已登录用户：
  POST /conversations/ → 得到 conv_id
  POST /ask/ → SSE 流式回答
  GET  /conversations/ → 获取历史列表
  GET  /conversations/{id}/ → 获取历史消息
  PATCH /conversations/{id}/ → 重命名
  DELETE /conversations/{id}/ → 删除
```

## 常见返回值一览

| HTTP 状态码 | 含义 |
|-------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 删除成功（无内容） |
| 400 | 参数校验失败 |
| 401 | 需要登录但未提供 token |
| 403 | 无权操作（非创建者操作他人会话） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
