<template>
  <div
    class="ctv-asset-card ctv:relative ctv:flex ctv:flex-col ctv:gap-2 ctv:overflow-hidden ctv:rounded-lg ctv:p-2
           ctv:cursor-grab ctv:select-none ctv:transition-colors ctv:duration-200
           ctv:hover:bg-secondary-background-hover/60"
    draggable="true"
  >
    <div class="ctv:relative ctv:aspect-square ctv:overflow-hidden ctv:rounded-lg ctv:bg-secondary-background">
      <video
        v-if="asset.media_type === 'video'"
        :src="asset.payload_url"
        :title="tooltip"
        muted
        playsinline
        preload="metadata"
        class="ctv-asset-thumb ctv:absolute ctv:inset-0 ctv:size-full ctv:object-cover ctv:bg-black"
        @mouseenter="hoverPlay"
        @mouseleave="hoverPause"
      />
      <div
        v-else-if="asset.media_type === 'audio'"
        :title="tooltip"
        class="ctv:absolute ctv:inset-0 ctv:flex ctv:items-center ctv:justify-center ctv:text-muted-foreground"
      >
        <IconVolume2 class="ctv:size-8" />
      </div>
      <div
        v-else-if="asset.media_type === 'model'"
        :title="tooltip"
        class="ctv:absolute ctv:inset-0"
      >
        <ModelThumb :src="asset.payload_url" :alt="asset.name">
          <IconBox class="ctv:size-8" />
        </ModelThumb>
      </div>
      <img
        v-else
        :src="asset.payload_url"
        :alt="asset.name"
        :title="tooltip"
        loading="lazy"
        class="ctv-asset-thumb ctv:absolute ctv:inset-0 ctv:size-full ctv:object-cover"
      />

      <span
        v-if="asset.media_type === 'video' || asset.media_type === 'audio'"
        class="ctv:absolute ctv:bottom-1.5 ctv:left-1.5 ctv:flex ctv:items-center ctv:justify-center ctv:size-5 ctv:rounded
               ctv:bg-black/65 ctv:text-white/90 ctv:pointer-events-none"
      >
        <IconPlay v-if="asset.media_type === 'video'" class="ctv:size-3" />
        <IconVolume2 v-else class="ctv:size-3" />
      </span>

      <div class="ctv-asset-actions ctv:absolute ctv:top-2 ctv:left-2 ctv:flex ctv:gap-1">
        <button
          class="ctv:flex ctv:size-6 ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none
                 ctv:rounded-md ctv:border-none ctv:shadow-sm ctv:bg-white/90 ctv:text-black/80 ctv:hover:bg-white"
          :title="$t('assets.card.more')"
          @click.stop="emit('open-menu', $event)"
        >
          <IconEllipsis class="ctv:size-4" />
        </button>
        <button
          v-if="asset.media_type === 'image'"
          class="ctv:flex ctv:size-6 ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none
                 ctv:rounded-md ctv:border-none ctv:shadow-sm ctv:bg-white/90 ctv:text-black/80 ctv:hover:bg-white"
          :title="$t('stage.action.viewFull')"
          @click.stop="emit('view-full')"
        >
          <IconMaximize class="ctv:size-4" />
        </button>
      </div>
    </div>

    <div class="ctv:flex ctv:min-w-0 ctv:flex-col ctv:gap-1">
      <span
        class="ctv:line-clamp-2 ctv:break-all ctv:text-xs ctv:leading-tight ctv:text-base-foreground"
        :title="tooltip"
      >{{ asset.name || '—' }}</span>
      <div v-if="meta" class="ctv:text-2xs ctv:leading-none ctv:text-muted-foreground">{{ meta }}</div>
      <div v-if="categoryNames.length" class="ctv:flex ctv:flex-wrap ctv:gap-0.5">
        <span
          v-for="name in categoryNames"
          :key="name"
          class="ctv:max-w-full ctv:truncate ctv:py-0 ctv:px-1 ctv:rounded ctv:text-3xs ctv:bg-base-foreground/10 ctv:text-muted-foreground"
        >{{ name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconBox from '~icons/lucide/box'
import IconEllipsis from '~icons/lucide/ellipsis'
import IconMaximize from '~icons/lucide/maximize-2'
import IconPlay from '~icons/lucide/play'
import IconVolume2 from '~icons/lucide/volume-2'

import type { Asset } from '@/api/schemas'
import ModelThumb from '@/components/widgets/ModelThumb.vue'

defineProps<{
  asset: Asset
  meta: string
  categoryNames: string[]
  tooltip: string
}>()

const emit = defineEmits<{
  'open-menu': [e: MouseEvent]
  'view-full': []
}>()

function hoverPlay(e: MouseEvent) {
  void (e.currentTarget as HTMLVideoElement).play().catch(() => {})
}
function hoverPause(e: MouseEvent) {
  const v = e.currentTarget as HTMLVideoElement
  v.pause()
  v.currentTime = 0
}
</script>

<style scoped>
.ctv-asset-thumb {
  transition: transform 0.2s ease;
}
.ctv-asset-card:hover .ctv-asset-thumb {
  transform: scale(1.05);
}

.ctv-asset-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.ctv-asset-card:hover .ctv-asset-actions,
.ctv-asset-card:focus-within .ctv-asset-actions {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none), (pointer: coarse) {
  .ctv-asset-actions {
    opacity: 1;
    pointer-events: auto;
  }
  .ctv-asset-card:hover .ctv-asset-thumb {
    transform: none;
  }
}
</style>
