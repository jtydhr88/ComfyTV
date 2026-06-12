<template>
  <div :class="rootClass">
    <span v-if="!compact" :class="typeBadgeClass">{{ shortType }}</span>

    <div v-if="!hasContent" :class="emptyClass">{{ emptyLabel }}</div>

    <pre v-else-if="type === 'COMFYTV_TEXT'" :class="textClass">{{ content }}</pre>

    <div
      v-else-if="(type === 'COMFYTV_IMAGE' || type === 'COMFYTV_PANORAMA') && !compact"
      ref="zoomContainer"
      class="ctv:group ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden ctv:rounded-sm ctv:touch-none ctv:cursor-grab"
    >
      <img
        ref="zoomImg"
        :src="String(content)"
        class="ctv:block ctv:size-full ctv:object-contain ctv:select-none"
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
        <span class="ctv:text-[22px] ctv:leading-none">🔊</span>
      </div>
      <audio
        v-else
        :src="String(content)"
        class="ctv:block ctv:w-full ctv:mt-3.5"
        controls preload="metadata"
      />
    </template>

    <template v-else-if="type === 'COMFYTV_STORYBOARD'">
      <div v-if="compact" class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:size-full ctv:py-[3px] ctv:px-1 ctv:box-border ctv:overflow-hidden">
        <div class="ctv:flex ctv:items-baseline ctv:gap-1 ctv:shrink-0">
          <span class="ctv:text-[11px] ctv:leading-none">📋</span>
          <span class="vp-sb-count ctv:text-xs ctv:font-bold ctv:leading-none ctv:text-[#d8b0ff]">{{ storyboardShots.length }}</span>
          <span v-if="storyboardTotalSec" class="ctv:ml-auto ctv:text-3xs ctv:tracking-wide ctv:text-muted-foreground">{{ storyboardTotalSec }}s</span>
        </div>
        <ul class="ctv:list-none ctv:m-0 ctv:p-0 ctv:flex ctv:flex-col ctv:gap-px ctv:flex-auto ctv:min-h-0">
          <li v-for="(shot, i) in storyboardShots.slice(0, 3)" :key="i"
              class="vp-sb-item ctv:flex ctv:items-baseline ctv:gap-[3px] ctv:text-3xs ctv:leading-tight ctv:whitespace-nowrap ctv:overflow-hidden">
            <span class="ctv:shrink-0 ctv:font-semibold ctv:text-[#d8b0ff] ctv:min-w-2">{{ shot.shot_no ?? i + 1 }}</span>
            <span class="ctv:flex-auto ctv:overflow-hidden ctv:text-ellipsis ctv:text-base-foreground/80">{{ shotSummary(shot) }}</span>
          </li>
        </ul>
        <div v-if="storyboardShots.length > 3" class="vp-sb-more ctv:text-[8px] ctv:text-right ctv:italic ctv:text-muted-foreground/60">
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
        <span class="ctv:text-[22px] ctv:leading-none">🎬</span>
        <span class="vp-compact-count-text ctv:text-sm ctv:font-bold ctv:text-[#d8b0ff]">{{ timelineSegs.length }}</span>
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
              class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:pointer-events-none ctv:py-px ctv:px-[5px]
                     ctv:text-3xs ctv:font-bold ctv:tracking-wide ctv:rounded-lg
                     ctv:bg-[rgb(255_140_200/0.85)] ctv:text-white">
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
               class="ctv:block ctv:size-full ctv:object-cover ctv:pointer-events-none" />
          <span class="ctv:absolute ctv:bottom-0.5 ctv:left-0.5 ctv:py-px ctv:px-1 ctv:text-3xs ctv:font-bold ctv:rounded-sm
                       ctv:bg-black/70 ctv:text-[#ffb0d8]">
            {{ img.label ?? `#${img.index ?? i + 1}` }}
          </span>
          <span v-if="clickMode === 'pick'"
                class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:py-px ctv:px-1 ctv:text-2xs ctv:rounded-sm
                       ctv:bg-black/55 ctv:opacity-0 ctv:transition-opacity ctv:duration-150 ctv:group-hover:opacity-100">
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
        class="ctv:fixed ctv:inset-0 ctv:z-[9999] ctv:flex ctv:items-center ctv:justify-center ctv:cursor-zoom-out ctv:bg-black/90"
        role="dialog"
        @click.self="lightboxUrl = null"
      >
        <img :src="lightboxUrl"
             class="ctv:max-w-[95vw] ctv:max-h-[95vh] ctv:object-contain ctv:cursor-default
                    ctv:shadow-[0_8px_40px_rgb(0_0_0/0.6)]"
             :alt="lightboxUrl" />
        <button
          type="button"
          class="ctv:absolute ctv:top-4 ctv:right-4 ctv:size-9 ctv:flex ctv:items-center ctv:justify-center ctv:text-sm ctv:leading-none
                 ctv:rounded-full ctv:cursor-pointer
                 ctv:bg-black/55 ctv:text-white ctv:border ctv:border-white/30
                 ctv:hover:bg-black/85 ctv:hover:border-white/55"
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
  if (props.compact) return 'ctv:relative ctv:size-full ctv:overflow-hidden'
  return 'ctv:relative ctv:flex ctv:flex-col ctv:min-h-12 ctv:text-xs ctv:overflow-hidden'
})

const TYPE_BADGE_COLORS: Record<string, string> = {
  COMFYTV_TEXT:       'ctv:bg-[rgb(120_200_120/0.25)] ctv:text-[#b5e3a5]',
  COMFYTV_IMAGE:      'ctv:bg-[rgb(78_168_255/0.25)] ctv:text-[#9dd0ff]',
  COMFYTV_PANORAMA:   'ctv:bg-[rgb(78_168_255/0.25)] ctv:text-[#9dd0ff]',
  COMFYTV_VIDEO:      'ctv:bg-[rgb(255_171_64/0.25)] ctv:text-[#ffd089]',
  COMFYTV_AUDIO:      'ctv:bg-[rgb(255_100_100/0.22)] ctv:text-[#ffb0b0]',
  COMFYTV_STORYBOARD: 'ctv:bg-[rgb(200_130_255/0.25)] ctv:text-[#d8b0ff]',
  COMFYTV_IMAGES:     'ctv:bg-[rgb(255_140_200/0.25)] ctv:text-[#ffb0d8]',
}
const typeBadgeClass = computed(() => {
  const palette = TYPE_BADGE_COLORS[props.type] ?? 'ctv:bg-white/10 ctv:text-white/70'
  return `ctv:absolute ctv:top-[3px] ctv:right-[3px] ctv:py-px ctv:px-[5px] ctv:text-3xs ctv:tracking-wide ctv:rounded-sm ctv:pointer-events-none ${palette}`
})

const emptyClass = computed(() =>
  props.compact
    ? 'ctv:flex ctv:items-center ctv:justify-center ctv:h-full ctv:p-1 ctv:text-3xs ctv:italic ctv:opacity-50'
    : 'ctv:flex ctv:items-center ctv:justify-center ctv:h-full ctv:min-h-10 ctv:text-[11px] ctv:italic ctv:opacity-50'
)

const textClass = computed(() => {
  if (props.compact) {
    return 'ctv:m-0 ctv:p-1 ctv:max-h-full ctv:text-2xs ctv:leading-[1.3] ctv:overflow-hidden ctv:whitespace-pre-wrap ctv:font-mono ctv:break-words ctv:text-base-foreground'
         + ' ctv:[display:-webkit-box] ctv:[-webkit-line-clamp:5] ctv:[-webkit-box-orient:vertical]'
  }
  return 'ctv:m-0 ctv:py-0.5 ctv:px-1 ctv:max-h-[120px] ctv:overflow-auto ctv:whitespace-pre-wrap ctv:break-words'
       + ' ctv:text-[11px] ctv:leading-snug ctv:font-mono ctv:text-base-foreground'
})

const imgClass = computed(() =>
  props.compact
    ? 'ctv:block ctv:size-full ctv:object-cover'
    : 'ctv:block ctv:w-full ctv:max-h-40 ctv:object-contain ctv:rounded-sm'
)

const videoClass = computed(() =>
  props.compact
    ? 'ctv:block ctv:size-full ctv:object-cover ctv:bg-black'
    : 'ctv:block ctv:w-full ctv:max-h-52 ctv:rounded-sm ctv:bg-black'
)

const compactSummary = 'ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:size-full ctv:gap-0.5'

const storyboardListClass = 'ctv:flex ctv:flex-col ctv:gap-1 ctv:pt-3.5 ctv:max-h-56 ctv:overflow-auto'
const shotRowClass = 'ctv:flex ctv:items-baseline ctv:gap-1.5 ctv:py-[3px] ctv:px-[5px] ctv:text-[11px] ctv:rounded-sm'
  + ' ctv:bg-base-foreground/[0.03] ctv:border-l-2 ctv:border-[rgb(200_130_255/0.4)]'
const shotNoClass     = 'ctv:shrink-0 ctv:font-bold ctv:text-[#d8b0ff]'
const shotDurClass    = 'ctv:shrink-0 ctv:py-px ctv:px-1 ctv:text-2xs ctv:rounded-sm ctv:bg-base-foreground/5 ctv:text-muted-foreground'
const shotPromptClass = 'ctv:flex-auto ctv:break-words ctv:text-base-foreground'

const COMFY_BTN_BASE = 'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-2 ctv:cursor-pointer'
  + ' ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'

const imgActionsClass = 'ctv:absolute ctv:top-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1 ctv:opacity-0 ctv:transition-opacity ctv:duration-150'
  + ' ctv:group-hover:opacity-100'

const imgActionBtn = COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
  + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'

function batchCellClass(selected: boolean) {
  const base = 'ctv:group ctv:relative ctv:aspect-video ctv:rounded-sm ctv:overflow-hidden ctv:p-0 ctv:bg-black ctv:transition-colors'
  const interactive = props.clickMode === 'pick' ? ' ctv:cursor-pointer' : ' ctv:cursor-default'
  if (selected) {
    return base + interactive + ' ctv:ring-3 ctv:ring-inset ctv:ring-primary-background'
  }
  return base + interactive
    + ' ctv:border ctv:border-border-default'
    + (props.clickMode === 'pick' ? ' ctv:hover:border-primary-background' : '')
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
