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
  const raw = String(value ?? '')
  const allowed = raw.replace(/[^\d.-]/g, '')
  let digits = 0
  const chars: string[] = []

  for (const char of allowed) {
    if (/\d/.test(char)) {
      if (maxDigits > 0 && digits >= maxDigits) continue
      digits += 1
      chars.push(char)
      continue
    }

    if (char === '.' || char === '-') {
      chars.push(char)
    }
  }

  return chars.join('')
}

export function normalizeKkNumber(value: string) {
  return String(value ?? '')
    .replace(/[\s.-]+/g, '')
    .replace(/[^\d]/g, '')
}

export function stripNumericSeparators(value: string) {
  return String(value ?? '').replace(/[.-]/g, '')
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
