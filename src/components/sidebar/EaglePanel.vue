<template>
  <div class="ctv:relative ctv:flex ctv:flex-col ctv:size-full ctv:box-border ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('eagle.title') }}</span>
      <span
        class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground"
        :title="statusTooltip"
      >
        <span class="ctv:size-2 ctv:rounded-full" :class="modeDotClass" />
        {{ $t(`eagle.mode.${mode}`) }}
      </span>
      <button :class="iconBtnClass" :title="$t('eagle.refresh')" @click="refresh(true)">
        <IconRefreshCw class="ctv:size-4" :class="loading && 'ctv:animate-spin'" />
      </button>
    </div>

    <div v-if="!enabled" class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-3">
      <div class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60 ctv:leading-relaxed">
        {{ $t('eagle.disabledHint') }}
      </div>
    </div>

    <template v-else>
      <div
        v-if="pendingCount > 0"
        class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:my-1.5 ctv:mx-2.5 ctv:py-1.5 ctv:px-2 ctv:rounded
               ctv:bg-amber-500/10 ctv:border ctv:border-amber-500/40 ctv:text-amber-500"
      >
        <span class="ctv:flex-1">{{ $t('eagle.pendingBanner', { n: pendingCount }) }}</span>
        <button :class="chipBtnClass" :disabled="flushing || mode !== 'api'" @click="flush">
          {{ flushing ? $t('eagle.flushing') : $t('eagle.flushNow') }}
        </button>
      </div>
      <div
        v-else-if="mode !== 'api'"
        class="ctv:shrink-0 ctv:my-1.5 ctv:mx-2.5 ctv:py-1.5 ctv:px-2 ctv:rounded ctv:leading-relaxed
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-muted-foreground"
      >
        {{ $t(`eagle.hint.${mode}`) }}
      </div>

      <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2.5 ctv:border-b ctv:border-border-subtle">
        <div class="ctv:relative ctv:flex-1 ctv:min-w-0">
          <IconSearch
            class="ctv:absolute ctv:left-2 ctv:top-1/2 ctv:-translate-y-1/2 ctv:size-3.5
                   ctv:text-muted-foreground ctv:pointer-events-none"
          />
          <input
            v-model="keyword"
            type="text"
            :placeholder="$t('eagle.search')"
            class="ctv:w-full ctv:h-7 ctv:box-border ctv:pl-7 ctv:pr-2 ctv:rounded-lg ctv:text-xs ctv:[font-family:inherit]
                   ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
                   ctv:placeholder:text-muted-foreground ctv:focus-visible:outline-none ctv:focus:border-border-default"
          />
        </div>
        <button
          v-if="aiReady"
          :class="chipClass(aiMode)"
          :title="$t('eagle.ai.tooltip')"
          @click="aiMode = !aiMode"
        >
          <IconSparkles class="ctv:size-3" />
          {{ $t('eagle.ai.label') }}
        </button>
        <select
          v-model="folder"
          class="ctv:h-7 ctv:max-w-32 ctv:box-border ctv:px-1.5 ctv:rounded-lg ctv:text-xs ctv:[font-family:inherit]
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
                 ctv:focus-visible:outline-none"
        >
          <option value="">{{ $t('eagle.folder.all') }}</option>
          <option v-for="f in folders" :key="f.id" :value="f.id">
            {{ `${' '.repeat(f.depth * 2)}${f.name}` }}
          </option>
        </select>
      </div>

      <div
        v-if="similarTo"
        class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:my-1.5 ctv:mx-2.5 ctv:py-1 ctv:px-2 ctv:rounded
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-muted-foreground"
      >
        <IconSparkles class="ctv:size-3.5 ctv:shrink-0" />
        <span class="ctv:flex-1 ctv:truncate">
          {{ $t('eagle.similar.banner', { name: similarTo.name }) }}
        </span>
        <button :class="chipBtnClass" @click="clearSimilar">
          {{ $t('eagle.similar.clear') }}
        </button>
      </div>

      <div class="ctv:shrink-0 ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1 ctv:py-1.5 ctv:px-2.5 ctv:border-b ctv:border-border-subtle">
        <button
          v-for="m in MEDIA_FILTERS"
          :key="m || 'all'"
          :class="chipClass(mediaType === m)"
          @click="mediaType = m"
        >
          {{ m ? $t(`assets.media.${m}`) : $t('assets.media.all') }}
        </button>
      </div>

      <div v-if="error"
           class="ctv:shrink-0 ctv:my-1.5 ctv:mx-2.5 ctv:py-1.5 ctv:px-2 ctv:text-xs ctv:rounded ctv:break-all
                  ctv:bg-destructive-background/15 ctv:border ctv:border-destructive-background/50 ctv:text-destructive-background">
        {{ error }}
      </div>

      <div v-if="items.length === 0" class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-1.5">
        <div class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
          {{ loading ? $t('eagle.loading') : $t('eagle.empty') }}
        </div>
      </div>

      <VirtualGrid
        v-else
        :items="virtualItems"
        :grid-style="gridStyle"
        :default-item-height="150"
        class="ctv:flex-1 ctv:min-h-0 ctv:p-1.5"
      >
        <template #item="{ item }">
          <div
            class="ctv:group ctv:relative ctv:flex ctv:flex-col ctv:overflow-hidden ctv:rounded-lg
                   ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:cursor-pointer"
            :title="itemTooltip(item.eagleItem)"
            :draggable="mediaKind(item.eagleItem) !== null"
            @dragstart="onCardDragStart(item.eagleItem, $event)"
            @click="onCardClick(item.eagleItem)"
            @mouseenter="hoverId = item.eagleItem.id"
            @mouseleave="hoverId = null"
          >
            <video
              v-if="mediaKind(item.eagleItem) === 'video'
                && (hoverId === item.eagleItem.id || pinnedVideoId === item.eagleItem.id)"
              :src="eagleFileUrl(item.eagleItem.id)"
              autoplay
              muted
              loop
              playsinline
              class="ctv:w-full ctv:h-24 ctv:object-cover ctv:bg-black"
              @canplay="hoverAutoplay"
            />
            <div
              v-else-if="mediaKind(item.eagleItem) === 'audio'"
              class="ctv:flex ctv:w-full ctv:h-24 ctv:items-center ctv:justify-center ctv:bg-black/20"
            >
              <button
                :class="overlayBtnClass"
                class="ctv:!size-10 ctv:!rounded-full"
                :title="audioPlaying(item.eagleItem)
                  ? $t('assets.card.pausePreview') : $t('assets.card.playPreview')"
                @click.stop="toggleAudio(eagleFileUrl(item.eagleItem.id))"
              >
                <IconPause v-if="audioPlaying(item.eagleItem)" class="ctv:size-5" />
                <IconPlay v-else class="ctv:size-5 ctv:ml-0.5" />
              </button>
            </div>
            <img
              v-else
              :src="eagleThumbUrl(item.eagleItem.id)"
              loading="lazy"
              class="ctv:w-full ctv:h-24 ctv:object-cover ctv:bg-black/20"
              @error="($event.target as HTMLImageElement).style.opacity = '0.15'"
            />
            <span
              class="ctv:absolute ctv:top-1 ctv:left-1 ctv:px-1 ctv:rounded ctv:text-3xs ctv:uppercase
                     ctv:bg-black/50 ctv:text-white/80"
            >{{ item.eagleItem.ext }}</span>
            <span
              v-if="mediaKind(item.eagleItem) === 'video'"
              class="ctv:absolute ctv:bottom-6 ctv:left-1 ctv:flex ctv:items-center ctv:justify-center ctv:size-5 ctv:rounded
                     ctv:bg-black/65 ctv:text-white/90 ctv:pointer-events-none"
            >
              <IconPlay class="ctv:size-3" />
            </span>
            <div class="ctv:px-1.5 ctv:py-1 ctv:truncate ctv:text-2xs">{{ item.eagleItem.name }}</div>
            <div
              class="ctv:absolute ctv:top-1 ctv:right-1 ctv:hidden ctv:group-hover:flex ctv:gap-1"
            >
              <button
                v-if="aiReady"
                :class="overlayBtnClass"
                :title="$t('eagle.similar.action')"
                @click.stop="findSimilar(item.eagleItem)"
              >
                <IconSparkles class="ctv:size-3.5" />
              </button>
              <button
                :class="overlayBtnClass"
                :disabled="importingIds.has(item.eagleItem.id)"
                :title="$t('eagle.import.action')"
                @click.stop="importItem(item.eagleItem)"
              >
                <IconArrowLeft class="ctv:size-3.5" />
              </button>
            </div>
          </div>
        </template>
      </VirtualGrid>

      <div
        v-if="items.length > 0 && !exhausted"
        class="ctv:shrink-0 ctv:flex ctv:justify-center ctv:py-1.5 ctv:border-t ctv:border-border-subtle"
      >
        <button :class="chipBtnClass" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? $t('eagle.loading') : $t('eagle.loadMore') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'

import IconArrowLeft from '~icons/lucide/arrow-left-to-line'
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSearch from '~icons/lucide/search'
import IconSparkles from '~icons/lucide/sparkles'

import { eagleFileUrl, eagleThumbUrl } from '@/api/eagle'
import type { EagleItem } from '@/api/schemas'
import VirtualGrid from '@/components/widgets/VirtualGrid.vue'
import { EAGLE_DRAG_MIME } from '@/composables/sidebar/assetCanvasDrop'
import { useAudioPreview } from '@/composables/sidebar/useAudioPreview'
import { useEaglePanel } from '@/composables/sidebar/useEaglePanel'
import { mediaTypeOfExt } from '@/utils/mediaFileTypes'

const props = defineProps<{ active?: boolean }>()

const MEDIA_FILTERS = ['', 'image', 'video', 'audio'] as const

const {
  status,
  items,
  folders,
  keyword,
  folder,
  mediaType,
  aiMode,
  aiReady,
  similarTo,
  loading,
  loadingMore,
  exhausted,
  flushing,
  error,
  importingIds,
  enabled,
  mode,
  pendingCount,
  refresh,
  loadMore,
  importItem,
  viewFull,
  findSimilar,
  clearSimilar,
  flush,
} = useEaglePanel(() => props.active)

const virtualItems = computed(() =>
  items.value.map((i) => ({ key: i.id, eagleItem: i })))

const hoverId = ref<string | null>(null)
const pinnedVideoId = ref<string | null>(null)
const { playingUrl, toggle: toggleAudio } = useAudioPreview()

function mediaKind(item: EagleItem) {
  return mediaTypeOfExt(item.ext)
}

function audioPlaying(item: EagleItem): boolean {
  return playingUrl.value === eagleFileUrl(item.id)
}

function hoverAutoplay(e: Event) {
  void (e.currentTarget as HTMLVideoElement).play().catch(() => {})
}

function onCardDragStart(item: EagleItem, e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(EAGLE_DRAG_MIME, item.id)
  e.dataTransfer.effectAllowed = 'copy'
}

function onCardClick(item: EagleItem) {
  const kind = mediaKind(item)
  if (kind === 'video') {
    pinnedVideoId.value = pinnedVideoId.value === item.id ? null : item.id
  } else if (kind === 'audio') {
    toggleAudio(eagleFileUrl(item.id))
  } else {
    viewFull(item)
  }
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(120px, 42vw), 1fr))',
  gap: '4px',
}

const modeDotClass = computed(() => ({
  api: 'ctv:bg-emerald-500',
  disk: 'ctv:bg-amber-500',
  offline: 'ctv:bg-destructive-background',
  disabled: 'ctv:bg-muted-foreground',
}[mode.value]))

const statusTooltip = computed(() => {
  const s = status.value
  if (!s) return ''
  return [
    s.version ? `Eagle ${s.version}${s.api_version ? ` · API ${s.api_version}` : ''}` : '',
    s.current_library ? `open: ${s.current_library}` : '',
    s.pinned_library ? `pinned: ${s.pinned_library}` : '',
  ].filter(Boolean).join('\n')
})

function itemTooltip(item: EagleItem): string {
  const dims = item.width && item.height ? `${item.width}×${item.height}` : ''
  const score = item.score != null ? `score ${(item.score * 100).toFixed(0)}%` : ''
  return [item.name, dims, item.tags.join(', '), score].filter(Boolean).join('\n')
}

function chipClass(active: boolean) {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:transition-colors',
    active
      ? 'ctv:bg-secondary-background-selected ctv:border-primary-background/60 ctv:text-base-foreground'
      : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
  ].join(' ')
}

const iconBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-7 ctv:shrink-0 ctv:cursor-pointer ctv:appearance-none',
  'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground',
  'ctv:hover:bg-secondary-background-hover ctv:transition-colors',
].join(' ')

const chipBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit]',
  'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-2 ctv:py-1 ctv:text-xs',
  'ctv:text-base-foreground ctv:hover:bg-secondary-background-hover',
  'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none',
].join(' ')

const overlayBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-6 ctv:cursor-pointer ctv:appearance-none',
  'ctv:rounded ctv:border-none ctv:bg-black/60 ctv:text-white ctv:hover:bg-black/80',
  'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none',
].join(' ')
</script>
