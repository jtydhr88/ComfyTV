<template>
  <div :class="rootClass">
    <span v-if="!compact" :class="typeBadgeClass">{{ shortType }}</span>

    <div v-if="!hasContent" :class="emptyClass">{{ emptyLabel }}</div>

    <pre v-else-if="type === 'COMFYTV_TEXT'" :class="textClass">{{ content }}</pre>

    <div
      v-else-if="(type === 'COMFYTV_IMAGE' || type === 'COMFYTV_PANORAMA') && !compact"
      ref="zoomContainer"
      class="group relative w-full flex-1 min-h-0 overflow-hidden rounded-sm touch-none cursor-grab"
    >
      <img
        ref="zoomImg"
        :src="String(content)"
        class="block size-full object-contain select-none"
        :alt="String(content)"
        draggable="false"
      />
      <div :class="imgActionsClass">
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.viewFull')"
                @click.stop="openViewer(String(content))">⤢</button>
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.download')"
                @click.stop="onDownload(String(content))">⬇</button>
      </div>
    </div>
    <img
      v-else-if="type === 'COMFYTV_IMAGE' || type === 'COMFYTV_PANORAMA'"
      :src="String(content)"
      :class="imgClass"
      :alt="String(content)"
    />

    <video
      v-else-if="type === 'COMFYTV_VIDEO'"
      :src="String(content)"
      :class="videoClass"
      controls muted playsinline preload="metadata"
    />

    <template v-else-if="type === 'COMFYTV_AUDIO'">
      <div v-if="compact" :class="compactSummary">
        <span class="text-[22px] leading-none">🔊</span>
      </div>
      <audio
        v-else
        :src="String(content)"
        class="block w-full mt-3.5"
        controls preload="metadata"
      />
    </template>

    <template v-else-if="type === 'COMFYTV_STORYBOARD'">
      <div v-if="compact" class="flex flex-col gap-0.5 size-full py-[3px] px-1 box-border overflow-hidden">
        <div class="flex items-baseline gap-1 shrink-0">
          <span class="text-[11px] leading-none">📋</span>
          <span class="vp-sb-count text-xs font-bold leading-none text-[#d8b0ff]">{{ storyboardShots.length }}</span>
          <span v-if="storyboardTotalSec" class="ml-auto text-3xs tracking-wide text-muted-foreground">{{ storyboardTotalSec }}s</span>
        </div>
        <ul class="list-none m-0 p-0 flex flex-col gap-px flex-auto min-h-0">
          <li v-for="(shot, i) in storyboardShots.slice(0, 3)" :key="i"
              class="vp-sb-item flex items-baseline gap-[3px] text-3xs leading-tight whitespace-nowrap overflow-hidden">
            <span class="shrink-0 font-semibold text-[#d8b0ff] min-w-2">{{ shot.shot_no ?? i + 1 }}</span>
            <span class="flex-auto overflow-hidden text-ellipsis text-base-foreground/80">{{ shotSummary(shot) }}</span>
          </li>
        </ul>
        <div v-if="storyboardShots.length > 3" class="vp-sb-more text-[8px] text-right italic text-muted-foreground/60">
          + {{ storyboardShots.length - 3 }} more
        </div>
      </div>
      <div v-else :class="storyboardListClass">
        <div v-for="(shot, i) in storyboardShots" :key="i" :class="shotRowClass">
          <span :class="shotNoClass">#{{ shot.shot_no ?? i + 1 }}</span>
          <span v-if="shot.duration" :class="shotDurClass">{{ shot.duration }}</span>
          <span :class="shotPromptClass">{{ shot.prompt }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_TIMELINE'">
      <div v-if="compact" :class="compactSummary">
        <span class="text-[22px] leading-none">🎬</span>
        <span class="vp-compact-count-text text-sm font-bold text-[#d8b0ff]">{{ timelineSegs.length }}</span>
      </div>
      <div v-else :class="storyboardListClass">
        <div v-for="(seg, i) in timelineSegs" :key="i" :class="shotRowClass">
          <span :class="shotNoClass">#{{ i + 1 }}</span>
          <span v-if="seg.length" :class="shotDurClass">{{ seg.length }}f</span>
          <span :class="shotPromptClass">{{ seg.prompt || '—' }}</span>
        </div>
        <div v-if="timelineSegs.length === 0" :class="emptyClass">empty timeline</div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_IMAGES'">
      <template v-if="compact">
        <img
          v-if="batchImages[0]"
          :src="batchImages[0].image_url"
          :class="imgClass"
          :alt="`${batchImages.length} items`"
        />
        <div v-else :class="emptyClass">{{ emptyLabel || '…' }}</div>
        <span v-if="batchImages.length > 0"
              class="absolute top-0.5 left-0.5 pointer-events-none py-px px-[5px]
                     text-3xs font-bold tracking-wide rounded-lg
                     bg-[rgb(255_140_200/0.85)] text-white">
          {{ batchImages.length }}
        </span>
      </template>
      <div v-else class="ctv-batch-grid">
        <component
          :is="clickMode === 'pick' ? 'button' : 'div'"
          v-for="(img, i) in batchImages"
          :key="i"
          :type="clickMode === 'pick' ? 'button' : undefined"
          :class="batchCellClass(isItemSelected(img, i))"
          :title="cellTooltip(img, i)"
          @click="clickMode === 'pick' ? onItemClick(img, i) : undefined"
        >
          <img :src="img.image_url" :alt="img.label || img.prompt || `item ${i + 1}`"
               class="block size-full object-cover pointer-events-none" />
          <span class="absolute bottom-0.5 left-0.5 py-px px-1 text-3xs font-bold rounded-sm
                       bg-black/70 text-[#ffb0d8]">
            {{ img.label ?? `#${img.index ?? i + 1}` }}
          </span>
          <span v-if="clickMode === 'pick'"
                class="absolute top-0.5 right-0.5 py-px px-1 text-2xs rounded-sm
                       bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {{ clickHintIcon }}
          </span>
          <div :class="imgActionsClass">
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.viewFull')"
                    @click.stop="openViewer(img.image_url)">⤢</button>
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.download')"
                    @click.stop="onDownload(img.image_url)">⬇</button>
          </div>
        </component>
      </div>
    </template>

    <div v-else :class="emptyClass">{{ $t('stage.empty.unsupported_type', { type }) }}</div>

    <Teleport to="body">
      <div
        v-if="lightboxUrl"
        class="fixed inset-0 z-[9999] flex items-center justify-center cursor-zoom-out bg-black/90"
        role="dialog"
        @click.self="lightboxUrl = null"
      >
        <img :src="lightboxUrl"
             class="max-w-[95vw] max-h-[95vh] object-contain cursor-default
                    shadow-[0_8px_40px_rgb(0_0_0/0.6)]"
             :alt="lightboxUrl" />
        <button
          type="button"
          class="absolute top-4 right-4 size-9 flex items-center justify-center text-sm leading-none
                 rounded-full cursor-pointer
                 bg-black/55 text-white border border-white/30
                 hover:bg-black/85 hover:border-white/55"
          :title="$t('stage.action.close')"
          @click="lightboxUrl = null"
        >✕</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImagePanZoom } from '@/composables/widgets/useImagePanZoom'
import type {
  BatchImage,
  ItemClickPayload,
  StoryboardShot,
  TimelineSeg,
} from '@/types/payloads'
import { downloadFile } from '@/utils/download'

const { t } = useI18n()

const zoomContainer = ref<HTMLElement | null>(null)
const zoomImg = ref<HTMLImageElement | null>(null)

const lightboxUrl = ref<string | null>(null)

function openViewer(url: string) {
  if (url) lightboxUrl.value = url
}

async function onDownload(url: string) {
  if (!url) return
  try {
    await downloadFile(url)
  } catch (err) {
    console.error('[ComfyTV/download] failed', err)
  }
}

import { onBeforeUnmount, onMounted } from 'vue'
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && lightboxUrl.value) lightboxUrl.value = null
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const props = defineProps<{
  type:
    | 'COMFYTV_TEXT'
    | 'COMFYTV_IMAGE'
    | 'COMFYTV_VIDEO'
    | 'COMFYTV_PANORAMA'
    | 'COMFYTV_STORYBOARD'
    | 'COMFYTV_IMAGES'
    | string
  content?: string | null
  emptyLabel?: string
  selectedIndex?: string | number
  clickMode?: 'refine' | 'pick'
  compact?: boolean
}>()

useImagePanZoom(zoomContainer, zoomImg, { resetKey: toRef(props, 'content') })

const hasContent = computed(() => props.content != null && String(props.content).length > 0)

const shortType = computed(() => {
  switch (props.type) {
    case 'COMFYTV_TEXT':       return 'TEXT'
    case 'COMFYTV_IMAGE':      return 'IMG'
    case 'COMFYTV_VIDEO':      return 'VID'
    case 'COMFYTV_AUDIO':      return 'AUDIO'
    case 'COMFYTV_PANORAMA':   return '360°'
    case 'COMFYTV_STORYBOARD': return 'BOARD'
    case 'COMFYTV_IMAGES':     return 'BATCH'
    case 'COMFYTV_TIMELINE':   return 'TIMELINE'
    default: return props.type
  }
})

const emit = defineEmits<{
  (e: 'item-click', payload: ItemClickPayload): void
}>()

function onItemClick(img: BatchImage, i: number) {
  emit('item-click', {
    index: img.index ?? String(i + 1),
    label: img.label,
    prompt: img.prompt,
    imageUrl: img.image_url,
  })
}

const clickHintIcon = computed(() => props.clickMode === 'pick' ? '✓' : '✏️')

function isItemSelected(img: BatchImage, i: number): boolean {
  if (props.selectedIndex == null) return false
  const cellIdx = img.index ?? String(i + 1)
  return Number(cellIdx) === Number(props.selectedIndex)
}

function cellTooltip(img: BatchImage, i: number): string {
  const tag = img.label ?? `#${img.index ?? i + 1}`
  return props.clickMode === 'pick' ? t('shotCell.pick', { tag }) : t('shotCell.refine', { tag })
}

const batchImages = computed<BatchImage[]>(() => {
  if (props.type !== 'COMFYTV_IMAGES' || !props.content) return []
  try {
    const parsed = JSON.parse(String(props.content))
    return Array.isArray(parsed?.images) ? parsed.images : []
  } catch {
    return []
  }
})

const storyboardShots = computed<StoryboardShot[]>(() => {
  if (props.type !== 'COMFYTV_STORYBOARD' || !props.content) return []
  try {
    const parsed = JSON.parse(String(props.content))
    return Array.isArray(parsed?.shots) ? parsed.shots : []
  } catch {
    return []
  }
})

const storyboardTotalSec = computed<number>(() => {
  let total = 0
  for (const s of storyboardShots.value) {
    const raw = s.duration
    if (raw == null) continue
    const n = parseFloat(String(raw).replace(/s$/i, ''))
    if (Number.isFinite(n)) total += n
  }
  return Math.round(total)
})

function shotSummary(s: StoryboardShot): string {
  const raw = String(s.scene_purpose || s.prompt || s.image_prompt || '').trim()

  return raw.replace(/\s+/g, ' ').slice(0, 60)
}

const timelineSegs = computed<TimelineSeg[]>(() => {
  if (props.type !== 'COMFYTV_TIMELINE' || !props.content) return []
  try {
    const parsed = JSON.parse(String(props.content))
    return Array.isArray(parsed?.segments) ? parsed.segments : []
  } catch {
    return []
  }
})

const rootClass = computed(() => {
  if (props.compact) return 'relative size-full overflow-hidden'
  return 'relative flex flex-col min-h-12 text-xs overflow-hidden'
})

const TYPE_BADGE_COLORS: Record<string, string> = {
  COMFYTV_TEXT:       'bg-[rgb(120_200_120/0.25)] text-[#b5e3a5]',
  COMFYTV_IMAGE:      'bg-[rgb(78_168_255/0.25)] text-[#9dd0ff]',
  COMFYTV_PANORAMA:   'bg-[rgb(78_168_255/0.25)] text-[#9dd0ff]',
  COMFYTV_VIDEO:      'bg-[rgb(255_171_64/0.25)] text-[#ffd089]',
  COMFYTV_AUDIO:      'bg-[rgb(255_100_100/0.22)] text-[#ffb0b0]',
  COMFYTV_STORYBOARD: 'bg-[rgb(200_130_255/0.25)] text-[#d8b0ff]',
  COMFYTV_IMAGES:     'bg-[rgb(255_140_200/0.25)] text-[#ffb0d8]',
}
const typeBadgeClass = computed(() => {
  const palette = TYPE_BADGE_COLORS[props.type] ?? 'bg-white/10 text-white/70'
  return `absolute top-[3px] right-[3px] py-px px-[5px] text-3xs tracking-wide rounded-sm pointer-events-none ${palette}`
})

const emptyClass = computed(() =>
  props.compact
    ? 'flex items-center justify-center h-full p-1 text-3xs italic opacity-50'
    : 'flex items-center justify-center h-full min-h-10 text-[11px] italic opacity-50'
)

const textClass = computed(() => {
  if (props.compact) {
    return 'm-0 p-1 max-h-full text-2xs leading-[1.3] overflow-hidden whitespace-pre-wrap font-mono break-words text-base-foreground'
         + ' [display:-webkit-box] [-webkit-line-clamp:5] [-webkit-box-orient:vertical]'
  }
  return 'm-0 py-0.5 px-1 max-h-[120px] overflow-auto whitespace-pre-wrap break-words'
       + ' text-[11px] leading-snug font-mono text-base-foreground'
})

const imgClass = computed(() =>
  props.compact
    ? 'block size-full object-cover'
    : 'block w-full max-h-40 object-contain rounded-sm'
)

const videoClass = computed(() =>
  props.compact
    ? 'block size-full object-cover bg-black'
    : 'block w-full max-h-52 rounded-sm bg-black'
)

const compactSummary = 'flex flex-col items-center justify-center size-full gap-0.5'

const storyboardListClass = 'flex flex-col gap-1 pt-3.5 max-h-56 overflow-auto'
const shotRowClass = 'flex items-baseline gap-1.5 py-[3px] px-[5px] text-[11px] rounded-sm'
  + ' bg-base-foreground/[0.03] border-l-2 border-[rgb(200_130_255/0.4)]'
const shotNoClass     = 'shrink-0 font-bold text-[#d8b0ff]'
const shotDurClass    = 'shrink-0 py-px px-1 text-2xs rounded-sm bg-base-foreground/5 text-muted-foreground'
const shotPromptClass = 'flex-auto break-words text-base-foreground'

const COMFY_BTN_BASE = 'relative inline-flex items-center justify-center gap-2 cursor-pointer'
  + ' touch-manipulation whitespace-nowrap appearance-none border-none transition-colors'
  + ' disabled:pointer-events-none disabled:opacity-50'

const imgActionsClass = 'absolute top-1 right-1 z-10 flex gap-1 opacity-0 transition-opacity duration-150'
  + ' group-hover:opacity-100'

const imgActionBtn = COMFY_BTN_BASE
  + ' size-5 p-0 rounded-sm text-sm'
  + ' bg-white text-gray-600 hover:bg-white/90'

function batchCellClass(selected: boolean) {
  const base = 'group relative aspect-video rounded-sm overflow-hidden p-0 bg-black transition-colors'
  const interactive = props.clickMode === 'pick' ? ' cursor-pointer' : ' cursor-default'
  if (selected) {
    return base + interactive + ' ring-3 ring-inset ring-primary-background'
  }
  return base + interactive
    + ' border border-border-default'
    + (props.clickMode === 'pick' ? ' hover:border-primary-background' : '')
}
</script>

<style scoped>
.ctv-batch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 4px;
  padding-top: 14px;
  max-height: 320px;
  overflow: auto;
}
</style>
