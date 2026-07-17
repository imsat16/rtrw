<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import type { ChartData, ChartOptions, ChartType } from 'chart.js'

const props = defineProps<{
  type: ChartType
  data: ChartData<any>
  options?: ChartOptions<any>
  label: string
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

async function renderChart() {
  await nextTick()
  if (!canvas.value) return
  chart?.destroy()
  chart = new Chart(canvas.value, {
    type: props.type,
    data: props.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 9 } },
        tooltip: { intersect: false },
      },
      ...props.options,
    },
  })
}

watch(() => [props.type, props.data, props.options], renderChart, { deep: true })
onMounted(renderChart)
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="chart-canvas"><canvas ref="canvas" role="img" :aria-label="label" /></div>
</template>
