<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  if (submitting.value || auth.loading) return
  submitting.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    await router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login gagal.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="login-card content-stack" :aria-busy="submitting" @submit.prevent="submit">
    <div>
      <p class="eyebrow">RT/RW Digital</p>
      <h1>Masuk Petugas</h1>
      <p class="muted">Masuk menggunakan akun yang telah terdaftar.</p>
    </div>

    <p v-if="error" class="alert">{{ error }}</p>

    <div class="field">
      <label for="email">Email</label>
      <input id="email" v-model="email" autocomplete="email" required type="email" />
    </div>

    <div class="field">
      <label for="password">Password</label>
      <input
        id="password"
        v-model="password"
        autocomplete="current-password"
        required
        type="password"
      />
    </div>

    <button
      class="primary-button full-width action-button"
      type="submit"
      :disabled="submitting || auth.loading"
    >
      <span v-if="submitting" class="loading-spinner" aria-hidden="true"></span>
      <span role="status">{{ submitting ? 'Sedang masuk…' : 'Masuk' }}</span>
    </button>
    <RouterLink class="login-guide-link" to="/panduan">Buka panduan pengguna</RouterLink>
  </form>
</template>
