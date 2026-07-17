import { describe, expect, it } from 'vitest'
import { canManageProfileRole, matchesUserScope } from '@/services/scope'
import type { UserProfile } from '@/types/domain'

const rwProfile: UserProfile = {
  uid: 'rw',
  email: 'rw@example.test',
  displayName: 'RW',
  role: 'rw',
  rwId: 'rw-07',
}

const rtProfile: UserProfile = {
  uid: 'rt',
  email: 'rt@example.test',
  displayName: 'RT',
  role: 'rt',
  rwId: 'rw-07',
  rtId: 'rt-03',
}

describe('matchesUserScope', () => {
  it('allows superadmin to access all records', () => {
    expect(
      matchesUserScope(
        { uid: 'admin', email: 'admin@test', displayName: 'Admin', role: 'superadmin' },
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
      canManageProfileRole({ uid: 'admin', email: 'admin@test', displayName: 'Admin', role: 'superadmin' }, 'rw'),
    ).toBe(true)
  })

  it('limits RW to managing rt profiles only', () => {
    expect(canManageProfileRole(rwProfile, 'rt')).toBe(true)
    expect(canManageProfileRole(rwProfile, 'rw')).toBe(false)
    expect(canManageProfileRole(rwProfile, 'superadmin')).toBe(false)
  })

  it('disallows RT from managing any profiles', () => {
    expect(canManageProfileRole(rtProfile, 'rt')).toBe(false)
  })
})
