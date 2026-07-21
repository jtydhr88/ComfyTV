<template>
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs">
    <button
      type="button"
      class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:h-6 ctv:rounded ctv:cursor-pointer
             ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
             ctv:hover:border-primary-background ctv:disabled:opacity-40 ctv:disabled:cursor-default"
      :disabled="!enabled || preview.state.loading"
      @click="preview.request()"
    >
      <i :class="['pi', preview.state.loading ? 'pi-spinner pi-spin' : 'pi-eye']" />
      {{ $t('fxPreview.run') }}
    </button>
    <span v-if="preview.state.error" class="ctv:text-destructive-background ctv:truncate">
      {{ $t('fxPreview.failed') }}
    </span>
    <span v-else-if="preview.state.stale" class="ctv:text-warning-background">
      {{ $t('fxPreview.stale') }}
    </span>
    <span v-else-if="preview.state.url" class="ctv:text-muted-foreground">
      {{ $t('fxPreview.window', { s: windowLabel }) }}
    </span>
  </div>

  <div v-if="preview.state.url" class="ctv:h-40 ctv:flex ctv:flex-col">
    <VideoPlayerLite :source-video-url="preview.state.url" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import type { useFxClipPreview } from '@/composables/stages/useFxClipPreview'

const props = defineProps<{
  preview: ReturnType<typeof useFxClipPreview>
  enabled: boolean
}>()

const windowLabel = computed(() =>
  (props.preview.state.t1 - props.preview.state.t0).toFixed(1))
</script>
