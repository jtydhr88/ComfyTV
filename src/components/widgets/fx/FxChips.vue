<template>
  <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="ctv:flex-1 ctv:min-w-fit ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors ctv:whitespace-nowrap"
      :class="modelValue === opt.value
        ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
        : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
      :title="opt.title ?? opt.label"
      @click="$emit('update:modelValue', opt.value)"
    ><span v-if="opt.icon" class="ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1 ctv:align-middle">
      <component :is="opt.icon" class="ctv:size-3 ctv:shrink-0" />
      <span>{{ opt.label }}</span>
    </span><span
      v-else-if="opt.image"
      class="ctv:inline-block ctv:align-middle ctv:bg-current"
      :style="{ maskImage: `url(${opt.image})`, maskSize: '100% 100%' }"
    ><img :src="opt.image" :alt="opt.label" class="ctv:block ctv:h-[1.6em] ctv:w-auto ctv:opacity-0"></span><template v-else>{{ opt.label }}</template></button>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  modelValue: string
  options: { value: string; label: string; title?: string; icon?: Component; image?: string }[]
}>()
defineEmits<{ 'update:modelValue': [v: string] }>()
</script>
