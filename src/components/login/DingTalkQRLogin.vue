<script setup lang="ts">
defineProps<{
  qrCodeDataUrl: string
  qrLoading: boolean
  qrError: string
  loginSuccess: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()
</script>

<template>
  <div class="login-brand">
    <h2 class="login-title">钉钉扫码登录</h2>
    <p class="login-sub">请使用钉钉扫码登录</p>
  </div>
  <div class="qrcode-wrap">
    <template v-if="loginSuccess">
      <div class="qrcode-placeholder" style="border-color:#22c55e">
        <svg class="w-10 h-10 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <p class="text-sm text-[#22c55e] font-medium mt-2">登录成功，正在跳转...</p>
      </div>
    </template>
    <template v-else>
      <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="钉钉扫码登录" class="qrcode-img" />
      <div v-else-if="qrLoading" class="qrcode-placeholder">
        <svg class="w-8 h-8 text-[#94a3b8] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="text-xs text-[#94a3b8] mt-2">获取二维码中...</p>
      </div>
      <div v-else-if="qrError" class="qrcode-placeholder">
        <p class="text-xs text-[#ef4444]">{{ qrError }}</p>
        <button class="mt-2 text-xs text-[#2563eb] hover:underline" @click="emit('refresh')">重新获取</button>
      </div>
    </template>
  </div>
  <div class="qrcode-actions">
    <button v-if="qrCodeDataUrl && !qrLoading && !loginSuccess" class="qrcode-refresh" @click="emit('refresh')">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
      重新生成
    </button>
  </div>
</template>

<style scoped>
/* ── 品牌 ── */
.login-brand { text-align: center; margin-bottom: 32px; }
.login-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
.login-sub { font-size: 14px; color: #64748b; margin: 0; }

/* ── 扫码登录 ── */
.qrcode-wrap {
  display: flex; justify-content: center; padding: 16px 0 8px;
}
.qrcode-img {
  width: 220px; height: 220px; border-radius: 14px;
  border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;
}
.qrcode-placeholder {
  width: 220px; height: 220px; border-radius: 14px;
  border: 1px solid #e2e8f0; background: #f8fafc;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.qrcode-actions {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.qrcode-refresh {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: #94a3b8; background: none; border: none;
  cursor: pointer; transition: all 0.2s; padding: 4px 10px; border-radius: 6px;
}
.qrcode-refresh:hover { color: #409eff; background: rgba(64,158,255,0.1); }
.qrcode-refresh svg { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.qrcode-refresh:hover svg { transform: rotate(180deg); }
</style>
