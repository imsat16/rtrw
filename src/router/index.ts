import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: 'Masuk' } },
    { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Dashboard' } },
    { path: '/wilayah', name: 'regions', component: () => import('@/views/RegionsView.vue'), meta: { title: 'Wilayah' } },
    {
      path: '/kk-warga',
      name: 'families',
      component: () => import('@/views/FamilyCardsView.vue'),
      meta: { title: 'KK & Warga' },
    },
    { path: '/export', name: 'export', component: () => import('@/views/ExportView.vue'), meta: { title: 'Export Laporan' } },
    {
      path: '/pengguna',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: { title: 'Manajemen Pengguna' },
    },
    {
      path: '/pengaturan',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'Pengaturan' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.initialize()

  if (to.name !== 'login' && !auth.isAuthenticated) return { name: 'login' }
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' }
  if (to.name === 'regions' && !auth.canManageRegions) return { name: 'dashboard' }
  if (to.name === 'users' && !auth.canManageUsers) return { name: 'dashboard' }
  return true
})

export default router
