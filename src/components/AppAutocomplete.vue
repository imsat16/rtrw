<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

export type AutocompleteItem = {
  value: string
  label: string
  keywords?: string[]
  description?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  items: AutocompleteItem[]
  inputId?: string
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  required?: boolean
}>(), {
  inputId: undefined,
  placeholder: 'Ketik untuk mencari',
  emptyText: 'Data tidak ditemukan',
  disabled: false,
  required: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const input = ref<HTMLInputElement | null>(null)
const inputText = ref('')
const open = ref(false)
const activeIndex = ref(0)

const selectedItem = computed(() => props.items.find((item) => item.value === props.modelValue))
const normalizedInput = computed(() => inputText.value.trim().toLocaleLowerCase('id'))
const filteredItems = computed(() => {
  const term = normalizedInput.value
  if (!term || inputText.value === selectedItem.value?.label) return props.items
  return props.items.filter((item) => [item.label, ...(item.keywords ?? [])]
    .some((value) => value.toLocaleLowerCase('id').includes(term)))
})

watch([selectedItem, () => props.items], () => {
  if (!open.value) inputText.value = selectedItem.value?.label ?? ''
}, { immediate: true })

function handleFocus() {
  if (props.disabled) return
  open.value = true
  activeIndex.value = 0
  if (selectedItem.value) void nextTick(() => input.value?.select())
}

function handleInput(event: Event) {
  inputText.value = (event.target as HTMLInputElement).value
  if (inputText.value !== selectedItem.value?.label) emit('update:modelValue', '')
  open.value = true
  activeIndex.value = 0
}

function syncValidity() {
  input.value?.setCustomValidity(props.required && !props.modelValue ? 'Pilih salah satu data yang tersedia.' : '')
}

function selectItem(item: AutocompleteItem) {
  emit('update:modelValue', item.value)
  inputText.value = item.label
  open.value = false
  void nextTick(syncValidity)
}

function handleBlur() {
  window.setTimeout(() => {
    open.value = false
    inputText.value = selectedItem.value?.label ?? ''
  }, 120)
}

async function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    open.value = true
    activeIndex.value = Math.min(activeIndex.value + 1, filteredItems.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter' && open.value) {
    const item = filteredItems.value[activeIndex.value]
    if (!item) return
    event.preventDefault()
    selectItem(item)
  } else if (event.key === 'Escape') {
    open.value = false
    inputText.value = selectedItem.value?.label ?? ''
    await nextTick()
    input.value?.blur()
  }
}


watch(() => props.modelValue, () => void nextTick(syncValidity), { immediate: true })
</script>

<template>
  <div class="autocomplete">
    <input
      :id="inputId"
      ref="input"
      :value="inputText"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      @focus="handleFocus"
      @input="handleInput"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
    <div v-if="open" class="autocomplete-menu" role="listbox">
      <button
        v-for="(item, index) in filteredItems"
        :key="item.value"
        :class="['autocomplete-option', { active: index === activeIndex, selected: item.value === modelValue }]"
        type="button"
        role="option"
        :aria-selected="item.value === modelValue"
        @mouseenter="activeIndex = index"
        @mousedown.prevent="selectItem(item)"
      >
        <strong>{{ item.label }}</strong>
        <small v-if="item.description">{{ item.description }}</small>
      </button>
      <p v-if="filteredItems.length === 0" class="autocomplete-empty">{{ emptyText }}</p>
    </div>
  </div>
</template>
