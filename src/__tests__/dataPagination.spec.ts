import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { listFamilyCards, listMutations, listResidents, listResidentsByFamilyCard } from '@/services/data'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockPages(count: number, cap = 1000, failAt = -1) {
  const records = Array.from({ length: count }, (_, i) => ({
    id: String(i), full_name: `Warga ${i}`, head_name: `Kepala ${i}`,
    rt_id: i < 845 ? 'rt-other' : 'rt-07', residents: [{ nik: String(i) }],
  }))
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), ilike: vi.fn().mockReturnThis(),
    range: vi.fn(async (from: number, to: number) => ({
      data: from === failAt ? null : records.slice(from, Math.min(to + 1, from + cap)),
      error: from === failAt ? { message: 'Page failed' } : null,
    })),
  }
  vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>)
  return query
}

beforeEach(() => vi.resetAllMocks())

describe('complete data for dashboard, tables and reports', () => {
  it('loads 276 RT residents even when only 155 occur within the first 1000 records', async () => {
    const query = mockPages(1121)
    const data = await listResidents(null)
    expect(data).toHaveLength(1121)
    expect(data.filter(row => row.rtId === 'rt-07')).toHaveLength(276)
    expect(query.range).toHaveBeenLastCalledWith(1121, 1620)
    expect(query.order).toHaveBeenCalledWith('id')
  })

  it('keeps scope and search filters while reading subsequent pages', async () => {
    const query = mockPages(1001)
    await listResidents(null, 'rt-07', 'rw-07', 'Nama')
    expect(query.eq).toHaveBeenCalledWith('rt_id', 'rt-07')
    expect(query.eq).toHaveBeenCalledWith('rw_id', 'rw-07')
    expect(query.or).toHaveBeenCalledWith('nik.ilike.%Nama%,full_name.ilike.%Nama%,kk_number.ilike.%Nama%')
    expect(query.range.mock.calls.map(call => call[0])).toEqual([0, 500, 1000, 1001])
  })

  it('continues after smaller server pages rather than treating them as the last page', async () => {
    const query = mockPages(251, 100)
    expect(await listResidents(null)).toHaveLength(251)
    expect(query.range.mock.calls.map(call => call[0])).toEqual([0, 100, 200, 251])
  })

  it.each([
    ['family cards', () => listFamilyCards(null)],
    ['family members', () => listResidentsByFamilyCard('card')],
    ['mutations', () => listMutations(null)],
  ])('also loads all %s', async (_label, read) => {
    mockPages(1200)
    expect(await read()).toHaveLength(1200)
  })

  it('reports a failed later page instead of returning misleading partial statistics', async () => {
    mockPages(1200, 1000, 500)
    await expect(listResidents(null)).rejects.toThrow('Page failed')
  })

  it('returns an empty list for an empty response', async () => {
    mockPages(0)
    expect(await listResidents(null)).toEqual([])
  })
})
