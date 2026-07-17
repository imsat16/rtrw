<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { deleteProfile, listProfiles, listRegions, listRoles, saveProfile } from '@/services/data'
import { canManageProfileRole, createScopePayload, roleLabel } from '@/services/scope'
import { useAuthStore } from '@/stores/auth'
import type { Region, Role, UserProfile, UserRole } from '@/types/domain'

const auth = useAuthStore()
const profiles = ref<UserProfile[]>([])
const regions = ref<Region[]>([])
const roles = ref<Role[]>([])
const saving = ref(false)
const isNew = ref(true)

const form = reactive({
  uid: '',
  email: '',
  displayName: '',
  role: 'rt' as UserRole,
  provinceId: '',
  cityId: '',
  districtId: '',
  villageId: '',
  rwId: '',
  rtId: '',
})

const rtOptions = computed(() => {
  const rt = regions.value.filter((item) => item.type === 'rt')
  if (auth.profile?.role === 'rw') return rt.filter((item) => item.rwId === auth.profile?.rwId)
  return rt
})
const rwOptions = computed(() => regions.value.filter((item) => item.type === 'rw'))
const villageOptions = computed(() => regions.value.filter((item) => item.type === 'village'))
const districtOptions = computed(() => regions.value.filter((item) => item.type === 'district'))
const cityOptions = computed(() => regions.value.filter((item) => item.type === 'city'))
const provinceOptions = computed(() => regions.value.filter((item) => item.type === 'province'))

function regionName(id?: string) {
  return regions.value.find((item) => item.id === id)?.name ?? '-'
}

async function loadData() {
  const [profileData, regionData, roleData] = await Promise.all([listProfiles(), listRegions(), listRoles()])
  profiles.value = profileData
  regions.value = regionData
  roles.value = roleData
}

function resetForm() {
  isNew.value = true
  form.uid = ''
  form.email = ''
  form.displayName = ''
  form.role = 'rt'
  const scope = createScopePayload(auth.profile)
  form.provinceId = scope.provinceId ?? ''
  form.cityId = scope.cityId ?? ''
  form.districtId = scope.districtId ?? ''
  form.villageId = scope.villageId ?? ''
  form.rwId = scope.rwId ?? ''
  form.rtId = ''
}

function editProfile(p: UserProfile) {
  isNew.value = false
  form.uid = p.uid
  form.email = p.email
  form.displayName = p.displayName
  form.role = p.role
  form.provinceId = p.provinceId ?? ''
  form.cityId = p.cityId ?? ''
  form.districtId = p.districtId ?? ''
  form.villageId = p.villageId ?? ''
  form.rwId = p.rwId ?? ''
  form.rtId = p.rtId ?? ''
}

async function submit() {
  if (!canManageProfileRole(auth.profile, form.role)) return
  saving.value = true

  const rtRegion = regions.value.find((item) => item.id === form.rtId)
  const rwRegion = regions.value.find((item) => item.id === form.rwId)
  const leaf = form.role === 'rt' ? rtRegion : form.role === 'rw' ? rwRegion : undefined

  await saveProfile(
    {
      email: form.email,
      displayName: form.displayName,
      role: form.role,
      provinceId: leaf?.provinceId ?? form.provinceId ?? undefined,
      cityId: leaf?.cityId ?? form.cityId ?? undefined,
      districtId: leaf?.districtId ?? form.districtId ?? undefined,
      villageId: leaf?.villageId ?? form.villageId ?? undefined,
      rwId: form.role === 'rt' ? (rtRegion?.rwId ?? form.rwId) : form.rwId || undefined,
      rtId: form.role === 'rt' ? form.rtId : undefined,
    },
    form.uid,
    isNew.value,
  )
  resetForm()
  await loadData()
  saving.value = false
}

async function removeProfile(uid: string) {
  await deleteProfile(uid)
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
        <label for="uid">UID Supabase Auth</label>
        <input
          id="uid"
          v-model="form.uid"
          required
          :disabled="!isNew"
          placeholder="UUID dari Authentication > Users"
        />
        <small class="muted">
          Salin UID dari Supabase Dashboard &gt; Authentication &gt; Users. Akun auth harus sudah dibuat manual
          sebelum mengisi form ini.
        </small>
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="form.email" type="email" required />
      </div>
      <div class="field">
        <label for="displayName">Nama tampilan</label>
        <input id="displayName" v-model="form.displayName" required />
      </div>
      <div class="field">
        <label for="role">Role</label>
        <select id="role" v-model="form.role">
          <option
            v-for="item in roles"
            :key="item.id"
            :value="item.id"
            :disabled="!canManageProfileRole(auth.profile, item.id)"
          >
            {{ item.label }}
          </option>
        </select>
      </div>

      <template v-if="auth.profile?.role === 'superadmin'">
        <div class="field">
          <label for="provinceId">Provinsi</label>
          <select id="provinceId" v-model="form.provinceId">
            <option value="">-</option>
            <option v-for="item in provinceOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="cityId">Kota/Kabupaten</label>
          <select id="cityId" v-model="form.cityId">
            <option value="">-</option>
            <option v-for="item in cityOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="districtId">Kecamatan</label>
          <select id="districtId" v-model="form.districtId">
            <option value="">-</option>
            <option v-for="item in districtOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="villageId">Kelurahan</label>
          <select id="villageId" v-model="form.villageId">
            <option value="">-</option>
            <option v-for="item in villageOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="rwId">RW</label>
          <select id="rwId" v-model="form.rwId">
            <option value="">-</option>
            <option v-for="item in rwOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
      </template>

      <div class="field" v-if="form.role === 'rt'">
        <label for="rtId">RT</label>
        <select id="rtId" v-model="form.rtId" required>
          <option value="">Pilih RT</option>
          <option v-for="item in rtOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>

      <button class="primary-button" type="submit" :disabled="saving">
        {{ isNew ? 'Tambah Pengguna' : 'Simpan Perubahan' }}
      </button>
      <button class="secondary-button" type="button" @click="resetForm">Reset</button>
    </form>

    <div class="section-panel">
      <div class="section-header">
        <strong>Daftar pengguna</strong>
        <span class="badge">{{ profiles.length }} akun</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Wilayah</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in profiles" :key="item.uid">
              <td>{{ item.displayName }}</td>
              <td>{{ item.email }}</td>
              <td>{{ roleLabel(item.role) }}</td>
              <td>{{ item.role === 'rt' ? regionName(item.rtId) : regionName(item.rwId) }}</td>
              <td>
                <template v-if="canManageProfileRole(auth.profile, item.role)">
                  <button class="secondary-button" type="button" @click="editProfile(item)">Edit</button>
                  <button class="danger-button" type="button" @click="removeProfile(item.uid)">Hapus</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
