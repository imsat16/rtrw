import { describe, expect, it } from 'vitest'
import {
  applyFamilyParentAutoFill,
  normalizeKkNumber,
  normalizeNumericId,
  stripNumericSeparators,
} from '@/utils/familyRules'

describe('family rules', () => {
  it('normalizes KK and NIK numbers with punctuation and spaces', () => {
    expect(normalizeKkNumber(' 1234.5678-9012/3456 ')).toBe('1234567890123456')
    expect(normalizeNumericId(' 3321.4403-4455.6612 ')).toBe('3321.4403-4455.6612')
    expect(stripNumericSeparators(normalizeNumericId(' 3321.4403-4455.6612 '))).toBe('3321440344556612')
    expect(normalizeKkNumber('1234567890123456')).toBe('1234567890123456')
  })

  it('auto-fills parent names when a child belongs to the same family card', () => {
    const members = [
      { fullName: 'Budi', gender: 'L', familyRelationship: 'Ayah', fatherName: '', motherName: '' },
      { fullName: 'Sari', gender: 'P', familyRelationship: 'Ibu', fatherName: '', motherName: '' },
      { fullName: 'Rina', gender: 'P', familyRelationship: 'Anak', fatherName: '', motherName: '' },
    ]

    const child = applyFamilyParentAutoFill(members[2]!, members)
    expect(child.fatherName).toBe('Budi')
    expect(child.motherName).toBe('Sari')
  })
})
