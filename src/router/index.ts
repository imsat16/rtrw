import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { PermissionCode } from '@/types/domain'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: 'Masuk' } },
    {
      path: '/panduan',
      name: 'guide',
      component: () => import('@/views/GuideView.vue'),
      meta: { title: 'Panduan Pengguna', public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: 'Dashboard', permission: 'dashboard.view' },
    },
    {
      path: '/wilayah',
      name: 'regions',
      component: () => import('@/views/RegionsView.vue'),
      meta: { title: 'Master Wilayah', permission: 'regions.view' },
    },
    {
      path: '/kartu-keluarga',
      name: 'families',
      component: () => import('@/views/FamilyCardsView.vue'),
      meta: { title: 'Kartu Keluarga', permission: 'families.view' },
    },
    {
      path: '/data-warga',
      name: 'residents',
      component: () => import('@/views/ResidentsView.vue'),
      meta: { title: 'Data Warga', permission: 'families.view' },
    },
    { path: '/kk-warga', redirect: '/kartu-keluarga' },
    {
      path: '/export',
      name: 'export',
      component: () => import('@/views/ExportView.vue'),
      meta: { title: 'Export Laporan', permission: 'reports.view' },
    },
    {
      path: '/pengguna',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: { title: 'Manajemen Pengguna', permission: 'users.view' },
    },
    {
      path: '/rbac',
      name: 'rbac',
      component: () => import('@/views/RbacView.vue'),
      meta: { title: 'Role & Permission', permission: 'rbac.manage' },
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
  if (to.meta.public) return true
  const auth = useAuthStore()
  await auth.initialize()

  if (to.name !== 'login' && !auth.isAuthenticated) return { name: 'login' }
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' }
  const permission = to.meta.permission as PermissionCode | undefined
  if (permission && !auth.hasPermission(permission)) return { name: 'settings' }
  return true
})

export default router
