import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildPaarediData, createPaarediWorkbook, type PaarediOptions } from '@/services/paaredi'
import { buildReportPreview } from '@/services/reports'
import type { Resident } from '@/types/domain'

function resident(id: string, birthDate: string, extra: Partial<Resident> = {}): Resident {
  return {
    id,
    birthDate,
    fullName: `Anak ${id}`,
    gender: 'P',
    rtId: 'rt1',
    fatherName: 'Ayah',
    motherName: 'Ibu',
    address: 'Alamat',
    hasBirthCertificate: true,
    hasKia: false,
    hasKtp: false,
    ...extra,
  } as Resident
}
function options(residents: Resident[]): PaarediOptions {
  return {
    period: { year: 2026, month: 10 },
    profile: null,
    cards: [],
    mutations: [],
    residents,
    regions: [
      { id: 'rt1', type: 'rt', name: '01' },
      { id: 'rt2', type: 'rt', name: '02' },
    ],
  }
}

describe('PAAREDI export', () => {
  it('uses completed age at month end and keeps each boundary in exactly one group', () => {
    const input = options(
      [
        '2026-10-31',
        '2024-10-31',
        '2023-10-31',
        '2020-10-31',
        '2019-10-31',
        '2016-10-31',
        '2015-10-31',
        '2008-10-31',
        '2007-10-31',
        '2002-10-31',
        '2001-10-31',
        '2026-11-01',
        'invalid',
        '2026-02-30',
      ].map((date, i) => resident(String(i), date)),
    )
    const { details, summary } = buildPaarediData(input)
    expect(details).toHaveLength(10)
    expect(summary[0]?.slice(3, 8)).toEqual([2, 2, 2, 2, 2])
    expect(summary[0]?.slice(8, 11)).toEqual([10, 0, 0])
    expect(
      details.every((row) => row.slice(9, 14).filter((value) => value === 1).length === 1),
    ).toBe(true)
    expect(details[0]?.[1]).toBe('Ayah / Ibu')
    expect(details.every((row) => row[8] === '')).toBe(true)
  })

  it('scopes RTs, excludes departed residents and includes linked pregnancy records in the chosen month', () => {
    const input = options([
      resident('child', '2020-01-01'),
      resident('other', '2020-01-01', { rtId: 'rt2' }),
      resident('gone', '2020-01-01', { movedOutAt: '2026-10-15' }),
      resident('arrives', '2020-01-01', { staySince: '2026-11-01' }),
      resident('mother', '1990-01-01', { hasKtp: true }),
      resident('old-pregnancy', '1990-01-01'),
    ])
    input.rtId = 'rt1'
    input.mutations = [
      { residentId: 'mother', mutationType: 'hamil', mutationDate: '2026-10-10' },
      { residentId: 'old-pregnancy', mutationType: 'hamil', mutationDate: '2026-09-10' },
    ] as PaarediOptions['mutations']
    const { details, summary } = buildPaarediData(input)
    expect(details.map((row) => row[2])).toEqual(['Anak child', 'Anak mother'])
    expect(details[1]?.[17]).toBe('Ibu hamil')
    expect(details[1]?.slice(9, 14)).toEqual(['', '', '', '', ''])
    expect(summary).toHaveLength(1)
    expect(summary[0]?.slice(8, 11)).toEqual([2, 0, 1])
  })

  it('writes per-RT printable sheets, real dates, merged headers and formula totals without truncation', async () => {
    const input = options(
      Array.from({ length: 250 }, (_, i) => resident(String(i).padStart(3, '0'), '2020-01-01')),
    )
    const workbook = createPaarediWorkbook(input)
    const buffer = await workbook.xlsx.writeBuffer()
    const loaded = new ExcelJS.Workbook()
    await loaded.xlsx.load(buffer)
    const detail = loaded.getWorksheet('RT 01')!
    const summary = loaded.getWorksheet('Rekap RT')!
    expect(loaded.worksheets).toHaveLength(3)
    expect(detail.columnCount).toBe(18)
    expect(summary.columnCount).toBe(12)
    expect(detail.getCell('C260').value).toBe('Anak 249')
    expect(detail.getCell('D11').value).toBeInstanceOf(Date)
    expect(detail.getCell('J8').value).toBe('KELOMPOK USIA')
    expect(detail.getCell('O261').value).toEqual({ formula: 'SUM(O11:O260)', result: 250 })
    expect(summary.getCell('I11').value).toBe(250)
    expect(summary.getCell('I21').value).toEqual({ formula: 'SUM(I11:I20)', result: 250 })
    expect(detail.pageSetup.orientation).toBe('landscape')
    expect(detail.pageSetup.printTitlesRow).toBe('1:10')
    expect(detail.pageSetup.printArea).toBe('A1:R261')
    const preview = buildReportPreview({ ...input, kind: 'paaredi' })
    expect(preview.totalRows).toBe(250)
    expect(preview.columns).toHaveLength(18)
  })

  it('retains the blank template rows and zero totals when no targets exist', () => {
    const workbook = createPaarediWorkbook(options([]))
    expect(workbook.getWorksheet('RT 01')?.getCell('O38').formula).toBe('SUM(O11:O37)')
    expect(workbook.getWorksheet('RT 01')?.getCell('O38').result).toBe(0)
    expect(workbook.getWorksheet('Rekap RT')?.getCell('B12').value).toBe('RT 02')
  })

  it('separates all RTs, restarts numbering and gives preview the exact workbook sheet order', async () => {
    const input = options([
      resident('one', '2020-01-01'),
      resident('two', '2021-01-01', { rtId: 'rt2', hasKia: true }),
      resident('three', '2022-01-01', { rtId: 'rt2' }),
    ])
    const book = createPaarediWorkbook(input)
    const loaded = new ExcelJS.Workbook()
    await loaded.xlsx.load(await book.xlsx.writeBuffer())
    expect(loaded.worksheets.map((sheet) => sheet.name)).toEqual(['RT 01', 'RT 02', 'Rekap RT'])
    expect(loaded.getWorksheet('RT 01')!.getCell('C11').value).toBe('Anak one')
    expect(loaded.getWorksheet('RT 01')!.getCell('C12').value).toBeNull()
    expect(loaded.getWorksheet('RT 02')!.getCell('A11').value).toBe(1)
    expect(loaded.getWorksheet('RT 02')!.getCell('A12').value).toBe(2)
    const preview = buildReportPreview({ ...input, kind: 'paaredi' })
    expect(preview.sheets?.map((sheet) => sheet.name)).toEqual(
      loaded.worksheets.map((sheet) => sheet.name),
    )
    expect(preview.sheets?.map((sheet) => sheet.totalRows)).toEqual([1, 2, 2])
    expect(preview.sheets?.[1]?.rows.map((row) => row['2'])).toEqual(['Anak three', 'Anak two'])
    expect(preview.sheets?.[2]?.rows.map((row) => row['8'])).toEqual([1, 2])
  })

  it('exports and previews only the selected RT even with a mixed input dataset', () => {
    const input = {
      ...options([resident('one', '2020-01-01'), resident('two', '2021-01-01', { rtId: 'rt2' })]),
      rtId: 'rt2',
    }
    const book = createPaarediWorkbook(input)
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['RT 02', 'Rekap RT'])
    expect(book.getWorksheet('RT 02')!.getCell('C11').value).toBe('Anak two')
    expect(book.getWorksheet('Rekap RT')!.getCell('B11').value).toBe('RT 02')
    expect(book.getWorksheet('Rekap RT')!.getCell('B12').value).toBeNull()
    const preview = buildReportPreview({ ...input, kind: 'paaredi' })
    expect(preview.sheets?.map((sheet) => sheet.name)).toEqual(['RT 02', 'Rekap RT'])
    expect(preview.rows.map((row) => row['2'])).toEqual(['Anak two'])
  })

  it('keeps duplicate RT labels across RWs distinguishable with valid sheet names', () => {
    const input = options([])
    input.regions = [
      { id: 'rw1', type: 'rw', name: '07' },
      { id: 'rw2', type: 'rw', name: '08' },
      { id: 'rt1', type: 'rt', name: '01', rwId: 'rw1' },
      { id: 'rt2', type: 'rt', name: '01', rwId: 'rw2' },
      { id: 'rt3', type: 'rt', name: 'A/very:long*RT?label[that]exceeds31characters', rwId: 'rw1' },
    ]
    const book = createPaarediWorkbook(input)
    const names = book.worksheets.map((sheet) => sheet.name)
    expect(names).toContain('RT 01 - RW 07')
    expect(names).toContain('RT 01 - RW 08')
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length)
    expect(names.every((name) => name.length <= 31 && !/[\\/*?:\[\]]/.test(name))).toBe(true)
    expect(book.getWorksheet('RT 01 - RW 07')!.getCell('C3').value).toBe('07')
    expect(book.getWorksheet('Rekap RT')!.getCell('B11').value).toBe('RT 01 - RW 07')
    expect(book.getWorksheet('Rekap RT')!.getCell('B12').value).toBe('RT 01 - RW 08')
  })
})
