<script setup lang="ts">
// ── 引用文件弹窗组件 ──
// 功能：展示 AI 回复引用的知识库文件，根据角色权限区分可访问性
import { ref, computed } from 'vue'
import type { KnowledgeFile } from '@/types'

const props = defineProps<{
  references: KnowledgeFile[]
  userRole?: 'user' | 'admin' | 'superadmin'
}>()

const visible = ref(false)

// 权限判断：user 角色只能查看公开文件
const accessibleFiles = computed(() => {
  if (!props.userRole || props.userRole === 'admin' || props.userRole === 'superadmin') {
    return props.references
  }
  // user 角色仅显示状态为 1（已发布/公开）的文件
  return props.references.filter(f => f.status === 1)
})

const limited = computed(() => accessibleFiles.value.length < props.references.length)

function toggle() {
  visible.value = !visible.value
}

function openFile(file: KnowledgeFile) {
  if (file.fileUrl) {
    window.open(file.fileUrl, '_blank')
  }
}
</script>

<template>
  <div v-if="references.length > 0" class="refs-popover">
    <button class="refs-toggle" @click="toggle">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <path d="M2 2.5A1.5 1.5 0 013.5 1h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0112 5.622V13.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 13.5v-11z" />
      </svg>
      <span>{{ references.length }} 篇参考</span>
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="currentColor"
        :class="{ rotated: visible }"
        class="chevron"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>

    <Transition name="refs-dropdown">
      <div v-if="visible" class="refs-list">
        <div
          v-for="file in accessibleFiles"
          :key="file.id"
          class="refs-item"
          @click="openFile(file)"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M2 2.5A1.5 1.5 0 013.5 1h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0112 5.622V13.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 13.5v-11z" />
          </svg>
          <span class="refs-title">{{ file.title }}</span>
          <span class="refs-type">{{ file.fileType?.toUpperCase() }}</span>
        </div>
        <div v-if="limited" class="refs-limited">
          部分文件当前角色无法访问
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.refs-popover {
  position: relative;
  margin-top: var(--spacing-sm, 8px);
}

.refs-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-primary, #409eff);
  background: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refs-toggle:hover {
  background: rgba(64, 158, 255, 0.14);
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron.rotated {
  transform: rotate(180deg);
}

.refs-list {
  margin-top: var(--spacing-xs, 4px);
  background: #fff;
  border: 1px solid var(--color-border, #e4e7ed);
  border-radius: var(--radius-base, 6px);
  box-shadow: var(--shadow-base, 0 2px 8px rgba(0, 0, 0, 0.08));
  overflow: hidden;
  max-width: 320px;
}

.refs-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text, #303133);
}

.refs-item:hover {
  background: var(--color-bg, #f5f7fa);
}

.refs-item + .refs-item {
  border-top: 1px solid var(--color-border, #e4e7ed);
}

.refs-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.refs-type {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 4px;
  background: var(--color-bg, #f5f7fa);
  border-radius: 3px;
  color: var(--color-info, #909399);
}

.refs-limited {
  padding: var(--spacing-xs, 4px) var(--spacing-md, 12px);
  font-size: var(--font-size-xs, 12px);
  color: var(--color-warning, #e6a23c);
  background: rgba(230, 162, 60, 0.06);
  border-top: 1px solid var(--color-border, #e4e7ed);
}

/* 过渡动画 */
.refs-dropdown-enter-active,
.refs-dropdown-leave-active {
  transition: all 0.15s ease;
}

.refs-dropdown-enter-from,
.refs-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
