<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppIcon from '@/components/AppIcon.vue'
import { requestCache } from '@/lib/requestCache'
import { listFamilyCards, listMutations, listRegions, listResidents } from '@/services/data'
import {
  buildRegionLine,
  buildReportPreview,
  exportReport,
  formatPeriod,
  type ReportKind,
  type ReportPreview,
} from '@/services/reports'
import { useAuthStore } from '@/stores/auth'
import type { FamilyCard, Region, Resident, ResidentMutation } from '@/types/domain'

const auth = useAuthStore()
const regions = ref<Region[]>([])
const cards = ref<FamilyCard[]>([])
const residents = ref<Resident[]>([])
const mutations = ref<ResidentMutation[]>([])
const exporting = ref('')
const loading = ref(false)
const dataReady = ref(false)
const errorMessage = ref('')
const selectedRtId = ref('')
const filterOpen = ref(false)
const previewOpen = ref(false)
const previewKind = ref<ReportKind | null>(null)
const previewData = ref<ReportPreview | null>(null)
const previewSheetIndex = ref(0)
const form = reactive({
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
})
const filterDraft = reactive({ month: form.month, year: form.year, rtId: '' })

const rtOptions = computed(() =>
  regions.value.filter(
    (item) =>
      item.type === 'rt' &&
      (auth.profile?.role === 'superadmin' || item.rwId === auth.profile?.rwId),
  ),
)
const canFilterRt = computed(() =>
  ['superadmin', 'ketua_rw', 'staff_rw'].includes(auth.profile?.role ?? ''),
)
const effectiveRtId = computed(() => selectedRtId.value || auth.profile?.rtId || '')
const activeRtLabel = computed(() =>
  effectiveRtId.value ? rtLabel(effectiveRtId.value) : 'Semua RT',
)
const previewSheets = computed(
  () =>
    previewData.value?.sheets ??
    (previewData.value ? [{ ...previewData.value, name: 'Laporan' }] : []),
)
const activePreviewSheet = computed(() => previewSheets.value[previewSheetIndex.value])

function rtLabel(id: string) {
  const rt = regions.value.find((item) => item.id === id)
  const rw = regions.value.find((item) => item.id === rt?.rwId)
  const name = rt?.name ?? id
  const label = /^RT\b/i.test(name) ? name : `RT ${name}`
  return auth.profile?.role === 'superadmin' && rw
    ? `${label} — RW ${rw.name.replace(/^RW\s*/i, '')}`
    : label
}

const reports: Array<{ kind: ReportKind; title: string; description: string }> = [
  {
    kind: 'paaredi',
    title: 'Data Sasaran PAAREDI',
    description:
      'Rincian sasaran usia 0–24 tahun dan ibu hamil tercatat pada periode laporan. Sheet rincian dipisahkan per RT, disertai rekap RT; usia kandungan dikosongkan.',
  },
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

const activePreviewReport = computed(() =>
  reports.find((report) => report.kind === previewKind.value),
)

const previewContext = computed(
  () =>
    `${buildRegionLine(regions.value, auth.profile)} · ${activeRtLabel.value} · ${formatPeriod({ month: Number(form.month), year: Number(form.year) })}`,
)

function getReportOptions(kind: ReportKind) {
  return {
    kind,
    period: { month: Number(form.month), year: Number(form.year) },
    regions: regions.value,
    profile: auth.profile,
    cards: cards.value,
    residents: residents.value,
    mutations: mutations.value,
    rtId: selectedRtId.value || auth.profile?.rtId || undefined,
  }
}

async function loadData(force = false) {
  if (loading.value) return
  loading.value = true
  dataReady.value = false
  errorMessage.value = ''
  closePreview()
  if (force) requestCache.clear()
  const rtId = effectiveRtId.value || undefined
  try {
    const [regionData, cardData, residentData, mutationData] = await Promise.all([
      listRegions(auth.profile),
      listFamilyCards(auth.profile, rtId),
      listResidents(auth.profile, rtId),
      listMutations(auth.profile, rtId),
    ])
    regions.value = regionData
    cards.value = cardData
    residents.value = residentData
    mutations.value = mutationData
    dataReady.value = true
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Data laporan gagal dimuat. Silakan refresh data.'
  } finally {
    loading.value = false
  }
}

async function applyFilter() {
  if (loading.value || exporting.value) return
  form.month = Number(filterDraft.month)
  form.year = Number(filterDraft.year)
  selectedRtId.value = filterDraft.rtId
  filterOpen.value = false
  await loadData()
}

function resetFilter() {
  filterDraft.month = new Date().getMonth() + 1
  filterDraft.year = new Date().getFullYear()
  filterDraft.rtId = ''
}

function openFilter() {
  filterDraft.month = form.month
  filterDraft.year = form.year
  filterDraft.rtId = selectedRtId.value
  filterOpen.value = true
}

async function download(kind: ReportKind) {
  if (!dataReady.value || loading.value || exporting.value || !auth.hasPermission('reports.export'))
    return
  exporting.value = kind
  errorMessage.value = ''
  try {
    await exportReport(getReportOptions(kind))
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Laporan gagal diunduh. Silakan coba lagi.'
  } finally {
    exporting.value = ''
  }
}

function openPreview(kind: ReportKind) {
  if (!dataReady.value || loading.value || !auth.hasPermission('reports.view')) return
  previewSheetIndex.value = 0
  previewKind.value = kind
  previewData.value = buildReportPreview(getReportOptions(kind))
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
  previewKind.value = null
  previewData.value = null
  previewSheetIndex.value = 0
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <section class="content-stack">
    <div class="toolbar">
      <span>Periode {{ form.month }}/{{ form.year }} · {{ activeRtLabel }}</span>
      <div class="table-actions">
        <button
          class="secondary-button action-button icon-only-button"
          type="button"
          aria-label="Filter laporan"
          title="Filter laporan"
          :disabled="loading || Boolean(exporting)"
          @click="openFilter"
        >
          <AppIcon class="action-icon" icon="mdi:filter-variant" />
        </button>
        <button
          class="secondary-button action-button icon-only-button"
          type="button"
          aria-label="Refresh data"
          title="Refresh data"
          :disabled="loading || Boolean(exporting)"
          @click="loadData(true)"
        >
          <span v-if="loading" class="loading-spinner" aria-hidden="true"></span
          ><AppIcon v-else class="action-icon" icon="mdi:refresh" />
        </button>
      </div>
    </div>
    <p v-if="loading" class="muted" role="status">Memuat data laporan…</p>
    <p v-if="errorMessage" class="alert" role="alert">{{ errorMessage }}</p>

    <article v-for="report in reports" :key="report.kind" class="report-action">
      <div>
        <strong>{{ report.title }}</strong>
        <p class="muted">{{ report.description }}</p>
      </div>
      <div class="report-action-buttons">
        <button
          class="secondary-button"
          type="button"
          :disabled="!dataReady || loading || !auth.hasPermission('reports.view')"
          @click="openPreview(report.kind)"
        >
          Preview
        </button>
        <button
          class="primary-button"
          type="button"
          :disabled="
            !dataReady || loading || Boolean(exporting) || !auth.hasPermission('reports.export')
          "
          @click="download(report.kind)"
        >
          {{
            !auth.hasPermission('reports.export')
              ? 'Tidak diizinkan'
              : exporting === report.kind
                ? 'Menyiapkan...'
                : 'Download XLSX'
          }}
        </button>
      </div>
    </article>

    <AppModal :open="filterOpen" title="Filter Laporan" @close="filterOpen = false">
      <form class="form-grid modal-form" @submit.prevent="applyFilter">
        <div class="field">
          <label for="month">Bulan</label
          ><select id="month" v-model="filterDraft.month">
            <option v-for="month in 12" :key="month" :value="month">{{ month }}</option>
          </select>
        </div>
        <div class="field">
          <label for="year">Tahun</label
          ><input id="year" v-model="filterDraft.year" min="2020" type="number" />
        </div>
        <div v-if="canFilterRt" class="field">
          <label for="rtFilter">RT</label
          ><select id="rtFilter" v-model="filterDraft.rtId">
            <option value="">Semua RT</option>
            <option v-for="item in rtOptions" :key="item.id" :value="item.id">
              {{ rtLabel(item.id) }}
            </option>
          </select>
        </div>
        <button class="secondary-button" type="button" @click="resetFilter">Reset</button>
        <button class="primary-button" type="submit">Terapkan</button>
      </form>
    </AppModal>

    <AppModal
      :open="previewOpen"
      :title="`Preview ${activePreviewReport?.title ?? 'Laporan'}`"
      size="large"
      @close="closePreview"
    >
      <div v-if="previewData && previewKind" class="report-preview">
        <div class="report-preview-header">
          <div>
            <strong>{{ activePreviewReport?.title }}</strong>
            <p class="muted">{{ previewContext }}</p>
          </div>
          <span class="badge">{{ activePreviewSheet?.totalRows ?? 0 }} baris</span>
        </div>

        <div v-if="previewSheets.length > 1" class="field">
          <label for="previewSheet">Sheet laporan</label>
          <select id="previewSheet" v-model="previewSheetIndex">
            <option v-for="(sheet, index) in previewSheets" :key="sheet.name" :value="index">
              {{ sheet.name }} ({{ sheet.totalRows }} baris)
            </option>
          </select>
        </div>

        <div v-if="activePreviewSheet?.rows.length" class="table-wrap report-preview-table">
          <table>
            <thead>
              <tr>
                <th v-for="column in activePreviewSheet.columns" :key="column.key">
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in activePreviewSheet.rows.slice(0, 200)" :key="rowIndex">
                <td v-for="column in activePreviewSheet.columns" :key="column.key">
                  {{ row[column.key] ?? '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="report-preview-empty">
          Tidak ada data pada periode dan wilayah yang dipilih.
        </p>
        <p v-if="activePreviewSheet && activePreviewSheet.totalRows > 200" class="muted">
          Preview menampilkan 200 baris pertama.
          {{
            previewKind === 'paaredi'
              ? 'File XLSX PAAREDI memuat seluruh sasaran.'
              : 'File XLSX mengikuti batas isi template.'
          }}
        </p>

        <div class="report-preview-actions">
          <button class="secondary-button" type="button" @click="closePreview">Tutup</button>
          <button
            class="primary-button"
            type="button"
            :disabled="exporting === previewKind || !auth.hasPermission('reports.export')"
            @click="download(previewKind)"
          >
            {{ exporting === previewKind ? 'Menyiapkan...' : 'Download XLSX' }}
          </button>
        </div>
      </div>
    </AppModal>
  </section>
</template>
