import { expect, it, vi } from 'vitest'
import { ensureFamilyRelationship } from '@/services/data'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

it('creates a new relationship with an order within the database smallint range', async () => {
  const insert = vi.fn().mockResolvedValue({ error: null })
  const query = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert,
  }
  vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>)
  await expect(ensureFamilyRelationship('Orang Tua')).resolves.toBe('Orang Tua')
  expect(insert).toHaveBeenCalledWith({ label: 'Orang Tua', sort_order: 0 })
})
