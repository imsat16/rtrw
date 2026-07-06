import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/data'
import { roleLabel } from '@/services/scope'
import type { UserProfile } from '@/types/domain'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const loading = ref(true)
  const initialized = ref(false)

  const isAuthenticated = computed(() => Boolean(currentUser.value && profile.value))
  const roleLabelText = computed(() => roleLabel(profile.value?.role))
  const canManageRegions = computed(() => profile.value?.role === 'superadmin' || profile.value?.role === 'rw')

  async function loadProfile(user: User | null) {
    currentUser.value = user
    if (!user) {
      profile.value = null
      return
    }

    try {
      profile.value = await getProfile(user.id)
    } catch {
      profile.value = {
        uid: user.id,
        email: user.email ?? '',
        displayName: user.email ?? 'Petugas',
        role: 'rt',
      }
    }
  }

  function initialize() {
    if (initialized.value) return Promise.resolve()
    initialized.value = true
    loading.value = true

    return new Promise<void>((resolve) => {
      void supabase.auth.getSession().then(({ data }) => {
        void loadProfile(data.session?.user ?? null).finally(() => {
          loading.value = false
          resolve()
        })
      })

      supabase.auth.onAuthStateChange((_event, session) => {
        void loadProfile(session?.user ?? null)
      })
    })
  }

  async function login(email: string, password: string) {
    loading.value = true
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await loadProfile(data.user)
    loading.value = false
  }

  async function logout() {
    await supabase.auth.signOut()
    currentUser.value = null
    profile.value = null
  }

  return {
    currentUser,
    profile,
    loading,
    isAuthenticated,
    roleLabel: roleLabelText,
    canManageRegions,
    initialize,
    login,
    logout,
  }
})
