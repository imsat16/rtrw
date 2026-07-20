<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppAutocomplete, { type AutocompleteItem } from '@/components/AppAutocomplete.vue'
import ItemDetailModal from '@/components/ItemDetailModal.vue'
import TablePagination from '@/components/TablePagination.vue'
import { useClientTable } from '@/composables/useClientTable'
import { deleteResident, listFamilyCards, listMutations, listRegions, listResidents, saveMutation, saveResident } from '@/services/data'
import { useAuthStore } from '@/stores/auth'
import type { FamilyCard, Gender, MutationType, Region, Resident, ResidentMutation, ResidentStatus } from '@/types/domain'

const auth = useAuthStore()
const regions = ref<Region[]>([])
const cards = ref<FamilyCard[]>([])
const residents = ref<Resident[]>([])
const mutations = ref<ResidentMutation[]>([])
const message = ref('')
const messageError = ref(false)
const filterOpen = ref(false)
const residentFormOpen = ref(false)
const editingResidentId = ref('')
const detailTarget = ref<Resident | null>(null)
const deleteTarget = ref<Resident | null>(null)
const mutationFormOpen = ref(false)
const filters = reactive({ rwId: '', rtId: '', search: '' })
const filterDraft = reactive({ rwId: '', rtId: '', search: '' })
const residentForm = reactive({
  familyCardId: '', nik: '', fullName: '', gender: 'L' as Gender, birthPlace: '', birthDate: '',
  religion: 'Islam', education: '', occupation: '', maritalStatus: 'Belum Kawin',
  familyRelationship: 'Anak', citizenship: 'WNI', fatherName: '', motherName: '',
  staySince: '', residentStatus: 'tetap' as ResidentStatus,
})
const mutationForm = reactive({ residentId: '', mutationType: 'lahir' as MutationType, mutationDate: '', note: '' })

const rwOptions = computed(() => {
  const items = regions.value.filter((item) => item.type === 'rw')
  return auth.profile?.role === 'superadmin' ? items : items.filter((item) => item.id === auth.profile?.rwId)
})
const rtOptions = computed(() => regions.value.filter(
  (item) => item.type === 'rt' && (!filterDraft.rwId || item.rwId === filterDraft.rwId),
))
const selectedCard = computed(() => cards.value.find((item) => item.id === residentForm.familyCardId))
const selectedResident = computed(() => residents.value.find((item) => item.id === mutationForm.residentId))
const familyCardItems = computed<AutocompleteItem[]>(() => cards.value.map((card) => ({
  value: card.id,
  label: `${card.kkNumber} — ${card.headName}`,
  keywords: [card.kkNumber, card.headName, ...(card.memberNiks ?? [])],
  description: card.memberNiks?.length ? `NIK anggota: ${card.memberNiks.join(', ')}` : 'Belum ada anggota',
})))

const { page, pageSize, totalPages, paginatedItems, toggleSort, sortIndicator } = useClientTable(residents, 'fullName')
const detailRows = computed(() => detailTarget.value ? [
  { label: 'NIK', value: detailTarget.value.nik },
  { label: 'Nomor KK', value: detailTarget.value.kkNumber },
  { label: 'Nama Lengkap', value: detailTarget.value.fullName },
  { label: 'Jenis Kelamin', value: detailTarget.value.gender === 'L' ? 'Laki-laki' : 'Perempuan' },
  { label: 'Tempat, Tanggal Lahir', value: `${detailTarget.value.birthPlace}, ${detailTarget.value.birthDate}` },
  { label: 'Hubungan Keluarga', value: detailTarget.value.familyRelationship },
  { label: 'Agama', value: detailTarget.value.religion },
  { label: 'Pendidikan', value: detailTarget.value.education },
  { label: 'Pekerjaan', value: detailTarget.value.occupation },
  { label: 'Status Perkawinan', value: detailTarget.value.maritalStatus },
  { label: 'Kewarganegaraan', value: detailTarget.value.citizenship },
  { label: 'Nama Ayah', value: detailTarget.value.fatherName },
  { label: 'Nama Ibu', value: detailTarget.value.motherName },
  { label: 'Status Penduduk', value: detailTarget.value.residentStatus },
  { label: 'Alamat', value: detailTarget.value.address },
] : [])

function regionOptionLabel(region: Region) {
  const parent = regions.value.find((item) => item.id === region.parentId)
  return parent ? `${region.name} — ${parent.name}` : region.name
}

function initializeScope() {
  filters.rwId = auth.profile?.rwId ?? ''
  filters.rtId = auth.profile?.rtId ?? ''
  filterDraft.rwId = filters.rwId
  filterDraft.rtId = filters.rtId
}

function resetResidentForm() {
  editingResidentId.value = ''
  Object.assign(residentForm, {
    familyCardId: '', nik: '', fullName: '', gender: 'L' as Gender, birthPlace: '', birthDate: '',
    religion: 'Islam', education: '', occupation: '', maritalStatus: 'Belum Kawin',
    familyRelationship: 'Anak', citizenship: 'WNI', fatherName: '', motherName: '',
    staySince: '', residentStatus: 'tetap' as ResidentStatus,
  })
}

function openCreateResident() {
  resetResidentForm()
  residentFormOpen.value = true
}

function editResident(item: Resident) {
  editingResidentId.value = item.id
  Object.assign(residentForm, {
    familyCardId: item.familyCardId,
    nik: item.nik,
    fullName: item.fullName,
    gender: item.gender,
    birthPlace: item.birthPlace,
    birthDate: item.birthDate,
    religion: item.religion,
    education: item.education,
    occupation: item.occupation,
    maritalStatus: item.maritalStatus,
    familyRelationship: item.familyRelationship,
    citizenship: item.citizenship,
    fatherName: item.fatherName,
    motherName: item.motherName,
    staySince: item.staySince ?? '',
    residentStatus: item.residentStatus,
  })
  residentFormOpen.value = true
}

async function applyFilters() {
  Object.assign(filters, filterDraft)
  await loadData()
}

function openFilters() {
  Object.assign(filterDraft, filters)
  filterOpen.value = true
}

async function loadData() {
  const [cardData, residentData, mutationData] = await Promise.all([
    listFamilyCards(auth.profile, filters.rtId || undefined, filters.rwId || undefined),
    listResidents(auth.profile, filters.rtId || undefined, filters.rwId || undefined, filters.search),
    listMutations(auth.profile, filters.rtId || undefined),
  ])
  cards.value = cardData
  residents.value = residentData
  mutations.value = mutationData
  if (!cards.value.some((item) => item.id === residentForm.familyCardId)) residentForm.familyCardId = ''
  filterOpen.value = false
}

function resetFilters() {
  filters.search = ''
  initializeScope()
  filterDraft.search = ''
  void loadData()
}

async function submitResident() {
  const card = selectedCard.value
  if (!card || !auth.hasPermission('families.manage')) return
  try {
    await saveResident({
    familyCardId: card.id, kkNumber: card.kkNumber, nik: residentForm.nik, fullName: residentForm.fullName,
    gender: residentForm.gender, birthPlace: residentForm.birthPlace, birthDate: residentForm.birthDate,
    religion: residentForm.religion, education: residentForm.education, occupation: residentForm.occupation,
    maritalStatus: residentForm.maritalStatus, familyRelationship: residentForm.familyRelationship,
    citizenship: residentForm.citizenship, fatherName: residentForm.fatherName, motherName: residentForm.motherName,
    address: card.address, staySince: residentForm.staySince, residentStatus: residentForm.residentStatus,
    provinceId: card.provinceId, cityId: card.cityId, districtId: card.districtId, villageId: card.villageId,
    rwId: card.rwId, rtId: card.rtId,
    }, editingResidentId.value || undefined)
    message.value = editingResidentId.value ? 'Data warga berhasil diperbarui.' : 'Data warga berhasil ditambahkan.'
    messageError.value = false
    residentFormOpen.value = false
    resetResidentForm()
    await loadData()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Gagal menyimpan data warga.'
    messageError.value = true
  }
}

async function confirmDelete() {
  if (!deleteTarget.value || !auth.hasPermission('families.manage')) return
  try {
    await deleteResident(deleteTarget.value.id)
    message.value = 'Data warga berhasil dihapus.'
    messageError.value = false
    deleteTarget.value = null
    await loadData()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Gagal menghapus data warga.'
    messageError.value = true
  }
}

async function submitMutation() {
  const resident = selectedResident.value
  if (!resident || !auth.hasPermission('families.manage')) return
  try {
    await saveMutation({
    residentId: resident.id, residentName: resident.fullName, gender: resident.gender,
    mutationType: mutationForm.mutationType, mutationDate: mutationForm.mutationDate,
    note: mutationForm.note, residentStatus: resident.residentStatus, provinceId: resident.provinceId,
    cityId: resident.cityId, districtId: resident.districtId, villageId: resident.villageId,
    rwId: resident.rwId, rtId: resident.rtId,
    })
    mutationForm.note = ''
    message.value = 'Mutasi LAMPID berhasil dicatat.'
    messageError.value = false
    mutationFormOpen.value = false
    await loadData()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Gagal mencatat mutasi.'
    messageError.value = true
  }
}

watch(() => filterDraft.rwId, () => {
  if (!rtOptions.value.some((item) => item.id === filterDraft.rtId)) filterDraft.rtId = ''
})

onMounted(async () => {
  regions.value = await listRegions(auth.profile)
  initializeScope()
  await loadData()
})
</script>

<template>
  <section class="content-stack">
    <p v-if="message" :class="messageError ? 'alert' : 'success'">{{ message }}</p>
    <div class="section-panel">
      <div class="section-header">
        <div><strong>Daftar Warga</strong><span class="badge">{{ residents.length }} warga</span></div>
        <div class="table-actions">
          <button class="secondary-button" type="button" @click="openFilters">Filter</button>
          <button v-if="auth.hasPermission('families.manage')" class="secondary-button" type="button" @click="mutationFormOpen = true">Catat LAMPID</button>
          <button v-if="auth.hasPermission('families.manage')" class="primary-button" type="button" @click="openCreateResident">Tambah Warga</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th><button class="sort-button" type="button" @click="toggleSort('nik')">NIK {{ sortIndicator('nik') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('kkNumber')">No. KK {{ sortIndicator('kkNumber') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('fullName')">Nama {{ sortIndicator('fullName') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('familyRelationship')">Hubungan {{ sortIndicator('familyRelationship') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('gender')">JK {{ sortIndicator('gender') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('birthDate')">TTL {{ sortIndicator('birthDate') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('residentStatus')">Status {{ sortIndicator('residentStatus') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('address')">Alamat {{ sortIndicator('address') }}</button></th><th>Aksi</th></tr></thead>
        <tbody><tr v-for="resident in paginatedItems" :key="resident.id"><td>{{ resident.nik }}</td><td>{{ resident.kkNumber }}</td><td>{{ resident.fullName }}</td><td>{{ resident.familyRelationship }}</td><td>{{ resident.gender }}</td><td>{{ resident.birthPlace }}, {{ resident.birthDate }}</td><td>{{ resident.residentStatus }}</td><td>{{ resident.address }}</td><td class="table-actions"><button class="secondary-button" type="button" @click="detailTarget = resident">Lihat</button><template v-if="auth.hasPermission('families.manage')"><button class="secondary-button" type="button" @click="editResident(resident)">Edit</button><button class="danger-button" type="button" @click="deleteTarget = resident">Hapus</button></template></td></tr><tr v-if="residents.length === 0"><td colspan="9" class="muted">Data warga tidak ditemukan.</td></tr></tbody>
      </table></div>
      <TablePagination v-model:page="page" v-model:page-size="pageSize" :total-items="residents.length" :total-pages="totalPages" />
    </div>

    <AppModal :open="filterOpen" title="Filter Data Warga" @close="filterOpen = false">
      <form class="form-grid modal-form" @submit.prevent="applyFilters">
        <div class="field"><label for="residentSearch">Cari warga</label><input id="residentSearch" v-model="filterDraft.search" placeholder="NIK, nama, atau nomor KK" /></div>
        <div class="field"><label for="residentRw">RW</label><select id="residentRw" v-model="filterDraft.rwId" :disabled="auth.profile?.role !== 'superadmin'"><option value="">Semua RW</option><option v-for="rw in rwOptions" :key="rw.id" :value="rw.id">{{ regionOptionLabel(rw) }}</option></select></div>
        <div class="field"><label for="residentRt">RT</label><select id="residentRt" v-model="filterDraft.rtId" :disabled="Boolean(auth.profile?.rtId)"><option value="">Semua RT</option><option v-for="rt in rtOptions" :key="rt.id" :value="rt.id">{{ regionOptionLabel(rt) }}</option></select></div>
        <button class="primary-button" type="submit">Cari</button>
        <button class="secondary-button" type="button" @click="resetFilters">Reset</button>
      </form>
    </AppModal>

    <AppModal :open="residentFormOpen" :title="editingResidentId ? 'Edit Warga' : 'Tambah Warga'" size="large" @close="residentFormOpen = false">
    <form class="form-grid compact modal-form" @submit.prevent="submitResident">
      <div class="field"><label for="familyCardId">Kartu keluarga</label><AppAutocomplete input-id="familyCardId" v-model="residentForm.familyCardId" :items="familyCardItems" placeholder="Cari nomor KK, NIK, atau kepala keluarga" empty-text="Kartu keluarga tidak ditemukan" required /></div>
      <div class="field"><label for="nik">NIK</label><input id="nik" v-model="residentForm.nik" required inputmode="numeric" pattern="[0-9]{16}" minlength="16" maxlength="16" title="NIK harus terdiri dari 16 digit angka" /></div>
      <div class="field"><label for="fullName">Nama lengkap</label><input id="fullName" v-model="residentForm.fullName" required /></div>
      <div class="field"><label for="gender">Jenis kelamin</label><select id="gender" v-model="residentForm.gender"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div>
      <div class="field"><label for="birthPlace">Tempat lahir</label><input id="birthPlace" v-model="residentForm.birthPlace" required /></div>
      <div class="field"><label for="birthDate">Tanggal lahir</label><input id="birthDate" v-model="residentForm.birthDate" type="date" required /></div>
      <div class="field"><label for="religion">Agama</label><input id="religion" v-model="residentForm.religion" required /></div>
      <div class="field"><label for="education">Pendidikan</label><input id="education" v-model="residentForm.education" /></div>
      <div class="field"><label for="occupation">Pekerjaan</label><input id="occupation" v-model="residentForm.occupation" /></div>
      <div class="field"><label for="maritalStatus">Status perkawinan</label><select id="maritalStatus" v-model="residentForm.maritalStatus"><option>Belum Kawin</option><option>Kawin</option><option>Cerai Hidup</option><option>Cerai Mati</option></select></div>
      <div class="field"><label for="familyRelationship">Hubungan keluarga</label><input id="familyRelationship" v-model="residentForm.familyRelationship" required /></div>
      <div class="field"><label for="citizenship">Kewarganegaraan</label><input id="citizenship" v-model="residentForm.citizenship" /></div>
      <div class="field"><label for="fatherName">Nama ayah</label><input id="fatherName" v-model="residentForm.fatherName" /></div>
      <div class="field"><label for="motherName">Nama ibu</label><input id="motherName" v-model="residentForm.motherName" /></div>
      <div class="field"><label for="staySince">Mulai tinggal</label><input id="staySince" v-model="residentForm.staySince" type="date" /></div>
      <div class="field"><label for="residentStatus">Status penduduk</label><select id="residentStatus" v-model="residentForm.residentStatus"><option value="tetap">Tetap</option><option value="sementara">Sementara/Musiman</option></select></div>
      <button class="primary-button" type="submit">{{ editingResidentId ? 'Simpan Perubahan' : 'Tambah Warga' }}</button>
      <button class="secondary-button" type="button" @click="residentFormOpen = false">Batal</button>
    </form>
    </AppModal>

    <ItemDetailModal :open="Boolean(detailTarget)" title="Detail Warga" :rows="detailRows" @close="detailTarget = null" />
    <AppModal :open="Boolean(deleteTarget)" title="Hapus Warga" size="small" @close="deleteTarget = null">
      <p>Hapus data warga <strong>{{ deleteTarget?.fullName }}</strong>?</p>
      <footer class="modal-actions"><button class="secondary-button" type="button" @click="deleteTarget = null">Batal</button><button class="danger-button" type="button" @click="confirmDelete">Hapus</button></footer>
    </AppModal>

    <AppModal :open="mutationFormOpen" title="Catat LAMPID" @close="mutationFormOpen = false">
    <form class="form-grid modal-form" @submit.prevent="submitMutation">
      <div class="field"><label for="residentId">Warga</label><select id="residentId" v-model="mutationForm.residentId" required><option value="">Pilih warga</option><option v-for="resident in residents" :key="resident.id" :value="resident.id">{{ resident.fullName }} - {{ resident.nik }}</option></select></div>
      <div class="field"><label for="mutationType">Jenis LAMPID</label><select id="mutationType" v-model="mutationForm.mutationType"><option value="lahir">Lahir</option><option value="mati">Meninggal</option><option value="pindah">Pindah</option><option value="datang">Datang</option></select></div>
      <div class="field"><label for="mutationDate">Tanggal perubahan</label><input id="mutationDate" v-model="mutationForm.mutationDate" required type="date" /></div>
      <div class="field"><label for="note">Catatan</label><input id="note" v-model="mutationForm.note" /></div>
      <button class="primary-button" type="submit">Catat LAMPID</button>
      <button class="secondary-button" type="button" @click="mutationFormOpen = false">Batal</button>
    </form>
    </AppModal>
  </section>
</template>
