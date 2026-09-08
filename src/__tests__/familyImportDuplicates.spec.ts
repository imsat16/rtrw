import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runFamilyImport } from '@/services/familyImport'
import type { FamilyGroupInput } from '@/services/familyImport'
import { deleteFamilyCard, ensureFamilyRelationship, listFamilyImportIdentities, saveFamilyCard, saveResident, updateFamilyCard } from '@/services/data'
import { familyImportIdentityKey } from '@/utils/familyRules'

vi.mock('@/services/data', () => ({
  deleteFamilyCard: vi.fn(), ensureFamilyRelationship: vi.fn(),
  listFamilyImportIdentities: vi.fn(), saveFamilyCard: vi.fn(), saveResident: vi.fn(), updateFamilyCard: vi.fn(),
}))

function family(kk = '3273000000000001', nik = '3273000000000011'): FamilyGroupInput {
  const head = { kkNumber: kk, nik, fullName: 'Dummy', gender: 'L' as const, birthPlace: 'Bandung', birthDate: '1990-01-01', religion: 'Islam', education: '', occupation: '', maritalStatus: 'Kawin', familyRelationship: 'Kepala Keluarga', citizenship: 'WNI' as const, fatherName: '', motherName: '', address: 'Dummy', residentStatus: 'tetap' as const }
  return { kkNumber: kk, headRow: 2, card: { kkNumber: kk, headName: 'Dummy', address: 'Dummy' }, head, members: [{ ...head, nik: `${nik}-2`, familyRelationship: 'Anak' }] }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listFamilyImportIdentities).mockResolvedValue({ cards: [], residents: [] })
  vi.mocked(saveFamilyCard).mockResolvedValue('new-card')
})

describe('duplicate prevention during import', () => {
  it('compares numeric formatting consistently without conflating free-text separators', () => {
    expect(familyImportIdentityKey(' 3273.00-00 / 01 ')).toBe('3273000001')
    expect(familyImportIdentityKey(' kk-01 ')).toBe('KK-01')
    expect(familyImportIdentityKey('KK01')).not.toBe(familyImportIdentityKey('KK-01'))
  })

  it('updates matching KK and NIK by ID and adds only new members', async () => {
    vi.mocked(listFamilyImportIdentities).mockResolvedValue({ cards: [{ id: 'old-card', kk_number: '3273.0000.0000.0001' }], residents: [{ id: 'old-head', kk_number: '3273.0000.0000.0001', nik: '3273000000000011', family_card_id: 'old-card', family_relationship: 'Kepala Keluarga' }] })
    vi.mocked(updateFamilyCard).mockResolvedValue('old-card')
    const input = family()
    input.head.fullName = 'Nama Diperbarui'
    input.head.gender = 'P'
    const result = await runFamilyImport([input])
    expect(result.successFamilies).toBe(1)
    expect(updateFamilyCard).toHaveBeenCalledWith(expect.objectContaining({ kkNumber: '3273.0000.0000.0001' }), 'old-card')
    expect(saveFamilyCard).not.toHaveBeenCalled()
    expect(saveResident).toHaveBeenNthCalledWith(1, expect.objectContaining({ fullName: 'Nama Diperbarui', gender: 'P', familyCardId: 'old-card' }), 'old-head')
    expect(saveResident).toHaveBeenNthCalledWith(2, expect.objectContaining({ familyCardId: 'old-card' }), undefined)
    expect(deleteFamilyCard).not.toHaveBeenCalled()
  })

  it('skips the entire family if a member NIK exists under another KK', async () => {
    const input = family()
    vi.mocked(listFamilyImportIdentities).mockResolvedValue({ cards: [], residents: [{ id: 'other-member', kk_number: 'other-kk', family_card_id: 'other-card', nik: input.members[0]!.nik.replace(/-/g, ' ') }] })
    const result = await runFamilyImport([input])
    expect(result.errors[0]?.message).toContain('NIK')
    expect(saveFamilyCard).not.toHaveBeenCalled()
  })

  it('imports new families while skipping repeats and keeps progress accurate', async () => {
    const progress = vi.fn()
    const result = await runFamilyImport([family(), family(), family('NEW-KK', 'NEW-NIK')], progress)
    expect(result.successFamilies).toBe(2)
    expect(result.failedFamilies).toBe(1)
    expect(saveFamilyCard).toHaveBeenCalledTimes(2)
    expect(progress).toHaveBeenLastCalledWith(3, 3)
  })

  it('detects a NIK reused across new families in the same run', async () => {
    const result = await runFamilyImport([family('KK-A'), family('KK-B')])
    expect(result.successFamilies).toBe(1)
    expect(result.failedFamilies).toBe(1)
    expect(saveFamilyCard).toHaveBeenCalledTimes(1)
  })

  it('does not start writing when identifier lookup fails', async () => {
    vi.mocked(listFamilyImportIdentities).mockRejectedValue(new Error('Tidak dapat memeriksa data lama'))
    await expect(runFamilyImport([family()])).rejects.toThrow('Tidak dapat memeriksa data lama')
    expect(saveFamilyCard).not.toHaveBeenCalled()
  })

  it('preserves existing data if the database rejects a concurrent duplicate', async () => {
    vi.mocked(saveFamilyCard).mockRejectedValue(new Error('duplicate key value violates unique constraint'))
    const result = await runFamilyImport([family()])
    expect(result.failedFamilies).toBe(1)
    expect(saveResident).not.toHaveBeenCalled()
    expect(deleteFamilyCard).not.toHaveBeenCalled()
  })

  it('rolls back only the newly created KK if a member insert fails', async () => {
    vi.mocked(saveResident).mockResolvedValueOnce('head').mockRejectedValueOnce(new Error('NIK sudah ada'))
    const result = await runFamilyImport([family()])
    expect(result.successFamilies).toBe(0)
    expect(deleteFamilyCard).toHaveBeenCalledExactlyOnceWith('new-card')
  })
  it('keeps omitted members and does not delete an existing KK on an update failure', async () => {
    vi.mocked(listFamilyImportIdentities).mockResolvedValue({ cards: [{ id: 'old-card', kk_number: family().kkNumber }], residents: [
      { id: 'old-head', kk_number: family().kkNumber, nik: family().head.nik, family_card_id: 'old-card', family_relationship: 'Kepala Keluarga' },
      { id: 'omitted', kk_number: family().kkNumber, nik: 'omitted-nik', family_card_id: 'old-card', family_relationship: 'Anak' },
    ] })
    vi.mocked(updateFamilyCard).mockResolvedValue('old-card')
    vi.mocked(saveResident).mockRejectedValue(new Error('Network error'))
    const result = await runFamilyImport([family()])
    expect(result.failedFamilies).toBe(1)
    expect(result.errors[0]?.message).toContain('Sebagian perubahan mungkin sudah tersimpan')
    expect(deleteFamilyCard).not.toHaveBeenCalled()
    expect(saveResident).not.toHaveBeenCalledWith(expect.anything(), 'omitted')
  })

  it('rejects a replacement head when the old head is omitted', async () => {
    vi.mocked(listFamilyImportIdentities).mockResolvedValue({ cards: [{ id: 'old-card', kk_number: family().kkNumber }], residents: [
      { id: 'old-head', kk_number: family().kkNumber, nik: 'old-nik', family_card_id: 'old-card', family_relationship: 'Kepala Keluarga' },
    ] })
    const result = await runFamilyImport([family()])
    expect(result.errors[0]?.message).toContain('Kepala keluarga lama tidak ada')
    expect(updateFamilyCard).not.toHaveBeenCalled()
    expect(saveResident).not.toHaveBeenCalled()
  })

})
