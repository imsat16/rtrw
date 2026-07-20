<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import TablePagination from '@/components/TablePagination.vue'
import { useClientTable } from '@/composables/useClientTable'
import { createFamilyCardWithHead, deleteFamilyCard, listFamilyCards, listRegions, listResidentsByFamilyCard, updateFamilyCard } from '@/services/data'
import { useAuthStore } from '@/stores/auth'
import type { FamilyCard, Gender, Region, Resident } from '@/types/domain'

const auth = useAuthStore()
const cards = ref<FamilyCard[]>([])
const regions = ref<Region[]>([])
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const messageError = ref(false)
const filterOpen = ref(false)
const formOpen = ref(false)
const editingId = ref('')
const detailTarget = ref<FamilyCard | null>(null)
const detailMembers = ref<Resident[]>([])
const detailLoading = ref(false)
const deleteTarget = ref<FamilyCard | null>(null)
const filters = reactive({ rwId: '', rtId: '', search: '' })
const filterDraft = reactive({ rwId: '', rtId: '', search: '' })
const form = reactive({
  kkNumber: '',
  headNik: '',
  headName: '',
  address: '',
  gender: 'L' as Gender,
  birthPlace: '',
  birthDate: '',
  religion: 'Islam',
  maritalStatus: 'Kawin',
  registeredAt: '',
  rwId: '',
  rtId: '',
})

const rwOptions = computed(() => {
  const options = regions.value.filter((item) => item.type === 'rw')
  if (auth.profile?.role === 'superadmin') return options
  return options.filter((item) => item.id === auth.profile?.rwId)
})
const filterRtOptions = computed(() => regions.value.filter(
  (item) => item.type === 'rt' && (!filterDraft.rwId || item.rwId === filterDraft.rwId),
))
const formRtOptions = computed(() => regions.value.filter(
  (item) => item.type === 'rt' && (!form.rwId || item.rwId === form.rwId),
))

function regionName(id?: string) {
  return regions.value.find((item) => item.id === id)?.name ?? '-'
}

function regionOptionLabel(region: Region) {
  const parent = regions.value.find((item) => item.id === region.parentId)
  return parent ? `${region.name} — ${parent.name}` : region.name
}

const { page, pageSize, totalPages, paginatedItems, toggleSort, sortIndicator } = useClientTable(
  cards,
  'kkNumber',
  { rw: (item) => regionName(item.rwId), rt: (item) => regionName(item.rtId) },
)
const detailRows = computed(() => detailTarget.value ? [
  { label: 'Nomor KK', value: detailTarget.value.kkNumber },
  { label: 'Kepala Keluarga', value: detailTarget.value.headName },
  { label: 'RW', value: regionName(detailTarget.value.rwId) },
  { label: 'RT', value: regionName(detailTarget.value.rtId) },
  { label: 'Alamat', value: detailTarget.value.address },
  { label: 'Jumlah Anggota', value: `${detailTarget.value.memberCount ?? detailMembers.value.length} orang` },
  { label: 'Tanggal Terdaftar', value: detailTarget.value.registeredAt },
] : [])

async function openDetail(card: FamilyCard) {
  detailTarget.value = card
  detailMembers.value = []
  detailLoading.value = true
  try {
    detailMembers.value = await listResidentsByFamilyCard(card.id)
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Gagal memuat anggota keluarga.'
    messageError.value = true
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailTarget.value = null
  detailMembers.value = []
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, {
    kkNumber: '', headNik: '', headName: '', address: '', gender: 'L' as Gender,
    birthPlace: '', birthDate: '', religion: 'Islam', maritalStatus: 'Kawin', registeredAt: '',
    rwId: auth.profile?.rwId ?? '', rtId: auth.profile?.rtId ?? '',
  })
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function editCard(card: FamilyCard) {
  editingId.value = card.id
  Object.assign(form, {
    kkNumber: card.kkNumber,
    headName: card.headName,
    address: card.address,
    registeredAt: card.registeredAt ?? '',
    rwId: card.rwId ?? '',
    rtId: card.rtId ?? '',
  })
  formOpen.value = true
}

function initializeScope() {
  filters.rwId = auth.profile?.rwId ?? ''
  filters.rtId = auth.profile?.rtId ?? ''
  filterDraft.rwId = filters.rwId
  filterDraft.rtId = filters.rtId
  form.rwId = auth.profile?.rwId ?? ''
  form.rtId = auth.profile?.rtId ?? ''
}

async function applyFilters() {
  Object.assign(filters, filterDraft)
  await loadCards()
}

function openFilters() {
  Object.assign(filterDraft, filters)
  filterOpen.value = true
}

async function loadCards() {
  loading.value = true
  try {
    cards.value = await listFamilyCards(auth.profile, filters.rtId || undefined, filters.rwId || undefined, filters.search)
    filterOpen.value = false
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.search = ''
  initializeScope()
  filterDraft.search = ''
  void loadCards()
}

async function submit() {
  if (!auth.hasPermission('families.manage')) return
  const rt = regions.value.find((item) => item.id === form.rtId && item.type === 'rt')
  if (!rt) return
  saving.value = true
  message.value = ''
  try {
    const payload = {
      kkNumber: form.kkNumber,
      headName: form.headName,
      address: form.address,
      registeredAt: form.registeredAt,
      provinceId: rt.provinceId,
      cityId: rt.cityId,
      districtId: rt.districtId,
      villageId: rt.villageId,
      rwId: rt.rwId,
      rtId: rt.id,
    }
    if (editingId.value) await updateFamilyCard(payload, editingId.value)
    else await createFamilyCardWithHead({
      ...payload,
      headNik: form.headNik,
      gender: form.gender,
      birthPlace: form.birthPlace,
      birthDate: form.birthDate,
      religion: form.religion,
      maritalStatus: form.maritalStatus,
    })
    message.value = editingId.value ? 'Kartu Keluarga berhasil diperbarui.' : 'KK dan data kepala keluarga berhasil disimpan.'
    messageError.value = false
    formOpen.value = false
    resetForm()
    await loadCards()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Gagal menyimpan Kartu Keluarga.'
    messageError.value = true
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value || !auth.hasPermission('families.manage')) return
  saving.value = true
  try {
    await deleteFamilyCard(deleteTarget.value.id)
    message.value = 'Kartu Keluarga dan data warga di dalamnya berhasil dihapus.'
    messageError.value = false
    deleteTarget.value = null
    await loadCards()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Gagal menghapus Kartu Keluarga.'
    messageError.value = true
  } finally {
    saving.value = false
  }
}

watch(() => filterDraft.rwId, () => {
  if (!filterRtOptions.value.some((item) => item.id === filterDraft.rtId)) filterDraft.rtId = ''
})
watch(() => form.rwId, () => {
  if (!formRtOptions.value.some((item) => item.id === form.rtId)) form.rtId = ''
})

onMounted(async () => {
  regions.value = await listRegions(auth.profile)
  initializeScope()
  await loadCards()
})
</script>

<template>
  <section class="content-stack">
    <p v-if="message" :class="messageError ? 'alert' : 'success'">{{ message }}</p>

    <div class="section-panel">
      <div class="section-header">
        <div><strong>Daftar Kartu Keluarga</strong><span class="badge">{{ cards.length }} KK</span></div>
        <div class="table-actions">
          <button class="secondary-button" type="button" @click="openFilters">Filter</button>
          <button v-if="auth.hasPermission('families.manage')" class="primary-button" type="button" @click="openCreate">Tambah KK</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th><button class="sort-button" type="button" @click="toggleSort('kkNumber')">No. KK {{ sortIndicator('kkNumber') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('headName')">Kepala Keluarga {{ sortIndicator('headName') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('memberCount')">Anggota {{ sortIndicator('memberCount') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('rw')">RW {{ sortIndicator('rw') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('rt')">RT {{ sortIndicator('rt') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('address')">Alamat {{ sortIndicator('address') }}</button></th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-for="card in paginatedItems" :key="card.id"><td>{{ card.kkNumber }}</td><td>{{ card.headName }}</td><td>{{ card.memberCount ?? 0 }} orang</td><td>{{ regionName(card.rwId) }}</td><td>{{ regionName(card.rtId) }}</td><td>{{ card.address }}</td><td class="table-actions"><button class="secondary-button" type="button" @click="openDetail(card)">Lihat</button><template v-if="auth.hasPermission('families.manage')"><button class="secondary-button" type="button" @click="editCard(card)">Edit</button><button class="danger-button" type="button" @click="deleteTarget = card">Hapus</button></template></td></tr>
            <tr v-if="!loading && cards.length === 0"><td colspan="7" class="muted">Data KK tidak ditemukan.</td></tr>
          </tbody>
        </table>
      </div>
      <TablePagination v-model:page="page" v-model:page-size="pageSize" :total-items="cards.length" :total-pages="totalPages" />
    </div>

    <AppModal :open="filterOpen" title="Filter Kartu Keluarga" @close="filterOpen = false">
      <form class="form-grid modal-form" @submit.prevent="applyFilters">
        <div class="field">
          <label for="kkSearch">Cari nomor KK</label>
          <input id="kkSearch" v-model="filterDraft.search" inputmode="numeric" placeholder="Masukkan nomor KK" />
        </div>
        <div class="field">
          <label for="filterRw">RW</label>
          <select id="filterRw" v-model="filterDraft.rwId" :disabled="auth.profile?.role !== 'superadmin'">
            <option value="">Semua RW</option>
            <option v-for="rw in rwOptions" :key="rw.id" :value="rw.id">{{ regionOptionLabel(rw) }}</option>
          </select>
        </div>
        <div class="field">
          <label for="filterRt">RT</label>
          <select id="filterRt" v-model="filterDraft.rtId" :disabled="Boolean(auth.profile?.rtId)">
            <option value="">Semua RT</option>
            <option v-for="rt in filterRtOptions" :key="rt.id" :value="rt.id">{{ regionOptionLabel(rt) }}</option>
          </select>
        </div>
        <button class="primary-button" type="submit" :disabled="loading">Cari</button>
        <button class="secondary-button" type="button" @click="resetFilters">Reset</button>
      </form>
    </AppModal>

    <AppModal :open="formOpen" :title="editingId ? 'Edit Kartu Keluarga' : 'Tambah Kartu Keluarga'" size="large" @close="formOpen = false">
    <form class="form-grid modal-form" @submit.prevent="submit">
      <div class="field">
        <label for="kkNumber">Nomor KK</label>
        <input id="kkNumber" v-model="form.kkNumber" required inputmode="numeric" pattern="[0-9]{16}" minlength="16" maxlength="16" title="Nomor KK harus terdiri dari 16 digit angka" />
      </div>
      <div v-if="!editingId" class="field">
        <label for="headNik">NIK kepala keluarga</label>
        <input id="headNik" v-model="form.headNik" required inputmode="numeric" pattern="[0-9]{16}" minlength="16" maxlength="16" title="NIK harus terdiri dari 16 digit angka" />
      </div>
      <div class="field">
        <label for="headName">Nama kepala keluarga</label>
        <input id="headName" v-model="form.headName" required />
      </div>
      <div v-if="!editingId" class="field">
        <label for="gender">Jenis kelamin</label>
        <select id="gender" v-model="form.gender">
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </select>
      </div>
      <div v-if="!editingId" class="field">
        <label for="birthPlace">Tempat lahir</label>
        <input id="birthPlace" v-model="form.birthPlace" required />
      </div>
      <div v-if="!editingId" class="field">
        <label for="birthDate">Tanggal lahir</label>
        <input id="birthDate" v-model="form.birthDate" required type="date" />
      </div>
      <div v-if="!editingId" class="field">
        <label for="religion">Agama</label>
        <input id="religion" v-model="form.religion" required />
      </div>
      <div v-if="!editingId" class="field">
        <label for="maritalStatus">Status perkawinan</label>
        <select id="maritalStatus" v-model="form.maritalStatus">
          <option>Belum Kawin</option><option>Kawin</option><option>Cerai Hidup</option><option>Cerai Mati</option>
        </select>
      </div>
      <div class="field">
        <label for="registeredAt">Tanggal terdaftar</label>
        <input id="registeredAt" v-model="form.registeredAt" type="date" />
      </div>
      <div class="field">
        <label for="formRw">RW</label>
        <select id="formRw" v-model="form.rwId" required :disabled="auth.profile?.role !== 'superadmin'">
          <option value="">Pilih RW</option>
          <option v-for="rw in rwOptions" :key="rw.id" :value="rw.id">{{ regionOptionLabel(rw) }}</option>
        </select>
      </div>
      <div class="field">
        <label for="formRt">RT</label>
        <select id="formRt" v-model="form.rtId" required :disabled="Boolean(auth.profile?.rtId)">
          <option value="">Pilih RT</option>
          <option v-for="rt in formRtOptions" :key="rt.id" :value="rt.id">{{ regionOptionLabel(rt) }}</option>
        </select>
      </div>
      <div class="field">
        <label for="address">Alamat lengkap</label>
        <textarea id="address" v-model="form.address" required />
      </div>
      <button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Tambah KK') }}</button>
      <button class="secondary-button" type="button" @click="formOpen = false">Batal</button>
    </form>
    </AppModal>
    <AppModal :open="Boolean(detailTarget)" title="Detail Kartu Keluarga" size="large" @close="closeDetail">
      <dl class="detail-list">
        <template v-for="row in detailRows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value || '-' }}</dd></template>
      </dl>

      <details class="family-collapse" open>
        <summary>Anggota Keluarga ({{ detailMembers.length }})</summary>
        <p v-if="detailLoading" class="muted">Memuat data anggota keluarga...</p>
        <p v-else-if="detailMembers.length === 0" class="muted">Belum ada anggota keluarga.</p>
        <div v-else class="family-members">
          <details v-for="member in detailMembers" :key="member.id" class="family-member">
            <summary>{{ member.fullName }} — {{ member.nik }} <span class="badge">{{ member.familyRelationship }}</span></summary>
            <dl class="detail-list">
              <dt>Jenis Kelamin</dt><dd>{{ member.gender === 'L' ? 'Laki-laki' : 'Perempuan' }}</dd>
              <dt>Tempat, Tanggal Lahir</dt><dd>{{ member.birthPlace }}, {{ member.birthDate }}</dd>
              <dt>Agama</dt><dd>{{ member.religion }}</dd>
              <dt>Pendidikan</dt><dd>{{ member.education || '-' }}</dd>
              <dt>Pekerjaan</dt><dd>{{ member.occupation || '-' }}</dd>
              <dt>Status Perkawinan</dt><dd>{{ member.maritalStatus }}</dd>
              <dt>Status Penduduk</dt><dd>{{ member.residentStatus }}</dd>
              <dt>Nama Ayah</dt><dd>{{ member.fatherName || '-' }}</dd>
              <dt>Nama Ibu</dt><dd>{{ member.motherName || '-' }}</dd>
            </dl>
          </details>
        </div>
      </details>
    </AppModal>
    <AppModal :open="Boolean(deleteTarget)" title="Hapus Kartu Keluarga" size="small" @close="deleteTarget = null">
      <p>Hapus KK <strong>{{ deleteTarget?.kkNumber }}</strong>? Seluruh data warga dalam KK ini juga akan dihapus.</p>
      <footer class="modal-actions"><button class="secondary-button" type="button" @click="deleteTarget = null">Batal</button><button class="danger-button" type="button" :disabled="saving" @click="confirmDelete">Hapus</button></footer>
    </AppModal>
  </section>
</template>
