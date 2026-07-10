<script setup lang="ts">
defineProps<{
  visible: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  play: []
  cancel: []
  confirm: []
  close: []
}>()
</script>

<template>
  <Transition name="vp-fade">
    <div v-if="visible" class="vp-overlay" @click.self="emit('close')">
      <div class="vp-card">
        <div class="vp-header">
          <span>语音预览</span>
          <button class="vp-close" @click="emit('close')">×</button>
        </div>
        <div class="vp-body">
          <div class="vp-wave" :class="{ playing: isPlaying }">
            <span /><span /><span /><span /><span />
          </div>
          <button class="vp-play-btn" @click="emit('play')">
            <svg v-if="!isPlaying" viewBox="0 0 20 20" width="24" height="24" fill="currentColor"><path d="M5 3l12 7-12 7V3z"/></svg>
            <svg v-else viewBox="0 0 20 20" width="24" height="24" fill="currentColor"><path d="M6 3h3v14H6V3zm5 0h3v14h-3V3z"/></svg>
          </button>
          <p class="vp-hint">点击播放试听，确认后发送</p>
        </div>
        <div class="vp-footer">
          <button class="vp-btn vp-cancel" @click="emit('cancel')">重录</button>
          <button class="vp-btn vp-confirm" @click="emit('confirm')">发送</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* iOS Safari 按钮重置 */
.vp-overlay button {
  -webkit-appearance: none; appearance: none; font-family: inherit;
}
.vp-overlay svg { flex-shrink: 0; }

.vp-fade-enter-active, .vp-fade-leave-active {
  transition: opacity 0.25s ease;
}
.vp-fade-enter-from, .vp-fade-leave-to {
  opacity: 0;
}

.vp-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
}

.vp-card {
  background: #fff; border-radius: 16px; padding: 24px;
  width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,.12);
}

.vp-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 16px; font-weight: 600; margin-bottom: 20px;
}

.vp-close {
  border: none; background: none; font-size: 20px;
  cursor: pointer; color: #909399; padding: 0 4px;
}

.vp-body {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
}

.vp-wave {
  display: flex; align-items: center; gap: 4px; height: 40px;
}
.vp-wave span {
  display: block; width: 4px; height: 12px; border-radius: 2px;
  background: #c0c4cc; transition: all .3s ease;
}
.vp-wave.playing span {
  background: #409eff; animation: vpWave 1.2s ease-in-out infinite;
}
.vp-wave.playing span:nth-child(2) { animation-delay: .1s; }
.vp-wave.playing span:nth-child(3) { animation-delay: .2s; }
.vp-wave.playing span:nth-child(4) { animation-delay: .3s; }
.vp-wave.playing span:nth-child(5) { animation-delay: .4s; }

@keyframes vpWave {
  0%, 100% { height: 12px; }
  50% { height: 36px; }
}

.vp-play-btn {
  width: 56px; height: 56px; border-radius: 50%;
  border: none; background: #409eff; color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: transform .2s;
}
.vp-play-btn:hover { transform: scale(1.08); }

.vp-hint {
  font-size: 13px; color: #909399; margin: 0;
}

.vp-footer {
  display: flex; gap: 12px; margin-top: 20px;
}

.vp-btn {
  flex: 1; padding: 10px 0; border-radius: 8px;
  border: none; font-size: 14px; cursor: pointer; transition: opacity .2s;
}
.vp-btn:hover { opacity: .85; }
.vp-cancel { background: #f0f2f5; color: #606266; }
.vp-confirm { background: #409eff; color: #fff; }
</style>
