<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const isLogin = computed(() => route.name === 'login')
const initials = computed(() => auth.profile?.displayName?.slice(0, 2).toUpperCase() ?? 'RW')

onMounted(() => {
  void auth.initialize()
})

async function handleLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <aside v-if="auth.isAuthenticated && !isLogin" class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">RW</div>
        <div>
          <strong>Data Warga</strong>
          <span>RT/RW Digital</span>
        </div>
      </div>

      <nav class="nav-list">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink v-if="auth.canManageRegions" to="/wilayah">Wilayah</RouterLink>
        <RouterLink to="/kk-warga">KK & Warga</RouterLink>
        <RouterLink to="/export">Export Laporan</RouterLink>
        <RouterLink to="/pengaturan">Pengaturan</RouterLink>
      </nav>

      <button class="secondary-button full-width" type="button" @click="handleLogout">Keluar</button>
    </aside>

    <main :class="['main-panel', { 'login-panel': isLogin || !auth.isAuthenticated }]">
      <header v-if="auth.isAuthenticated && !isLogin" class="topbar">
        <div>
          <p class="eyebrow">Sistem administrasi kependudukan</p>
          <h1>{{ route.meta.title ?? 'Dashboard' }}</h1>
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
