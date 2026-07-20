<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import ItemDetailModal from '@/components/ItemDetailModal.vue'
import TablePagination from '@/components/TablePagination.vue'
import { useClientTable } from '@/composables/useClientTable'
import { createManagedUser, deleteManagedUser, listProfiles, listRegions, listRoles, updateManagedUser } from '@/services/data'
import { canManageProfileRole, createScopePayload, roleLabel } from '@/services/scope'
import { useAuthStore } from '@/stores/auth'
import type { Region, Role, UserProfile, UserRole } from '@/types/domain'

const auth = useAuthStore()
const profiles = ref<UserProfile[]>([])
const regions = ref<Region[]>([])
const roles = ref<Role[]>([])
const saving = ref(false)
const isNew = ref(true)
const formOpen = ref(false)
const deleteTarget = ref<UserProfile | null>(null)
const detailTarget = ref<UserProfile | null>(null)
const feedback = ref('')
const feedbackError = ref(false)

const form = reactive({
  uid: '', email: '', password: '', displayName: '', role: 'ketua_rt' as UserRole,
  provinceId: '', cityId: '', districtId: '', villageId: '', rwId: '', rtId: '',
})

const provinceOptions = computed(() => regions.value.filter((item) => item.type === 'province'))
const cityOptions = computed(() => regions.value.filter(
  (item) => item.type === 'city' && (!form.provinceId || item.parentId === form.provinceId),
))
const districtOptions = computed(() => regions.value.filter(
  (item) => item.type === 'district' && (!form.cityId || item.parentId === form.cityId),
))
const villageOptions = computed(() => regions.value.filter(
  (item) => item.type === 'village' && (!form.districtId || item.parentId === form.districtId),
))
const rwOptions = computed(() => regions.value.filter(
  (item) => item.type === 'rw' && (!form.villageId || item.parentId === form.villageId),
))
const rtOptions = computed(() => regions.value.filter(
  (item) => item.type === 'rt' && Boolean(form.rwId) && item.rwId === form.rwId,
))
const needsRw = computed(() => ['ketua_rw', 'staff_rw', 'ketua_rt', 'staff_rt'].includes(form.role))
const needsRt = computed(() => ['ketua_rt', 'staff_rt'].includes(form.role))

function regionName(id?: string) {
  return regions.value.find((item) => item.id === id)?.name ?? '-'
}

function regionOptionLabel(region: Region) {
  const parent = regions.value.find((item) => item.id === region.parentId)
  return parent ? `${region.name} — ${parent.name}` : region.name
}

const { page, pageSize, totalPages, paginatedItems, toggleSort, sortIndicator } = useClientTable(
  profiles,
  'displayName',
  {
    roleLabel: (item) => roleLabel(item.role),
    region: (item) => ['ketua_rt', 'staff_rt'].includes(item.role) ? regionName(item.rtId) : regionName(item.rwId),
  },
)
const detailRows = computed(() => detailTarget.value ? [
  { label: 'Nama', value: detailTarget.value.displayName },
  { label: 'Email', value: detailTarget.value.email },
  { label: 'Role', value: roleLabel(detailTarget.value.role) },
  { label: 'RW', value: regionName(detailTarget.value.rwId) },
  { label: 'RT', value: regionName(detailTarget.value.rtId) },
] : [])

async function loadData() {
  const [profileData, regionData, roleData] = await Promise.all([
    listProfiles(), listRegions(auth.profile), listRoles(),
  ])
  profiles.value = profileData
  regions.value = regionData
  roles.value = roleData
}

function resetForm() {
  isNew.value = true
  const scope = createScopePayload(auth.profile)
  Object.assign(form, {
    uid: '', email: '', password: '', displayName: '', role: 'ketua_rt' as UserRole,
    provinceId: scope.provinceId ?? '',
    cityId: scope.cityId ?? '',
    districtId: scope.districtId ?? '',
    villageId: scope.villageId ?? '',
    rwId: scope.rwId ?? '',
    rtId: '',
  })
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function editProfile(profile: UserProfile) {
  isNew.value = false
  Object.assign(form, {
    uid: profile.uid,
    email: profile.email,
    password: '',
    displayName: profile.displayName,
    role: profile.role,
    provinceId: profile.provinceId ?? '',
    cityId: profile.cityId ?? '',
    districtId: profile.districtId ?? '',
    villageId: profile.villageId ?? '',
    rwId: profile.rwId ?? '',
    rtId: profile.rtId ?? '',
  })
  formOpen.value = true
}

async function submit() {
  if (!auth.canManageUsers || !canManageProfileRole(auth.profile, form.role)) return
  saving.value = true
  feedback.value = ''
  try {
    const rtRegion = regions.value.find((item) => item.id === form.rtId && item.rwId === form.rwId)
    const rwRegion = regions.value.find((item) => item.id === form.rwId)
    const leaf = needsRt.value ? rtRegion : needsRw.value ? rwRegion : undefined
    const payload = {
      email: form.email,
      displayName: form.displayName,
      role: form.role,
      provinceId: leaf?.provinceId ?? (form.provinceId || undefined),
      cityId: leaf?.cityId ?? (form.cityId || undefined),
      districtId: leaf?.districtId ?? (form.districtId || undefined),
      villageId: leaf?.villageId ?? (form.villageId || undefined),
      rwId: needsRw.value ? (rtRegion?.rwId ?? form.rwId) : undefined,
      rtId: needsRt.value ? form.rtId : undefined,
    }
    if (isNew.value) await createManagedUser(payload, form.password)
    else await updateManagedUser(form.uid, payload, form.password)
    feedback.value = isNew.value ? 'Pengguna berhasil ditambahkan.' : 'Pengguna berhasil diperbarui.'
    feedbackError.value = false
    formOpen.value = false
    resetForm()
    await loadData()
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Gagal menyimpan pengguna.'
    feedbackError.value = true
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  saving.value = true
  try {
    await deleteManagedUser(deleteTarget.value.uid)
    feedback.value = 'Pengguna berhasil dihapus.'
    feedbackError.value = false
    deleteTarget.value = null
    await loadData()
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Gagal menghapus pengguna.'
    feedbackError.value = true
  } finally {
    saving.value = false
  }
}

watch(() => form.provinceId, () => {
  if (!cityOptions.value.some((item) => item.id === form.cityId)) form.cityId = ''
})
watch(() => form.cityId, () => {
  if (!districtOptions.value.some((item) => item.id === form.districtId)) form.districtId = ''
})
watch(() => form.districtId, () => {
  if (!villageOptions.value.some((item) => item.id === form.villageId)) form.villageId = ''
})
watch(() => form.villageId, () => {
  if (!rwOptions.value.some((item) => item.id === form.rwId)) form.rwId = ''
})
watch(() => form.rwId, () => {
  if (!rtOptions.value.some((item) => item.id === form.rtId)) form.rtId = ''
})

onMounted(async () => {
  resetForm()
  await loadData()
})
</script>

<template>
  <section class="content-stack">
    <p v-if="feedback" :class="feedbackError ? 'alert' : 'success'">{{ feedback }}</p>

    <div class="section-panel">
      <div class="section-header">
        <div><strong>Daftar pengguna</strong><span class="badge">{{ profiles.length }} akun</span></div>
        <button v-if="auth.canManageUsers && auth.profile?.role === 'superadmin'" class="primary-button" type="button" @click="openCreate">
          Tambah Pengguna
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th><button class="sort-button" type="button" @click="toggleSort('displayName')">Nama {{ sortIndicator('displayName') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('email')">Email {{ sortIndicator('email') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('roleLabel')">Role {{ sortIndicator('roleLabel') }}</button></th><th><button class="sort-button" type="button" @click="toggleSort('region')">Wilayah {{ sortIndicator('region') }}</button></th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-for="item in paginatedItems" :key="item.uid">
              <td>{{ item.displayName }}</td><td>{{ item.email }}</td><td>{{ roleLabel(item.role) }}</td>
              <td>{{ ['ketua_rt', 'staff_rt'].includes(item.role) ? regionName(item.rtId) : regionName(item.rwId) }}</td>
              <td class="table-actions">
                <button class="secondary-button" type="button" @click="detailTarget = item">Lihat</button>
                <template v-if="canManageProfileRole(auth.profile, item.role)">
                  <button class="secondary-button" type="button" @click="editProfile(item)">Edit</button>
                  <button v-if="item.uid !== auth.currentUser?.id && item.role !== 'superadmin'" class="danger-button" type="button" @click="deleteTarget = item">Hapus</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination v-model:page="page" v-model:page-size="pageSize" :total-items="profiles.length" :total-pages="totalPages" />
    </div>

    <AppModal :open="formOpen" :title="isNew ? 'Tambah Pengguna' : 'Edit Pengguna'" size="large" @close="formOpen = false">
      <form class="form-grid modal-form" @submit.prevent="submit">
        <div class="field"><label for="email">Email</label><input id="email" v-model="form.email" type="email" required /></div>
        <div class="field">
          <label for="password">{{ isNew ? 'Password awal' : 'Password baru' }}</label>
          <input id="password" v-model="form.password" type="password" minlength="8" :required="isNew" autocomplete="new-password" />
          <small v-if="!isNew" class="muted">Kosongkan jika password tidak diubah.</small>
        </div>
        <div class="field"><label for="displayName">Nama tampilan</label><input id="displayName" v-model="form.displayName" required /></div>
        <div class="field"><label for="role">Role</label><select id="role" v-model="form.role"><option v-for="item in roles" :key="item.id" :value="item.code" :disabled="!canManageProfileRole(auth.profile, item.code)">{{ item.label }}</option></select></div>

        <template v-if="auth.profile?.role === 'superadmin' && needsRw">
          <div class="field"><label for="provinceId">Provinsi</label><select id="provinceId" v-model="form.provinceId" required><option value="">Pilih Provinsi</option><option v-for="item in provinceOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
          <div class="field"><label for="cityId">Kota/Kabupaten</label><select id="cityId" v-model="form.cityId" required :disabled="!form.provinceId"><option value="">Pilih Kota/Kabupaten</option><option v-for="item in cityOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
          <div class="field"><label for="districtId">Kecamatan</label><select id="districtId" v-model="form.districtId" required :disabled="!form.cityId"><option value="">Pilih Kecamatan</option><option v-for="item in districtOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
          <div class="field"><label for="villageId">Kelurahan</label><select id="villageId" v-model="form.villageId" required :disabled="!form.districtId"><option value="">Pilih Kelurahan</option><option v-for="item in villageOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
          <div class="field"><label for="rwId">RW</label><select id="rwId" v-model="form.rwId" required :disabled="!form.villageId"><option value="">Pilih RW</option><option v-for="item in rwOptions" :key="item.id" :value="item.id">{{ regionOptionLabel(item) }}</option></select></div>
        </template>
        <div v-if="needsRt" class="field"><label for="rtId">RT</label><select id="rtId" v-model="form.rtId" required :disabled="!form.rwId"><option value="">Pilih RT</option><option v-for="item in rtOptions" :key="item.id" :value="item.id">{{ regionOptionLabel(item) }}</option></select></div>

        <footer class="modal-actions"><button class="secondary-button" type="button" @click="formOpen = false">Batal</button><button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan' }}</button></footer>
      </form>
    </AppModal>

    <AppModal :open="Boolean(deleteTarget)" title="Hapus Pengguna" size="small" @close="deleteTarget = null">
      <p>Hapus akun <strong>{{ deleteTarget?.displayName }}</strong>? Pengguna tersebut tidak akan dapat login kembali.</p>
      <footer class="modal-actions"><button class="secondary-button" type="button" @click="deleteTarget = null">Batal</button><button class="danger-button" type="button" :disabled="saving" @click="confirmDelete">Hapus</button></footer>
    </AppModal>

    <ItemDetailModal :open="Boolean(detailTarget)" title="Detail Pengguna" :rows="detailRows" @close="detailTarget = null" />
  </section>
</template>
