# 后端修改说明 — 智能问答权限调整

## 修改文件：`chat/views.py`

### 修改前

```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

class ConversationViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]  # 所有操作都要登录
    # ...

class AskQuestionView(APIView):
    permission_classes = [IsAuthenticated]  # 提问也要登录
    # ...
```

### 修改后

```python
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

class ConversationViewSet(ModelViewSet):
    # 创建对话（POST）允许匿名，其他操作（GET/PATCH/DELETE）需要登录
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        # 如果用户已登录，关联用户；未登录则 user 为 null
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(user=self.request.user)
        else:
            serializer.save(user=None)
    # ...

class AskQuestionView(APIView):
    # 提问允许匿名用户
    permission_classes = [AllowAny]

    def post(self, request):
        # 如果用户已登录，可以取 user 做额外处理
        user = request.user if request.user.is_authenticated else None
        # ... 处理逻辑不变
        # ...
```

## 修改文件：`chat/models.py`（如果需要）

确保 `Conversation` 模型的 `user` 字段允许为空：

```python
class Conversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,          # 允许匿名 → user 为 null
        blank=True,
        db_index=True,
    )
    title = models.CharField(max_length=100, default='新对话')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # ...
```

## 汇总

| 接口 | 修改 | 效果 |
|------|------|------|
| `POST /conversations/` | `AllowAny` + `user` 可空 | 未登录也能创建对话 |
| `GET/PATCH/DELETE /conversations/{id}/` | 保持 `IsAuthenticated` | 只有登录才能看/改/删历史 |
| `POST /ask/` | `AllowAny` | 未登录也能提问 |

前端已做好区分：**电脑端没登录会弹登录框不让发**，移动端没登录可以正常用。
