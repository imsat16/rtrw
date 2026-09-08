import { describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { listFamilyImportIdentities } from '@/services/data'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('import identity pagination', () => {
  it('reads every page even when the server returns fewer rows than requested', async () => {
    const queries: Array<{ table: string; after: string }> = []
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      let after = ''
      const query = {
        select: () => query, order: () => query, limit: () => query,
        gt: (_column: string, value: string) => { after = value; return query },
        then: (resolve: (value: unknown) => void) => {
          queries.push({ table, after })
          const column = table === 'family_cards' ? 'kk_number' : 'nik'
          resolve({ error: null, data: after === 'b' ? [] : [{ id: after ? 'b' : 'a', [column]: after ? 'second' : 'first' }] })
        },
      }
      return query as unknown as ReturnType<typeof supabase.from>
    })
    expect(await listFamilyImportIdentities()).toEqual({ cards: [{ id: 'a', kk_number: 'first' }, { id: 'b', kk_number: 'second' }], residents: [{ id: 'a', nik: 'first' }, { id: 'b', nik: 'second' }] })
    expect(queries).toHaveLength(6)
  })
})
