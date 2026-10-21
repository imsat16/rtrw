import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { parseFamilyImportWorkbook } from '@/services/familyImport'
import { readableText, requireReadableText } from '@/utils/readableText'

function workbook(value: ExcelJS.CellValue) {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('Data KK & Warga')
  sheet.addRow(['Nomor KK'])
  sheet.addRow(['3273000000000001', 'Alamat', '', '07', '04', '3273000000000002', value])
  return book
}

describe('Excel structured cell values', () => {
  it.each([
    [{ text: 'Ratna Saribanon', hyperlink: 'https://example.com' }, 'Ratna Saribanon'],
    [{ richText: [{ text: 'Ratna ' }, { text: 'Saribanon' }] }, 'Ratna Saribanon'],
    [{ formula: 'A1', result: 'Ratna Saribanon' }, 'Ratna Saribanon'],
  ] as Array<[ExcelJS.CellValue, string]>)('imports the visible text of %j', (value, expected) => {
    const parsed = parseFamilyImportWorkbook(workbook(value))
    expect(parsed.parseErrors).toEqual([])
    expect(parsed.rows[0]?.fullName).toBe(expected)
  })

  it('accepts empty optional cells and formulas returning an empty string', () => {
    const book = workbook('Nama Valid')
    const sheet = book.getWorksheet('Data KK & Warga')!
    sheet.getCell('Q2').value = '   '
    sheet.getCell('R2').value = { formula: 'IF(A1=1,"Nama","")', result: '' }
    const parsed = parseFamilyImportWorkbook(book)
    expect(parsed.parseErrors).toEqual([])
    expect(parsed.rows[0]?.fatherName).toBe('')
    expect(parsed.rows[0]?.motherName).toBe('')
  })

  it('rejects corrupt literal text and Excel errors with a row number', () => {
    for (const value of ['[object Object]', { error: '#VALUE!' }] as ExcelJS.CellValue[]) {
      const parsed = parseFamilyImportWorkbook(workbook(value))
      expect(parsed.rows).toEqual([])
      expect(parsed.parseErrors[0]?.row).toBe(2)
      expect(parsed.parseErrors[0]?.message).toContain('tidak valid')
    }
  })

  it('does not invent names from corrupt persisted data or stringify unknown objects', () => {
    expect(readableText('[object Object]')).toBe('')
    expect(readableText({ unknown: 'value' })).toBe('')
    expect(() => requireReadableText('[object Object]', 'Nama')).toThrow('sumber asli')
    expect(() => requireReadableText({ invalid: 'name' }, 'Nama')).toThrow()
  })
})
