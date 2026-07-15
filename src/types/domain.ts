export type UserRole = 'superadmin' | 'rw' | 'rt'
export type RegionType = 'province' | 'city' | 'district' | 'village' | 'rw' | 'rt'
export type Gender = 'L' | 'P'
export type ResidentStatus = 'tetap' | 'sementara'
export type MutationType = 'lahir' | 'mati' | 'pindah' | 'datang'

export interface Role {
  id: UserRole
  label: string
}

export interface Region {
  id: string
  type: RegionType
  name: string
  code?: string
  parentId?: string
  provinceId?: string
  cityId?: string
  districtId?: string
  villageId?: string
  rwId?: string
  rtId?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  provinceId?: string
  cityId?: string
  districtId?: string
  villageId?: string
  rwId?: string
  rtId?: string
}

export interface FamilyCard {
  id: string
  kkNumber: string
  headName: string
  address: string
  provinceId?: string
  cityId?: string
  districtId?: string
  villageId?: string
  rwId?: string
  rtId?: string
  registeredAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface Resident {
  id: string
  familyCardId: string
  kkNumber: string
  nik: string
  fullName: string
  gender: Gender
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
  address: string
  staySince?: string
  movedOutAt?: string
  residentStatus: ResidentStatus
  provinceId?: string
  cityId?: string
  districtId?: string
  villageId?: string
  rwId?: string
  rtId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ResidentMutation {
  id: string
  residentId?: string
  residentName: string
  gender: Gender
  mutationType: MutationType
  mutationDate: string
  note?: string
  residentStatus: ResidentStatus
  provinceId?: string
  cityId?: string
  districtId?: string
  villageId?: string
  rwId?: string
  rtId?: string
  createdAt?: string
}

export interface ReportPeriod {
  month: number
  year: number
}

export interface DashboardStats {
  familyCards: number
  residents: number
  male: number
  female: number
  permanent: number
  temporary: number
  lahir: number
  mati: number
  pindah: number
  datang: number
}
