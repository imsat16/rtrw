<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { listFamilyCards, listMutations, listRegions, listResidents } from '@/services/data'
import { exportReport, type ReportKind } from '@/services/reports'
import { useAuthStore } from '@/stores/auth'
import type { FamilyCard, Region, Resident, ResidentMutation } from '@/types/domain'

const auth = useAuthStore()
const regions = ref<Region[]>([])
const cards = ref<FamilyCard[]>([])
const residents = ref<Resident[]>([])
const mutations = ref<ResidentMutation[]>([])
const exporting = ref('')
const selectedRtId = ref('')
const form = reactive({
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
})

const rtOptions = computed(() =>
  regions.value.filter((item) => item.type === 'rt' && item.rwId === auth.profile?.rwId),
)

const reports: Array<{ kind: ReportKind; title: string; description: string }> = [
  {
    kind: 'lampid',
    title: 'Laporan Kependudukan LAMPID',
    description: 'Rekap lahir, meninggal, pindah, dan datang per periode.',
  },
  {
    kind: 'bukuIndukTetap',
    title: 'Model A.1 Buku Induk Penduduk Tetap',
    description: 'Daftar penduduk tetap untuk laporan RT/RW.',
  },
  {
    kind: 'bukuIndukSementara',
    title: 'Model A.2 Buku Induk Penduduk Sementara/Musiman',
    description: 'Daftar penduduk sementara atau musiman.',
  },
  {
    kind: 'perubahanTetap',
    title: 'Model A.3 Perubahan Penduduk Tetap',
    description: 'Daftar perubahan LAMPID pada penduduk tetap.',
  },
  {
    kind: 'perubahanSementara',
    title: 'Model A.4 Perubahan Penduduk Sementara/Musiman',
    description: 'Daftar perubahan LAMPID pada penduduk sementara.',
  },
  {
    kind: 'perkembangan',
    title: 'Model A.5 Perkembangan Penduduk',
    description: 'Ringkasan awal bulan, LAMPID, dan akhir bulan.',
  },
]

async function loadData() {
  const rtId = auth.profile?.role === 'rw' ? selectedRtId.value || undefined : undefined
  const [regionData, cardData, residentData, mutationData] = await Promise.all([
    listRegions(),
    listFamilyCards(auth.profile, rtId),
    listResidents(auth.profile, rtId),
    listMutations(auth.profile, rtId),
  ])
  regions.value = regionData
  cards.value = cardData
  residents.value = residentData
  mutations.value = mutationData
}

async function download(kind: ReportKind) {
  exporting.value = kind
  await exportReport({
    kind,
    period: { month: Number(form.month), year: Number(form.year) },
    regions: regions.value,
    profile: auth.profile,
    cards: cards.value,
    residents: residents.value,
    mutations: mutations.value,
  })
  exporting.value = ''
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <section class="content-stack">
    <div class="toolbar">
      <div class="field">
        <label for="month">Bulan</label>
        <select id="month" v-model="form.month">
          <option v-for="month in 12" :key="month" :value="month">{{ month }}</option>
        </select>
      </div>
      <div class="field">
        <label for="year">Tahun</label>
        <input id="year" v-model="form.year" min="2020" type="number" />
      </div>
      <div class="field" v-if="auth.profile?.role === 'rw'">
        <label for="rtFilter">RT</label>
        <select id="rtFilter" v-model="selectedRtId" @change="loadData">
          <option value="">Semua RT (gabungan RW)</option>
          <option v-for="item in rtOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>
      <button class="secondary-button" type="button" @click="loadData">Refresh Data</button>
    </div>

    <article v-for="report in reports" :key="report.kind" class="report-action">
      <div>
        <strong>{{ report.title }}</strong>
        <p class="muted">{{ report.description }}</p>
      </div>
      <button class="primary-button" type="button" :disabled="exporting === report.kind" @click="download(report.kind)">
        {{ exporting === report.kind ? 'Menyiapkan...' : 'Download XLSX' }}
      </button>
    </article>
  </section>
</template>
