<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useFamilyImportStore } from '@/stores/familyImport'

const job = useFamilyImportStore()
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!job.busy) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
</script>

<template>
  <aside v-if="job.visible" class="import-progress" aria-label="Progres impor Excel">
    <header>
      <strong role="status">{{ job.busy ? 'Mengimpor Kartu Keluarga' : job.hasErrors ? 'Impor selesai dengan kendala' : 'Impor berhasil' }}</strong>
      <button type="button" class="modal-close" :aria-label="job.minimized ? 'Perluas progres impor' : 'Minimalkan progres impor'"
        :aria-expanded="!job.minimized" @click="job.minimized = !job.minimized">{{ job.minimized ? '+' : '−' }}</button>
      <button v-if="!job.busy" type="button" class="modal-close" aria-label="Tutup hasil impor" @click="job.dismiss">×</button>
    </header>
    <div v-if="!job.minimized" class="import-progress-body">
      <p class="import-file">{{ job.fileName }}</p>
      <template v-if="job.busy">
        <progress :value="job.total ? job.processed : undefined" :max="job.total || 1" aria-label="Progres penyimpanan KK" />
        <p role="status">{{ job.total ? `${job.processed} dari ${job.total} KK diproses` : 'Membaca dan memeriksa file...' }}</p>
        <p class="muted">Anda boleh berpindah halaman. Tetap buka tab ini sampai impor selesai.</p>
      </template>
      <template v-else-if="job.result">
        <p :class="job.hasErrors ? 'alert' : 'success'">{{ job.result.successFamilies }} dari {{ job.result.totalFamilies }} KK berhasil diimpor.</p>
        <p v-if="job.result.failedFamilies">{{ job.result.failedFamilies }} KK gagal atau dilewati.</p>
        <details v-if="job.result.errors.length">
          <summary>Lihat {{ job.result.errors.length }} kendala</summary>
          <ul>
            <li v-for="(error, index) in job.result.errors" :key="index"><template v-if="error.row">Baris {{ error.row }}: </template>{{ error.message }}</li>
          </ul>
        </details>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.import-progress { position: fixed; right: 20px; bottom: 20px; z-index: 80; width: min(400px, calc(100vw - 32px)); background: white; border: 1px solid #d7e0e5; border-radius: 12px; box-shadow: 0 8px 32px #0f172a26; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
header strong { flex: 1; }
.import-progress-body { padding: 0 16px 16px; max-height: 55vh; overflow: auto; }
.import-progress-body p { margin: 8px 0; }
.import-file, li { overflow-wrap: anywhere; }
.import-file { font-size: 0.85rem; color: #64748b; }
progress { width: 100%; accent-color: #0f766e; }
summary { cursor: pointer; }
ul { padding-left: 20px; }
li + li { margin-top: 8px; }
@media (max-width: 600px) { .import-progress { right: 16px; bottom: 16px; } }
</style>
