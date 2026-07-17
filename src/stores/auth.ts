import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getProfile, listPermissions, listRolePermissions, listUserPermissions } from '@/services/data'
import { roleLabel } from '@/services/scope'
import type { PermissionCode, UserProfile } from '@/types/domain'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const permissions = ref<PermissionCode[]>([])
  const loading = ref(true)
  const initialized = ref(false)
  let initializationPromise: Promise<void> | null = null
  let authListenerRegistered = false
  let profileLoadPromise = Promise.resolve()

  const isAuthenticated = computed(() => Boolean(currentUser.value && profile.value))
  const roleLabelText = computed(() => roleLabel(profile.value?.role))
  const hasPermission = (permission: PermissionCode) =>
    profile.value?.role === 'superadmin' || permissions.value.includes(permission)
  const canManageRegions = computed(() => hasPermission('regions.manage'))
  const canManageUsers = computed(() => hasPermission('users.manage'))
  const canManageRbac = computed(() => hasPermission('rbac.manage'))

  async function loadProfile(user: User | null) {
    currentUser.value = user
    if (!user) {
      profile.value = null
      permissions.value = []
      return
    }

    try {
      profile.value = await getProfile(user.id)
      const [permissionMaster, rolePermissions, userPermissions] = await Promise.all([
        listPermissions(),
        listRolePermissions(),
        listUserPermissions(user.id),
      ])
      const roleDefaults = new Map(
        rolePermissions
          .filter((item) => item.roleId === profile.value?.roleId)
          .map((item) => [item.permissionId, item.allowed]),
      )
      userPermissions.forEach((item) => roleDefaults.set(item.permissionId, item.allowed))
      const permissionCodeById = new Map(permissionMaster.map((item) => [item.id, item.code]))
      permissions.value = [...roleDefaults.entries()]
        .filter(([, allowed]) => allowed)
        .map(([permissionId]) => permissionCodeById.get(permissionId))
        .filter((permission): permission is PermissionCode => Boolean(permission))
    } catch {
      profile.value = {
        uid: user.id,
        email: user.email ?? '',
        displayName: user.email ?? 'Petugas',
        roleId: '',
        role: 'ketua_rt',
      }
      permissions.value = []
    }
  }

  function queueProfileLoad(user: User | null) {
    profileLoadPromise = profileLoadPromise.then(() => loadProfile(user))
    return profileLoadPromise
  }

  function initialize() {
    if (initializationPromise) return initializationPromise
    loading.value = true

    if (!authListenerRegistered) {
      authListenerRegistered = true
      supabase.auth.onAuthStateChange((event, session) => {
        // Sesi awal dipulihkan oleh getSession di bawah agar route guard selalu
        // menunggu profile selesai dimuat sebelum memutuskan redirect.
        if (event === 'INITIAL_SESSION') return
        void queueProfileLoad(session?.user ?? null)
      })
    }

    initializationPromise = supabase.auth.getSession()
      .then(async ({ data, error }) => {
        if (error) throw error
        await queueProfileLoad(data.session?.user ?? null)
        initialized.value = true
      })
      .finally(() => {
        loading.value = false
      })

    return initializationPromise
  }

  async function login(email: string, password: string) {
    loading.value = true

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      await queueProfileLoad(data.user)
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    currentUser.value = null
    profile.value = null
    permissions.value = []
  }

  return {
    currentUser,
    profile,
    permissions,
    loading,
    isAuthenticated,
    roleLabel: roleLabelText,
    canManageRegions,
    canManageUsers,
    canManageRbac,
    hasPermission,
    initialize,
    login,
    logout,
  }
})
