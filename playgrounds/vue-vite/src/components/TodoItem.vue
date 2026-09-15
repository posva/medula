<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ label: string }>()
const done = defineModel<boolean>('done', { required: true })
const highlighted = ref(false)
</script>

<template>
  <li
    :class="{ done, highlighted }"
    @pointerenter="highlighted = true"
    @pointerleave="highlighted = false"
  >
    <label><input type="checkbox" v-model="done" /> {{ label }}</label>
    <slot />
  </li>
</template>
