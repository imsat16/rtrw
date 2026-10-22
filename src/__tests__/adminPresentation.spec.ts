import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import ResidentsView from '@/views/ResidentsView.vue'
import DashboardView from '@/views/DashboardView.vue'
import type { FamilyCard, Region, Resident } from '@/types/domain'
import { listFamilyCards, listRegions, listResidents, listResidentsPage } from '@/services/data'

const { auth, importJob } = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    profile: { uid: 'fixture-user', displayName: 'Petugas Contoh', role: 'ketua_rw', rwId: 'rw1' },
    roleLabel: 'Ketua RW',
    hasPermission: vi.fn<(permission: string) => boolean>().mockReturnValue(true),
    initialize: vi.fn<() => Promise<void>>().mockResolvedValue(),
    logout: vi.fn<() => Promise<void>>().mockResolvedValue(),
  },
  importJob: { busy: false, visible: false, completionVersion: 0, dismiss: vi.fn<() => void>() },
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/familyImport', () => ({ useFamilyImportStore: () => importJob }))
vi.mock('@/services/data', () => ({
  listFamilyCards: vi.fn<typeof import('@/services/data').listFamilyCards>(),
  listRegions: vi.fn<typeof import('@/services/data').listRegions>(),
  listResidents: vi.fn<typeof import('@/services/data').listResidents>(),
  listResidentsPage: vi.fn<typeof import('@/services/data').listResidentsPage>(),
  listMutations: vi.fn<typeof import('@/services/data').listMutations>().mockResolvedValue([]),
  saveResident: vi.fn<typeof import('@/services/data').saveResident>(),
  deleteResident: vi.fn<typeof import('@/services/data').deleteResident>(),
  saveMutation: vi.fn<typeof import('@/services/data').saveMutation>(),
}))

const residents = [
  {
    id: 'one',
    fullName: 'Ahmad Contoh',
    nik: 'NIK-1',
    familyCardId: 'kk1',
    gender: 'L',
    residentStatus: 'tetap',
    birthDate: '2000-01-01',
    hasKtp: true,
  },
  {
    id: 'two',
    fullName: 'Budi Contoh',
    nik: 'NIK-2',
    familyCardId: 'kk1',
    gender: 'L',
    residentStatus: 'sementara',
    birthDate: '2001-01-01',
    hasKtp: false,
  },
] as Resident[]

beforeEach(() => {
  vi.clearAllMocks()
  auth.hasPermission.mockReturnValue(true)
  vi.mocked(listResidents).mockResolvedValue(residents)
  vi.mocked(listResidentsPage).mockImplementation(async (_profile, query) => ({
    items: query.sortDirection === 'desc' ? [...residents].reverse() : [...residents],
    total: 42,
  }))
  vi.mocked(listFamilyCards).mockResolvedValue([
    { id: 'kk1', kkNumber: 'KK-1', headName: 'Ahmad Contoh' },
  ] as FamilyCard[])
  vi.mocked(listRegions).mockResolvedValue([{ id: 'rw1', name: '01', type: 'rw' }] as Region[])
})

const options = { global: { stubs: { teleport: true, AppIcon: true, BaseChart: true } } }

describe('admin presentation keeps the existing interactions', () => {
  it('keeps debounced server search and sorting with the new presentation and dialogs', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ResidentsView, options)
    try {
      await flushPromises()
      expect(wrapper.findAll('.residents-table-wrap tbody tr')).toHaveLength(2)
      expect(wrapper.get('.table-heading .badge').text()).toBe('42 warga')
      expect(listResidents).not.toHaveBeenCalled()
      await wrapper.get('#residentSearch').setValue('Ahmad')
      await vi.advanceTimersByTimeAsync(349)
      expect(listResidentsPage).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await flushPromises()
      expect(listResidentsPage).toHaveBeenLastCalledWith(
        auth.profile,
        expect.objectContaining({ page: 1, pageSize: 10, rwId: 'rw1', search: 'Ahmad' }),
      )
      const nameSort = wrapper
        .findAll('.sort-button')
        .find((button) => button.text().startsWith('Nama'))!
      await nameSort.trigger('click')
      await flushPromises()
      expect(listResidentsPage).toHaveBeenLastCalledWith(
        auth.profile,
        expect.objectContaining({ sortKey: 'fullName', sortDirection: 'desc' }),
      )
      expect(wrapper.findAll('.resident-name strong').map((name) => name.text())).toEqual([
        'Budi Contoh',
        'Ahmad Contoh',
      ])
      await wrapper.findAll('[aria-label="Lihat detail"]')[0]!.trigger('click')
      expect(wrapper.find('[role="dialog"]').text()).toContain('Budi Contoh')
      await wrapper.get('[role="dialog"] [aria-label="Tutup"]').trigger('click')
      await wrapper.findAll('[aria-label="Edit warga"]')[0]!.trigger('click')
      expect((wrapper.get('#fullName').element as HTMLInputElement).value).toBe('Budi Contoh')
      expect((wrapper.get('#hasKtp').element as HTMLSelectElement).value).toBe('false')
      await wrapper.get('[role="dialog"] [aria-label="Tutup"]').trigger('click')
      await wrapper.get('[aria-label="Tambah Warga"]').trigger('click')
      expect((wrapper.get('#fullName').element as HTMLInputElement).value).toBe('')
      expect(wrapper.findAll('.form-section-label')).toHaveLength(3)
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('preserves read-only permissions on residents actions', async () => {
    auth.hasPermission.mockImplementation((permission) => permission !== 'families.manage')
    const wrapper = mount(ResidentsView, options)
    await flushPromises()
    expect(wrapper.find('[aria-label="Tambah Warga"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Edit warga"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Hapus warga"]').exists()).toBe(false)
    expect(wrapper.findAll('[aria-label="Lihat detail"]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('retains dashboard stats and current-month document ownership in the LAMPID table', async () => {
    const wrapper = mount(DashboardView, {
      ...options,
      global: { ...options.global, stubs: { ...options.global.stubs, RouterLink: true } },
    })
    await flushPromises()
    expect(wrapper.findAll('.stat-card')).toHaveLength(6)
    const rows = wrapper.findAll('.chart-card--lampid tbody tr')
    expect(rows).toHaveLength(6)
    expect(rows[0]!.text()).toContain('—')
    expect(rows[5]!.findAll('td')[8]!.text()).toBe('1')
    expect(wrapper.get('.chart-card--lampid').text()).toContain('KTP')
    wrapper.unmount()
  })

  it('keeps mobile navigation, role display and the existing logout handler', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/data-warga', component: { template: '<div />' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
        ...[
          '/wilayah',
          '/pengguna',
          '/rbac',
          '/kartu-keluarga',
          '/export',
          '/pengaturan',
          '/panduan',
        ].map((path) => ({ path, component: { template: '<div />' } })),
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, {
      global: { plugins: [router], stubs: { AppIcon: true, FamilyImportProgress: true } },
    })
    expect(wrapper.get('.user-chip').text()).toContain('Ketua RW')
    await wrapper.get('[aria-label="Buka menu"]').trigger('click')
    expect(wrapper.find('.mobile-drawer-backdrop--open').exists()).toBe(true)
    await wrapper.get('.mobile-drawer a[href="/data-warga"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/data-warga')
    expect(wrapper.find('.mobile-drawer-backdrop--open').exists()).toBe(false)
    await wrapper.get('.profile-panel button').trigger('click')
    await flushPromises()
    expect(auth.logout).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.path).toBe('/login')
    wrapper.unmount()
  })
})
