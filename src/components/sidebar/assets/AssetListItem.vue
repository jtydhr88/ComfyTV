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
      <ThumbImg
        v-if="asset.media_type === 'video'"
        :src="asset.payload_url"
        :thumb-max="THUMB_TILE"
        :alt="asset.name"
        loading="lazy"
        class="ctv:size-full ctv:object-cover ctv:pointer-events-none"
      />
      <button
        v-else-if="asset.media_type === 'audio'"
        type="button"
        class="ctv:flex ctv:size-full ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none
               ctv:border-none ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground"
        :title="audioPlaying ? $t('assets.card.pausePreview') : $t('assets.card.playPreview')"
        @click.stop="toggleAudio(asset.payload_url)"
        @pointerdown.stop
      >
        <IconPause v-if="audioPlaying" class="ctv:size-4" />
        <IconPlay v-else class="ctv:size-4" />
      </button>
      <ModelThumb
        v-else-if="asset.media_type === 'model'"
        :src="asset.payload_url"
        :alt="asset.name"
      >
        <IconBox class="ctv:size-4" />
      </ModelThumb>
      <div
        v-else-if="asset.media_type === 'text'"
        class="ctv:flex ctv:size-full ctv:items-center ctv:justify-center ctv:text-muted-foreground"
      >
        <IconFileText class="ctv:size-4" />
      </div>
      <ThumbImg
        v-else
        :src="assetPreviewUrl(asset)"
        :thumb-max="THUMB_TILE"
        :alt="asset.name"
        loading="lazy"
        class="ctv:size-full ctv:object-cover"
      />
    </div>

    <div class="ctv:flex ctv:min-w-0 ctv:flex-1 ctv:flex-col ctv:gap-1">
      <span class="ctv:flex ctv:min-w-0 ctv:items-center ctv:gap-1">
        <span
          class="ctv:block ctv:truncate ctv:text-xs ctv:leading-none ctv:text-base-foreground"
          :title="tooltip"
        >{{ asset.name || '—' }}</span>
        <span
          v-if="asset.file_missing"
          class="ctv:shrink-0 ctv:px-1 ctv:py-px ctv:rounded-sm ctv:text-3xs ctv:font-semibold
                 ctv:bg-destructive-background ctv:text-white"
          :title="$t('assets.card.fileMissingHint')"
        >{{ $t('assets.card.fileMissing') }}</span>
      </span>
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
import { assetPreviewUrl } from '@/utils/assetMedia'
import { THUMB_TILE } from '@/utils/thumbUrl'
import IconEllipsis from '~icons/lucide/ellipsis'
import IconFileText from '~icons/lucide/file-text'
import IconMaximize from '~icons/lucide/maximize-2'
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'

import type { Asset } from '@/api/schemas'
import ModelThumb from '@/components/widgets/ModelThumb.vue'
import ThumbImg from '@/components/widgets/ThumbImg.vue'
import { useAudioPreview } from '@/composables/sidebar/useAudioPreview'

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

const { playingUrl, toggle: toggleAudio } = useAudioPreview()
const audioPlaying = computed(() => playingUrl.value === props.asset.payload_url)
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
