<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import type { PermissionCode } from '@/types/domain'

const auth = useAuthStore()
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
  mobileDrawerOpen.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <aside v-if="auth.isAuthenticated && !isStandalonePage" class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">RW</div>
        <div>
          <strong>Data Warga</strong>
          <span>RT/RW Digital</span>
        </div>
      </div>

      <nav class="nav-list">
        <template v-for="item in navItems" :key="item.to">
          <RouterLink v-if="canShowLink(item.permission)" :to="item.to">
            {{ item.label }}
          </RouterLink>
        </template>
      </nav>

      <button class="secondary-button full-width" type="button" @click="handleLogout">Keluar</button>
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
            <div class="brand-mark">RW</div>
            <div>
              <strong>Data Warga</strong>
              <span>RT/RW Digital</span>
            </div>
          </div>
          <button class="secondary-button" type="button" aria-label="Tutup menu" @click="closeMobileDrawer">Tutup</button>
        </div>

        <nav class="nav-list">
          <template v-for="item in navItems" :key="`mobile-${item.to}`">
            <RouterLink v-if="canShowLink(item.permission)" :to="item.to" @click="closeMobileDrawer">
              {{ item.label }}
            </RouterLink>
          </template>
        </nav>

        <button class="secondary-button full-width" type="button" @click="handleLogout">Keluar</button>
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
          <p class="eyebrow">Sistem administrasi kependudukan</p>
          <h1>{{ route.meta.title ?? 'Dashboard' }}</h1>
          </div>
        </div>
        <div class="user-chip">
          <span>{{ initials }}</span>
          <div>
            <strong>{{ auth.profile?.displayName }}</strong>
            <small>{{ auth.roleLabel }}</small>
          </div>
        </div>
      </header>

      <RouterView />
    </main>
  </div>
</template>
