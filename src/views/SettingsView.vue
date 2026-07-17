<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <section class="content-stack">
    <div class="section-panel">
      <div class="section-header">
        <strong>Profil akun</strong>
      </div>
      <dl class="detail-list">
        <dt>Nama</dt><dd>{{ auth.profile?.displayName }}</dd>
        <dt>Email</dt><dd>{{ auth.profile?.email }}</dd>
        <dt>Role</dt><dd>{{ auth.roleLabel }}</dd>
      </dl>
    </div>
  </section>
</template>
