<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    await router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login gagal.'
  }
}
</script>

<template>
  <form class="login-card content-stack" @submit.prevent="submit">
    <div>
      <p class="eyebrow">RT/RW Digital</p>
      <h1>Masuk Petugas</h1>
      <p class="muted">Gunakan akun Supabase Auth yang sudah diberi profil role di tabel profiles.</p>
    </div>

    <p v-if="error" class="alert">{{ error }}</p>

    <div class="field">
      <label for="email">Email</label>
      <input id="email" v-model="email" autocomplete="email" required type="email" />
    </div>

    <div class="field">
      <label for="password">Password</label>
      <input id="password" v-model="password" autocomplete="current-password" required type="password" />
    </div>

    <button class="primary-button full-width" type="submit" :disabled="auth.loading">Masuk</button>
  </form>
</template>
