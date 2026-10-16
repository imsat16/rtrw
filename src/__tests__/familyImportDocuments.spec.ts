import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildFamilyGroups, buildFamilyImportTemplateWorkbook, parseFamilyImportWorkbook } from '@/services/familyImport'
import type { Region } from '@/types/domain'

const regions: Region[] = [
  { id: 'rw', type: 'rw', name: '01' },
  { id: 'rt', type: 'rt', name: '02', parentId: 'rw', rwId: 'rw' },
]

function template(documents: Record<string, unknown> = {}) {
  const workbook = buildFamilyImportTemplateWorkbook(regions, ['Kepala Keluarga', 'Anak'])
  workbook.getWorksheet('Data KK & Warga')!.getRow(2).values = {
    kkNumber: 'KK-123', address: 'Alamat', rwLabel: '01', rtLabel: '02 — 01', nik: 'NIK-123',
    fullName: 'Nama', gender: 'L', birthPlace: 'Bandung', birthDate: '1990-01-01', religion: 'Islam',
    maritalStatus: 'Kawin', familyRelationship: 'Kepala Keluarga', ...documents,
  }
  return workbook
}

describe('family import document ownership', () => {
  it('appends document columns, dropdown sources and instructions to the downloadable workbook', async () => {
    const workbook = buildFamilyImportTemplateWorkbook(regions, ['Kepala Keluarga'])
    const saved = new ExcelJS.Workbook()
    await saved.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = saved.getWorksheet('Data KK & Warga')!
    expect(['U1', 'V1', 'W1'].map(cell => sheet.getCell(cell).value)).toEqual(['Akte (Ya/Tidak)', 'KIA (Ya/Tidak)', 'KTP (Ya/Tidak)'])
    for (const cell of ['U2', 'V2', 'W2', 'U500', 'V500', 'W500']) {
      expect(sheet.getCell(cell).dataValidation.formulae).toEqual(["'Master Data'!$H$2:$H$3"])
    }
    expect(saved.getWorksheet('Master Data')!.getCell('H2').value).toBe('Ya')
    expect(saved.getWorksheet('Master Data')!.getCell('H3').value).toBe('Tidak')
    expect(saved.getWorksheet('Petunjuk')!.getCell('A16').value).toContain('Template lama')
  })

  it.each([
    ['Ya', 'Tidak', 'YA'], [true, false, true], [1, 0, 1], [' true ', 'FALSE', '1'],
  ])('parses document values %s/%s/%s into boolean resident payloads', async (akte, kia, ktp) => {
    const workbook = template({ hasBirthCertificate: akte, hasKia: kia, hasKtp: ktp })
    const saved = new ExcelJS.Workbook()
    await saved.xlsx.load(await workbook.xlsx.writeBuffer())
    const parsed = parseFamilyImportWorkbook(saved)
    expect(parsed.parseErrors).toEqual([])
    const result = buildFamilyGroups(parsed.rows, regions)
    expect(result.errors).toEqual([])
    expect(result.groups[0]?.head).toMatchObject({ hasBirthCertificate: true, hasKia: false, hasKtp: true })
  })

  it('leaves blank or legacy columns undefined so existing document values are preserved', () => {
    const workbook = template()
    workbook.getWorksheet('Data KK & Warga')!.spliceColumns(21, 3)
    const { rows } = parseFamilyImportWorkbook(workbook)
    const result = buildFamilyGroups(rows, regions)
    expect(result.errors).toEqual([])
    expect(result.groups[0]?.head.hasBirthCertificate).toBeUndefined()
    expect(result.groups[0]?.head.hasKia).toBeUndefined()
    expect(result.groups[0]?.head.hasKtp).toBeUndefined()
  })

  it('reports the row and field for invalid values and skips the family', () => {
    const { rows } = parseFamilyImportWorkbook(template({ hasKia: 'mungkin' }))
    const result = buildFamilyGroups(rows, regions)
    expect(result.groups).toEqual([])
    expect(result.errors).toEqual([{ row: 2, message: 'KIA harus Ya/Tidak, TRUE/FALSE, atau 1/0.' }])
  })
})
