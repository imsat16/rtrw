<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import TablePagination from '@/components/TablePagination.vue'
import { useClientTable } from '@/composables/useClientTable'
import { deleteFamilyCard, ensureFamilyRelationship, listFamilyCards, listFamilyRelationships, listRegions, listResidentsByFamilyCard, saveFamilyCard, saveResident, updateFamilyCard } from '@/services/data'
import { useAuthStore } from '@/stores/auth'
import { familyRelationshipOptions, citizenshipOptions } from '@/types/domain'
import { applyFamilyParentAutoFill, normalizeFreeTextId, normalizeKkNumber, stripNumericSeparators } from '@/utils/familyRules'
import type { FamilyCard, Gender, Region, Resident, ResidentStatus } from '@/types/domain'

type ResidentDraft = {
  id: string
  nik: string
  fullName: string
  gender: Gender
  birthPlace: string
  birthDate: string
  religion: string
  education: string
  occupation: string
  maritalStatus: string
  familyRelationship: string
  citizenship: string
  fatherName: string
  motherName: string
  staySince: string
  residentStatus: ResidentStatus
}

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
  address: '',
  headName: '',
  registeredAt: '',
  rwId: '',
  rtId: '',
})
const headForm = reactive(createResidentDraft({
  maritalStatus: 'Kawin',
  familyRelationship: 'Kepala Keluarga',
}))
const relationshipOptions = ref<string[]>(familyRelationshipOptions)
const memberForms = ref<ResidentDraft[]>([])

function createResidentDraft(overrides: Partial<ResidentDraft> = {}): ResidentDraft {
  return {
    id: crypto.randomUUID(),
    nik: '',
    fullName: '',
    gender: 'L',
    birthPlace: '',
    birthDate: '',
    religion: 'Islam',
    education: '',
    occupation: '',
    maritalStatus: 'Belum Kawin',
    familyRelationship: 'Anak',
    citizenship: 'WNI',
    fatherName: '',
    motherName: '',
    staySince: '',
    residentStatus: 'tetap',
    ...overrides,
  }
}

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

async function loadRelationshipOptions() {
  try {
    relationshipOptions.value = await listFamilyRelationships()
  } catch {
    relationshipOptions.value = [...familyRelationshipOptions]
  }
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, {
    kkNumber: '', headName: '', address: '', registeredAt: '',
    rwId: auth.profile?.rwId ?? '', rtId: auth.profile?.rtId ?? '',
  })
  Object.assign(headForm, createResidentDraft({ maritalStatus: 'Kawin', familyRelationship: 'Kepala Keluarga' }))
  memberForms.value = []
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
  memberForms.value = []
  formOpen.value = true
}

function addMemberForm() {
  memberForms.value.push(createResidentDraft())
}

function removeMemberForm(index: number) {
  memberForms.value.splice(index, 1)
}

function validateUniqueNiks() {
  const nikList = [headForm.nik, ...memberForms.value.map((item) => item.nik)]
    .map((nik) => stripNumericSeparators(normalizeFreeTextId(nik)))
    .filter(Boolean)
  if (nikList.length !== new Set(nikList).size) {
    throw new Error('NIK kepala keluarga dan anggota harus unik.')
  }
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
  for (const relationship of relationshipOptions.value) {
    await ensureFamilyRelationship(relationship)
  }
  const rt = regions.value.find((item) => item.id === form.rtId && item.type === 'rt')
  if (!rt) return
  saving.value = true
  message.value = ''
  let createdCardId = ''
  try {
    const normalizedKkNumber = normalizeKkNumber(form.kkNumber)
    const payload = {
      kkNumber: normalizedKkNumber,
      headName: editingId.value ? form.headName : headForm.fullName,
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
    else {
      validateUniqueNiks()
      createdCardId = await saveFamilyCard(payload)
      await saveResident({
        familyCardId: createdCardId,
        kkNumber: payload.kkNumber,
        nik: headForm.nik,
        fullName: headForm.fullName,
        gender: headForm.gender,
        birthPlace: headForm.birthPlace,
        birthDate: headForm.birthDate,
        religion: headForm.religion,
        education: headForm.education,
        occupation: headForm.occupation,
        maritalStatus: headForm.maritalStatus,
        familyRelationship: 'Kepala Keluarga',
        citizenship: headForm.citizenship,
        fatherName: headForm.fatherName,
        motherName: headForm.motherName,
        address: payload.address,
        staySince: headForm.staySince,
        residentStatus: headForm.residentStatus,
        provinceId: payload.provinceId,
        cityId: payload.cityId,
        districtId: payload.districtId,
        villageId: payload.villageId,
        rwId: payload.rwId,
        rtId: payload.rtId,
      })

      for (const member of memberForms.value) {
        const parentContext = [
          { ...headForm, fullName: headForm.fullName, gender: headForm.gender, familyRelationship: 'Kepala Keluarga' },
          ...memberForms.value.filter((candidate) => candidate !== member),
        ] as const
        const autoFilledMember = applyFamilyParentAutoFill(member, [...parentContext])
        if (!autoFilledMember) continue
        await saveResident({
          familyCardId: createdCardId,
          kkNumber: payload.kkNumber,
          nik: autoFilledMember.nik,
          fullName: autoFilledMember.fullName,
          gender: autoFilledMember.gender,
          birthPlace: autoFilledMember.birthPlace,
          birthDate: autoFilledMember.birthDate,
          religion: autoFilledMember.religion,
          education: autoFilledMember.education,
          occupation: autoFilledMember.occupation,
          maritalStatus: autoFilledMember.maritalStatus,
          familyRelationship: autoFilledMember.familyRelationship,
          citizenship: autoFilledMember.citizenship,
          fatherName: autoFilledMember.fatherName,
          motherName: autoFilledMember.motherName,
          address: payload.address,
          staySince: autoFilledMember.staySince,
          residentStatus: autoFilledMember.residentStatus,
          provinceId: payload.provinceId,
          cityId: payload.cityId,
          districtId: payload.districtId,
          villageId: payload.villageId,
          rwId: payload.rwId,
          rtId: payload.rtId,
        })
      }
    }
    message.value = editingId.value ? 'Kartu Keluarga berhasil diperbarui.' : 'KK dan data kepala keluarga berhasil disimpan.'
    messageError.value = false
    formOpen.value = false
    resetForm()
    await loadCards()
  } catch (error) {
    if (!editingId.value && createdCardId) {
      try {
        await deleteFamilyCard(createdCardId)
      } catch {
        // Best effort rollback jika salah satu data warga gagal disimpan.
      }
    }
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
  await loadRelationshipOptions()
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
          <button class="secondary-button action-button icon-compact-mobile" type="button" aria-label="Filter"
            title="Filter" @click="openFilters">
            <AppIcon class="action-icon" icon="mdi:filter-variant" /><span class="action-label">Filter</span>
          </button>
          <button v-if="auth.hasPermission('families.manage')" class="primary-button action-button icon-compact-mobile"
            type="button" aria-label="Tambah KK" title="Tambah KK" @click="openCreate">
            <AppIcon class="action-icon" icon="mdi:plus" /><span class="action-label">Tambah KK</span>
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><button class="sort-button" type="button" @click="toggleSort('kkNumber')">No. KK {{
                sortIndicator('kkNumber') }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('headName')">Kepala Keluarga {{
                sortIndicator('headName') }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('memberCount')">Anggota {{
                sortIndicator('memberCount') }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('rw')">RW {{ sortIndicator('rw')
              }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('rt')">RT {{ sortIndicator('rt')
              }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('address')">Alamat {{
                sortIndicator('address') }}</button></th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="card in paginatedItems" :key="card.id">
              <td>{{ card.kkNumber }}</td>
              <td>{{ card.headName }}</td>
              <td>{{ card.memberCount ?? 0 }} orang</td>
              <td>{{ regionName(card.rwId) }}</td>
              <td>{{ regionName(card.rtId) }}</td>
              <td>{{ card.address }}</td>
              <td class="table-actions"><button class="secondary-button action-button icon-only-button" type="button"
                  aria-label="Lihat detail" title="Lihat detail" @click="openDetail(card)">
                  <AppIcon class="action-icon" icon="mdi:eye-outline" /><span class="action-label">Lihat</span>
                </button><template v-if="auth.hasPermission('families.manage')"><button
                    class="secondary-button action-button icon-only-button" type="button" aria-label="Edit KK"
                    title="Edit KK" @click="editCard(card)">
                    <AppIcon class="action-icon" icon="mdi:pencil-outline" /><span class="action-label">Edit</span>
                  </button><button class="danger-button action-button icon-only-button" type="button"
                    aria-label="Hapus KK" title="Hapus KK" @click="deleteTarget = card">
                    <AppIcon class="action-icon" icon="mdi:trash-can-outline" /><span class="action-label">Hapus</span>
                  </button></template>
              </td>
            </tr>
            <tr v-if="!loading && cards.length === 0">
              <td colspan="7" class="muted">Data KK tidak ditemukan.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination v-model:page="page" v-model:page-size="pageSize" :total-items="cards.length"
        :total-pages="totalPages" />
    </div>

    <AppModal :open="filterOpen" title="Filter Kartu Keluarga" @close="filterOpen = false">
      <form class="form-grid modal-form" @submit.prevent="applyFilters">
        <div class="field">
          <label for="kkSearch">Cari nomor KK</label>
          <input id="kkSearch" v-model="filterDraft.search" placeholder="Masukkan nomor KK" />
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

    <AppModal :open="formOpen" :title="editingId ? 'Edit Kartu Keluarga' : 'Tambah Kartu Keluarga'" size="large"
      @close="formOpen = false">
      <form class="form-grid modal-form" @submit.prevent="submit">
        <div class="family-form-section">
          <h3>Data Kartu Keluarga</h3>
        </div>
        <div class="field">
          <label for="kkNumber">Nomor KK</label>
          <input id="kkNumber" v-model="form.kkNumber" required
            placeholder="contoh: 1234.5678-9012.3456" title="Nomor KK bisa menggunakan tanda titik atau tanda hubung"
            @input="form.kkNumber = normalizeKkNumber(form.kkNumber)" />
        </div>
        <div v-if="editingId" class="field">
          <label for="headName">Nama kepala keluarga</label>
          <input id="headName" v-model="form.headName" required />
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

        <template v-if="!editingId">
          <div class="family-form-section">
            <h3>Data Kepala Keluarga</h3>
            <p class="muted">Isi data kepala keluarga dengan format yang sama seperti data warga.</p>
          </div>
          <div class="field">
            <label for="headNik">NIK kepala keluarga</label>
            <input id="headNik" v-model="headForm.nik" required title="NIK dapat diisi dengan teks bebas"
              @input="headForm.nik = normalizeFreeTextId(headForm.nik)" />
          </div>
          <div class="field">
            <label for="headFullName">Nama lengkap</label>
            <input id="headFullName" v-model="headForm.fullName" required />
          </div>
          <div class="field">
            <label for="headGender">Jenis kelamin</label>
            <select id="headGender" v-model="headForm.gender">
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div class="field">
            <label for="headBirthPlace">Tempat lahir</label>
            <input id="headBirthPlace" v-model="headForm.birthPlace" required />
          </div>
          <div class="field">
            <label for="headBirthDate">Tanggal lahir</label>
            <input id="headBirthDate" v-model="headForm.birthDate" required type="date" />
          </div>
          <div class="field">
            <label for="headReligion">Agama</label>
            <input id="headReligion" v-model="headForm.religion" required />
          </div>
          <div class="field">
            <label for="headEducation">Pendidikan</label>
            <input id="headEducation" v-model="headForm.education" />
          </div>
          <div class="field">
            <label for="headOccupation">Pekerjaan</label>
            <input id="headOccupation" v-model="headForm.occupation" />
          </div>
          <div class="field">
            <label for="headMaritalStatus">Status perkawinan</label>
            <select id="headMaritalStatus" v-model="headForm.maritalStatus">
              <option>Belum Kawin</option>
              <option>Kawin</option>
              <option>Cerai Hidup</option>
              <option>Cerai Mati</option>
            </select>
          </div>
          <div class="field">
            <label for="headCitizenship">Kewarganegaraan</label>
            <select id="headCitizenship" v-model="headForm.citizenship">
              <option v-for="option in citizenshipOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
          <div class="field">
            <label for="headFatherName">Nama ayah</label>
            <input id="headFatherName" v-model="headForm.fatherName" />
          </div>
          <div class="field">
            <label for="headMotherName">Nama ibu</label>
            <input id="headMotherName" v-model="headForm.motherName" />
          </div>
          <div class="field">
            <label for="headStaySince">Mulai tinggal</label>
            <input id="headStaySince" v-model="headForm.staySince" type="date" />
          </div>
          <div class="field">
            <label for="headResidentStatus">Status penduduk</label>
            <select id="headResidentStatus" v-model="headForm.residentStatus">
              <option value="tetap">Tetap</option>
              <option value="sementara">Sementara/Musiman</option>
            </select>
          </div>

          <div class="family-form-section">
            <h3>Tambah Anggota Keluarga</h3>
            <button class="secondary-button action-button" type="button" @click="addMemberForm">
              <AppIcon class="action-icon" icon="mdi:plus" /><span class="action-label">Tambah Anggota</span>
            </button>
          </div>

          <div v-if="memberForms.length === 0" class="muted family-form-note">Belum ada anggota tambahan. Anda bisa
            menambah setelah data KK tersimpan.</div>

          <div v-for="(member, index) in memberForms" :key="member.id" class="member-card">
            <div class="member-card-header">
              <strong>Anggota {{ index + 1 }}</strong>
              <button class="danger-button action-button" type="button" @click="removeMemberForm(index)">
                <AppIcon class="action-icon" icon="mdi:trash-can-outline" /><span class="action-label">Hapus</span>
              </button>
            </div>
            <div class="field">
              <label :for="`memberNik-${index}`">NIK</label>
              <input :id="`memberNik-${index}`" v-model="member.nik" required title="NIK dapat diisi dengan teks bebas"
                @input="member.nik = normalizeFreeTextId(member.nik)" />
            </div>
            <div class="field">
              <label :for="`memberName-${index}`">Nama lengkap</label>
              <input :id="`memberName-${index}`" v-model="member.fullName" required />
            </div>
            <div class="field">
              <label :for="`memberGender-${index}`">Jenis kelamin</label>
              <select :id="`memberGender-${index}`" v-model="member.gender">
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div class="field">
              <label :for="`memberBirthPlace-${index}`">Tempat lahir</label>
              <input :id="`memberBirthPlace-${index}`" v-model="member.birthPlace" required />
            </div>
            <div class="field">
              <label :for="`memberBirthDate-${index}`">Tanggal lahir</label>
              <input :id="`memberBirthDate-${index}`" v-model="member.birthDate" type="date" required />
            </div>
            <div class="field">
              <label :for="`memberReligion-${index}`">Agama</label>
              <input :id="`memberReligion-${index}`" v-model="member.religion" required />
            </div>
            <div class="field">
              <label :for="`memberEducation-${index}`">Pendidikan</label>
              <input :id="`memberEducation-${index}`" v-model="member.education" />
            </div>
            <div class="field">
              <label :for="`memberOccupation-${index}`">Pekerjaan</label>
              <input :id="`memberOccupation-${index}`" v-model="member.occupation" />
            </div>
            <div class="field">
              <label :for="`memberMaritalStatus-${index}`">Status perkawinan</label>
              <select :id="`memberMaritalStatus-${index}`" v-model="member.maritalStatus">
                <option>Belum Kawin</option>
                <option>Kawin</option>
                <option>Cerai Hidup</option>
                <option>Cerai Mati</option>
              </select>
            </div>
            <div class="field">
              <label :for="`memberRelationship-${index}`">Hubungan keluarga</label>
              <select :id="`memberRelationship-${index}`" v-model="member.familyRelationship" required>
                <option v-for="option in relationshipOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </div>
            <div class="field">
              <label :for="`memberCitizenship-${index}`">Kewarganegaraan</label>
              <select :id="`memberCitizenship-${index}`" v-model="member.citizenship">
                <option v-for="option in citizenshipOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </div>
            <div class="field">
              <label :for="`memberFatherName-${index}`">Nama ayah</label>
              <input :id="`memberFatherName-${index}`" v-model="member.fatherName" />
            </div>
            <div class="field">
              <label :for="`memberMotherName-${index}`">Nama ibu</label>
              <input :id="`memberMotherName-${index}`" v-model="member.motherName" />
            </div>
            <div class="field">
              <label :for="`memberStaySince-${index}`">Mulai tinggal</label>
              <input :id="`memberStaySince-${index}`" v-model="member.staySince" type="date" />
            </div>
            <div class="field">
              <label :for="`memberResidentStatus-${index}`">Status penduduk</label>
              <select :id="`memberResidentStatus-${index}`" v-model="member.residentStatus">
                <option value="tetap">Tetap</option>
                <option value="sementara">Sementara/Musiman</option>
              </select>
            </div>
          </div>
        </template>

        <button class="primary-button" type="submit" :disabled="saving">
          {{ saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Tambah KK') }}
        </button>
        <button class="secondary-button" type="button" @click="formOpen = false">Batal</button>
      </form>
    </AppModal>
    <AppModal :open="Boolean(detailTarget)" title="Detail Kartu Keluarga" size="large" @close="closeDetail">
      <dl class="detail-list">
        <template v-for="row in detailRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value || '-' }}</dd>
        </template>
      </dl>

      <details class="family-collapse" open>
        <summary>Anggota Keluarga ({{ detailMembers.length }})</summary>
        <p v-if="detailLoading" class="muted">Memuat data anggota keluarga...</p>
        <p v-else-if="detailMembers.length === 0" class="muted">Belum ada anggota keluarga.</p>
        <div v-else class="family-members">
          <details v-for="member in detailMembers" :key="member.id" class="family-member">
            <summary>{{ member.fullName }} — {{ member.nik }} <span class="badge">{{ member.familyRelationship }}</span>
            </summary>
            <dl class="detail-list">
              <dt>Jenis Kelamin</dt>
              <dd>{{ member.gender === 'L' ? 'Laki-laki' : 'Perempuan' }}</dd>
              <dt>Tempat, Tanggal Lahir</dt>
              <dd>{{ member.birthPlace }}, {{ member.birthDate }}</dd>
              <dt>Agama</dt>
              <dd>{{ member.religion }}</dd>
              <dt>Pendidikan</dt>
              <dd>{{ member.education || '-' }}</dd>
              <dt>Pekerjaan</dt>
              <dd>{{ member.occupation || '-' }}</dd>
              <dt>Status Perkawinan</dt>
              <dd>{{ member.maritalStatus }}</dd>
              <dt>Status Penduduk</dt>
              <dd>{{ member.residentStatus }}</dd>
              <dt>Nama Ayah</dt>
              <dd>{{ member.fatherName || '-' }}</dd>
              <dt>Nama Ibu</dt>
              <dd>{{ member.motherName || '-' }}</dd>
            </dl>
          </details>
        </div>
      </details>
    </AppModal>
    <AppModal :open="Boolean(deleteTarget)" title="Hapus Kartu Keluarga" size="small" @close="deleteTarget = null">
      <p>Hapus KK <strong>{{ deleteTarget?.kkNumber }}</strong>? Seluruh data warga dalam KK ini juga akan dihapus.</p>
      <footer class="modal-actions"><button class="secondary-button" type="button"
          @click="deleteTarget = null">Batal</button><button class="danger-button" type="button" :disabled="saving"
          @click="confirmDelete">Hapus</button></footer>
    </AppModal>
  </section>
</template>

<style scoped>
.family-form-section {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
}

.family-form-section h3 {
  margin: 0;
  font-size: 15px;
}

.family-form-note {
  grid-column: 1 / -1;
}

.member-card {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 14px;
  border: 1px dashed #cad3dc;
  border-radius: 10px;
  background: #f8fafc;
}

.member-card-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 980px) {
  .member-card {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .member-card {
    grid-template-columns: 1fr;
  }
}
</style>
