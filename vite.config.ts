import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import { fileURLToPath, URL } from 'url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      VueDevTools({
        // 点击页面元素直接跳转到 VS Code 对应源码
        launchEditor: 'code',
        componentInspector: {
          // 常驻右下角切换按钮：点一下进入检查模式，再点页面元素即可打开源码
          toggleButtonVisibility: 'always',
          toggleButtonPos: 'bottom-right',
        },
      }),
      vue(),
      tailwindcss(),
    ],
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