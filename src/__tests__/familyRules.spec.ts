import { describe, expect, it } from 'vitest'
import { buildFamilyGroups } from '@/services/familyImport'
import {
  applyFamilyParentAutoFill,
  normalizeFreeTextId,
  normalizeKkNumber,
  stripNumericSeparators,
} from '@/utils/familyRules'

describe('family rules', () => {
  it('keeps free-text identifiers while trimming whitespace and preserving separators', () => {
    expect(normalizeKkNumber(' 1234.5678-9012/3456 ')).toBe('1234.5678-9012/3456')
    expect(normalizeFreeTextId(' 3321.4403-4455.6612 ')).toBe('3321.4403-4455.6612')
    expect(stripNumericSeparators(normalizeFreeTextId(' 3321.4403-4455.6612 '))).toBe(
      '3321440344556612',
    )
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

  it('accepts region labels regardless of case when building family groups', () => {
    const regions = [
      { id: 'p1', type: 'province', name: 'Jawa Barat', provinceId: undefined },
      { id: 'c1', type: 'city', name: 'Bandung', parentId: 'p1', provinceId: 'p1' },
      { id: 'd1', type: 'district', name: 'Bandung Kulon', parentId: 'c1', provinceId: 'p1', cityId: 'c1' },
      { id: 'v1', type: 'village', name: 'Desa Suka', parentId: 'd1', provinceId: 'p1', cityId: 'c1', districtId: 'd1' },
      { id: 'rw1', type: 'rw', name: 'RW 01', parentId: 'v1', provinceId: 'p1', cityId: 'c1', districtId: 'd1', villageId: 'v1' },
      { id: 'rt1', type: 'rt', name: 'RT 01', parentId: 'rw1', provinceId: 'p1', cityId: 'c1', districtId: 'd1', villageId: 'v1', rwId: 'rw1' },
    ] as const

    const result = buildFamilyGroups([
      {
        row: 2,
        kkNumber: '1234567890123456',
        address: 'Jl. Contoh No. 1',
        registeredAt: '2024-01-01',
        rwLabel: 'rw 01 — desa suka',
        rtLabel: 'rt 01 — rw 01',
        nik: '3201010101010001',
        fullName: 'Budi',
        gender: 'l',
        birthPlace: 'Bandung',
        birthDate: '1990-01-01',
        religion: 'Islam',
        education: 'SMA',
        occupation: 'Wiraswasta',
        maritalStatus: 'Kawin',
        familyRelationship: 'kepala keluarga',
        citizenship: 'wni',
        fatherName: '',
        motherName: '',
        staySince: '2020-01-01',
        residentStatus: 'tetap',
      },
      {
        row: 3,
        kkNumber: '1234567890123456',
        address: 'Jl. Contoh No. 1',
        registeredAt: '2024-01-01',
        rwLabel: 'rw 01 — desa suka',
        rtLabel: 'rt 01 — rw 01',
        nik: '3201010101010002',
        fullName: 'Sari',
        gender: 'p',
        birthPlace: 'Bandung',
        birthDate: '1992-01-01',
        religion: 'Islam',
        education: 'SMA',
        occupation: 'Ibu Rumah Tangga',
        maritalStatus: 'Kawin',
        familyRelationship: 'istri',
        citizenship: 'wni',
        fatherName: '',
        motherName: '',
        staySince: '2020-01-01',
        residentStatus: 'tetap',
      },
    ], [...regions])

    expect(result.errors).toHaveLength(0)
    expect(result.groups).toHaveLength(1)
  })
})
