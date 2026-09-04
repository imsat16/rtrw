<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
}>(), { size: 'medium', loading: false })

const emit = defineEmits<{ close: [] }>()

function close() {
  if (props.loading) return
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @mousedown.self="close">
      <section :class="['modal-card', `modal-card--${size}`]" role="dialog" aria-modal="true" :aria-label="title">
        <header class="modal-header">
          <h2>{{ title }}</h2>
          <button class="modal-close" type="button" aria-label="Tutup" :disabled="loading" @click="close">×</button>
        </header>
        <div class="modal-body"><slot /></div>
        <output v-if="loading" class="modal-loading-overlay" aria-live="polite">
          <span class="modal-spinner" />
        </output>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-loading-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(255 255 255 / 70%);
  border-radius: inherit;
}

.modal-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #cbd5e1;
  border-top-color: #0f766e;
  border-radius: 50%;
  animation: modal-spin 0.8s linear infinite;
}

@keyframes modal-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
