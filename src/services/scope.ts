import type { FamilyCard, Region, Resident, ResidentMutation, UserProfile } from '@/types/domain'

type ScopedRecord = Partial<Region & FamilyCard & Resident & ResidentMutation>

export function matchesUserScope(profile: UserProfile | null, record: ScopedRecord): boolean {
  if (!profile) return false
  if (profile.role === 'superadmin') return true
  if (profile.role === 'rw') return Boolean(profile.rwId && record.rwId === profile.rwId)
  return Boolean(profile.rtId && record.rtId === profile.rtId)
}

export function createScopePayload(profile: UserProfile | null): Partial<ScopedRecord> {
  if (!profile) return {}
  return {
    provinceId: profile.provinceId,
    cityId: profile.cityId,
    districtId: profile.districtId,
    villageId: profile.villageId,
    rwId: profile.rwId,
    rtId: profile.rtId,
  }
}

export function roleLabel(role?: string): string {
  if (role === 'superadmin') return 'Superadmin'
  if (role === 'rw') return 'Ketua RW'
  if (role === 'rt') return 'Ketua RT'
  return 'Petugas'
}

export function canManageRegionType(profile: UserProfile | null, type: string): boolean {
  if (!profile) return false
  if (profile.role === 'superadmin') return true
  return profile.role === 'rw' && type === 'rt'
}
