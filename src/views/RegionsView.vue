<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { deleteRegion, listRegions, saveRegion } from '@/services/data'
import { canManageRegionType } from '@/services/scope'
import { useAuthStore } from '@/stores/auth'
import type { Region, RegionType } from '@/types/domain'

const auth = useAuthStore()
const regions = ref<Region[]>([])
const saving = ref(false)
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

const parentOptions = computed(() => regions.value.filter((item) => item.type !== 'rt'))

function regionName(id?: string) {
  return regions.value.find((item) => item.id === id)?.name ?? '-'
}

async function loadData() {
  regions.value = await listRegions()
}

function editRegion(region: Region) {
  form.id = region.id
  form.type = region.type
  form.name = region.name
  form.code = region.code ?? ''
  form.parentId = region.parentId ?? ''
}

function resetForm() {
  form.id = ''
  form.type = auth.profile?.role === 'rw' ? 'rt' : 'province'
  form.name = ''
  form.code = ''
  form.parentId = ''
}

async function submit() {
  if (!canManageRegionType(auth.profile, form.type)) return
  saving.value = true
  const parent = regions.value.find((item) => item.id === form.parentId)
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
  await loadData()
  saving.value = false
}

async function removeRegion(id: string) {
  await deleteRegion(id)
  await loadData()
}

onMounted(async () => {
  resetForm()
  await loadData()
})
</script>

<template>
  <section class="content-stack">
    <form class="form-grid" @submit.prevent="submit">
      <div class="field">
        <label for="type">Jenis wilayah</label>
        <select id="type" v-model="form.type">
          <option
            v-for="type in regionTypes"
            :key="type.value"
            :value="type.value"
            :disabled="!canManageRegionType(auth.profile, type.value)"
          >
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
        <select id="parent" v-model="form.parentId">
          <option value="">Tanpa induk</option>
          <option v-for="region in parentOptions" :key="region.id" :value="region.id">
            {{ region.type.toUpperCase() }} - {{ region.name }}
          </option>
        </select>
      </div>
      <button class="primary-button" type="submit" :disabled="saving">
        {{ form.id ? 'Simpan Perubahan' : 'Tambah Wilayah' }}
      </button>
      <button class="secondary-button" type="button" @click="resetForm">Reset</button>
    </form>

    <div class="section-panel">
      <div class="section-header">
        <strong>Daftar wilayah</strong>
        <span class="badge">{{ regions.length }} data</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Jenis</th>
              <th>Nama</th>
              <th>Kode</th>
              <th>Induk</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="region in regions" :key="region.id">
              <td>{{ region.type.toUpperCase() }}</td>
              <td>{{ region.name }}</td>
              <td>{{ region.code || '-' }}</td>
              <td>{{ regionName(region.parentId) }}</td>
              <td>
                <button class="secondary-button" type="button" @click="editRegion(region)">Edit</button>
                <button class="danger-button" type="button" @click="removeRegion(region.id)">Hapus</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
