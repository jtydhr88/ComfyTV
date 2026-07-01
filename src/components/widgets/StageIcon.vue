<script setup lang="ts">
import { computed, type Component } from 'vue'
import IconScissors from '~icons/lucide/scissors'
import IconCrop from '~icons/lucide/crop'
import IconPaintBucket from '~icons/lucide/paint-bucket'

const LUCIDE: Record<string, Component> = {
  scissors: IconScissors,
  crop: IconCrop,
  'paint-bucket': IconPaintBucket,
}

const props = defineProps<{ name: string }>()

const isLucide = computed(() => props.name.startsWith('lucide:'))
const lucideComp = computed(() => LUCIDE[props.name.slice('lucide:'.length)] ?? null)
</script>

<template>
  <component :is="lucideComp" v-if="isLucide && lucideComp" />
  <i v-else :class="name" />
</template>
