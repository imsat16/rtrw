import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useFamilyImportStore } from '@/stores/familyImport'
import FamilyImportProgress from '@/components/FamilyImportProgress.vue'
import { buildFamilyGroups, parseFamilyImportWorkbook, readWorkbookFromFile, runFamilyImport } from '@/services/familyImport'
import type { FamilyImportResult } from '@/services/familyImport'

vi.mock('@/services/familyImport', () => ({
  buildFamilyGroups: vi.fn(), parseFamilyImportWorkbook: vi.fn(),
  readWorkbookFromFile: vi.fn(), runFamilyImport: vi.fn(),
}))

const file = new File(['test'], 'families.xlsx')
const successful: FamilyImportResult = { totalFamilies: 1, successFamilies: 1, failedFamilies: 0, errors: [] }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(parseFamilyImportWorkbook).mockReturnValue({ rows: [], parseErrors: [] })
  vi.mocked(buildFamilyGroups).mockReturnValue({ groups: [{}] as ReturnType<typeof buildFamilyGroups>['groups'], errors: [], totalKkCount: 1 })
  vi.mocked(runFamilyImport).mockResolvedValue(successful)
})

describe('background family import', () => {
  it('survives the initiating view unmounting and prevents duplicate starts', async () => {
    let complete!: (value: FamilyImportResult) => void
    vi.mocked(runFamilyImport).mockImplementation((_groups, progress) => {
      progress?.(0, 1)
      return new Promise(resolve => { complete = resolve })
    })
    const view = mount(defineComponent({ setup: () => ({ job: useFamilyImportStore() }), template: '<div />' }))
    const job = useFamilyImportStore()
    const pending = job.start(file, [], null)
    await flushPromises()
    view.unmount()
    await job.start(file, [], null)
    expect(runFamilyImport).toHaveBeenCalledTimes(1)
    expect(job.busy).toBe(true)
    job.dismiss()
    expect(job.visible).toBe(true)
    complete(successful)
    await pending
    expect(job.busy).toBe(false)
    expect(job.result?.successFamilies).toBe(1)
    expect(job.completionVersion).toBe(1)
    job.dismiss()
    expect(job.visible).toBe(false)
  })

  it('retains validation errors even when valid families are imported', async () => {
    vi.mocked(parseFamilyImportWorkbook).mockReturnValue({ rows: [], parseErrors: [{ row: 4, message: 'Data contoh' }] })
    const job = useFamilyImportStore()
    await job.start(file, [], null)
    expect(job.result?.successFamilies).toBe(1)
    expect(job.hasErrors).toBe(true)
    expect(job.result?.errors[0]?.row).toBe(4)
  })

  it('does not write invalid groups and reports file reading failures', async () => {
    vi.mocked(buildFamilyGroups).mockReturnValue({ groups: [], errors: [{ row: 2, message: 'RW tidak ditemukan' }], totalKkCount: 1 })
    const job = useFamilyImportStore()
    await job.start(file, [], null)
    expect(runFamilyImport).not.toHaveBeenCalled()
    expect(job.result?.failedFamilies).toBe(1)
    vi.mocked(readWorkbookFromFile).mockRejectedValue(new Error('File rusak'))
    await job.start(file, [], null)
    expect(job.busy).toBe(false)
    expect(job.hasErrors).toBe(true)
    expect(job.result?.errors[0]?.message).toBe('File rusak')
  })

  it('minimizes without stopping, warns on reload, and exposes completion errors', async () => {
    const job = useFamilyImportStore()
    const panel = mount(FamilyImportProgress)
    job.visible = true
    job.busy = true
    job.total = 2
    job.processed = 1
    await flushPromises()
    expect(panel.text()).toContain('1 dari 2 KK diproses')
    await panel.get('[aria-label="Minimalkan progres impor"]').trigger('click')
    expect(job.minimized).toBe(true)
    expect(job.busy).toBe(true)
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    job.busy = false
    job.minimized = false
    job.result = { ...successful, errors: [{ row: 3, message: 'NIK duplikat' }] }
    await flushPromises()
    expect(panel.text()).toContain('Impor selesai dengan kendala')
    expect(panel.text()).toContain('Baris 3: NIK duplikat')
    const finishedEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(finishedEvent)
    expect(finishedEvent.defaultPrevented).toBe(false)
    await panel.get('[aria-label="Tutup hasil impor"]').trigger('click')
    expect(job.visible).toBe(false)
    panel.unmount()
  })
})
