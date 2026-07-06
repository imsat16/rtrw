import { describe, expect, it } from 'vitest'
import { calculateStats, countMutationsByType, formatPeriod } from '@/services/reports'
import type { Resident, ResidentMutation } from '@/types/domain'

const residents = [
  { id: '1', gender: 'L', residentStatus: 'tetap' },
  { id: '2', gender: 'P', residentStatus: 'sementara' },
] as Resident[]

const mutations = [
  { id: '1', gender: 'L', mutationType: 'lahir' },
  { id: '2', gender: 'P', mutationType: 'lahir' },
  { id: '3', gender: 'L', mutationType: 'pindah' },
] as ResidentMutation[]

describe('report helpers', () => {
  it('calculates dashboard counters', () => {
    expect(calculateStats([{ id: 'kk' }] as never, residents, mutations)).toMatchObject({
      familyCards: 1,
      residents: 2,
      male: 1,
      female: 1,
      permanent: 1,
      temporary: 1,
      lahir: 2,
      pindah: 1,
    })
  })

  it('groups mutations by type and gender', () => {
    expect(countMutationsByType(mutations, 'lahir')).toEqual({ male: 1, female: 1, total: 2 })
  })

  it('formats Indonesian reporting period', () => {
    expect(formatPeriod({ month: 3, year: 2025 })).toBe('MARET TAHUN 2025')
  })
})
