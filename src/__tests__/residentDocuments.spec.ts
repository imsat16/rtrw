import { beforeEach, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { listResidents, saveResident } from '@/services/data'
import type { Resident } from '@/types/domain'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

it('reads document ownership and defaults legacy records to false', async () => {
  const query = {
    select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValueOnce({ data: [
      { id: '1', has_birth_certificate: true, has_kia: false, has_ktp: true },
      { id: '2' },
    ], error: null }).mockResolvedValue({ data: [], error: null }),
  }
  vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>)
  const records = await listResidents(null)
  expect(records[0]).toMatchObject({ hasBirthCertificate: true, hasKia: false, hasKtp: true })
  expect(records[1]).toMatchObject({ hasBirthCertificate: false, hasKia: false, hasKtp: false })
})

it('persists explicit false when document ownership is unchecked', async () => {
  const query = {
    update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
  }
  vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>)
  await saveResident({ kkNumber: '123', nik: '456', hasBirthCertificate: false, hasKia: true, hasKtp: false } as Omit<Resident, 'id'>, '1')
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
    has_birth_certificate: false, has_kia: true, has_ktp: false,
  }))
})
