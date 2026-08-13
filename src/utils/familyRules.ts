export const FAMILY_RELATIONSHIP_OPTIONS = [
  'Kepala Keluarga',
  'Suami',
  'Istri',
  'Ayah',
  'Ibu',
  'Anak',
  'Mertua',
  'Cucu',
  'Lainnya',
]

export function normalizeNumericId(value: string, maxDigits = 16) {
  const digits = String(value ?? '')
    .replace(/[\s.-]+/g, '')
    .replace(/[^\d]/g, '')
  return maxDigits > 0 ? digits.slice(0, maxDigits) : digits
}

export function normalizeKkNumber(value: string) {
  return normalizeNumericId(value, 16)
}

export function isChildRelationship(value?: string) {
  return ['anak', 'anak kandung', 'anak angkat'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  )
}

export function applyFamilyParentAutoFill<
  T extends {
    fatherName?: string
    motherName?: string
    familyRelationship?: string
    fullName?: string
    gender?: string
  },
>(member: T, members: T[] = []): T {
  if (!isChildRelationship(member.familyRelationship)) return member

  const father = members.find((candidate) => {
    const relationship = String(candidate.familyRelationship ?? '')
      .trim()
      .toLowerCase()
    return (
      ['ayah', 'kepala keluarga', 'suami'].includes(relationship) &&
      (candidate.gender ?? '').toUpperCase() === 'L'
    )
  })
  const mother = members.find((candidate) => {
    const relationship = String(candidate.familyRelationship ?? '')
      .trim()
      .toLowerCase()
    return ['ibu', 'istri'].includes(relationship) && (candidate.gender ?? '').toUpperCase() === 'P'
  })

  return {
    ...member,
    fatherName: member.fatherName || father?.fullName || '',
    motherName: member.motherName || mother?.fullName || '',
  }
}
