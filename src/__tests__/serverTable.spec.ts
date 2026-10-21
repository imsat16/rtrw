import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useServerTable } from '@/composables/useServerTable'
import type { TablePage, TablePageOptions } from '@/services/data'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn())
  vi.useRealTimers()
})
function setup(
  read = vi.fn(
    async (_options: TablePageOptions): Promise<TablePage<string>> => ({
      items: ['row'],
      total: 81,
    }),
  ),
) {
  const filters = reactive({ search: '', rwId: '', rtId: '' })
  let table!: ReturnType<typeof useServerTable<string>>
  const wrapper = mount(
    defineComponent({
      setup() {
        table = useServerTable(read, () => ({ ...filters }), 'fullName')
        return () => null
      },
    }),
  )
  cleanup.push(() => wrapper.unmount())
  return { table, filters, read, wrapper }
}

describe('server table paging and search', () => {
  it('loads each page with the selected limit and resets to page 1 when limit or sort changes', async () => {
    const { table, read } = setup()
    await table.reload()
    table.page.value = 3
    await flushPromises()
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 10 }))
    table.pageSize.value = 25
    await flushPromises()
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 25 }))
    table.toggleSort('nik')
    await flushPromises()
    expect(read).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortKey: 'nik', sortDirection: 'asc' }),
    )
  })

  it('waits 350 ms after the last keystroke and resets the page for search and region filters', async () => {
    vi.useFakeTimers()
    const { table, read, filters } = setup()
    await table.reload()
    table.page.value = 2
    await flushPromises()
    read.mockClear()
    filters.search = 'Ra'
    await nextTick()
    await vi.advanceTimersByTimeAsync(200)
    filters.search = 'Ratna'
    await nextTick()
    await vi.advanceTimersByTimeAsync(349)
    expect(read).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ page: 1, search: 'Ratna' }),
    )
    filters.rwId = 'rw-07'
    await flushPromises()
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ rwId: 'rw-07', page: 1 }))
  })

  it('ignores old responses during debounce and after a newer request has completed', async () => {
    vi.useFakeTimers()
    let resolveOld!: (value: TablePage<string>) => void
    const read = vi
      .fn(async (_options: TablePageOptions) => ({ items: ['new'], total: 1 }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          }),
      )
    const { table, filters } = setup(read)
    const old = table.reload()
    filters.search = 'new'
    await nextTick()
    resolveOld({ items: ['old'], total: 100 })
    await old
    expect(table.items.value).toEqual([])
    await vi.advanceTimersByTimeAsync(350)
    expect(table.items.value).toEqual(['new'])
    expect(table.totalItems.value).toBe(1)
  })

  it('corrects the page after deletion and provides a retry after errors', async () => {
    const { table, read } = setup()
    await table.reload()
    read.mockResolvedValue({ items: [], total: 10 })
    table.page.value = 9
    await flushPromises()
    expect(table.page.value).toBe(1)
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    read.mockRejectedValueOnce(new Error('offline'))
    await table.reload()
    expect(table.error.value).toBe('offline')
    expect(table.items.value).toEqual([])
    await table.reload()
    expect(table.error.value).toBe('')
  })

  it('clears pending debounce on unmount', async () => {
    vi.useFakeTimers()
    const { table, filters, wrapper, read } = setup()
    await table.reload()
    filters.search = 'pending'
    await nextTick()
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(400)
    expect(read).toHaveBeenCalledTimes(1)
  })
})
