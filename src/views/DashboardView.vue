<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listFamilyCards, listMutations, listResidents } from '@/services/data'
import { calculateStats } from '@/services/reports'
import { useAuthStore } from '@/stores/auth'
import type { FamilyCard, Resident, ResidentMutation } from '@/types/domain'

const auth = useAuthStore()
const cards = ref<FamilyCard[]>([])
const residents = ref<Resident[]>([])
const mutations = ref<ResidentMutation[]>([])
const loading = ref(false)

const stats = computed(() => calculateStats(cards.value, residents.value, mutations.value))

const statItems = computed(() => [
  ['Kartu keluarga', stats.value.familyCards],
  ['Total warga', stats.value.residents],
  ['Laki-laki', stats.value.male],
  ['Perempuan', stats.value.female],
  ['Penduduk tetap', stats.value.permanent],
  ['Sementara/musiman', stats.value.temporary],
  ['Lahir', stats.value.lahir],
  ['Meninggal', stats.value.mati],
  ['Pindah', stats.value.pindah],
  ['Datang', stats.value.datang],
])

async function loadData() {
  loading.value = true
  const [cardData, residentData, mutationData] = await Promise.all([
    listFamilyCards(auth.profile),
    listResidents(auth.profile),
    listMutations(auth.profile),
  ])
  cards.value = cardData
  residents.value = residentData
  mutations.value = mutationData
  loading.value = false
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <section class="content-stack">
    <div class="toolbar">
      <div>
        <strong>Ringkasan wilayah kerja</strong>
        <p class="muted">Data ditampilkan sesuai scope role akun yang sedang login.</p>
      </div>
      <button class="secondary-button" type="button" @click="loadData">Refresh</button>
    </div>

    <div class="dashboard-grid">
      <article v-for="[label, value] in statItems" :key="label" class="stat-card">
        <span class="muted">{{ label }}</span>
        <strong>{{ loading ? '...' : value }}</strong>
      </article>
    </div>
  </section>
</template>
