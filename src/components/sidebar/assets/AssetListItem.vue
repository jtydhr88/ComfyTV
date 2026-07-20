<template>
  <div
    class="ctv-asset-row ctv:relative ctv:flex ctv:items-center ctv:gap-2 ctv:overflow-hidden ctv:rounded-lg ctv:p-2
           ctv:cursor-grab ctv:select-none ctv:transition-colors ctv:duration-200
           ctv:hover:bg-secondary-background-hover/60"
    draggable="true"
  >
    <div
      class="ctv:relative ctv:flex ctv:size-8 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:overflow-hidden
             ctv:rounded-sm ctv:bg-secondary-background"
    >
      <ProxiedVideo
        v-if="asset.media_type === 'video'"
        :src="asset.payload_url"
        muted
        playsinline
        preload="metadata"
        class="ctv:size-full ctv:object-cover ctv:pointer-events-none"
      />
      <IconVolume2
        v-else-if="asset.media_type === 'audio'"
        class="ctv:size-4 ctv:text-muted-foreground"
      />
      <ModelThumb
        v-else-if="asset.media_type === 'model'"
        :src="asset.payload_url"
        :alt="asset.name"
      >
        <IconBox class="ctv:size-4" />
      </ModelThumb>
      <img
        v-else
        :src="asset.payload_url"
        :alt="asset.name"
        loading="lazy"
        class="ctv:size-full ctv:object-cover"
      />
    </div>

    <div class="ctv:flex ctv:min-w-0 ctv:flex-1 ctv:flex-col ctv:gap-1">
      <span
        class="ctv:block ctv:truncate ctv:text-xs ctv:leading-none ctv:text-base-foreground"
        :title="tooltip"
      >{{ asset.name || '—' }}</span>
      <span
        v-if="secondary"
        class="ctv:block ctv:truncate ctv:text-xs ctv:leading-none ctv:text-muted-foreground"
        :title="secondary"
      >{{ secondary }}</span>
    </div>

    <div class="ctv-asset-actions ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1">
      <button
        v-if="asset.media_type === 'image'"
        class="ctv:flex ctv:size-6 ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none
               ctv:rounded-md ctv:border-none ctv:bg-secondary-background ctv:text-base-foreground
               ctv:hover:bg-secondary-background-hover"
        :title="$t('stage.action.viewFull')"
        @click.stop="emit('view-full')"
      >
        <IconMaximize class="ctv:size-4" />
      </button>
      <button
        class="ctv:flex ctv:size-6 ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none
               ctv:rounded-md ctv:border-none ctv:bg-secondary-background ctv:text-base-foreground
               ctv:hover:bg-secondary-background-hover"
        :title="$t('assets.card.more')"
        @click.stop="emit('open-menu', $event)"
      >
        <IconEllipsis class="ctv:size-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import IconBox from '~icons/lucide/box'
import ProxiedVideo from '@/components/widgets/ProxiedVideo.vue'
import IconEllipsis from '~icons/lucide/ellipsis'
import IconMaximize from '~icons/lucide/maximize-2'
import IconVolume2 from '~icons/lucide/volume-2'

import type { Asset } from '@/api/schemas'
import ModelThumb from '@/components/widgets/ModelThumb.vue'

const props = defineProps<{
  asset: Asset
  meta: string
  categoryNames: string[]
  tooltip: string
}>()

const emit = defineEmits<{
  'open-menu': [e: MouseEvent]
  'view-full': []
}>()

const secondary = computed(() =>
  [props.meta, props.categoryNames.join(', ')].filter(Boolean).join(' · '),
)
</script>

<style scoped>
.ctv-asset-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.ctv-asset-row:hover .ctv-asset-actions,
.ctv-asset-row:focus-within .ctv-asset-actions {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none), (pointer: coarse) {
  .ctv-asset-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
