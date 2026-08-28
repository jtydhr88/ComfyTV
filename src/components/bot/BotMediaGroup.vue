<template>
  <div class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
    <template v-for="(ref, i) in refs" :key="`${ref.url}-${i}`">
      <a
        v-if="ref.kind === 'image'"
        :href="ref.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          :src="ref.url"
          loading="lazy"
          class="ctv:h-28 ctv:max-w-56 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:object-cover"
        >
      </a>
      <video
        v-else-if="ref.kind === 'video'"
        :src="ref.url"
        controls
        preload="metadata"
        class="ctv:max-h-48 ctv:max-w-full ctv:rounded-lg ctv:border ctv:border-border-subtle"
      />
      <audio
        v-else
        :src="ref.url"
        controls
        preload="metadata"
        class="ctv:h-9 ctv:w-full ctv:max-w-72"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { MediaRef } from '@/utils/markdownSegments'

defineProps<{ refs: MediaRef[] }>()
</script>
