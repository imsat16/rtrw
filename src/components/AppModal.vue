<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  size?: 'small' | 'medium' | 'large'
}>(), { size: 'medium' })

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @mousedown.self="emit('close')">
      <section :class="['modal-card', `modal-card--${size}`]" role="dialog" aria-modal="true" :aria-label="title">
        <header class="modal-header">
          <h2>{{ title }}</h2>
          <button class="modal-close" type="button" aria-label="Tutup" @click="emit('close')">×</button>
        </header>
        <div class="modal-body"><slot /></div>
      </section>
    </div>
  </Teleport>
</template>
