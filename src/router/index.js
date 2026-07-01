import { useDevice } from '@/composables/useDevice'
import { usePermission } from '@/composables/usePermission'

const { isMobile } = useDevice()
const { canUpload } = usePermission()
import { createRouter, createWebHistory } from 'vue-router'
const routes = [
  { path: '/', redirect: '/chat' },
  {
    path: '/chat',
    name: 'ChatPage',
    component: () => import('../views/chat/index.vue')
  }
]
const router = createRouter({
  history: createWebHistory(),
  routes
})
export default router