<template>
  <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="ctv:flex-1 ctv:min-w-12 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors ctv:whitespace-nowrap"
      :class="modelValue === opt.value
        ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
        : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
      :title="opt.title ?? opt.label"
      @click="$emit('update:modelValue', opt.value)"
    >{{ opt.label }}</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  options: { value: string; label: string; title?: string }[]
}>()
defineEmits<{ 'update:modelValue': [v: string] }>()
</script>
