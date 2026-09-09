import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import {
  deleteFamilyCard,
  ensureFamilyRelationship,
  listFamilyImportIdentities,
  saveFamilyCard,
  saveResident,
  updateFamilyCard,
} from '@/services/data'
import {
  applyFamilyParentAutoFill,
  familyImportIdentityKey,
  normalizeFreeTextId,
  normalizeKkNumber,
} from '@/utils/familyRules'
import { citizenshipOptions } from '@/types/domain'
import type {
  Citizenship,
  FamilyCard,
  Gender,
  Region,
  Resident,
  ResidentStatus,
  UserProfile,
} from '@/types/domain'

const SHEET_PETUNJUK = 'Petunjuk'
const SHEET_MASTER = 'Master Data'
const SHEET_DATA = 'Data KK & Warga'

const EXAMPLE_KK_NUMBER = 'CONTOH-0001'
const EXAMPLE_NIK = 'CONTOH-NIK-0001'

const GENDER_OPTIONS = ['L', 'P']
const RESIDENT_STATUS_OPTIONS = ['tetap', 'sementara']
const MARITAL_STATUS_OPTIONS = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati']

const COLUMNS = [
  { key: 'kkNumber', label: 'No. KK*' },
  { key: 'address', label: 'Alamat KK*' },
  { key: 'registeredAt', label: 'Tanggal Terdaftar (YYYY-MM-DD)' },
  { key: 'rwLabel', label: 'RW*' },
  { key: 'rtLabel', label: 'RT*' },
  { key: 'nik', label: 'NIK*' },
  { key: 'fullName', label: 'Nama Lengkap*' },
  { key: 'gender', label: 'Jenis Kelamin (L/P)*' },
  { key: 'birthPlace', label: 'Tempat Lahir*' },
  { key: 'birthDate', label: 'Tanggal Lahir (YYYY-MM-DD)*' },
  { key: 'religion', label: 'Agama*' },
  { key: 'education', label: 'Pendidikan' },
  { key: 'occupation', label: 'Pekerjaan' },
  { key: 'maritalStatus', label: 'Status Perkawinan*' },
  { key: 'familyRelationship', label: 'Hubungan Keluarga*' },
  { key: 'citizenship', label: 'Kewarganegaraan (WNI/WNA)' },
  { key: 'fatherName', label: 'Nama Ayah' },
  { key: 'motherName', label: 'Nama Ibu' },
  { key: 'staySince', label: 'Mulai Tinggal (YYYY-MM-DD)' },
  { key: 'residentStatus', label: 'Status Penduduk (tetap/sementara)' },
] as const

type ColumnKey = (typeof COLUMNS)[number]['key']

function colIndex(key: ColumnKey) {
  return COLUMNS.findIndex((column) => column.key === key) + 1
}

function normalizeLookupKey(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function regionLabel(region: Region, regions: Region[]) {
  const parent = regions.find((item) => item.id === region.parentId)
  return parent ? `${region.name} — ${parent.name}` : region.name
}

function rangeEnd(count: number) {
  return Math.max(count + 1, 2)
}

function scopedRegions(profile: UserProfile | null | undefined, regions: Region[]) {
  const rw =
    profile && profile.role !== 'superadmin' && profile.rwId
      ? regions.find((item) => item.type === 'rw' && item.id === profile.rwId)
      : undefined
  const rt = profile?.rtId
    ? regions.find((item) => item.type === 'rt' && item.id === profile.rtId)
    : undefined
  return { rw, rt }
}

export function buildFamilyImportTemplateWorkbook(
  regions: Region[],
  relationshipOptions: string[],
  profile?: UserProfile | null,
) {
  const workbook = new ExcelJS.Workbook()
  const rwRegions = regions.filter((item) => item.type === 'rw')
  const rtRegions = regions.filter((item) => item.type === 'rt')
  const rwLabels = rwRegions.map((item) => regionLabel(item, regions))
  const rtLabels = rtRegions.map((item) => regionLabel(item, regions))
  const { rw: scopedRw, rt: scopedRt } = scopedRegions(profile, regions)
  const defaultRwLabel = scopedRw ? regionLabel(scopedRw, regions) : ''
  const defaultRtLabel = scopedRt ? regionLabel(scopedRt, regions) : ''

  const petunjuk = workbook.addWorksheet(SHEET_PETUNJUK)
  petunjuk.getColumn(1).width = 100
  const lines = [
    'PETUNJUK IMPORT DATA KARTU KELUARGA & WARGA',
    '',
    '1. Isi data pada sheet "Data KK & Warga" mulai baris ke-3. Baris ke-2 adalah contoh — HAPUS baris tersebut sebelum mengisi data asli.',
    '2. Kolom bertanda (*) wajib diisi.',
    '3. Satu baris = satu warga. Untuk KK dengan lebih dari satu anggota, gunakan No. KK yang sama pada beberapa baris.',
    '4. Setiap No. KK wajib memiliki tepat satu baris dengan Hubungan Keluarga = "Kepala Keluarga".',
    '5. Kolom Alamat KK, RW, RT, dan Tanggal Terdaftar cukup diisi pada baris Kepala Keluarga; baris anggota lain boleh dikosongkan dan akan otomatis mengikuti data Kepala Keluarga.',
    '6. Kolom RW dan RT wajib dipilih persis sama dengan pilihan pada sheet "Master Data" (gunakan dropdown yang sudah disediakan pada sheet Data KK & Warga).',
    '7. Format tanggal: YYYY-MM-DD (contoh: 2026-09-04). Sel bertipe tanggal pada Excel juga didukung.',
    '8. NIK dan No. KK boleh berisi huruf/angka sesuai kebutuhan pencatatan RT/RW, namun NIK tidak boleh sama antar warga.',
    '9. Kolom Jenis Kelamin, Kewarganegaraan, Status Penduduk, Status Perkawinan, dan Hubungan Keluarga sudah disediakan dropdown pada sheet Data KK & Warga, sumbernya dari sheet "Master Data".',
    '10. Jangan mengubah nama sheet atau urutan kolom pada sheet "Data KK & Warga".',
    '11. Setelah selesai diisi, simpan file lalu unggah kembali melalui tombol "Proses Import" pada halaman Kartu Keluarga.',
    scopedRt
      ? `12. Akun Anda terbatas pada RT ${defaultRtLabel}: kolom RW dan RT boleh dikosongkan pada baris Kepala Keluarga, akan otomatis memakai wilayah akun Anda. Dropdown pada Master Data juga hanya menampilkan wilayah Anda.`
      : scopedRw
        ? `12. Akun Anda terbatas pada RW ${defaultRwLabel}: kolom RW boleh dikosongkan pada baris Kepala Keluarga (otomatis memakai RW Anda), namun kolom RT tetap wajib dipilih sesuai RT tujuan. Dropdown pada Master Data juga hanya menampilkan wilayah Anda.`
        : '12. Akun Anda memiliki akses ke seluruh wilayah: kolom RW dan RT wajib diisi sesuai KK masing-masing.',
  ]
  lines.forEach((line, index) => {
    petunjuk.getCell(`A${index + 1}`).value = line
  })
  petunjuk.getCell('A1').font = { bold: true, size: 14 }

  const master = workbook.addWorksheet(SHEET_MASTER)
  const masterColumns: Array<{ header: string; values: string[] }> = [
    { header: 'RW', values: rwLabels },
    { header: 'RT', values: rtLabels },
    { header: 'Jenis Kelamin', values: GENDER_OPTIONS },
    { header: 'Kewarganegaraan', values: [...citizenshipOptions] },
    { header: 'Status Penduduk', values: RESIDENT_STATUS_OPTIONS },
    { header: 'Status Perkawinan', values: MARITAL_STATUS_OPTIONS },
    { header: 'Hubungan Keluarga', values: relationshipOptions },
  ]
  masterColumns.forEach((column, index) => {
    const letter = String.fromCharCode(65 + index)
    const headerCell = master.getCell(`${letter}1`)
    headerCell.value = column.header
    headerCell.font = { bold: true }
    column.values.forEach((value, rowIndex) => {
      master.getCell(`${letter}${rowIndex + 2}`).value = value
    })
  })

  const sheet = workbook.addWorksheet(SHEET_DATA)
  sheet.columns = COLUMNS.map((column) => ({ header: column.label, key: column.key, width: 22 }))
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCEEE9' } }

  sheet.addRow({
    kkNumber: EXAMPLE_KK_NUMBER,
    address: 'Jl. Contoh No. 1',
    registeredAt: '2020-01-01',
    rwLabel: defaultRwLabel,
    rtLabel: defaultRtLabel,
    nik: EXAMPLE_NIK,
    fullName: 'Contoh Kepala Keluarga',
    gender: 'L',
    birthPlace: 'Bandung',
    birthDate: '1990-01-01',
    religion: 'Islam',
    education: 'SMA',
    occupation: 'Wiraswasta',
    maritalStatus: 'Kawin',
    familyRelationship: 'Kepala Keluarga',
    citizenship: 'WNI',
    fatherName: '',
    motherName: '',
    staySince: '2020-01-01',
    residentStatus: 'tetap',
  })
  sheet.getRow(2).eachCell((cell) => {
    cell.font = { italic: true, color: { argb: 'FF94A3B8' } }
  })

  const listValidation = (formula: string) => ({
    type: 'list' as const,
    formulae: [formula],
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: 'warning' as const,
    error: 'Nilai harus dipilih dari daftar.',
  })

  const lastRow = 500
  for (let row = 2; row <= lastRow; row++) {
    sheet.getCell(row, colIndex('rwLabel')).dataValidation = listValidation(
      `'${SHEET_MASTER}'!$A$2:$A$${rangeEnd(rwLabels.length)}`,
    )
    sheet.getCell(row, colIndex('rtLabel')).dataValidation = listValidation(
      `'${SHEET_MASTER}'!$B$2:$B$${rangeEnd(rtLabels.length)}`,
    )
    sheet.getCell(row, colIndex('gender')).dataValidation = listValidation(
      `'${SHEET_MASTER}'!$C$2:$C$${rangeEnd(GENDER_OPTIONS.length)}`,
    )
    sheet.getCell(row, colIndex('maritalStatus')).dataValidation = listValidation(
      `'${SHEET_MASTER}'!$F$2:$F$${rangeEnd(MARITAL_STATUS_OPTIONS.length)}`,
    )
    sheet.getCell(row, colIndex('familyRelationship')).dataValidation = listValidation(
      `'${SHEET_MASTER}'!$G$2:$G$${rangeEnd(relationshipOptions.length)}`,
    )
    sheet.getCell(row, colIndex('citizenship')).dataValidation = listValidation(
      `'${SHEET_MASTER}'!$D$2:$D$${rangeEnd(citizenshipOptions.length)}`,
    )
    sheet.getCell(row, colIndex('residentStatus')).dataValidation = listValidation(
      `'${SHEET_MASTER}'!$E$2:$E$${rangeEnd(RESIDENT_STATUS_OPTIONS.length)}`,
    )
  }

  return workbook
}

export async function downloadFamilyImportTemplate(
  regions: Region[],
  relationshipOptions: string[],
  profile?: UserProfile | null,
) {
  const workbook = buildFamilyImportTemplateWorkbook(regions, relationshipOptions, profile)
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), 'template-import-kartu-keluarga.xlsx')
}

export interface FamilyImportError {
  row: number
  message: string
}

interface ParsedRow {
  row: number
  kkNumber: string
  address: string
  registeredAt: string
  rwLabel: string
  rtLabel: string
  nik: string
  fullName: string
  gender: string
  birthPlace: string
  birthDate: string
  religion: string
  education: string
  occupation: string
  maritalStatus: string
  familyRelationship: string
  citizenship: string
  fatherName: string
  motherName: string
  staySince: string
  residentStatus: string
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return formatDate(value)
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: Array<{ text: string }> }).richText
      .map((part) => part.text)
      .join('')
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as { result: unknown }).result
    return result instanceof Date ? formatDate(result) : String(result ?? '').trim()
  }
  return String(value).trim()
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function cellDateText(cell: ExcelJS.Cell): string {
  const raw = cellText(cell)
  if (!raw || /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const altMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (altMatch) {
    const [, day, month, year] = altMatch
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`
  }
  return raw
}

export function parseFamilyImportWorkbook(workbook: ExcelJS.Workbook): {
  rows: ParsedRow[]
  parseErrors: FamilyImportError[]
} {
  const sheet = workbook.getWorksheet(SHEET_DATA)
  if (!sheet) {
    throw new Error(
      `Sheet "${SHEET_DATA}" tidak ditemukan. Gunakan template import yang disediakan.`,
    )
  }

  const rows: ParsedRow[] = []
  const parseErrors: FamilyImportError[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const get = (key: ColumnKey) => cellText(row.getCell(colIndex(key)))
    const kkNumber = get('kkNumber')
    const nik = get('nik')
    const fullName = get('fullName')
    if (!kkNumber && !nik && !fullName) return
    if (
      normalizeKkNumber(kkNumber) === EXAMPLE_KK_NUMBER ||
      normalizeFreeTextId(nik) === EXAMPLE_NIK
    ) {
      parseErrors.push({
        row: rowNumber,
        message:
          'Baris ini masih berisi data contoh dari template. Hapus atau ganti dengan data asli sebelum mengunggah.',
      })
      return
    }

    rows.push({
      row: rowNumber,
      kkNumber: normalizeKkNumber(kkNumber),
      address: get('address'),
      registeredAt: cellDateText(row.getCell(colIndex('registeredAt'))),
      rwLabel: get('rwLabel'),
      rtLabel: get('rtLabel'),
      nik: normalizeFreeTextId(nik),
      fullName,
      gender: get('gender'),
      birthPlace: get('birthPlace'),
      birthDate: cellDateText(row.getCell(colIndex('birthDate'))),
      religion: get('religion'),
      education: get('education'),
      occupation: get('occupation'),
      maritalStatus: get('maritalStatus'),
      familyRelationship: get('familyRelationship'),
      citizenship: get('citizenship'),
      fatherName: get('fatherName'),
      motherName: get('motherName'),
      staySince: cellDateText(row.getCell(colIndex('staySince'))),
      residentStatus: get('residentStatus'),
    })
  })

  if (!rows.length && !parseErrors.length) {
    parseErrors.push({ row: 0, message: `Tidak ada data pada sheet "${SHEET_DATA}".` })
  }
  return { rows, parseErrors }
}

export interface FamilyGroupInput {
  kkNumber: string
  headRow: number
  card: Omit<FamilyCard, 'id'>
  head: Omit<Resident, 'id' | 'familyCardId'>
  members: Array<Omit<Resident, 'id' | 'familyCardId'>>
}

function requireField(value: string, label: string, row: number, errors: FamilyImportError[]) {
  if (!value) errors.push({ row, message: `${label} wajib diisi.` })
}

function normalizeGender(value: string, row: number, errors: FamilyImportError[]): Gender {
  const upper = value.trim().toUpperCase()
  if (upper.startsWith('L')) return 'L'
  if (upper.startsWith('P')) return 'P'
  errors.push({ row, message: 'Jenis Kelamin harus "L" atau "P".' })
  return 'L'
}

function normalizeResidentStatus(value: string): ResidentStatus {
  return value.trim().toLowerCase().startsWith('sementara') ? 'sementara' : 'tetap'
}

function normalizeCitizenship(value: string): Citizenship {
  return value.trim().toUpperCase() === 'WNA' ? 'WNA' : 'WNI'
}

export function buildFamilyGroups(
  rows: ParsedRow[],
  regions: Region[],
  profile?: UserProfile | null,
): { groups: FamilyGroupInput[]; errors: FamilyImportError[]; totalKkCount: number } {
  const errors: FamilyImportError[] = []
  const rwRegions = regions.filter((item) => item.type === 'rw')
  const rtRegions = regions.filter((item) => item.type === 'rt')
  const rwByLabel = new Map(
    rwRegions.map((item) => [normalizeLookupKey(regionLabel(item, regions)), item]),
  )
  const rtByLabel = new Map(
    rtRegions.map((item) => [normalizeLookupKey(regionLabel(item, regions)), item]),
  )
  const { rw: scopedRw, rt: scopedRt } = scopedRegions(profile, regions)

  const duplicateNikRows = new Set<number>()
  const nikRowMap = new Map<string, number[]>()
  rows.forEach((row) => {
    const key = familyImportIdentityKey(row.nik)
    if (!key) return
    const list = nikRowMap.get(key) ?? []
    list.push(row.row)
    nikRowMap.set(key, list)
  })
  nikRowMap.forEach((rowNumbers, nik) => {
    if (rowNumbers.length <= 1) return
    rowNumbers.forEach((row) => duplicateNikRows.add(row))
    errors.push({
      row: rowNumbers[0]!,
      message: `NIK "${nik}" muncul lebih dari sekali pada file (baris ${rowNumbers.join(', ')}).`,
    })
  })

  const byKk = new Map<string, ParsedRow[]>()
  rows.forEach((row) => {
    if (!row.kkNumber) {
      errors.push({ row: row.row, message: 'No. KK wajib diisi.' })
      return
    }
    const key = familyImportIdentityKey(row.kkNumber)
    const list = byKk.get(key) ?? []
    list.push(row)
    byKk.set(key, list)
  })

  const groups: FamilyGroupInput[] = []

  byKk.forEach((familyRows) => {
    const kkNumber = familyRows[0]!.kkNumber
    if (familyRows.some((row) => duplicateNikRows.has(row.row))) return

    const headRows = familyRows.filter(
      (row) => normalizeFreeTextId(row.familyRelationship).toLowerCase() === 'kepala keluarga',
    )
    if (headRows.length === 0) {
      errors.push({
        row: familyRows[0]!.row,
        message: `KK ${kkNumber}: tidak ada baris dengan Hubungan Keluarga "Kepala Keluarga".`,
      })
      return
    }
    if (headRows.length > 1) {
      errors.push({
        row: headRows[1]!.row,
        message: `KK ${kkNumber}: ditemukan lebih dari satu baris "Kepala Keluarga".`,
      })
      return
    }
    const head = headRows[0]!

    if (!head.address) {
      errors.push({ row: head.row, message: 'Alamat KK wajib diisi pada baris Kepala Keluarga.' })
      return
    }

    if (!head.rwLabel && !scopedRw) {
      errors.push({ row: head.row, message: 'RW wajib diisi pada baris Kepala Keluarga.' })
      return
    }
    if (!head.rtLabel && !scopedRt) {
      errors.push({ row: head.row, message: 'RT wajib diisi pada baris Kepala Keluarga.' })
      return
    }

    const rwKey = head.rwLabel ? normalizeLookupKey(head.rwLabel) : ''
    const rtKey = head.rtLabel ? normalizeLookupKey(head.rtLabel) : ''
    const rw = head.rwLabel ? rwByLabel.get(rwKey) : scopedRw
    if (!rw) {
      errors.push({
        row: head.row,
        message: `RW "${head.rwLabel}" tidak ditemukan pada sheet Master Data.`,
      })
      return
    }
    const rt = head.rtLabel ? rtByLabel.get(rtKey) : scopedRt
    if (!rt) {
      errors.push({
        row: head.row,
        message: `RT "${head.rtLabel}" tidak ditemukan pada sheet Master Data.`,
      })
      return
    }
    if (rt.rwId !== rw.id) {
      errors.push({
        row: head.row,
        message: `RT "${head.rtLabel || regionLabel(rt, regions)}" bukan bagian dari RW "${head.rwLabel || regionLabel(rw, regions)}".`,
      })
      return
    }

    let hasRowError = false
    const residentsInput: Array<Omit<Resident, 'id' | 'familyCardId'> & { isHead: boolean }> = []

    for (const row of familyRows) {
      const before = errors.length
      const isHead = row === head
      const gender = normalizeGender(row.gender, row.row, errors)
      requireField(row.nik, 'NIK', row.row, errors)
      requireField(row.fullName, 'Nama Lengkap', row.row, errors)
      requireField(row.birthPlace, 'Tempat Lahir', row.row, errors)
      requireField(row.birthDate, 'Tanggal Lahir', row.row, errors)
      requireField(row.religion, 'Agama', row.row, errors)
      requireField(row.maritalStatus, 'Status Perkawinan', row.row, errors)
      requireField(row.familyRelationship, 'Hubungan Keluarga', row.row, errors)
      if (errors.length > before) {
        hasRowError = true
        continue
      }

      residentsInput.push({
        isHead,
        kkNumber,
        nik: row.nik,
        fullName: row.fullName,
        gender,
        birthPlace: row.birthPlace,
        birthDate: row.birthDate,
        religion: row.religion,
        education: row.education,
        occupation: row.occupation,
        maritalStatus: row.maritalStatus,
        familyRelationship: isHead
          ? 'Kepala Keluarga'
          : normalizeFreeTextId(row.familyRelationship),
        citizenship: normalizeCitizenship(row.citizenship),
        fatherName: row.fatherName,
        motherName: row.motherName,
        address: head.address,
        staySince: row.staySince || undefined,
        residentStatus: normalizeResidentStatus(row.residentStatus),
        provinceId: rw.provinceId,
        cityId: rw.cityId,
        districtId: rw.districtId,
        villageId: rw.villageId,
        rwId: rw.id,
        rtId: rt.id,
      })
    }

    if (hasRowError) return

    const headInput = residentsInput.find((item) => item.isHead)!
    const memberInputs = residentsInput.filter((item) => !item.isHead)
    const autoFilledMembers = memberInputs.map((member) =>
      applyFamilyParentAutoFill(member, [
        headInput,
        ...memberInputs.filter((candidate) => candidate !== member),
      ]),
    )

    groups.push({
      kkNumber,
      headRow: head.row,
      card: {
        kkNumber,
        headName: headInput.fullName,
        address: head.address,
        registeredAt: head.registeredAt || undefined,
        provinceId: rw.provinceId,
        cityId: rw.cityId,
        districtId: rw.districtId,
        villageId: rw.villageId,
        rwId: rw.id,
        rtId: rt.id,
      },
      head: headInput,
      members: autoFilledMembers,
    })
  })

  return { groups, errors, totalKkCount: byKk.size }
}

export interface FamilyImportResult {
  totalFamilies: number
  successFamilies: number
  failedFamilies: number
  changedFamilies?: number
  errors: FamilyImportError[]
}

export async function runFamilyImport(
  groups: FamilyGroupInput[],
  onProgress?: (processed: number, total: number) => void,
): Promise<FamilyImportResult> {
  const errors: FamilyImportError[] = []
  let successFamilies = 0
  let changedFamilies = 0
  if (!groups.length) return { totalFamilies: 0, successFamilies: 0, failedFamilies: 0, errors }
  // Fail closed: never start writing if the duplicate check cannot be completed.
  const existing = await listFamilyImportIdentities()
  const seenKks = new Set<string>()
  const seenNiks = new Set<string>()
  const relationships = new Set<string>()

  for (let index = 0; index < groups.length; index++) {
    const group = groups[index]!
    let createdCardId = ''
    let updatingExisting = false
    try {
      const kkKey = familyImportIdentityKey(group.kkNumber)
      const residents = [group.head, ...group.members]
      const matches = existing.cards.filter(
        (card) => familyImportIdentityKey(card.kk_number) === kkKey,
      )
      if (matches.length > 1)
        throw new Error('No. KK cocok dengan beberapa data lama. Periksa duplikasi sebelum impor.')
      const card = matches[0]
      if (seenKks.has(kkKey)) throw new Error('No. KK berulang dalam impor. KK dilewati.')
      const familyNiks = residents.map((resident) => familyImportIdentityKey(resident.nik))
      if (new Set(familyNiks).size !== familyNiks.length)
        throw new Error('NIK berulang pada anggota KK. Seluruh KK dilewati.')
      const residentMatches = residents.map((resident) => {
        const key = familyImportIdentityKey(resident.nik)
        if (seenNiks.has(key)) throw new Error(`NIK "${resident.nik}" berulang dalam impor.`)
        const matches = existing.residents.filter(
          (saved) => familyImportIdentityKey(saved.nik || '') === key,
        )
        if (matches.length > 1)
          throw new Error(`NIK "${resident.nik}" cocok dengan beberapa data lama.`)
        const saved = matches[0]
        if (saved && (!card || saved.family_card_id !== card.id)) {
          throw new Error(
            `NIK "${resident.nik}" terdaftar di KK lain. Seluruh KK dilewati; warga tidak dipindahkan otomatis.`,
          )
        }
        return saved
      })
      // An omitted former head must not leave two heads after an upsert.
      if (card) {
        const heads = existing.residents.filter(
          (saved) =>
            saved.family_card_id === card.id &&
            normalizeLookupKey(saved.family_relationship || '') === 'kepala keluarga',
        )
        if (heads.some((head) => !familyNiks.includes(familyImportIdentityKey(head.nik || '')))) {
          throw new Error(
            'Kepala keluarga lama tidak ada dalam file. Sertakan NIK kepala keluarga lama beserta hubungan barunya untuk mengganti kepala keluarga.',
          )
        }
      }
      for (const resident of residents) {
        if (relationships.has(resident.familyRelationship)) continue
        await ensureFamilyRelationship(resident.familyRelationship)
        relationships.add(resident.familyRelationship)
      }
      seenKks.add(kkKey)
      familyNiks.forEach((nik) => seenNiks.add(nik))
      const kkNumber = card?.kk_number || group.kkNumber
      let cardId: string
      changedFamilies++
      if (card) {
        updatingExisting = true
        cardId = await updateFamilyCard({ ...group.card, kkNumber }, card.id)
      } else {
        createdCardId = await saveFamilyCard(group.card)
        cardId = createdCardId
      }
      for (let i = 0; i < residents.length; i++) {
        const resident = residents[i]!
        const saved = residentMatches[i]
        await saveResident(
          { ...resident, kkNumber, nik: saved?.nik || resident.nik, familyCardId: cardId },
          saved?.id,
        )
      }
      successFamilies++
    } catch (error) {
      if (createdCardId) {
        try {
          await deleteFamilyCard(createdCardId)
        } catch {
          errors.push({
            row: group.headRow,
            message: `KK ${group.kkNumber}: pembersihan data impor gagal. Periksa KK ini sebelum mencoba impor ulang.`,
          })
        }
      }
      errors.push({
        row: group.headRow,
        message: `KK ${group.kkNumber}: ${error instanceof Error ? error.message : 'Gagal disimpan.'}${updatingExisting ? ' Sebagian perubahan mungkin sudah tersimpan. Periksa data atau ulangi impor untuk menyelesaikan pembaruan.' : ''}`,
      })
    }
    onProgress?.(index + 1, groups.length)
  }

  return {
    totalFamilies: groups.length,
    successFamilies,
    failedFamilies: groups.length - successFamilies,
    changedFamilies,
    errors,
  }
}

export async function readWorkbookFromFile(file: File): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer)
  return workbook
}
