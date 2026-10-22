<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import NavigationIcon from '@/components/NavigationIcon.vue'
import FamilyImportProgress from '@/components/FamilyImportProgress.vue'
import { useFamilyImportStore } from '@/stores/familyImport'
import { useAuthStore } from '@/stores/auth'
import type { PermissionCode } from '@/types/domain'

const auth = useAuthStore()
const importJob = useFamilyImportStore()
const route = useRoute()
const router = useRouter()

const isLogin = computed(() => route.name === 'login')
const isPublicPage = computed(() => Boolean(route.meta.public))
const isStandalonePage = computed(() => isLogin.value || isPublicPage.value)
const initials = computed(() => auth.profile?.displayName?.slice(0, 2).toUpperCase() ?? 'RW')
const mobileDrawerOpen = ref(false)
type NavItem = { label: string; to: string; permission?: PermissionCode }
const navItems = [
  { label: 'Dashboard', to: '/', permission: 'dashboard.view' },
  { label: 'Master Wilayah', to: '/wilayah', permission: 'regions.view' },
  { label: 'Manajemen Pengguna', to: '/pengguna', permission: 'users.view' },
  { label: 'Role & Permission', to: '/rbac', permission: 'rbac.manage' },
  { label: 'Kartu Keluarga', to: '/kartu-keluarga', permission: 'families.view' },
  { label: 'Data Warga', to: '/data-warga', permission: 'families.view' },
  { label: 'Export Laporan', to: '/export', permission: 'reports.view' },
] as NavItem[]
navItems.push(
  { label: 'Pengaturan', to: '/pengaturan' },
  { label: 'Panduan Pengguna', to: '/panduan' },
)

onMounted(() => {
  void auth.initialize()
})

watch(() => route.fullPath, () => {
  mobileDrawerOpen.value = false
})

watch(() => auth.isAuthenticated, (value) => {
  if (!value) mobileDrawerOpen.value = false
})

function canShowLink(permission?: PermissionCode) {
  return permission ? auth.hasPermission(permission) : true
}

function closeMobileDrawer() {
  mobileDrawerOpen.value = false
}

function toggleMobileDrawer() {
  mobileDrawerOpen.value = !mobileDrawerOpen.value
}

async function handleLogout() {
  if (importJob.busy) return
  importJob.dismiss()
  mobileDrawerOpen.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <aside v-if="auth.isAuthenticated && !isStandalonePage" class="sidebar">
      <div class="brand-block">
        <div class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3z M9 20v-7h6v7 M7 10h.01 M17 10h.01" /></svg></div>
        <div>
          <strong>RT/RW Digital</strong>
          <span>Administrasi kependudukan</span>
        </div>
      </div>

      <nav class="nav-list" aria-label="Navigasi utama">
        <template v-for="item in navItems" :key="item.to">
          <template v-if="canShowLink(item.permission)">
            <p v-if="item.to === '/'" class="nav-group-label">Ruang kerja</p>
            <p v-if="item.to === '/kartu-keluarga'" class="nav-group-label">Kependudukan</p>
            <p v-if="item.to === '/pengaturan'" class="nav-group-label">Preferensi</p>
            <RouterLink :to="item.to"><NavigationIcon :path="item.to" /><span>{{ item.label }}</span></RouterLink>
          </template>
        </template>
      </nav>

      <div class="sidebar-footer"><span class="workspace-label"><span class="workspace-dot" /> Ruang kerja RT/RW</span></div>
      <button class="secondary-button full-width sidebar-logout" type="button" :disabled="importJob.busy" :title="importJob.busy ? 'Tunggu impor selesai sebelum keluar' : undefined" @click="handleLogout">Keluar</button>
    </aside>

    <div
      v-if="auth.isAuthenticated && !isStandalonePage"
      class="mobile-drawer-backdrop"
      :class="{ 'mobile-drawer-backdrop--open': mobileDrawerOpen }"
      @click="closeMobileDrawer"
    >
      <aside class="mobile-drawer" @click.stop>
        <div class="mobile-drawer-header">
          <div class="brand-block">
            <div class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3z M9 20v-7h6v7 M7 10h.01 M17 10h.01" /></svg></div>
            <div>
              <strong>RT/RW Digital</strong>
              <span>Administrasi kependudukan</span>
            </div>
          </div>
          <button class="secondary-button" type="button" aria-label="Tutup menu" @click="closeMobileDrawer">Tutup</button>
        </div>

        <nav class="nav-list" aria-label="Navigasi utama">
          <template v-for="item in navItems" :key="`mobile-${item.to}`">
            <template v-if="canShowLink(item.permission)">
              <p v-if="item.to === '/'" class="nav-group-label">Ruang kerja</p>
              <p v-if="item.to === '/kartu-keluarga'" class="nav-group-label">Kependudukan</p>
              <p v-if="item.to === '/pengaturan'" class="nav-group-label">Preferensi</p>
              <RouterLink :to="item.to" @click="closeMobileDrawer"><NavigationIcon :path="item.to" /><span>{{ item.label }}</span></RouterLink>
            </template>
          </template>
        </nav>

        <button class="secondary-button full-width" type="button" :disabled="importJob.busy" :title="importJob.busy ? 'Tunggu impor selesai sebelum keluar' : undefined" @click="handleLogout">Keluar</button>
      </aside>
    </div>

    <main :class="['main-panel', { 'login-panel': isLogin || (!auth.isAuthenticated && !isPublicPage), 'public-panel': isPublicPage }]">
      <header v-if="auth.isAuthenticated && !isStandalonePage" class="topbar">
        <div class="topbar-heading">
          <button
            class="mobile-menu-button action-button icon-only-button"
            type="button"
            aria-label="Buka menu"
            :aria-expanded="mobileDrawerOpen"
            @click="toggleMobileDrawer"
          >
            <AppIcon class="action-icon" icon="mdi:menu" />
          </button>
          <div>
          <p class="eyebrow">Ruang kerja <span aria-hidden="true">/</span></p>
          <h1>{{ route.meta.title ?? 'Dashboard' }}</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <RouterLink v-if="auth.hasPermission('families.view')" class="header-search" to="/data-warga" aria-label="Buka pencarian NIK atau nama di Data Warga">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
            <span>Cari NIK atau nama...</span><span class="search-destination">Warga</span>
          </RouterLink>
          <details class="header-popover">
            <summary class="header-icon-button" aria-label="Pemberitahuan" title="Pemberitahuan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4" /></svg>
              <span v-if="importJob.busy" class="notification-dot" />
            </summary>
            <div class="header-popover-panel notification-panel"><strong>Pemberitahuan</strong><p class="muted">{{ importJob.busy ? 'Import kartu keluarga sedang diproses. Lihat perkembangannya pada panel import.' : 'Tidak ada proses import yang berjalan.' }}</p></div>
          </details>
          <details class="header-popover profile-popover">
            <summary class="user-chip" aria-label="Menu profil pengguna">
              <span class="user-avatar">{{ initials }}</span>
              <div><strong>{{ auth.profile?.displayName }}</strong><small>{{ auth.roleLabel }}</small></div>
              <svg class="profile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>
            </summary>
            <div class="header-popover-panel profile-panel">
              <strong>{{ auth.profile?.displayName }}</strong><span class="badge role-badge">{{ auth.roleLabel }}</span>
              <RouterLink to="/pengaturan"><NavigationIcon path="/pengaturan" />Pengaturan akun</RouterLink>
              <button type="button" :disabled="importJob.busy" @click="handleLogout">Keluar dari akun</button>
            </div>
          </details>
        </div>
      </header>

      <div :class="{ 'workspace-content': auth.isAuthenticated && !isStandalonePage }"><RouterView /></div>
      <FamilyImportProgress />
    </main>
  </div>
</template>
