import { computed, ref, watch, type Ref } from 'vue'

export type SortDirection = 'asc' | 'desc'
export type SortAccessors<T> = Record<string, (item: T) => unknown>

export function useClientTable<T>(source: Ref<T[]>, initialSort: string, accessors: SortAccessors<T> = {}) {
  const page = ref(1)
  const pageSize = ref(10)
  const sortKey = ref(initialSort)
  const sortDirection = ref<SortDirection>('asc')

  function valueFor(item: T, key: string) {
    return accessors[key]?.(item) ?? (item as Record<string, unknown>)[key]
  }

  const sortedItems = computed(() => [...source.value].sort((left, right) => {
    const leftValue = valueFor(left, sortKey.value)
    const rightValue = valueFor(right, sortKey.value)
    if (leftValue == null) return rightValue == null ? 0 : 1
    if (rightValue == null) return -1
    const result = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), 'id', { numeric: true, sensitivity: 'base' })
    return sortDirection.value === 'asc' ? result : -result
  }))

  const totalPages = computed(() => Math.max(1, Math.ceil(sortedItems.value.length / pageSize.value)))
  const paginatedItems = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return sortedItems.value.slice(start, start + pageSize.value)
  })

  function toggleSort(key: string) {
    if (sortKey.value === key) sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    else {
      sortKey.value = key
      sortDirection.value = 'asc'
    }
    page.value = 1
  }

  function sortIndicator(key: string) {
    if (sortKey.value !== key) return '↕'
    return sortDirection.value === 'asc' ? '↑' : '↓'
  }

  watch([() => source.value.length, pageSize, totalPages], () => {
    if (page.value > totalPages.value) page.value = totalPages.value
    if (page.value < 1) page.value = 1
  })

  return { page, pageSize, sortKey, sortDirection, totalPages, paginatedItems, toggleSort, sortIndicator }
}
