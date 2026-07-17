<script setup lang="ts">
defineProps<{ page: number; pageSize: number; totalItems: number; totalPages: number }>()
const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()
</script>

<template>
  <div class="table-pagination">
    <label>
      Tampilkan
      <select :value="pageSize" @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))">
        <option :value="10">10</option><option :value="25">25</option><option :value="50">50</option>
      </select>
      data
    </label>
    <span>{{ totalItems }} data · Halaman {{ page }} dari {{ totalPages }}</span>
    <div class="table-actions">
      <button class="secondary-button" type="button" :disabled="page <= 1" @click="emit('update:page', page - 1)">Sebelumnya</button>
      <button class="secondary-button" type="button" :disabled="page >= totalPages" @click="emit('update:page', page + 1)">Berikutnya</button>
    </div>
  </div>
</template>
