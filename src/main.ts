// ── 应用入口 ──
// 人员 A 维护

import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { vPermission } from './directives/permission'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 全局注册所有 Element 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.directive('permission', vPermission)
app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
