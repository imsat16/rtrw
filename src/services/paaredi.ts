import ExcelJS from 'exceljs'
import type {
  FamilyCard,
  Region,
  ReportPeriod,
  Resident,
  ResidentMutation,
  UserProfile,
} from '@/types/domain'

export interface PaarediOptions {
  period: ReportPeriod
  regions: Region[]
  profile: UserProfile | null
  cards: FamilyCard[]
  residents: Resident[]
  mutations: ResidentMutation[]
  rtId?: string
}

const ageLabels = ['0-2 TAHUN', '3-6 TAHUN', '7-10 TAHUN', '11-18 TAHUN', '19-24 TAHUN']
const ageLimits = [2, 6, 10, 18, 24]
export const detailLabels = [
  'NO',
  'NAMA ORANG TUA',
  'NAMA ANAK',
  'TGL LAHIR',
  'USIA',
  'L',
  'P',
  'ALAMAT',
  'USIA DALAM KANDUNGAN',
  ...ageLabels,
  'AKTE',
  'KIA',
  'KTP',
  'KETERANGAN',
]
export const summaryLabels = [
  'NO',
  'NAMA WILAYAH/RT',
  'USIA DALAM KANDUNGAN',
  ...ageLabels,
  'AKTE',
  'KIA',
  'KTP',
  'KETERANGAN',
]

function ageAt(birthDate: string, period: ReportPeriod): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate ?? '')
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number]
  const birth = new Date(Date.UTC(year, month - 1, day))
  const cutoff = new Date(Date.UTC(period.year, period.month, 0))
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day ||
    birth > cutoff
  )
    return null
  return (
    cutoff.getUTCFullYear() -
    year -
    (cutoff.getUTCMonth() + 1 < month ||
    (cutoff.getUTCMonth() + 1 === month && cutoff.getUTCDate() < day)
      ? 1
      : 0)
  )
}

export function buildPaarediData(options: PaarediOptions) {
  const prefix = `${options.period.year}-${String(options.period.month).padStart(2, '0')}`
  const endDate = `${prefix}-${new Date(Date.UTC(options.period.year, options.period.month, 0)).getUTCDate()}`
  const pregnant = new Set(
    options.mutations
      .filter((item) => item.mutationType === 'hamil' && item.mutationDate.startsWith(prefix))
      .map((item) => item.residentId),
  )
  const rtId = options.rtId || options.profile?.rtId
  const targets = options.residents
    .filter((resident) => {
      const age = ageAt(resident.birthDate, options.period)
      return (
        (!rtId || resident.rtId === rtId) &&
        (!resident.movedOutAt || resident.movedOutAt > endDate) &&
        (!resident.staySince || resident.staySince <= endDate) &&
        ((age !== null && age <= 24) || pregnant.has(resident.id))
      )
    })
    .sort(
      (a, b) =>
        (a.rtId ?? '').localeCompare(b.rtId ?? '') || a.fullName.localeCompare(b.fullName, 'id'),
    )
  const details = targets.map((resident, index) => {
    const age = ageAt(resident.birthDate, options.period)
    const group = age === null ? -1 : ageLimits.findIndex((limit) => age <= limit)
    const parent = [resident.fatherName, resident.motherName].filter(Boolean).join(' / ')
    return {
      resident,
      cells: [
        index + 1,
        parent,
        resident.fullName,
        resident.birthDate,
        age ?? '',
        resident.gender === 'L' ? 1 : '',
        resident.gender === 'P' ? 1 : '',
        resident.address,
        '',
        ...ageLabels.map((_, i) => (group === i ? 1 : '')),
        resident.hasBirthCertificate ? 1 : 0,
        resident.hasKia ? 1 : 0,
        resident.hasKtp ? 1 : 0,
        pregnant.has(resident.id) ? 'Ibu hamil' : '',
      ] as Array<string | number>,
    }
  })
  const rwId = options.profile?.rwId
  const rts = options.regions
    .filter(
      (region) =>
        region.type === 'rt' && (!rwId || region.rwId === rwId) && (!rtId || region.id === rtId),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))
  const groups: Array<{ id: string; label: string }> = rts.map((rt) => ({
    id: rt.id,
    label: /^RT\b/i.test(rt.name) ? rt.name : `RT ${rt.name}`,
  }))
  for (const { resident } of details) {
    const id = resident.rtId ?? ''
    if (!groups.some((group) => group.id === id))
      groups.push({ id, label: id ? `RT ${id}` : 'RT belum diisi' })
  }
  const summary = groups.map((group, index) => {
    const rows = details.filter((row) => (row.resident.rtId ?? '') === group.id)
    return [
      index + 1,
      group.label,
      '',
      ...Array.from({ length: 8 }, (_, i) =>
        rows.reduce((total, row) => total + Number(row.cells[i + 9] || 0), 0),
      ),
      '',
    ] as Array<string | number>
  })
  return { details: details.map((row) => row.cells), summary }
}

function regionValue(options: PaarediOptions, type: Region['type']) {
  const ids = new Set(
    options.residents
      .map(
        (resident) =>
          ({
            rw: resident.rwId,
            village: resident.villageId,
            district: resident.districtId,
            city: resident.cityId,
          })[type as 'rw' | 'village' | 'district' | 'city'],
      )
      .filter(Boolean),
  )
  const profileId = {
    rw: options.profile?.rwId,
    village: options.profile?.villageId,
    district: options.profile?.districtId,
    city: options.profile?.cityId,
  }[type as 'rw' | 'village' | 'district' | 'city']
  const id = ids.size === 1 ? [...ids][0] : profileId
  return (
    options.regions.find((region) => region.id === id && region.type === type)?.name ??
    (ids.size > 1 ? 'Semua wilayah terpilih' : '')
  )
}

function createSheet(workbook: ExcelJS.Workbook, options: PaarediOptions, summary: boolean) {
  const sheet = workbook.addWorksheet(summary ? 'Rekap RT' : 'Rincian Sasaran', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
    },
  })
  const labels = summary ? summaryLabels : detailLabels
  const last = summary ? 'L' : 'R'
  sheet.columns = (
    summary
      ? [5, 26, 14, 12, 12, 12, 12, 12, 10, 10, 10, 28]
      : [5, 28, 28, 14, 7, 5, 5, 30, 12, 11, 11, 11, 11, 11, 8, 8, 8, 25]
  ).map((width) => ({ width }))
  sheet.mergeCells(`A1:${last}1`)
  sheet.getCell('A1').value = 'DATA SASARAN PAAREDI'
  sheet.getCell('A1').font = { name: 'Arial', size: 12, bold: true }
  sheet.getCell('A1').alignment = { horizontal: 'center' }
  for (const [index, [label, type]] of (
    [
      ['RW', 'rw'],
      ['Kelurahan', 'village'],
      ['Kecamatan', 'district'],
      ['Kota', 'city'],
    ] as const
  ).entries()) {
    sheet.mergeCells(index + 3, 1, index + 3, 2)
    sheet.mergeCells(index + 3, 3, index + 3, 6)
    sheet.getCell(index + 3, 1).value = label
    sheet.getCell(index + 3, 3).value = regionValue(options, type) || null
    sheet.getCell(index + 3, 3).numFmt = '@'
    sheet.getCell(index + 3, 3).alignment = { horizontal: 'left' }
  }
  sheet.mergeCells(`G6:${last}6`)
  sheet.getCell('G6').value =
    `Periode ${String(options.period.month).padStart(2, '0')}/${options.period.year}`
  sheet.getCell('G6').alignment = { horizontal: 'right' }
  const mergedHeader = (start: number, end: number, text: string) => {
    sheet.mergeCells(8, start, start === end ? 9 : 8, end)
    sheet.getCell(8, start).value = text
  }
  if (summary) {
    mergedHeader(1, 1, 'NO')
    mergedHeader(2, 2, 'NAMA WILAYAH/RT')
    mergedHeader(3, 8, 'JUMLAH PER KELOMPOK USIA')
    mergedHeader(9, 11, 'DATA KEPENDUDUKAN')
    mergedHeader(12, 12, 'KETERANGAN')
    for (let col = 3; col <= 11; col++) sheet.getCell(9, col).value = labels[col - 1]
  } else {
    for (const col of [1, 2, 3, 4, 5, 8, 18]) mergedHeader(col, col, labels[col - 1]!)
    mergedHeader(6, 7, 'JENIS KELAMIN')
    mergedHeader(9, 14, 'KELOMPOK USIA')
    mergedHeader(15, 17, 'DATA KEPENDUDUKAN')
    for (const col of [6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17])
      sheet.getCell(9, col).value = labels[col - 1]
  }
  labels.forEach((_, i) => {
    sheet.getCell(10, i + 1).value = i + 1
  })
  sheet.getRow(8).height = 23
  sheet.getRow(9).height = 32
  const data = buildPaarediData(options)
  const rows = summary ? data.summary : data.details
  const rowCount = Math.max(summary ? 10 : 27, rows.length)
  for (let i = 0; i < rowCount; i++) {
    const row = sheet.getRow(11 + i)
    row.height = summary ? 22 : 30
    row.getCell(1).value = i + 1
    rows[i]?.forEach((value, col) => {
      const cell = row.getCell(col + 1)
      if (!summary && col === 3 && value) {
        cell.value = new Date(`${value}T00:00:00Z`)
        cell.numFmt = 'dd/mm/yyyy'
      } else cell.value = value === '' ? null : value
    })
  }
  const totalRow = 11 + rowCount
  sheet.mergeCells(totalRow, 1, totalRow, summary ? 3 : 5)
  sheet.getCell(totalRow, 1).value = 'TOTAL'
  const sumColumns = summary ? [4, 5, 6, 7, 8, 9, 10, 11] : [6, 7, 10, 11, 12, 13, 14, 15, 16, 17]
  for (const col of sumColumns) {
    const letter = sheet.getColumn(col).letter
    const result = rows.reduce((sum, row) => sum + Number(row[col - 1] || 0), 0)
    sheet.getCell(totalRow, col).value = {
      formula: `SUM(${letter}11:${letter}${totalRow - 1})`,
      result,
    }
  }
  for (let row = 8; row <= totalRow; row++) {
    for (let col = 1; col <= labels.length; col++) {
      const cell = sheet.getCell(row, col)
      cell.font = { name: 'Arial', size: 10, bold: row <= 10 || row === totalRow }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      if (row > 10 && row < totalRow && (summary ? [2, 12] : [2, 3, 8, 18]).includes(col))
        cell.alignment.horizontal = 'left'
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
    }
  }
  sheet.pageSetup.printArea = `A1:${last}${totalRow}`
  sheet.pageSetup.printTitlesRow = '1:10'
  sheet.headerFooter.oddFooter = 'Halaman &P dari &N'
  return sheet
}

export function createPaarediWorkbook(options: PaarediOptions) {
  const workbook = new ExcelJS.Workbook()
  createSheet(workbook, options, false)
  createSheet(workbook, options, true)
  return workbook
}
