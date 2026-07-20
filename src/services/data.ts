import { supabase } from '@/lib/supabase'
import type {
  FamilyCard,
  Permission,
  PermissionCode,
  Region,
  Resident,
  ResidentMutation,
  Role,
  RolePermission,
  UserPermission,
  UserProfile,
  UserRole,
} from '@/types/domain'

type MasterRegionRow = {
  id: string
  name: string
  code: string | null
  created_at: string | null
  updated_at: string | null
  province_id?: string
  city_id?: string
  district_id?: string
  village_id?: string
  rw_id?: string
}

type RoleRow = {
  id: string
  code: UserRole
  label: string
  scope_level: Role['scopeLevel']
  sort_order: number
}

type ProfileRow = {
  id: string
  email: string
  display_name: string
  role_id: string
  master_roles: { code: UserRole } | null
  province_id: string | null
  city_id: string | null
  district_id: string | null
  village_id: string | null
  rw_id: string | null
  rt_id: string | null
}

type FamilyCardRow = {
  id: string
  kk_number: string
  head_name: string
  address: string
  province_id: string | null
  city_id: string | null
  district_id: string | null
  village_id: string | null
  rw_id: string | null
  rt_id: string | null
  registered_at: string | null
  created_at: string | null
  updated_at: string | null
  residents?: Array<{ nik: string }>
}

type ResidentRow = {
  id: string
  family_card_id: string
  kk_number: string
  nik: string
  full_name: string
  gender: Resident['gender']
  birth_place: string
  birth_date: string
  religion: string
  education: string
  occupation: string
  marital_status: string
  family_relationship: string
  citizenship: string
  father_name: string
  mother_name: string
  address: string
  stay_since: string | null
  moved_out_at: string | null
  resident_status: Resident['residentStatus']
  province_id: string | null
  city_id: string | null
  district_id: string | null
  village_id: string | null
  rw_id: string | null
  rt_id: string | null
  created_at: string | null
  updated_at: string | null
}

type MutationRow = {
  id: string
  resident_id: string | null
  resident_name: string
  gender: ResidentMutation['gender']
  mutation_type: ResidentMutation['mutationType']
  mutation_date: string
  note: string | null
  resident_status: ResidentMutation['residentStatus']
  province_id: string | null
  city_id: string | null
  district_id: string | null
  village_id: string | null
  rw_id: string | null
  rt_id: string | null
  created_at: string | null
}

function assertNoError(error: unknown) {
  if (error instanceof Error) throw error
  if (error && typeof error === 'object' && 'message' in error) {
    throw new Error(String((error as { message: unknown }).message))
  }
}

function assertSixteenDigits(value: string, label: string) {
  if (!/^\d{16}$/.test(value)) throw new Error(`${label} harus terdiri dari 16 digit angka.`)
}

function clean<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''))
}

function mapRole(row: RoleRow): Role {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    scopeLevel: row.scope_level,
    sortOrder: row.sort_order,
  }
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    roleId: row.role_id,
    role: row.master_roles?.code ?? 'staff_rt',
    provinceId: row.province_id ?? undefined,
    cityId: row.city_id ?? undefined,
    districtId: row.district_id ?? undefined,
    villageId: row.village_id ?? undefined,
    rwId: row.rw_id ?? undefined,
    rtId: row.rt_id ?? undefined,
  }
}

function mapFamilyCard(row: FamilyCardRow): FamilyCard {
  return {
    id: row.id,
    kkNumber: row.kk_number,
    headName: row.head_name,
    address: row.address,
    memberCount: row.residents?.length ?? 0,
    memberNiks: row.residents?.map((resident) => resident.nik) ?? [],
    provinceId: row.province_id ?? undefined,
    cityId: row.city_id ?? undefined,
    districtId: row.district_id ?? undefined,
    villageId: row.village_id ?? undefined,
    rwId: row.rw_id ?? undefined,
    rtId: row.rt_id ?? undefined,
    registeredAt: row.registered_at ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

function familyCardPayload(card: Omit<FamilyCard, 'id'>) {
  return clean({
    kk_number: card.kkNumber,
    head_name: card.headName,
    address: card.address,
    province_id: card.provinceId,
    city_id: card.cityId,
    district_id: card.districtId,
    village_id: card.villageId,
    rw_id: card.rwId,
    rt_id: card.rtId,
    registered_at: card.registeredAt,
    updated_at: new Date().toISOString(),
  })
}

function mapResident(row: ResidentRow): Resident {
  return {
    id: row.id,
    familyCardId: row.family_card_id,
    kkNumber: row.kk_number,
    nik: row.nik,
    fullName: row.full_name,
    gender: row.gender,
    birthPlace: row.birth_place,
    birthDate: row.birth_date,
    religion: row.religion,
    education: row.education,
    occupation: row.occupation,
    maritalStatus: row.marital_status,
    familyRelationship: row.family_relationship,
    citizenship: row.citizenship,
    fatherName: row.father_name,
    motherName: row.mother_name,
    address: row.address,
    staySince: row.stay_since ?? undefined,
    movedOutAt: row.moved_out_at ?? undefined,
    residentStatus: row.resident_status,
    provinceId: row.province_id ?? undefined,
    cityId: row.city_id ?? undefined,
    districtId: row.district_id ?? undefined,
    villageId: row.village_id ?? undefined,
    rwId: row.rw_id ?? undefined,
    rtId: row.rt_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

function residentPayload(resident: Omit<Resident, 'id'>) {
  return clean({
    family_card_id: resident.familyCardId,
    kk_number: resident.kkNumber,
    nik: resident.nik,
    full_name: resident.fullName,
    gender: resident.gender,
    birth_place: resident.birthPlace,
    birth_date: resident.birthDate,
    religion: resident.religion,
    education: resident.education,
    occupation: resident.occupation,
    marital_status: resident.maritalStatus,
    family_relationship: resident.familyRelationship,
    citizenship: resident.citizenship,
    father_name: resident.fatherName,
    mother_name: resident.motherName,
    address: resident.address,
    stay_since: resident.staySince,
    moved_out_at: resident.movedOutAt,
    resident_status: resident.residentStatus,
    province_id: resident.provinceId,
    city_id: resident.cityId,
    district_id: resident.districtId,
    village_id: resident.villageId,
    rw_id: resident.rwId,
    rt_id: resident.rtId,
    updated_at: new Date().toISOString(),
  })
}

function mapMutation(row: MutationRow): ResidentMutation {
  return {
    id: row.id,
    residentId: row.resident_id ?? undefined,
    residentName: row.resident_name,
    gender: row.gender,
    mutationType: row.mutation_type,
    mutationDate: row.mutation_date,
    note: row.note ?? undefined,
    residentStatus: row.resident_status,
    provinceId: row.province_id ?? undefined,
    cityId: row.city_id ?? undefined,
    districtId: row.district_id ?? undefined,
    villageId: row.village_id ?? undefined,
    rwId: row.rw_id ?? undefined,
    rtId: row.rt_id ?? undefined,
    createdAt: row.created_at ?? undefined,
  }
}

function mutationPayload(mutation: Omit<ResidentMutation, 'id'>) {
  return clean({
    resident_id: mutation.residentId,
    resident_name: mutation.residentName,
    gender: mutation.gender,
    mutation_type: mutation.mutationType,
    mutation_date: mutation.mutationDate,
    note: mutation.note,
    resident_status: mutation.residentStatus,
    province_id: mutation.provinceId,
    city_id: mutation.cityId,
    district_id: mutation.districtId,
    village_id: mutation.villageId,
    rw_id: mutation.rwId,
    rt_id: mutation.rtId,
  })
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*, master_roles(code)').eq('id', userId).single()
  assertNoError(error)
  return mapProfile(data as ProfileRow)
}

export async function listRoles() {
  const { data, error } = await supabase.from('master_roles').select('*').order('sort_order')
  assertNoError(error)
  return (data as RoleRow[]).map(mapRole)
}

export async function listProfiles() {
  const { data, error } = await supabase.from('profiles').select('*, master_roles(code)').order('display_name')
  assertNoError(error)
  return (data as ProfileRow[]).map(mapProfile)
}

async function invokeManagedUser(body: Record<string, unknown>) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  assertNoError(sessionError)
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Sesi login tidak tersedia. Silakan login ulang.')

  const { data, error } = await supabase.functions.invoke('create-user', {
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })
  if (error) {
    let message = error.message
    const response = (error as { context?: Response }).context
    if (response) {
      try {
        const payload = await response.clone().json() as { message?: string }
        message = payload.message || message
      } catch {
        // Gunakan pesan bawaan client jika response bukan JSON.
      }
    }
    throw new Error(message)
  }
  if (!data?.id) throw new Error(data?.message ?? 'Gagal memproses pengguna.')
  return String(data.id)
}

async function managedUserPayload(profile: Omit<UserProfile, 'uid' | 'roleId'>) {
  const { data: role, error } = await supabase
    .from('master_roles')
    .select('id')
    .eq('code', profile.role)
    .single()
  assertNoError(error)
  return {
    email: profile.email,
    displayName: profile.displayName,
    roleId: role?.id,
    provinceId: profile.provinceId,
    cityId: profile.cityId,
    districtId: profile.districtId,
    villageId: profile.villageId,
    rwId: profile.rwId,
    rtId: profile.rtId,
  }
}

export async function createManagedUser(profile: Omit<UserProfile, 'uid' | 'roleId'>, password: string) {
  return invokeManagedUser({ action: 'create', ...(await managedUserPayload(profile)), password })
}

export async function updateManagedUser(
  uid: string,
  profile: Omit<UserProfile, 'uid' | 'roleId'>,
  password?: string,
) {
  return invokeManagedUser({ action: 'update', uid, ...(await managedUserPayload(profile)), password: password || undefined })
}

export async function deleteManagedUser(uid: string) {
  return invokeManagedUser({ action: 'delete', uid })
}

export async function listRegions(profile: UserProfile | null = null) {
  const tables = [
    'master_provinces',
    'master_cities',
    'master_districts',
    'master_villages',
    'master_rws',
    'master_rts',
  ] as const
  const responses = await Promise.all(tables.map((table) => {
    let request = supabase.from(table).select('*').order('name')
    if (table === 'master_rws' && profile?.role !== 'superadmin' && profile?.rwId) {
      request = request.eq('id', profile.rwId)
    }
    if (table === 'master_rts' && profile?.role !== 'superadmin') {
      if (['ketua_rw', 'staff_rw'].includes(profile?.role ?? '') && profile?.rwId) {
        request = request.eq('rw_id', profile.rwId)
      } else if (profile?.rtId) {
        request = request.eq('id', profile.rtId)
      }
    }
    return request
  }))
  responses.forEach(({ error }) => assertNoError(error))
  const [provinceRows = [], cityRows = [], districtRows = [], villageRows = [], rwRows = [], rtRows = []] = responses.map(
    ({ data }) => (data ?? []) as MasterRegionRow[],
  )
  const provinces = provinceRows.map((row) => toRegion(row, 'province', undefined, { provinceId: row.id }))
  const cities = cityRows.map((row) =>
    toRegion(row, 'city', row.province_id, { provinceId: row.province_id, cityId: row.id }),
  )
  const cityById = new Map(cities.map((row) => [row.id, row]))
  const districts = districtRows.map((row) => {
    const city = cityById.get(row.city_id ?? '')
    return toRegion(row, 'district', row.city_id, {
      provinceId: city?.provinceId,
      cityId: row.city_id,
      districtId: row.id,
    })
  })
  const districtById = new Map(districts.map((row) => [row.id, row]))
  const villages = villageRows.map((row) => {
    const district = districtById.get(row.district_id ?? '')
    return toRegion(row, 'village', row.district_id, {
      provinceId: district?.provinceId,
      cityId: district?.cityId,
      districtId: row.district_id,
      villageId: row.id,
    })
  })
  const villageById = new Map(villages.map((row) => [row.id, row]))
  const rws = rwRows.map((row) => {
    const village = villageById.get(row.village_id ?? '')
    return toRegion(row, 'rw', row.village_id, {
      provinceId: village?.provinceId,
      cityId: village?.cityId,
      districtId: village?.districtId,
      villageId: row.village_id,
      rwId: row.id,
    })
  })
  const rwById = new Map(rws.map((row) => [row.id, row]))
  const rts = rtRows.map((row) => {
    const rw = rwById.get(row.rw_id ?? '')
    return toRegion(row, 'rt', row.rw_id, {
      provinceId: rw?.provinceId,
      cityId: rw?.cityId,
      districtId: rw?.districtId,
      villageId: rw?.villageId,
      rwId: row.rw_id,
      rtId: row.id,
    })
  })
  const regions = [...provinces, ...cities, ...districts, ...villages, ...rws, ...rts]
  if (!profile || profile.role === 'superadmin' || !profile.rwId) return regions

  const scopedRw = rws.find((row) => row.id === profile.rwId)
  const lineageIds = new Set([
    scopedRw?.provinceId,
    scopedRw?.cityId,
    scopedRw?.districtId,
    scopedRw?.villageId,
    profile.rwId,
  ].filter((id): id is string => Boolean(id)))

  return regions.filter((region) => lineageIds.has(region.id) || region.rwId === profile.rwId)
}

export async function saveRegion(region: Omit<Region, 'id'>, id?: string) {
  const targetId = id || crypto.randomUUID()
  const config = regionTableConfig(region.type, region.parentId)
  const payload = clean({
    id: targetId,
    name: region.name,
    code: region.code,
    [config.parentKey]: config.parentId,
    updated_at: new Date().toISOString(),
  })
  const request = id
    ? supabase.from(config.table).update(payload).eq('id', id)
    : supabase.from(config.table).insert(payload)
  const { error } = await request
  assertNoError(error)
  return targetId
}

export async function deleteRegion(region: Pick<Region, 'id' | 'type'>) {
  const { table } = regionTableConfig(region.type)
  const { error } = await supabase.from(table).delete().eq('id', region.id)
  assertNoError(error)
}

function toRegion(
  row: MasterRegionRow,
  type: Region['type'],
  parentId?: string,
  scope: Partial<Region> = {},
): Region {
  return {
    id: row.id,
    type,
    name: row.name,
    code: row.code ?? undefined,
    parentId,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    ...scope,
  }
}

function regionTableConfig(type: Region['type'], parentId?: string) {
  const config = {
    province: { table: 'master_provinces', parentKey: 'province_id' },
    city: { table: 'master_cities', parentKey: 'province_id' },
    district: { table: 'master_districts', parentKey: 'city_id' },
    village: { table: 'master_villages', parentKey: 'district_id' },
    rw: { table: 'master_rws', parentKey: 'village_id' },
    rt: { table: 'master_rts', parentKey: 'rw_id' },
  }[type]
  return { ...config, parentId }
}

export async function listPermissions() {
  const { data, error } = await supabase.from('master_permissions').select('*').order('sort_order')
  assertNoError(error)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    code: row.code as PermissionCode,
    module: String(row.module),
    label: String(row.label),
    description: String(row.description),
    sortOrder: Number(row.sort_order),
  })) as Permission[]
}

export async function listRolePermissions() {
  const { data, error } = await supabase.from('role_permissions').select('*')
  assertNoError(error)
  return (data ?? []).map((row) => ({
    roleId: String(row.role_id),
    permissionId: String(row.permission_id),
    allowed: Boolean(row.allowed),
  })) as RolePermission[]
}

export async function listUserPermissions(userId?: string) {
  let request = supabase.from('user_permissions').select('*')
  if (userId) request = request.eq('user_id', userId)
  const { data, error } = await request
  assertNoError(error)
  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    permissionId: String(row.permission_id),
    allowed: Boolean(row.allowed),
  })) as UserPermission[]
}

export async function saveRolePermission(roleId: string, permissionId: string, allowed: boolean) {
  const { error } = await supabase
    .from('role_permissions')
    .upsert(
      {
        role_id: roleId,
        permission_id: permissionId,
        allowed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'role_id,permission_id' },
    )
  assertNoError(error)
}

export async function saveUserPermission(
  userId: string,
  permissionId: string,
  allowed: boolean | null,
) {
  const request = allowed === null
    ? supabase.from('user_permissions').delete().eq('user_id', userId).eq('permission_id', permissionId)
    : supabase.from('user_permissions').upsert(
        {
          user_id: userId,
          permission_id: permissionId,
          allowed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,permission_id' },
      )
  const { error } = await request
  assertNoError(error)
}

export async function listFamilyCards(profile: UserProfile | null, rtId?: string, rwId?: string, search?: string) {
  let request = supabase.from('family_cards').select('*, residents(nik)').order('head_name')
  if (profile && ['ketua_rw', 'staff_rw'].includes(profile.role) && profile.rwId) {
    request = request.eq('rw_id', profile.rwId)
  }
  if (profile && ['ketua_rt', 'staff_rt'].includes(profile.role) && profile.rtId) {
    request = request.eq('rt_id', profile.rtId)
  }
  if (rtId) request = request.eq('rt_id', rtId)
  if (rwId) request = request.eq('rw_id', rwId)
  if (search?.trim()) request = request.ilike('kk_number', `%${search.trim()}%`)
  const { data, error } = await request
  assertNoError(error)
  return (data as FamilyCardRow[]).map(mapFamilyCard)
}

export async function listResidentsByFamilyCard(familyCardId: string) {
  const { data, error } = await supabase
    .from('residents')
    .select('*')
    .eq('family_card_id', familyCardId)
    .order('family_relationship')
    .order('full_name')
  assertNoError(error)
  return (data as ResidentRow[]).map(mapResident)
}

export type FamilyHeadInput = {
  kkNumber: string
  headNik: string
  headName: string
  address: string
  gender: Resident['gender']
  birthPlace: string
  birthDate: string
  religion: string
  maritalStatus: string
  registeredAt?: string
  provinceId?: string
  cityId?: string
  districtId?: string
  villageId?: string
  rwId?: string
  rtId?: string
}

export async function createFamilyCardWithHead(input: FamilyHeadInput) {
  assertSixteenDigits(input.kkNumber, 'Nomor KK')
  assertSixteenDigits(input.headNik, 'NIK kepala keluarga')
  const { data, error } = await supabase.rpc('create_family_card_with_head', {
    p_kk_number: input.kkNumber,
    p_head_nik: input.headNik,
    p_head_name: input.headName,
    p_address: input.address,
    p_gender: input.gender,
    p_birth_place: input.birthPlace,
    p_birth_date: input.birthDate,
    p_religion: input.religion,
    p_marital_status: input.maritalStatus,
    p_registered_at: input.registeredAt || null,
    p_province_id: input.provinceId || null,
    p_city_id: input.cityId || null,
    p_district_id: input.districtId || null,
    p_village_id: input.villageId || null,
    p_rw_id: input.rwId || null,
    p_rt_id: input.rtId || null,
  })
  assertNoError(error)
  return String(data)
}

export async function saveFamilyCard(card: Omit<FamilyCard, 'id'>, id?: string) {
  assertSixteenDigits(card.kkNumber, 'Nomor KK')
  const payload = familyCardPayload(card)
  const request = id
    ? supabase.from('family_cards').update(payload).eq('id', id)
    : supabase.from('family_cards').insert(payload)
  const { data, error } = await request.select('id').single()
  assertNoError(error)
  return id || String(data?.id)
}

export async function updateFamilyCard(card: Omit<FamilyCard, 'id'>, id: string) {
  const cardId = await saveFamilyCard(card, id)
  const residentScope = clean({
    kk_number: card.kkNumber,
    address: card.address,
    province_id: card.provinceId,
    city_id: card.cityId,
    district_id: card.districtId,
    village_id: card.villageId,
    rw_id: card.rwId,
    rt_id: card.rtId,
    updated_at: new Date().toISOString(),
  })
  const { error: residentsError } = await supabase.from('residents').update(residentScope).eq('family_card_id', id)
  assertNoError(residentsError)
  const { error: headError } = await supabase
    .from('residents')
    .update({ full_name: card.headName, updated_at: new Date().toISOString() })
    .eq('family_card_id', id)
    .eq('family_relationship', 'Kepala Keluarga')
  assertNoError(headError)
  return cardId
}

export async function deleteFamilyCard(id: string) {
  const { error } = await supabase.from('family_cards').delete().eq('id', id)
  assertNoError(error)
}

export async function listResidents(profile: UserProfile | null, rtId?: string, rwId?: string, search?: string) {
  let request = supabase.from('residents').select('*').order('full_name')
  if (profile && ['ketua_rw', 'staff_rw'].includes(profile.role) && profile.rwId) {
    request = request.eq('rw_id', profile.rwId)
  }
  if (profile && ['ketua_rt', 'staff_rt'].includes(profile.role) && profile.rtId) {
    request = request.eq('rt_id', profile.rtId)
  }
  if (rtId) request = request.eq('rt_id', rtId)
  if (rwId) request = request.eq('rw_id', rwId)
  if (search?.trim()) {
    const term = search.trim().replace(/,/g, '')
    request = request.or(`nik.ilike.%${term}%,full_name.ilike.%${term}%,kk_number.ilike.%${term}%`)
  }
  const { data, error } = await request
  assertNoError(error)
  return (data as ResidentRow[]).map(mapResident)
}

export async function saveResident(resident: Omit<Resident, 'id'>, id?: string) {
  assertSixteenDigits(resident.kkNumber, 'Nomor KK')
  assertSixteenDigits(resident.nik, 'NIK')
  const payload = residentPayload(resident)
  const request = id
    ? supabase.from('residents').update(payload).eq('id', id)
    : supabase.from('residents').insert(payload)
  const { data, error } = await request.select('id').single()
  assertNoError(error)
  return id || String(data?.id)
}

export async function deleteResident(id: string) {
  const { error } = await supabase.from('residents').delete().eq('id', id)
  assertNoError(error)
}

export async function listMutations(profile: UserProfile | null, rtId?: string) {
  let request = supabase.from('resident_mutations').select('*').order('mutation_date', { ascending: false })
  if (profile && ['ketua_rw', 'staff_rw'].includes(profile.role) && profile.rwId) {
    request = request.eq('rw_id', profile.rwId)
  }
  if (profile && ['ketua_rt', 'staff_rt'].includes(profile.role) && profile.rtId) {
    request = request.eq('rt_id', profile.rtId)
  }
  if (rtId) request = request.eq('rt_id', rtId)
  const { data, error } = await request
  assertNoError(error)
  return (data as MutationRow[]).map(mapMutation)
}

export async function saveMutation(mutation: Omit<ResidentMutation, 'id'>) {
  const { data, error } = await supabase
    .from('resident_mutations')
    .insert(mutationPayload(mutation))
    .select('id')
    .single()
  assertNoError(error)
  return String(data?.id)
}

export async function saveReportExport(payload: Record<string, unknown>) {
  const { error } = await supabase.from('report_exports').insert(
    clean({
      kind: payload.kind,
      month: payload.month,
      year: payload.year,
      rw_id: payload.rwId,
      rt_id: payload.rtId,
      total_residents: payload.totalResidents,
    }),
  )
  assertNoError(error)
}
