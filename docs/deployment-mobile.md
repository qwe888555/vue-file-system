# 移动端智能问答 — 部署注意事项

## 一、认证与权限

### 1.1 未登录用户也能提问

移动端支持**未登录用户直接提问**，不需要强制登录。后端需要确保：

```
POST /api/chat/conversations/  →  AllowAny（创建对话）
POST /api/chat/ask/            →  AllowAny（发送问题）
POST /api/chat/voice-ask/      →  IsAuthenticated（语音需要登录）
```

**未登录用户的 conversation.user = null**，不关联任何账号。

### 1.2 已登录用户的权限

```
GET    /api/chat/conversations/       → 仅返回当前用户自己的对话
GET    /api/chat/conversations/{id}/  → 仅创建者可访问
PATCH  /api/chat/conversations/{id}/  → 仅创建者可修改
DELETE /api/chat/conversations/{id}/  → 仅创建者可删除
```

### 1.3 后端判断匿名用户的关键点

```
# ❌ 错误写法（匿名用户必崩）
user_id = request.user.id
user_role = request.user.role

# ✅ 正确写法
user = request.user if request.user.is_authenticated else None
user_id = user.id if user else None
user_role = user.role if user else 'user'
```

---

## 二、SSE 流式响应

### 2.1 响应头

后端 `/api/chat/ask/` 返回 `text/event-stream`，必须设置：

```python
response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
response['Cache-Control'] = 'no-cache'
response['X-Accel-Buffering'] = 'no'    # 禁止 Nginx 缓冲
response['Connection'] = 'keep-alive'
```

### 2.2 如果用了 Nginx 反向代理

```
# nginx.conf 必须配置
proxy_buffering off;
proxy_cache off;
proxy_set_header Connection '';
chunked_transfer_encoding on;
```

**如果不关 Nginx 缓冲，SSE 流会被 Nginx 攒到一大块才推给前端，用户会等很久才看到 AI 回复。**

### 2.3 SSE 事件格式

```
event: start
data: {"conversation_id": 1, "message_id": 10}

event: token
data: {"content": "你"}

event: token
data: {"content": "好"}

event: done
data: {"message_id": 10}
```

> ⚠️ 每行必须以 `\n` 结尾，事件之间**必须空一行**（两个 `\n`）才能被前端正确解析。

---

## 三、语音问答

### 3.1 前端发送的音频格式

| 浏览器 | MediaRecorder 输出格式 | 文件扩展名 |
|--------|----------------------|-----------|
| Chrome | `audio/webm;codecs=opus` | webm |
| Edge | `audio/webm` | webm |
| Firefox | `audio/ogg;codecs=opus` | ogg |
| Safari | `audio/mp4` | mp4 |

**浏览器只能输出 webm/ogg/mp4，无法输出 WAV**。

### 3.2 后端必须做格式转换

```
前端发送 webm → 后端收到 audio_file
  ↓
读取文件头检测实际格式（不依赖文件扩展名）
  ↓
用 pydub 或 FFmpeg 转码为 WAV 16kHz 单声道
  ↓
送 FunASR 识别
```

```python
# 建议：在 speech_to_text() 开头加转码
def speech_to_text(audio_data, file_ext):
    if file_ext in ('webm', 'ogg', 'mp4'):
        audio = AudioSegment.from_file(io.BytesIO(audio_data), format=file_ext)
        audio = audio.set_frame_rate(16000).set_channels(1)
        buffer = io.BytesIO()
        audio.export(buffer, format='wav')
        audio_data = buffer.getvalue()
        file_ext = 'wav'
    # 之后正常送 FunASR
```

### 3.3 ASR 模型加载

启动日志示例（首次需下载模型 ~300MB）：

```
正在加载 ASR 模型: damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404
ASR 模型加载完成，耗时 120.5s, device=cpu
```

> ⚠️ 首次启动需要较长时间下载模型。部署时建议提前下载好模型文件，避免用户首次使用时等太久。

### 3.4 语音文件大小限制

- 最大 10MB（前后端都要校验）
- 小于 512 bytes 视为无效录音

---

## 四、HTTPS 要求

### 4.1 语音功能必须 HTTPS

```
navigator.mediaDevices.getUserMedia()  ← 麦克风权限
navigator.mediaRecorder()             ← 录音
webkitSpeechRecognition               ← 语音转文字
```

这三个浏览器 API **在非 localhost 环境下必须 HTTPS**，否则直接报错。

### 4.2 移动端特别要求

- iOS Safari：麦克风权限需要用户**主动点击**触发，不能自动启动
- Android Chrome：需要 HTTPS
- HTTP 环境下语音按钮点了没反应

---

## 五、CORS 跨域

如果前端和后端不是同一个域名：

```python
# Django settings.py
CORS_ALLOW_ALL_ORIGINS = False  # 生产不要用 *
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',      # 开发环境
    'https://your-frontend.com',  # 生产环境
]
CORS_ALLOW_CREDENTIALS = True
```

---

## 六、未登录用户的 conversation 处理

### 6.1 创建对话（POST）

```python
def perform_create(self, serializer):
    # 已登录 → 关联用户；未登录 → user=null
    if self.request.user.is_authenticated:
        serializer.save(user=self.request.user)
    else:
        serializer.save(user=None)
```

### 6.2 提问时校验 conversation_id

```python
if conversation_id:
    if user:
        # 已登录用户：只能操作自己的对话
        conversation = get_object_or_404(Conversation, id=conversation_id, user=user)
    else:
        # 未登录用户：只能操作刚创建的匿名对话（user=null）
        conversation = get_object_or_404(Conversation, id=conversation_id, user__isnull=True)
```

### 6.3 未登录提问写日志

```python
QueryLog.objects.create(
    user=user,    # ← user 字段必须允许 null=True
    conversation=conversation,
    question=question,
    ...
)
```

---

## 七、性能建议

| 场景 | 建议 |
|------|------|
| 并发高 | SSE 流式输出建议用异步（Daphne/Uvicorn），避免阻塞 |
| ASR 模型 | 模型加载到内存后常驻，不要每次请求都重新加载 |
| 请求超时 | SSE 接口的超时时间设为 5 分钟以上（AI 回答可能较慢） |
| 网络不稳定 | 前端有 30 秒超时自动取消，后端应能优雅处理断连 |

---

## 八、验证清单

部署后逐项验证：

- [ ] 未登录用户能打开移动端、看到输入框
- [ ] 未登录用户能输入问题并收到 AI 回复（SSE 流）
- [ ] 登录后能看到对话历史
- [ ] 重命名/删除对话只影响当前用户
- [ ] 语音消息能正常发送和识别
- [ ] 切换账号后看不到上一个账号的对话
- [ ] SSE 流不卡顿、不攒批
- [ ] HTTPS 下语音功能正常
- [ ] 跨域情况下所有接口正常
