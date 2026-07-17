<script setup lang="ts">
import AppModal from '@/components/AppModal.vue'

defineProps<{ open: boolean; title: string; rows: Array<{ label: string; value: unknown }> }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <AppModal :open="open" :title="title" @close="$emit('close')">
    <dl class="detail-list">
      <template v-for="row in rows" :key="row.label">
        <dt>{{ row.label }}</dt><dd>{{ row.value || '-' }}</dd>
      </template>
    </dl>
  </AppModal>
</template>
