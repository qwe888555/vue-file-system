<script setup lang="ts">
// ── 退出确认弹窗组件 ──
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Transition name="panel">
    <div v-if="props.show" class="confirm-overlay" @click.self="emit('cancel')">
      <div class="confirm-dialog">
        <div class="confirm-dialog-body">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="var(--color-warning, #e6a23c)">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <p class="confirm-text">确定退出当前账号？</p>
        </div>
        <div class="confirm-dialog-footer">
          <button class="confirm-btn cancel" @click="emit('cancel')">取消</button>
          <button class="confirm-btn confirm" @click="emit('confirm')">确定</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 600; backdrop-filter: blur(2px);
}
.confirm-dialog {
  width: 320px; background: #fff;
  border-radius: var(--radius-xl, 12px);
  box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
  overflow: hidden; animation: dialogIn 0.25s ease;
}
@keyframes dialogIn {
  from { opacity: 0; transform: scale(0.92) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.confirm-dialog-body {
  display: flex; flex-direction: column; align-items: center;
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-xxl, 32px) var(--spacing-xl, 24px);
}
.confirm-text {
  margin: 0; font-size: var(--font-size-base, 14px);
  color: var(--color-text, #303133); text-align: center; line-height: 1.5;
}
.confirm-dialog-footer {
  display: flex; gap: var(--spacing-md, 12px);
  padding: 0 var(--spacing-xl, 24px) var(--spacing-xl, 24px);
}
.confirm-btn {
  flex: 1; height: 40px;
  border-radius: var(--radius-base, 6px);
  font-size: var(--font-size-base, 14px); font-weight: 600;
  cursor: pointer; transition: all 0.2s ease; border: none;
}
.confirm-btn.cancel { background: var(--color-bg, #f5f7fa); color: var(--color-text-secondary, #606266); }
.confirm-btn.cancel:hover { background: var(--color-border, #e4e7ed); }
.confirm-btn.confirm { background: var(--color-danger, #f56c6c); color: #fff; }
.confirm-btn.confirm:hover { background: #e05050; }
</style>
