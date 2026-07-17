import { describe, expect, it } from 'vitest'
import { canManageProfileRole, matchesUserScope } from '@/services/scope'
import type { UserProfile } from '@/types/domain'

const rwProfile: UserProfile = {
  uid: 'rw',
  email: 'rw@example.test',
  displayName: 'RW',
  roleId: '00000000-0000-4000-8000-000000000002',
  role: 'ketua_rw',
  rwId: 'rw-07',
}

const rtProfile: UserProfile = {
  uid: 'rt',
  email: 'rt@example.test',
  displayName: 'RT',
  roleId: '00000000-0000-4000-8000-000000000003',
  role: 'ketua_rt',
  rwId: 'rw-07',
  rtId: 'rt-03',
}

describe('matchesUserScope', () => {
  it('allows superadmin to access all records', () => {
    expect(
      matchesUserScope(
        {
          uid: 'admin',
          email: 'admin@test',
          displayName: 'Admin',
          roleId: '00000000-0000-4000-8000-000000000001',
          role: 'superadmin',
        },
        { rwId: 'any' },
      ),
    ).toBe(true)
  })

  it('limits RW users to their RW', () => {
    expect(matchesUserScope(rwProfile, { rwId: 'rw-07' })).toBe(true)
    expect(matchesUserScope(rwProfile, { rwId: 'rw-08' })).toBe(false)
  })

  it('limits RT users to their RT', () => {
    expect(matchesUserScope(rtProfile, { rtId: 'rt-03' })).toBe(true)
    expect(matchesUserScope(rtProfile, { rtId: 'rt-04' })).toBe(false)
  })
})

describe('canManageProfileRole', () => {
  it('allows superadmin to manage any role', () => {
    expect(
      canManageProfileRole(
        {
          uid: 'admin',
          email: 'admin@test',
          displayName: 'Admin',
          roleId: '00000000-0000-4000-8000-000000000001',
          role: 'superadmin',
        },
        'ketua_rw',
      ),
    ).toBe(true)
  })

  it('limits Ketua RW to subordinate RW/RT profiles', () => {
    expect(canManageProfileRole(rwProfile, 'ketua_rt')).toBe(true)
    expect(canManageProfileRole(rwProfile, 'staff_rw')).toBe(true)
    expect(canManageProfileRole(rwProfile, 'ketua_rw')).toBe(false)
    expect(canManageProfileRole(rwProfile, 'superadmin')).toBe(false)
  })

  it('disallows RT from managing any profiles', () => {
    expect(canManageProfileRole(rtProfile, 'staff_rt')).toBe(false)
  })
})
