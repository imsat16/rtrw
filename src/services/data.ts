import { supabase } from '@/lib/supabase'
import type { FamilyCard, Region, Resident, ResidentMutation, UserProfile } from '@/types/domain'

type RegionRow = {
  id: string
  type: Region['type']
  name: string
  code: string | null
  parent_id: string | null
  province_id: string | null
  city_id: string | null
  district_id: string | null
  village_id: string | null
  rw_id: string | null
  rt_id: string | null
  created_at: string | null
  updated_at: string | null
}

type ProfileRow = {
  id: string
  email: string
  display_name: string
  role: UserProfile['role']
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

function clean<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''))
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    provinceId: row.province_id ?? undefined,
    cityId: row.city_id ?? undefined,
    districtId: row.district_id ?? undefined,
    villageId: row.village_id ?? undefined,
    rwId: row.rw_id ?? undefined,
    rtId: row.rt_id ?? undefined,
  }
}

function mapRegion(row: RegionRow): Region {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    code: row.code ?? undefined,
    parentId: row.parent_id ?? undefined,
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

function regionPayload(region: Omit<Region, 'id'>, id: string) {
  return clean({
    id,
    type: region.type,
    name: region.name,
    code: region.code,
    parent_id: region.parentId,
    province_id: region.type === 'province' ? id : region.provinceId,
    city_id: region.type === 'city' ? id : region.cityId,
    district_id: region.type === 'district' ? id : region.districtId,
    village_id: region.type === 'village' ? id : region.villageId,
    rw_id: region.type === 'rw' ? id : region.rwId,
    rt_id: region.type === 'rt' ? id : region.rtId,
    updated_at: new Date().toISOString(),
  })
}

function mapFamilyCard(row: FamilyCardRow): FamilyCard {
  return {
    id: row.id,
    kkNumber: row.kk_number,
    headName: row.head_name,
    address: row.address,
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
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  assertNoError(error)
  return mapProfile(data as ProfileRow)
}

export async function listRegions() {
  const { data, error } = await supabase.from('regions').select('*').order('type').order('name')
  assertNoError(error)
  return (data as RegionRow[]).map(mapRegion)
}

export async function saveRegion(region: Omit<Region, 'id'>, id?: string) {
  const targetId = id || crypto.randomUUID()
  const payload = regionPayload(region, targetId)

  const request = id
    ? supabase.from('regions').update(payload).eq('id', id)
    : supabase.from('regions').insert(payload)
  const { error } = await request
  assertNoError(error)
  return targetId
}

export async function deleteRegion(id: string) {
  const { error } = await supabase.from('regions').delete().eq('id', id)
  assertNoError(error)
}

export async function listFamilyCards(profile: UserProfile | null) {
  let request = supabase.from('family_cards').select('*').order('head_name')
  if (profile?.role === 'rw' && profile.rwId) request = request.eq('rw_id', profile.rwId)
  if (profile?.role === 'rt' && profile.rtId) request = request.eq('rt_id', profile.rtId)
  const { data, error } = await request
  assertNoError(error)
  return (data as FamilyCardRow[]).map(mapFamilyCard)
}

export async function saveFamilyCard(card: Omit<FamilyCard, 'id'>, id?: string) {
  const payload = familyCardPayload(card)
  const request = id
    ? supabase.from('family_cards').update(payload).eq('id', id)
    : supabase.from('family_cards').insert(payload)
  const { data, error } = await request.select('id').single()
  assertNoError(error)
  return id || String(data?.id)
}

export async function listResidents(profile: UserProfile | null) {
  let request = supabase.from('residents').select('*').order('full_name')
  if (profile?.role === 'rw' && profile.rwId) request = request.eq('rw_id', profile.rwId)
  if (profile?.role === 'rt' && profile.rtId) request = request.eq('rt_id', profile.rtId)
  const { data, error } = await request
  assertNoError(error)
  return (data as ResidentRow[]).map(mapResident)
}

export async function saveResident(resident: Omit<Resident, 'id'>, id?: string) {
  const payload = residentPayload(resident)
  const request = id
    ? supabase.from('residents').update(payload).eq('id', id)
    : supabase.from('residents').insert(payload)
  const { data, error } = await request.select('id').single()
  assertNoError(error)
  return id || String(data?.id)
}

export async function listMutations(profile: UserProfile | null) {
  let request = supabase.from('resident_mutations').select('*').order('mutation_date', { ascending: false })
  if (profile?.role === 'rw' && profile.rwId) request = request.eq('rw_id', profile.rwId)
  if (profile?.role === 'rt' && profile.rtId) request = request.eq('rt_id', profile.rtId)
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
