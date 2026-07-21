<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
const filters = reactive({ rwId: '', rtId: '' })
const filterDraft = reactive({ rwId: '', rtId: '' })

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
const rwOptions = computed(() => {
  const options = regions.value.filter((region) => region.type === 'rw')
  if (auth.profile?.role === 'superadmin') return options
  return options.filter((region) => region.id === auth.profile?.rwId)
})
const rtOptions = computed(() => regions.value.filter(
  (region) => region.type === 'rt' && (!filterDraft.rwId || region.rwId === filterDraft.rwId),
))
const groupType = computed<'rw' | 'rt' | null>(() => {
  if (filters.rtId) return null
  if (filters.rwId || isRwScope.value) return 'rt'
  return auth.profile?.role === 'superadmin' ? 'rw' : null
})

function regionName(id?: string) {
  return regions.value.find((region) => region.id === id)?.name ?? '-'
}

const dashboardTitle = computed(() => {
  if (filters.rtId) return `Ringkasan RT ${regionName(filters.rtId)}`
  if (filters.rwId) return `Ringkasan RW ${regionName(filters.rwId)}`
  if (auth.profile?.role === 'superadmin') return 'Ringkasan seluruh wilayah'
  if (isRwScope.value) return `Ringkasan RW ${regionName(auth.profile?.rwId)}`
  return `Ringkasan RT ${regionName(auth.profile?.rtId)}`
})

const dashboardDescription = computed(() => {
  if (filters.rtId) return 'Komposisi warga, kelompok usia, dan aktivitas LAMPID untuk RT terpilih.'
  if (filters.rwId) return 'Perbandingan setiap RT serta kondisi kependudukan dalam RW terpilih.'
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

const ageGroups = [
  { label: '0–5 tahun', min: 0, max: 5 },
  { label: '6–17 tahun', min: 6, max: 17 },
  { label: '18–59 tahun', min: 18, max: 59 },
  { label: '60+ tahun', min: 60, max: Number.POSITIVE_INFINITY },
] as const

const ageGenderCounts = computed(() => {
  const male = ageGroups.map(() => 0)
  const female = ageGroups.map(() => 0)
  residents.value.forEach((resident) => {
    const age = ageAt(resident.birthDate)
    const groupIndex = ageGroups.findIndex((group) => age >= group.min && age <= group.max)
    if (groupIndex < 0) return
    if (resident.gender === 'L') male[groupIndex] = (male[groupIndex] ?? 0) + 1
    else female[groupIndex] = (female[groupIndex] ?? 0) + 1
  })
  return { male, female }
})

const ageChart = computed<ChartData<'bar'>>(() => ({
  labels: ageGroups.map((group) => group.label),
  datasets: [
    { label: 'Laki-laki', data: ageGenderCounts.value.male, backgroundColor: colors.blue, borderRadius: 5 },
    { label: 'Perempuan', data: ageGenderCounts.value.female, backgroundColor: colors.purple, borderRadius: 5 },
  ],
}))

const groupRegions = computed(() => regions.value.filter((region) => {
  if (region.type !== groupType.value) return false
  if (groupType.value === 'rt' && filters.rwId) return region.rwId === filters.rwId
  return true
}))
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
const scopeSummaryRows = computed(() => groupRegions.value.map((region) => ({
  label: region.name,
  residents: residents.value.filter((resident) => groupType.value === 'rw' ? resident.rwId === region.id : resident.rtId === region.id).length,
  familyCards: cards.value.filter((card) => groupType.value === 'rw' ? card.rwId === region.id : card.rtId === region.id).length,
})))

function percentage(value: number, total: number) {
  if (!total) return '0%'
  return `${((value / total) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
}

const genderSummaryRows = computed(() => [
  { label: 'Laki-laki', total: stats.value.male },
  { label: 'Perempuan', total: stats.value.female },
])
const statusSummaryRows = computed(() => [
  { label: 'Tetap', total: stats.value.permanent },
  { label: 'Sementara/Musiman', total: stats.value.temporary },
])
const ageSummaryRows = computed(() => ageGroups.map((group, index) => ({
  label: group.label,
  male: ageGenderCounts.value.male[index] ?? 0,
  female: ageGenderCounts.value.female[index] ?? 0,
  total: (ageGenderCounts.value.male[index] ?? 0) + (ageGenderCounts.value.female[index] ?? 0),
})))

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
const mutationSummaryRows = computed(() => monthKeys.value.map((month) => {
  const totals = Object.fromEntries(mutationTypes.map((type) => [
    type.key,
    mutations.value.filter((mutation) => mutation.mutationType === type.key && mutation.mutationDate.startsWith(month.key)).length,
  ])) as Record<(typeof mutationTypes)[number]['key'], number>
  return {
    label: month.label,
    ...totals,
    total: Object.values(totals).reduce((sum, value) => sum + value, 0),
  }
}))

const barOptions: ChartOptions<'bar'> = {
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
  plugins: { legend: { position: 'bottom' } },
}
const stackedBarOptions: ChartOptions<'bar'> = {
  scales: {
    y: { beginAtZero: true, stacked: true, ticks: { precision: 0 } },
    x: { stacked: true, grid: { display: false } },
  },
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
      listFamilyCards(auth.profile, filters.rtId || undefined, filters.rwId || undefined),
      listResidents(auth.profile, filters.rtId || undefined, filters.rwId || undefined),
      listMutations(auth.profile, filters.rtId || undefined, filters.rwId || undefined),
      regions.value.length ? Promise.resolve(regions.value) : listRegions(auth.profile),
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

function initializeFilters() {
  filters.rwId = auth.profile?.rwId ?? ''
  filters.rtId = auth.profile?.rtId ?? ''
  Object.assign(filterDraft, filters)
}

async function applyFilters() {
  Object.assign(filters, filterDraft)
  await loadData()
}

async function resetFilters() {
  initializeFilters()
  await loadData()
}

watch(() => filterDraft.rwId, () => {
  if (!rtOptions.value.some((region) => region.id === filterDraft.rtId)) filterDraft.rtId = ''
})

onMounted(async () => {
  regions.value = await listRegions(auth.profile)
  initializeFilters()
  await loadData()
})
</script>

<template>
  <section class="content-stack dashboard-page">
    <p v-if="errorMessage" class="alert">{{ errorMessage }}</p>
    <div class="toolbar dashboard-toolbar">
      <div><strong>{{ dashboardTitle }}</strong><p class="muted">{{ dashboardDescription }}</p></div>
      <form class="dashboard-filters" @submit.prevent="applyFilters">
        <div class="field">
          <label for="dashboardRw">RW</label>
          <select id="dashboardRw" v-model="filterDraft.rwId" :disabled="auth.profile?.role !== 'superadmin'">
            <option value="">Semua RW</option>
            <option v-for="rw in rwOptions" :key="rw.id" :value="rw.id">{{ rw.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="dashboardRt">RT</label>
          <select id="dashboardRt" v-model="filterDraft.rtId" :disabled="Boolean(auth.profile?.rtId)">
            <option value="">Semua RT</option>
            <option v-for="rt in rtOptions" :key="rt.id" :value="rt.id">{{ rt.name }}</option>
          </select>
        </div>
        <button class="primary-button" type="submit" :disabled="loading">{{ loading ? 'Memuat...' : 'Terapkan' }}</button>
        <button class="secondary-button" type="button" :disabled="loading" @click="resetFilters">Reset</button>
      </form>
    </div>

    <div class="dashboard-grid dashboard-summary">
      <article v-for="item in statItems" :key="item.label" :class="['stat-card', `stat-card--${item.tone}`]">
        <span>{{ item.label }}</span><strong>{{ loading ? '...' : item.value.toLocaleString('id-ID') }}</strong>
      </article>
    </div>

    <div v-if="!loading" class="charts-grid">
      <article v-if="groupType" class="chart-card chart-card--wide">
        <header><div><strong>{{ scopeChartTitle }}</strong><p class="muted">Jumlah warga dan KK berdasarkan wilayah kerja.</p></div></header>
        <BaseChart type="bar" :data="scopeChart" :options="barOptions" :label="scopeChartTitle" />
        <div class="chart-summary-table">
          <table>
            <thead><tr><th>Wilayah</th><th>Warga</th><th>Kartu Keluarga</th></tr></thead>
            <tbody><tr v-for="row in scopeSummaryRows" :key="row.label"><td>{{ row.label }}</td><td>{{ row.residents }}</td><td>{{ row.familyCards }}</td></tr></tbody>
            <tfoot><tr><th>Total</th><th>{{ stats.residents }}</th><th>{{ stats.familyCards }}</th></tr></tfoot>
          </table>
        </div>
      </article>

      <article class="chart-card">
        <header><div><strong>Komposisi jenis kelamin</strong><p class="muted">Perbandingan warga laki-laki dan perempuan.</p></div></header>
        <BaseChart type="doughnut" :data="genderChart" :options="doughnutOptions" label="Komposisi jenis kelamin warga" />
        <div class="chart-summary-table">
          <table>
            <thead><tr><th>Jenis Kelamin</th><th>Jumlah</th><th>Persentase</th></tr></thead>
            <tbody><tr v-for="row in genderSummaryRows" :key="row.label"><td>{{ row.label }}</td><td>{{ row.total }}</td><td>{{ percentage(row.total, stats.residents) }}</td></tr></tbody>
            <tfoot><tr><th>Total</th><th>{{ stats.residents }}</th><th>100%</th></tr></tfoot>
          </table>
        </div>
      </article>

      <article class="chart-card">
        <header><div><strong>Status penduduk</strong><p class="muted">Warga tetap dan sementara atau musiman.</p></div></header>
        <BaseChart type="doughnut" :data="statusChart" :options="doughnutOptions" label="Komposisi status penduduk" />
        <div class="chart-summary-table">
          <table>
            <thead><tr><th>Status</th><th>Jumlah</th><th>Persentase</th></tr></thead>
            <tbody><tr v-for="row in statusSummaryRows" :key="row.label"><td>{{ row.label }}</td><td>{{ row.total }}</td><td>{{ percentage(row.total, stats.residents) }}</td></tr></tbody>
            <tfoot><tr><th>Total</th><th>{{ stats.residents }}</th><th>100%</th></tr></tfoot>
          </table>
        </div>
      </article>

      <article class="chart-card">
        <header><div><strong>Kelompok usia dan jenis kelamin</strong><p class="muted">Total laki-laki dan perempuan pada setiap rentang usia.</p></div></header>
        <BaseChart type="bar" :data="ageChart" :options="stackedBarOptions" label="Sebaran laki-laki dan perempuan berdasarkan kelompok usia" />
        <div class="chart-summary-table">
          <table>
            <thead><tr><th>Kelompok Usia</th><th>Laki-laki</th><th>Perempuan</th><th>Total</th></tr></thead>
            <tbody><tr v-for="row in ageSummaryRows" :key="row.label"><td>{{ row.label }}</td><td>{{ row.male }}</td><td>{{ row.female }}</td><td>{{ row.total }}</td></tr></tbody>
            <tfoot><tr><th>Total</th><th>{{ stats.male }}</th><th>{{ stats.female }}</th><th>{{ stats.residents }}</th></tr></tfoot>
          </table>
        </div>
      </article>

      <article class="chart-card">
        <header><div><strong>Tren LAMPID 6 bulan</strong><p class="muted">Lahir, meninggal, pindah, dan datang sesuai wilayah akun.</p></div></header>
        <BaseChart type="line" :data="mutationChart" :options="lineOptions" label="Tren LAMPID enam bulan terakhir" />
        <div class="chart-summary-table">
          <table>
            <thead><tr><th>Bulan</th><th>Lahir</th><th>Datang</th><th>Pindah</th><th>Meninggal</th><th>Total</th></tr></thead>
            <tbody><tr v-for="row in mutationSummaryRows" :key="row.label"><td>{{ row.label }}</td><td>{{ row.lahir }}</td><td>{{ row.datang }}</td><td>{{ row.pindah }}</td><td>{{ row.mati }}</td><td>{{ row.total }}</td></tr></tbody>
            <tfoot><tr><th>Total</th><th>{{ stats.lahir }}</th><th>{{ stats.datang }}</th><th>{{ stats.pindah }}</th><th>{{ stats.mati }}</th><th>{{ stats.lahir + stats.datang + stats.pindah + stats.mati }}</th></tr></tfoot>
          </table>
        </div>
      </article>
    </div>
  </section>
</template>
