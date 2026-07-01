# 全局/通用组件文档
## Mobile/FileCard 文件卡片
路径：@/components/mobile/FileCard.vue
用途：移动端展示文件基础卡片
Props
- data Object 文件基础信息 {name,category,size,time}
事件：无
使用示例
<FileCard :data="item" />