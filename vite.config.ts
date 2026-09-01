import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tailwindcss()],
    build: {
      // ── chunk 拆分说明 ──
      // 保持 Rolldown 默认分包（lib/shared 分离 + 按异步路由分发），实测优于自定义 manualChunks。
      // highlight.js 已在 MarkdownViewer 按需注册语言（900kB → 84kB）。
      // Element Plus 全量注册（main.ts app.use(ElementPlus)）使入口 chunk 约 978kB，
      // 属既有架构选择；后续可按需引入（unplugin-auto-import + unplugin-vue-components）瘦身。
      chunkSizeWarningLimit: 1200,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
	          target: env.VITE_API_PROXY || '',
          changeOrigin: true,
          secure: false,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        },
      },
    },
  }
})