import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { listFamilyCards, listMutations, listResidents, listResidentsByFamilyCard, listResidentsPage, listFamilyCardsPage } from '@/services/data'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn<typeof supabase.from>() } }))

function mockPages(count: number, cap = 1000, failAt = -1) {
  const records = Array.from({ length: count }, (_, i) => ({
    id: String(i), full_name: `Warga ${i}`, head_name: `Kepala ${i}`,
    rt_id: i < 845 ? 'rt-other' : 'rt-07', residents: [{ nik: String(i) }],
  }))
  const query = {
    select: vi.fn<(...args: unknown[]) => unknown>().mockReturnThis(), eq: vi.fn<(...args: unknown[]) => unknown>().mockReturnThis(),
    order: vi.fn<(...args: unknown[]) => unknown>().mockReturnThis(), or: vi.fn<(...args: unknown[]) => unknown>().mockReturnThis(), ilike: vi.fn<(...args: unknown[]) => unknown>().mockReturnThis(),
    range: vi.fn<(from: number, to: number) => Promise<{ data: typeof records | null; error: { message: string } | null; count: number }>>(async (from: number, to: number) => ({
      data: from === failAt ? null : records.slice(from, Math.min(to + 1, from + cap)),
      count,
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

describe('endpoint pagination for list views', () => {
  it('recovers the total when PostgREST returns 416 for a page emptied by deletion', async () => {
    const query = mockPages(25)
    query.range.mockImplementationOnce(async () => ({
      data: null, count: 0, status: 416, error: { message: 'Requested range not satisfiable' },
    }))
    const result = await listResidentsPage(null, { page: 4, pageSize: 10, sortKey: 'fullName', sortDirection: 'asc' })
    expect(query.range.mock.calls).toEqual([[30, 39], [0, 9]])
    expect(result.total).toBe(25)
  })

  it.each([10, 25, 50])('only reads page 2 at limit %i with an exact total', async (pageSize) => {
    const query = mockPages(125)
    const result = await listResidentsPage(null, {
      page: 2,
      pageSize,
      sortKey: 'fullName',
      sortDirection: 'asc',
    })
    expect(query.range).toHaveBeenCalledExactlyOnceWith(pageSize, pageSize * 2 - 1)
    expect(query.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(result.items).toHaveLength(pageSize)
    expect(result.total).toBe(125)
    expect(query.order).toHaveBeenCalledWith('full_name', { ascending: true })
    expect(query.order).toHaveBeenCalledWith('id')
  })

  it('keeps server scope separate from optional filters and sanitizes search', async () => {
    const query = mockPages(100)
    const profile = { uid: 'user', role: 'staff_rt', rtId: 'assigned-rt' } as Parameters<
      typeof listResidentsPage
    >[0]
    await listResidentsPage(profile, {
      page: 1,
      pageSize: 1,
      sortKey: 'nik',
      sortDirection: 'desc',
      search: 'Nama,(x)%',
      rwId: 'rw-07',
    })
    expect(query.eq).toHaveBeenCalledWith('rt_id', 'assigned-rt')
    expect(query.eq).toHaveBeenCalledWith('rw_id', 'rw-07')
    expect(query.or).toHaveBeenCalledWith(
      'nik.ilike.%Nama x%,full_name.ilike.%Nama x%,kk_number.ilike.%Nama x%',
    )
    expect(query.range).toHaveBeenCalledExactlyOnceWith(0, 9)
    expect(query.order).toHaveBeenCalledWith('nik', { ascending: false })
  })

  it('searches family number and head name while fetching only one page', async () => {
    const query = mockPages(100)
    const result = await listFamilyCardsPage(null, {
      page: 3,
      pageSize: 10,
      sortKey: 'headName',
      sortDirection: 'asc',
      search: 'Ratna',
    })
    expect(query.range).toHaveBeenCalledExactlyOnceWith(20, 29)
    expect(query.or).toHaveBeenCalledWith('kk_number.ilike.%Ratna%,head_name.ilike.%Ratna%')
    expect(result.items).toHaveLength(10)
    expect(result.total).toBe(100)
  })
})
