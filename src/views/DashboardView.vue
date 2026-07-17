<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ChartData, ChartOptions } from 'chart.js'
import BaseChart from '@/components/BaseChart.vue'
import { listFamilyCards, listMutations, listRegions, listResidents } from '@/services/data'
import { calculateStats } from '@/services/reports'
import { useAuthStore } from '@/stores/auth'
import type { FamilyCard, Region, Resident, ResidentMutation } from '@/types/domain'

const auth = useAuthStore()
const cards = ref<FamilyCard[]>([])
const residents = ref<Resident[]>([])
const mutations = ref<ResidentMutation[]>([])
const regions = ref<Region[]>([])
const loading = ref(false)
const errorMessage = ref('')

const colors = {
  teal: '#13877d',
  tealSoft: '#69b8ae',
  blue: '#3b82f6',
  blueSoft: '#93c5fd',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  gray: '#94a3b8',
}

const stats = computed(() => calculateStats(cards.value, residents.value, mutations.value))
const isRtScope = computed(() => ['ketua_rt', 'staff_rt'].includes(auth.profile?.role ?? ''))
const isRwScope = computed(() => ['ketua_rw', 'staff_rw'].includes(auth.profile?.role ?? ''))
const groupType = computed<'rw' | 'rt' | null>(() => auth.profile?.role === 'superadmin' ? 'rw' : isRwScope.value ? 'rt' : null)

function regionName(id?: string) {
  return regions.value.find((region) => region.id === id)?.name ?? '-'
}

const dashboardTitle = computed(() => {
  if (auth.profile?.role === 'superadmin') return 'Ringkasan seluruh wilayah'
  if (isRwScope.value) return `Ringkasan RW ${regionName(auth.profile?.rwId)}`
  return `Ringkasan RT ${regionName(auth.profile?.rtId)}`
})

const dashboardDescription = computed(() => {
  if (auth.profile?.role === 'superadmin') return 'Perbandingan kependudukan setiap RW dan kondisi warga secara keseluruhan.'
  if (isRwScope.value) return 'Perbandingan setiap RT serta kondisi kependudukan dalam RW Anda.'
  return 'Komposisi warga, kelompok usia, dan aktivitas LAMPID khusus RT Anda.'
})

const statItems = computed(() => [
  { label: 'Kartu keluarga', value: stats.value.familyCards, tone: 'teal' },
  { label: 'Total warga', value: stats.value.residents, tone: 'blue' },
  { label: 'Laki-laki', value: stats.value.male, tone: 'blue-soft' },
  { label: 'Perempuan', value: stats.value.female, tone: 'purple' },
  { label: 'Penduduk tetap', value: stats.value.permanent, tone: 'teal-soft' },
  { label: 'Sementara/musiman', value: stats.value.temporary, tone: 'amber' },
])

const genderChart = computed<ChartData<'doughnut'>>(() => ({
  labels: ['Laki-laki', 'Perempuan'],
  datasets: [{ data: [stats.value.male, stats.value.female], backgroundColor: [colors.blue, colors.purple], borderWidth: 0 }],
}))

const statusChart = computed<ChartData<'doughnut'>>(() => ({
  labels: ['Tetap', 'Sementara/Musiman'],
  datasets: [{ data: [stats.value.permanent, stats.value.temporary], backgroundColor: [colors.teal, colors.amber], borderWidth: 0 }],
}))

function ageAt(date: string) {
  const birth = new Date(`${date}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return Math.max(age, 0)
}

const ageCounts = computed<[number, number, number, number]>(() => {
  let toddlers = 0
  let children = 0
  let adults = 0
  let seniors = 0
  residents.value.forEach((resident) => {
    const age = ageAt(resident.birthDate)
    if (age <= 5) toddlers++
    else if (age <= 17) children++
    else if (age <= 59) adults++
    else seniors++
  })
  return [toddlers, children, adults, seniors]
})

const ageChart = computed<ChartData<'bar'>>(() => ({
  labels: ['0–5 tahun', '6–17 tahun', '18–59 tahun', '60+ tahun'],
  datasets: [{ label: 'Warga', data: ageCounts.value, backgroundColor: [colors.tealSoft, colors.blueSoft, colors.teal, colors.amber], borderRadius: 7 }],
}))

const groupRegions = computed(() => regions.value.filter((region) => region.type === groupType.value))
const scopeChart = computed<ChartData<'bar'>>(() => ({
  labels: groupRegions.value.map((region) => region.name),
  datasets: [
    {
      label: 'Warga',
      data: groupRegions.value.map((region) => residents.value.filter((resident) => groupType.value === 'rw' ? resident.rwId === region.id : resident.rtId === region.id).length),
      backgroundColor: colors.teal,
      borderRadius: 6,
    },
    {
      label: 'Kartu Keluarga',
      data: groupRegions.value.map((region) => cards.value.filter((card) => groupType.value === 'rw' ? card.rwId === region.id : card.rtId === region.id).length),
      backgroundColor: colors.blueSoft,
      borderRadius: 6,
    },
  ],
}))

const scopeChartTitle = computed(() => groupType.value === 'rw' ? 'Perbandingan per RW' : 'Perbandingan per RT')

const monthKeys = computed(() => Array.from({ length: 6 }, (_, index) => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - (5 - index))
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
  }
}))

const mutationTypes = [
  { key: 'lahir', label: 'Lahir', color: colors.teal },
  { key: 'datang', label: 'Datang', color: colors.blue },
  { key: 'pindah', label: 'Pindah', color: colors.amber },
  { key: 'mati', label: 'Meninggal', color: colors.red },
] as const

const mutationChart = computed<ChartData<'line'>>(() => ({
  labels: monthKeys.value.map((month) => month.label),
  datasets: mutationTypes.map((type) => ({
    label: type.label,
    data: monthKeys.value.map((month) => mutations.value.filter(
      (mutation) => mutation.mutationType === type.key && mutation.mutationDate.startsWith(month.key),
    ).length),
    borderColor: type.color,
    backgroundColor: type.color,
    tension: 0.35,
    pointRadius: 4,
    pointHoverRadius: 6,
  })),
}))

const barOptions: ChartOptions<'bar'> = {
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
  plugins: { legend: { position: 'bottom' } },
}
const lineOptions: ChartOptions<'line'> = {
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
}
const doughnutOptions: ChartOptions<'doughnut'> = { cutout: '64%' }

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [cardData, residentData, mutationData, regionData] = await Promise.all([
      listFamilyCards(auth.profile),
      listResidents(auth.profile),
      listMutations(auth.profile),
      listRegions(auth.profile),
    ])
    cards.value = cardData
    residents.value = residentData
    mutations.value = mutationData
    regions.value = regionData
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Dashboard gagal dimuat.'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <section class="content-stack dashboard-page">
    <p v-if="errorMessage" class="alert">{{ errorMessage }}</p>
    <div class="toolbar dashboard-toolbar">
      <div><strong>{{ dashboardTitle }}</strong><p class="muted">{{ dashboardDescription }}</p></div>
      <button class="secondary-button" type="button" :disabled="loading" @click="loadData">{{ loading ? 'Memuat...' : 'Refresh' }}</button>
    </div>

    <div class="dashboard-grid dashboard-summary">
      <article v-for="item in statItems" :key="item.label" :class="['stat-card', `stat-card--${item.tone}`]">
        <span>{{ item.label }}</span><strong>{{ loading ? '...' : item.value.toLocaleString('id-ID') }}</strong>
      </article>
    </div>

    <div v-if="!loading" class="charts-grid">
      <article v-if="!isRtScope" class="chart-card chart-card--wide">
        <header><div><strong>{{ scopeChartTitle }}</strong><p class="muted">Jumlah warga dan KK berdasarkan wilayah kerja.</p></div></header>
        <BaseChart type="bar" :data="scopeChart" :options="barOptions" :label="scopeChartTitle" />
      </article>

      <article class="chart-card">
        <header><div><strong>Komposisi jenis kelamin</strong><p class="muted">Perbandingan warga laki-laki dan perempuan.</p></div></header>
        <BaseChart type="doughnut" :data="genderChart" :options="doughnutOptions" label="Komposisi jenis kelamin warga" />
      </article>

      <article class="chart-card">
        <header><div><strong>Status penduduk</strong><p class="muted">Warga tetap dan sementara atau musiman.</p></div></header>
        <BaseChart type="doughnut" :data="statusChart" :options="doughnutOptions" label="Komposisi status penduduk" />
      </article>

      <article class="chart-card chart-card--wide">
        <header><div><strong>Kelompok usia</strong><p class="muted">Sebaran warga berdasarkan kebutuhan layanan usia.</p></div></header>
        <BaseChart type="bar" :data="ageChart" :options="barOptions" label="Sebaran kelompok usia warga" />
      </article>

      <article class="chart-card chart-card--full">
        <header><div><strong>Tren LAMPID 6 bulan</strong><p class="muted">Lahir, meninggal, pindah, dan datang sesuai wilayah akun.</p></div></header>
        <BaseChart type="line" :data="mutationChart" :options="lineOptions" label="Tren LAMPID enam bulan terakhir" />
      </article>
    </div>
  </section>
</template>
