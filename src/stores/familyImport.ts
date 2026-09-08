import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { FamilyImportResult } from '@/services/familyImport'
import type { Region, UserProfile } from '@/types/domain'

export const useFamilyImportStore = defineStore('familyImport', () => {
  const busy = ref(false)
  const visible = ref(false)
  const minimized = ref(false)
  const fileName = ref('')
  const processed = ref(0)
  const total = ref(0)
  const result = ref<FamilyImportResult | null>(null)
  const completionVersion = ref(0)
  const hasErrors = computed(() => Boolean(result.value?.errors.length || result.value?.failedFamilies))

  async function start(file: File, regions: Region[], profile: UserProfile | null) {
    if (busy.value) return
    busy.value = true
    visible.value = true
    minimized.value = false
    fileName.value = file.name
    processed.value = 0
    total.value = 0
    result.value = null
    try {
      const { buildFamilyGroups, parseFamilyImportWorkbook, readWorkbookFromFile, runFamilyImport } = await import('@/services/familyImport')
      const workbook = await readWorkbookFromFile(file)
      const { rows, parseErrors } = parseFamilyImportWorkbook(workbook)
      const { groups, errors, totalKkCount } = buildFamilyGroups(rows, regions, profile)
      total.value = groups.length
      const imported = groups.length
        ? await runFamilyImport(groups, (count, size) => {
            processed.value = count
            total.value = size
          })
        : { successFamilies: 0, changedFamilies: 0, errors: [] }
      result.value = {
        totalFamilies: totalKkCount,
        successFamilies: imported.successFamilies,
        changedFamilies: imported.changedFamilies,
        failedFamilies: totalKkCount - imported.successFamilies,
        errors: [...parseErrors, ...errors, ...imported.errors].sort((a, b) => a.row - b.row),
      }
    } catch (error) {
      result.value = {
        totalFamilies: total.value,
        successFamilies: 0,
        failedFamilies: total.value,
        errors: [{ row: 0, message: error instanceof Error ? error.message : 'Gagal memproses file.' }],
      }
    } finally {
      busy.value = false
      minimized.value = false
      completionVersion.value++
    }
  }

  function dismiss() {
    if (!busy.value) visible.value = false
  }

  return { busy, visible, minimized, fileName, processed, total, result, hasErrors, completionVersion, start, dismiss }
})
