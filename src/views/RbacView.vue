<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ItemDetailModal from '@/components/ItemDetailModal.vue'
import TablePagination from '@/components/TablePagination.vue'
import { useClientTable } from '@/composables/useClientTable'
import {
  listPermissions,
  listProfiles,
  listRolePermissions,
  listRoles,
  listUserPermissions,
  saveRolePermission,
  saveUserPermission,
} from '@/services/data'
import type {
  Permission,
  Role,
  RolePermission,
  UserPermission,
  UserProfile,
} from '@/types/domain'

const permissions = ref<Permission[]>([])
const roles = ref<Role[]>([])
const profiles = ref<UserProfile[]>([])
const rolePermissions = ref<RolePermission[]>([])
const userPermissions = ref<UserPermission[]>([])
const selectedUserId = ref('')
const savingKey = ref('')
const message = ref('')
const detailTarget = ref<Permission | null>(null)

const editableRoles = computed(() => roles.value.filter((role) => role.code !== 'superadmin'))
const editableProfiles = computed(() => profiles.value.filter((profile) => profile.role !== 'superadmin'))
const selectedUser = computed(() => profiles.value.find((profile) => profile.uid === selectedUserId.value))
const roleTable = useClientTable(permissions, 'sortOrder')
const userTable = useClientTable(permissions, 'sortOrder')
const detailRows = computed(() => detailTarget.value ? [
  { label: 'Permission', value: detailTarget.value.label },
  { label: 'Kode', value: detailTarget.value.code },
  { label: 'Modul', value: detailTarget.value.module },
  { label: 'Deskripsi', value: detailTarget.value.description },
  { label: 'UUID', value: detailTarget.value.id },
] : [])

function roleAllowed(roleId: string, permissionId: string) {
  return rolePermissions.value.find(
    (item) => item.roleId === roleId && item.permissionId === permissionId,
  )?.allowed ?? false
}

function userOverride(permissionId: string): 'inherit' | 'allow' | 'deny' {
  const override = userPermissions.value.find(
    (item) => item.userId === selectedUserId.value && item.permissionId === permissionId,
  )
  if (!override) return 'inherit'
  return override.allowed ? 'allow' : 'deny'
}

function effectiveUserAllowed(permissionId: string) {
  const override = userOverride(permissionId)
  if (override !== 'inherit') return override === 'allow'
  return selectedUser.value ? roleAllowed(selectedUser.value.roleId, permissionId) : false
}

async function loadData() {
  const [permissionData, roleData, profileData, rolePermissionData, userPermissionData] = await Promise.all([
    listPermissions(),
    listRoles(),
    listProfiles(),
    listRolePermissions(),
    listUserPermissions(),
  ])
  permissions.value = permissionData
  roles.value = roleData
  profiles.value = profileData
  rolePermissions.value = rolePermissionData
  userPermissions.value = userPermissionData
  if (!selectedUserId.value) selectedUserId.value = editableProfiles.value[0]?.uid ?? ''
}

async function updateRole(roleId: string, permissionId: string, event: Event) {
  const allowed = (event.target as HTMLInputElement).checked
  savingKey.value = `role:${roleId}:${permissionId}`
  message.value = ''
  try {
    await saveRolePermission(roleId, permissionId, allowed)
    const existing = rolePermissions.value.find(
      (item) => item.roleId === roleId && item.permissionId === permissionId,
    )
    if (existing) existing.allowed = allowed
    else rolePermissions.value.push({ roleId, permissionId, allowed })
    message.value = 'Default permission role berhasil disimpan.'
  } finally {
    savingKey.value = ''
  }
}

async function updateUser(permissionId: string, event: Event) {
  if (!selectedUserId.value) return
  const value = (event.target as HTMLSelectElement).value as 'inherit' | 'allow' | 'deny'
  const allowed = value === 'inherit' ? null : value === 'allow'
  savingKey.value = `user:${selectedUserId.value}:${permissionId}`
  message.value = ''
  try {
    await saveUserPermission(selectedUserId.value, permissionId, allowed)
    userPermissions.value = userPermissions.value.filter(
      (item) => !(item.userId === selectedUserId.value && item.permissionId === permissionId),
    )
    if (allowed !== null) {
      userPermissions.value.push({ userId: selectedUserId.value, permissionId, allowed })
    }
    message.value = 'Override permission pengguna berhasil disimpan.'
  } finally {
    savingKey.value = ''
  }
}

onMounted(loadData)
</script>

<template>
  <section class="content-stack">
    <div class="section-panel">
      <div class="section-header">
        <div>
          <strong>Default permission per role</strong>
          <p class="muted">Perubahan berlaku untuk semua pengguna role tersebut yang tidak memiliki override.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><button class="sort-button" type="button" @click="roleTable.toggleSort('label')">Permission {{ roleTable.sortIndicator('label') }}</button></th>
              <th v-for="role in editableRoles" :key="role.id">{{ role.label }}</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="permission in roleTable.paginatedItems.value" :key="permission.id">
              <td>
                <strong>{{ permission.label }}</strong>
                <small class="muted permission-description">{{ permission.description }}</small>
              </td>
              <td v-for="role in editableRoles" :key="role.id">
                <input
                  type="checkbox"
                  :checked="roleAllowed(role.id, permission.id)"
                  :disabled="savingKey === `role:${role.id}:${permission.id}` || permission.code === 'rbac.manage'"
                  :aria-label="`${permission.label} untuk ${role.label}`"
                  @change="updateRole(role.id, permission.id, $event)"
                />
              </td>
              <td><button class="secondary-button" type="button" @click="detailTarget = permission">Lihat</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination v-model:page="roleTable.page.value" v-model:page-size="roleTable.pageSize.value" :total-items="permissions.length" :total-pages="roleTable.totalPages.value" />
    </div>

    <div class="section-panel">
      <div class="section-header">
        <div>
          <strong>Override permission per pengguna</strong>
          <p class="muted">Pilih Ikuti role, Izinkan, atau Tolak untuk akun tertentu.</p>
        </div>
        <span v-if="message" class="badge">{{ message }}</span>
      </div>

      <div class="field rbac-user-select">
        <label for="rbac-user">Pengguna</label>
        <select id="rbac-user" v-model="selectedUserId">
          <option v-for="profile in editableProfiles" :key="profile.uid" :value="profile.uid">
            {{ profile.displayName }} — {{ roles.find((role) => role.id === profile.roleId)?.label }}
          </option>
        </select>
      </div>

      <div v-if="selectedUser" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><button class="sort-button" type="button" @click="userTable.toggleSort('label')">Permission {{ userTable.sortIndicator('label') }}</button></th>
              <th><button class="sort-button" type="button" @click="userTable.toggleSort('module')">Modul {{ userTable.sortIndicator('module') }}</button></th>
              <th>Default role</th><th>Override</th><th>Efektif</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="permission in userTable.paginatedItems.value" :key="permission.id">
              <td>{{ permission.label }}</td>
              <td>{{ permission.module }}</td>
              <td>{{ roleAllowed(selectedUser.roleId, permission.id) ? 'Diizinkan' : 'Ditolak' }}</td>
              <td>
                <select
                  :value="userOverride(permission.id)"
                  :disabled="savingKey === `user:${selectedUser.uid}:${permission.id}` || permission.code === 'rbac.manage'"
                  @change="updateUser(permission.id, $event)"
                >
                  <option value="inherit">Ikuti role</option>
                  <option value="allow">Izinkan</option>
                  <option value="deny">Tolak</option>
                </select>
              </td>
              <td><button class="secondary-button" type="button" @click="detailTarget = permission">Lihat</button></td>
              <td>
                <span :class="['badge', { 'badge-denied': !effectiveUserAllowed(permission.id) }]">
                  {{ effectiveUserAllowed(permission.id) ? 'Diizinkan' : 'Ditolak' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination v-if="selectedUser" v-model:page="userTable.page.value" v-model:page-size="userTable.pageSize.value" :total-items="permissions.length" :total-pages="userTable.totalPages.value" />
      <p v-else class="muted">Belum ada pengguna non-Superadmin yang dapat dikonfigurasi.</p>
    </div>
    <ItemDetailModal :open="Boolean(detailTarget)" title="Detail Permission" :rows="detailRows" @close="detailTarget = null" />
  </section>
</template>

<style scoped>
.permission-description {
  display: block;
  margin-top: 0.25rem;
}

.rbac-user-select {
  max-width: 32rem;
  margin-bottom: 1rem;
}

.badge-denied {
  background: #fee2e2;
  color: #991b1b;
}
</style>
