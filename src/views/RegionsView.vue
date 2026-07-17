<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import ItemDetailModal from '@/components/ItemDetailModal.vue'
import TablePagination from '@/components/TablePagination.vue'
import { useClientTable } from '@/composables/useClientTable'
import { deleteRegion, listRegions, saveRegion } from '@/services/data'
import { canManageRegionType } from '@/services/scope'
import { useAuthStore } from '@/stores/auth'
import type { Region, RegionType } from '@/types/domain'

const auth = useAuthStore()
const regions = ref<Region[]>([])
const saving = ref(false)
const formOpen = ref(false)
const deleteTarget = ref<Region | null>(null)
const detailTarget = ref<Region | null>(null)
const form = reactive({
  id: '',
  type: 'province' as RegionType,
  name: '',
  code: '',
  parentId: '',
})

const regionTypes: Array<{ value: RegionType; label: string }> = [
  { value: 'province', label: 'Provinsi' },
  { value: 'city', label: 'Kota/Kabupaten' },
  { value: 'district', label: 'Kecamatan' },
  { value: 'village', label: 'Kelurahan' },
  { value: 'rw', label: 'RW' },
  { value: 'rt', label: 'RT' },
]

const parentType: Partial<Record<RegionType, RegionType>> = {
  city: 'province',
  district: 'city',
  village: 'district',
  rw: 'village',
  rt: 'rw',
}
const parentOptions = computed(() => {
  const expectedType = parentType[form.type]
  if (!expectedType) return []
  let options = regions.value.filter((item) => item.type === expectedType)
  if (form.type === 'rt' && auth.profile?.role === 'ketua_rw') {
    options = options.filter((item) => item.id === auth.profile?.rwId)
  }
  return options
})

function regionOptionLabel(region: Region) {
  const parent = regions.value.find((item) => item.id === region.parentId)
  return parent ? `${region.name} — ${parent.name}` : region.name
}

function regionName(id?: string) {
  return regions.value.find((item) => item.id === id)?.name ?? '-'
}

const { page, pageSize, totalPages, paginatedItems, toggleSort, sortIndicator } = useClientTable(
  regions,
  'type',
  { parent: (item) => regionName(item.parentId) },
)
const detailRows = computed(() => detailTarget.value ? [
  { label: 'Jenis', value: detailTarget.value.type.toUpperCase() },
  { label: 'Nama', value: detailTarget.value.name },
  { label: 'Kode', value: detailTarget.value.code },
  { label: 'Induk', value: regionName(detailTarget.value.parentId) },
  { label: 'UUID', value: detailTarget.value.id },
] : [])

async function loadData() {
  regions.value = await listRegions(auth.profile)
}

function editRegion(region: Region) {
  form.id = region.id
  form.type = region.type
  form.name = region.name
  form.code = region.code ?? ''
  form.parentId = region.parentId ?? ''
  formOpen.value = true
}

function resetForm() {
  form.id = ''
  form.type = auth.profile?.role === 'ketua_rw' ? 'rt' : 'province'
  form.name = ''
  form.code = ''
  form.parentId = ''
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

async function submit() {
  if (!auth.canManageRegions || !canManageRegionType(auth.profile, form.type)) return
  saving.value = true
  const parent = regions.value.find((item) => item.id === form.parentId)
  try {
    await saveRegion(
      {
        type: form.type,
        name: form.name,
        code: form.code,
        parentId: form.parentId || undefined,
        provinceId: parent?.provinceId ?? (form.type === 'province' ? form.id : undefined),
        cityId: parent?.cityId,
        districtId: parent?.districtId,
        villageId: parent?.villageId,
        rwId: form.type === 'rw' ? form.id : parent?.rwId ?? auth.profile?.rwId,
        rtId: form.type === 'rt' ? form.id : undefined,
      },
      form.id || undefined,
    )
    resetForm()
    formOpen.value = false
    await loadData()
  } catch (error) {
    console.error('Failed to save region:', error)
  } finally {
    saving.value = false
  }
}

async function removeRegion(region: Region) {
  if (!auth.canManageRegions) return
  await deleteRegion(region)
  deleteTarget.value = null
  await loadData()
}

watch(() => form.type, () => {
  if (!parentOptions.value.some((item) => item.id === form.parentId)) form.parentId = ''
})

onMounted(async () => {
  resetForm()
  await loadData()
})
</script>

<template>
  <section class="content-stack">
    <div class="section-panel">
      <div class="section-header">
        <div><strong>Daftar wilayah</strong><span class="badge">{{ regions.length }} data</span></div>
        <button v-if="auth.canManageRegions" class="primary-button" type="button" @click="openCreate">Tambah
          Wilayah</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><button class="sort-button" type="button" @click="toggleSort('type')">Jenis {{ sortIndicator('type') }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('name')">Nama {{ sortIndicator('name') }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('code')">Kode {{ sortIndicator('code') }}</button></th>
              <th><button class="sort-button" type="button" @click="toggleSort('parent')">Induk {{ sortIndicator('parent') }}</button></th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="region in paginatedItems" :key="region.id">
              <td>{{ region.type.toUpperCase() }}</td>
              <td>{{ region.name }}</td>
              <td>{{ region.code || '-' }}</td>
              <td>{{ regionName(region.parentId) }}</td>
              <td class="table-actions">
                <button class="secondary-button" type="button" @click="detailTarget = region">Lihat</button>
                <template v-if="canManageRegionType(auth.profile, region.type)">
                  <button class="secondary-button" type="button" @click="editRegion(region)">Edit</button>
                  <button class="danger-button" type="button" @click="deleteTarget = region">Hapus</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination v-model:page="page" v-model:page-size="pageSize" :total-items="regions.length" :total-pages="totalPages" />
    </div>

    <AppModal :open="formOpen" :title="form.id ? 'Edit Wilayah' : 'Tambah Wilayah'" @close="formOpen = false">
      <form class="form-grid modal-form" @submit.prevent="submit">
        <div class="field">
          <label for="type">Jenis wilayah</label>
          <select id="type" v-model="form.type">
            <option v-for="type in regionTypes" :key="type.value" :value="type.value"
              :disabled="!canManageRegionType(auth.profile, type.value)">
              {{ type.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="name">Nama</label>
          <input id="name" v-model="form.name" required placeholder="Contoh: Mekarjaya / RW 07" />
        </div>
        <div class="field">
          <label for="code">Kode</label>
          <input id="code" v-model="form.code" placeholder="Opsional" />
        </div>
        <div class="field">
          <label for="parent">Induk wilayah</label>
          <select id="parent" v-model="form.parentId" :required="form.type !== 'province'">
            <option value="">{{ form.type === 'province' ? 'Tanpa induk' : 'Pilih induk' }}</option>
            <option v-for="region in parentOptions" :key="region.id" :value="region.id">
              {{ regionOptionLabel(region) }}
            </option>
          </select>
        </div>
        <button class="primary-button" type="submit" :disabled="saving">
          {{ saving ? 'Menyimpan...' : 'Simpan' }}
        </button>
        <button class="secondary-button" type="button" @click="formOpen = false">Batal</button>
      </form>
    </AppModal>

    <AppModal :open="Boolean(deleteTarget)" title="Hapus Wilayah" size="small" @close="deleteTarget = null">
      <p>Hapus wilayah <strong>{{ deleteTarget?.name }}</strong>?</p>
      <footer class="modal-actions"><button class="secondary-button" type="button"
          @click="deleteTarget = null">Batal</button><button class="danger-button" type="button" :disabled="saving"
          @click="deleteTarget && removeRegion(deleteTarget)">Hapus</button></footer>
    </AppModal>

    <ItemDetailModal :open="Boolean(detailTarget)" title="Detail Wilayah" :rows="detailRows" @close="detailTarget = null" />
  </section>
</template>
