<script setup lang="ts">
import { Icon } from '@iconify/vue'
import './uiIcons'

defineProps<{ icon: string }>()
</script>

<template>
  <Icon :icon="icon" aria-hidden="true" />
</template>
