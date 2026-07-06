import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type {
  DashboardStats,
  FamilyCard,
  MutationType,
  Region,
  ReportPeriod,
  Resident,
  ResidentMutation,
  UserProfile,
} from '@/types/domain'

const reportTemplates = {
  lampid: '/dokumensementara/LAMPID.xlsx',
  bukuIndukTetap:
    '/dokumensementara/Model A.1. Buku Induk Penduduk Tetap - Penduduk Tetap.xlsx',
  bukuIndukSementara:
    '/dokumensementara/Model A.2. Buku Induk Penduduk Tetap - Penduduk Sementara atau Musiman Dalam Kota Bandung.xlsx',
  perubahanTetap:
    '/dokumensementara/Model A.3. Buku Peubahan Penduduk Tetap - Karena LAMPID - Penduduk Tetap.xlsx',
  perubahanSementara:
    '/dokumensementara/Model A.4. Buku Perubahan Penduduk Tetap - Karena LAMPID - Penduduk Sementara atau Musiman.xlsx',
  perkembangan: '/dokumensementara/Model A.5. Buku Perkembangan Penduduk.xlsx',
} as const

export type ReportKind = keyof typeof reportTemplates

export function calculateStats(
  cards: FamilyCard[],
  residents: Resident[],
  mutations: ResidentMutation[],
): DashboardStats {
  return {
    familyCards: cards.length,
    residents: residents.length,
    male: residents.filter((item) => item.gender === 'L').length,
    female: residents.filter((item) => item.gender === 'P').length,
    permanent: residents.filter((item) => item.residentStatus === 'tetap').length,
    temporary: residents.filter((item) => item.residentStatus === 'sementara').length,
    lahir: mutations.filter((item) => item.mutationType === 'lahir').length,
    mati: mutations.filter((item) => item.mutationType === 'mati').length,
    pindah: mutations.filter((item) => item.mutationType === 'pindah').length,
    datang: mutations.filter((item) => item.mutationType === 'datang').length,
  }
}

export function formatPeriod(period: ReportPeriod) {
  const month = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(
    new Date(period.year, period.month - 1, 1),
  )
  return `${month.toUpperCase()} TAHUN ${period.year}`
}

export function buildRegionLine(regions: Region[], profile: UserProfile | null) {
  const district = regions.find((item) => item.id === profile?.districtId)?.name ?? 'KECAMATAN'
  const village = regions.find((item) => item.id === profile?.villageId)?.name ?? 'KELURAHAN'
  return `KELURAHAN ${village.toUpperCase()} KECAMATAN ${district.toUpperCase()}`
}

export function countMutationsByType(mutations: ResidentMutation[], type: MutationType) {
  const filtered = mutations.filter((item) => item.mutationType === type)
  return {
    male: filtered.filter((item) => item.gender === 'L').length,
    female: filtered.filter((item) => item.gender === 'P').length,
    total: filtered.length,
  }
}

export async function exportReport(options: {
  kind: ReportKind
  period: ReportPeriod
  regions: Region[]
  profile: UserProfile | null
  cards: FamilyCard[]
  residents: Resident[]
  mutations: ResidentMutation[]
}) {
  const workbook = new ExcelJS.Workbook()
  const response = await fetch(reportTemplates[options.kind])
  const template = await response.arrayBuffer()
  await workbook.xlsx.load(template)
  const sheet = workbook.worksheets[0]

  if (!sheet) throw new Error('Template laporan tidak memiliki worksheet.')

  const regionLine = buildRegionLine(options.regions, options.profile)
  sheet.getCell('A3').value = regionLine
  sheet.getCell('A4').value = `BULAN ${formatPeriod(options.period)}`

  if (options.kind === 'lampid') {
    fillLampid(sheet, options.mutations)
  } else if (options.kind === 'perkembangan') {
    fillDevelopment(sheet, options.residents, options.mutations)
  } else if (options.kind.includes('bukuInduk')) {
    fillResidentBook(sheet, options.residents)
  } else {
    fillMutationBook(sheet, options.mutations)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `${options.kind}-${options.period.year}-${String(options.period.month).padStart(2, '0')}.xlsx`
  saveAs(new Blob([buffer]), filename)

  const { saveReportExport } = await import('@/services/data')
  await saveReportExport({
    kind: options.kind,
    month: options.period.month,
    year: options.period.year,
    rwId: options.profile?.rwId,
    rtId: options.profile?.rtId,
    totalResidents: options.residents.length,
  })
}

function fillLampid(sheet: ExcelJS.Worksheet, mutations: ResidentMutation[]) {
  const lahir = countMutationsByType(mutations, 'lahir')
  const mati = countMutationsByType(mutations, 'mati')
  const pindah = countMutationsByType(mutations, 'pindah')
  const datang = countMutationsByType(mutations, 'datang')
  const row = sheet.getRow(9)
  row.getCell(1).value = 'Jumlah'
  row.getCell(2).value = lahir.male
  row.getCell(3).value = lahir.female
  row.getCell(4).value = lahir.total
  row.getCell(5).value = mati.male
  row.getCell(6).value = mati.female
  row.getCell(7).value = mati.total
  row.getCell(8).value = pindah.male
  row.getCell(9).value = pindah.female
  row.getCell(10).value = pindah.total
  row.getCell(11).value = datang.male
  row.getCell(12).value = datang.female
  row.getCell(13).value = datang.total
  row.commit()
}

function fillResidentBook(sheet: ExcelJS.Worksheet, residents: Resident[]) {
  residents.slice(0, 200).forEach((resident, index) => {
    const row = sheet.getRow(8 + index)
    row.getCell(1).value = index + 1
    row.getCell(2).value = resident.kkNumber
    row.getCell(3).value = resident.fullName
    row.getCell(4).value = resident.gender
    row.getCell(5).value = `${resident.birthPlace}, ${resident.birthDate}`
    row.getCell(6).value = resident.maritalStatus
    row.getCell(7).value = resident.religion
    row.getCell(8).value = resident.education
    row.getCell(9).value = resident.occupation
    row.getCell(10).value = resident.familyRelationship
    row.getCell(11).value = resident.address
    row.getCell(12).value = resident.staySince
    row.getCell(13).value = resident.movedOutAt
    row.commit()
  })
}

function fillMutationBook(sheet: ExcelJS.Worksheet, mutations: ResidentMutation[]) {
  mutations.slice(0, 200).forEach((mutation, index) => {
    const row = sheet.getRow(10 + index)
    row.getCell(1).value = index + 1
    row.getCell(2).value = mutation.residentName
    row.getCell(3).value = mutation.gender
    row.getCell(11).value = mutation.mutationDate
    row.getCell(12).value = mutation.mutationType.toUpperCase()
    row.commit()
  })
}

function fillDevelopment(
  sheet: ExcelJS.Worksheet,
  residents: Resident[],
  mutations: ResidentMutation[],
) {
  const stats = calculateStats([], residents, mutations)
  sheet.getRow(8).getCell(3).value = stats.permanent
  sheet.getRow(9).getCell(3).value = stats.lahir
  sheet.getRow(10).getCell(3).value = stats.pindah
  sheet.getRow(11).getCell(3).value = stats.datang
  sheet.getRow(12).getCell(3).value = Math.max(0, stats.permanent + stats.lahir + stats.datang - stats.pindah - stats.mati)
}
