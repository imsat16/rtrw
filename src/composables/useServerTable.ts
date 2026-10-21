import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { TablePage, TablePageOptions } from '@/services/data'

export function useServerTable<T>(
  read: (options: TablePageOptions) => Promise<TablePage<T>>,
  filters: () => { search: string; rwId: string; rtId: string },
  initialSort: string,
) {
  const items = shallowRef<T[]>([])
  const totalItems = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const sortKey = ref(initialSort)
  const sortDirection = ref<'asc' | 'desc'>('asc')
  const loading = ref(false)
  const error = ref('')
  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))
  let timer: ReturnType<typeof setTimeout> | undefined
  let version = 0
  let active = false
  let disposed = false

  const query = computed(() => ({
    ...filters(),
    page: page.value,
    pageSize: pageSize.value,
    sortKey: sortKey.value,
    sortDirection: sortDirection.value,
  }))

  async function reload() {
    if (disposed) return
    active = true
    clearTimeout(timer)
    const current = ++version
    const options = { ...query.value }
    loading.value = true
    error.value = ''
    items.value = []
    try {
      const result = await read(options)
      if (current !== version) return
      totalItems.value = result.total
      if (page.value > totalPages.value) {
        page.value = totalPages.value
        return
      }
      items.value = result.items
    } catch (err) {
      if (current !== version) return
      error.value = err instanceof Error ? err.message : 'Data gagal dimuat. Silakan coba lagi.'
    } finally {
      if (current === version) loading.value = false
    }
  }

  watch(
    [filters, pageSize, sortKey, sortDirection],
    () => {
      page.value = 1
    },
    { deep: true, flush: 'sync' },
  )
  watch(query, (next, previous) => {
    if (!active) return
    ++version // An older response must not replace the new search, even during debounce.
    clearTimeout(timer)
    loading.value = true
    error.value = ''
    items.value = []
    if (next.search !== previous.search) timer = setTimeout(() => void reload(), 350)
    else void reload()
  })

  function toggleSort(key: string) {
    if (sortKey.value === key) sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    else {
      sortKey.value = key
      sortDirection.value = 'asc'
    }
  }

  function sortIndicator(key: string) {
    return sortKey.value !== key ? '↕' : sortDirection.value === 'asc' ? '↑' : '↓'
  }

  onBeforeUnmount(() => {
    disposed = true
    ++version
    clearTimeout(timer)
  })
  return {
    items,
    totalItems,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    reload,
    toggleSort,
    sortIndicator,
  }
}
