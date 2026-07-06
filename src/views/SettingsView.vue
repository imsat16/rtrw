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
      <table>
        <tbody>
          <tr>
            <th>Nama</th>
            <td>{{ auth.profile?.displayName }}</td>
          </tr>
          <tr>
            <th>Email</th>
            <td>{{ auth.profile?.email }}</td>
          </tr>
          <tr>
            <th>Role</th>
            <td>{{ auth.roleLabel }}</td>
          </tr>
          <tr>
            <th>RW ID</th>
            <td>{{ auth.profile?.rwId || '-' }}</td>
          </tr>
          <tr>
            <th>RT ID</th>
            <td>{{ auth.profile?.rtId || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-panel">
      <strong>Bootstrap superadmin</strong>
      <p class="muted">
        Buat user pertama di Supabase Auth, lalu tambahkan baris <code>profiles</code> dengan role
        <code>superadmin</code>. Detail langkah ada di README.
      </p>
    </div>
  </section>
</template>
