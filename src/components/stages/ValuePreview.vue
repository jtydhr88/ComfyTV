<template>
  <div class="vp" :class="[`type-${type.toLowerCase()}`, { 'is-compact': compact }]">
    <span v-if="!compact" class="vp-type-badge">{{ shortType }}</span>

    <div v-if="!hasContent" class="vp-empty">{{ emptyLabel }}</div>

    <pre v-else-if="type === 'COMFYTV_TEXT'" class="vp-text">{{ content }}</pre>

    <div
      v-else-if="(type === 'COMFYTV_IMAGE' || type === 'COMFYTV_PANORAMA') && !compact"
      ref="zoomContainer"
      class="vp-img-zoom"
    >
      <img
        ref="zoomImg"
        :src="String(content)"
        class="vp-img"
        :alt="String(content)"
      />
      <div class="vp-img-actions">
        <button
          type="button"
          class="vp-img-action"
          :title="$t('stage.action.viewFull')"
          @click.stop="openViewer(String(content))"
        >⤢</button>
        <a
          class="vp-img-action"
          :href="String(content)"
          :download="downloadFilename(String(content))"
          :title="$t('stage.action.download')"
          @click.stop
        >⬇</a>
      </div>
    </div>
    <img
      v-else-if="type === 'COMFYTV_IMAGE' || type === 'COMFYTV_PANORAMA'"
      :src="String(content)"
      class="vp-img"
      :alt="String(content)"
    />

    <video
      v-else-if="type === 'COMFYTV_VIDEO'"
      :src="String(content)"
      class="vp-video"
      controls
      muted
      playsinline
      preload="metadata"
    />

    <template v-else-if="type === 'COMFYTV_AUDIO'">
      <div v-if="compact" class="vp-compact-summary">
        <span class="vp-compact-icon">🔊</span>
      </div>
      <audio
        v-else
        :src="String(content)"
        class="vp-audio"
        controls
        preload="metadata"
      />
    </template>

    <template v-else-if="type === 'COMFYTV_STORYBOARD'">
      <div v-if="compact" class="vp-storyboard-compact">
        <div class="vp-sb-head">
          <span class="vp-sb-icon">📋</span>
          <span class="vp-sb-count">{{ storyboardShots.length }}</span>
          <span v-if="storyboardTotalSec" class="vp-sb-dur">{{ storyboardTotalSec }}s</span>
        </div>
        <ul class="vp-sb-list">
          <li
            v-for="(shot, i) in storyboardShots.slice(0, 3)"
            :key="i"
            class="vp-sb-item"
          >
            <span class="vp-sb-no">{{ shot.shot_no ?? i + 1 }}</span>
            <span class="vp-sb-text">{{ shotSummary(shot) }}</span>
          </li>
        </ul>
        <div v-if="storyboardShots.length > 3" class="vp-sb-more">
          + {{ storyboardShots.length - 3 }} more
        </div>
      </div>
      <div v-else class="vp-storyboard">
        <div v-for="(shot, i) in storyboardShots" :key="i" class="vp-shot-row">
          <span class="vp-shot-no">#{{ shot.shot_no ?? i + 1 }}</span>
          <span v-if="shot.duration" class="vp-shot-dur">{{ shot.duration }}</span>
          <span class="vp-shot-prompt">{{ shot.prompt }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_TIMELINE'">
      <div v-if="compact" class="vp-compact-summary">
        <span class="vp-compact-icon">🎬</span>
        <span class="vp-compact-count-text">{{ timelineSegs.length }}</span>
      </div>
      <div v-else class="vp-storyboard">
        <div v-for="(seg, i) in timelineSegs" :key="i" class="vp-shot-row">
          <span class="vp-shot-no">#{{ i + 1 }}</span>
          <span v-if="seg.length" class="vp-shot-dur">{{ seg.length }}f</span>
          <span class="vp-shot-prompt">{{ seg.prompt || '—' }}</span>
        </div>
        <div v-if="timelineSegs.length === 0" class="vp-empty">empty timeline</div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_IMAGES'">
      <template v-if="compact">
        <img
          v-if="batchImages[0]"
          :src="batchImages[0].image_url"
          class="vp-img"
          :alt="`${batchImages.length} items`"
        />
        <div v-else class="vp-empty">{{ emptyLabel || '…' }}</div>
        <span v-if="batchImages.length > 0" class="vp-compact-count">{{ batchImages.length }}</span>
      </template>
      <div
        v-else
        class="vp-image-batch"
        :class="{ 'is-pickable': clickMode === 'pick' }"
      >
        <component
          :is="clickMode === 'pick' ? 'button' : 'div'"
          v-for="(img, i) in batchImages"
          :key="i"
          :type="clickMode === 'pick' ? 'button' : undefined"
          class="vp-batch-cell"
          :class="{ 'is-selected': isItemSelected(img, i), 'is-readonly': clickMode !== 'pick' }"
          :title="cellTooltip(img, i)"
          @click="clickMode === 'pick' ? onItemClick(img, i) : undefined"
        >
          <img :src="img.image_url" :alt="img.label || img.prompt || `item ${i + 1}`" />
          <span class="vp-batch-cell-no">{{ img.label ?? `#${img.index ?? i + 1}` }}</span>
          <span v-if="clickMode === 'pick'" class="vp-batch-cell-hint">{{ clickHintIcon }}</span>
          <span v-if="isItemSelected(img, i)" class="vp-batch-cell-check">✓</span>
          <div class="vp-img-actions">
            <button
              type="button"
              class="vp-img-action"
              :title="$t('stage.action.viewFull')"
              @click.stop="openViewer(img.image_url)"
            >⤢</button>
            <a
              class="vp-img-action"
              :href="img.image_url"
              :download="downloadFilename(img.image_url)"
              :title="$t('stage.action.download')"
              @click.stop
            >⬇</a>
          </div>
        </component>
      </div>
    </template>

    <div v-else class="vp-empty">{{ $t('stage.empty.unsupported_type', { type }) }}</div>

    <Teleport to="body">
      <div
        v-if="lightboxUrl"
        class="vp-lightbox"
        role="dialog"
        @click.self="lightboxUrl = null"
      >
        <img :src="lightboxUrl" class="vp-lightbox-img" :alt="lightboxUrl" />
        <button
          type="button"
          class="vp-lightbox-close"
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

const { t } = useI18n()

const zoomContainer = ref<HTMLElement | null>(null)
const zoomImg = ref<HTMLImageElement | null>(null)

const lightboxUrl = ref<string | null>(null)

function openViewer(url: string) {
  if (url) lightboxUrl.value = url
}

function downloadFilename(url: string): string {
  if (!url) return 'image'
  try {
    const u = new URL(url, location.origin)
    const fn = u.searchParams.get('filename')
    if (fn) return fn
    const last = u.pathname.split('/').pop()
    if (last) return last
  } catch { /* fall through */ }
  return url.split('/').pop()?.split('?')[0] || 'image'
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

interface BatchImage {
  index?: string
  label?: string
  prompt?: string
  image_url: string
}

interface ItemClickPayload {
  index: string
  label?: string
  prompt?: string
  imageUrl?: string
}
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

interface StoryboardShot {
  shot_no?: string
  duration?: string | number
  prompt?: string
  scene_purpose?: string
  image_prompt?: string
  [k: string]: unknown
}
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

interface TimelineSeg { length?: number; prompt?: string }
const timelineSegs = computed<TimelineSeg[]>(() => {
  if (props.type !== 'COMFYTV_TIMELINE' || !props.content) return []
  try {
    const parsed = JSON.parse(String(props.content))
    return Array.isArray(parsed?.segments) ? parsed.segments : []
  } catch {
    return []
  }
})
</script>

<style scoped>
.vp {
  position: relative;
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  padding: 4px;
  min-height: 48px;
  font-size: 11px;
  overflow: hidden;
}

.vp.is-compact {
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}
.vp.is-compact .vp-img,
.vp.is-compact .vp-video {
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: cover;
  border-radius: 0;
}
.vp.is-compact .vp-text {
  margin: 0;
  padding: 4px;
  max-height: 100%;
  font-size: 10px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.vp.is-compact .vp-empty {
  font-size: 9px;
  padding: 4px;
  min-height: 0;
}
.vp-compact-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%; height: 100%;
  gap: 2px;
}
.vp-compact-icon { font-size: 22px; line-height: 1; }
.vp-compact-count-text {
  font-size: 14px;
  font-weight: 700;
  color: #d8b0ff;
}

.vp-storyboard-compact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%; height: 100%;
  padding: 3px 4px;
  box-sizing: border-box;
  overflow: hidden;
}
.vp-sb-head {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex: 0 0 auto;
}
.vp-sb-icon { font-size: 11px; line-height: 1; }
.vp-sb-count {
  font-size: 12px; font-weight: 700; color: #d8b0ff;
  line-height: 1;
}
.vp-sb-dur {
  font-size: 9px; color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.3px;
  margin-left: auto;
}
.vp-sb-list {
  list-style: none;
  margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 1px;
  flex: 1 1 auto;
  min-height: 0;
}
.vp-sb-item {
  display: flex;
  align-items: baseline;
  gap: 3px;
  font-size: 9px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
}
.vp-sb-no {
  flex: 0 0 auto;
  color: #d8b0ff;
  font-weight: 600;
  min-width: 8px;
}
.vp-sb-text {
  flex: 1 1 auto;
  color: rgba(255, 255, 255, 0.78);
  overflow: hidden;
  text-overflow: ellipsis;
}
.vp-sb-more {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.4);
  text-align: right;
  font-style: italic;
}
.vp-compact-count {
  position: absolute;
  top: 2px; left: 2px;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  background: rgba(255, 140, 200, 0.85);
  color: #fff;
  border-radius: 8px;
  letter-spacing: 0.3px;
  pointer-events: none;
}
.vp-type-badge {
  position: absolute;
  top: 3px; right: 3px;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.5px;
  pointer-events: none;
}
.vp.type-comfytv_text       .vp-type-badge { background: rgba(120, 200, 120, 0.25); color: #b5e3a5; }
.vp.type-comfytv_image      .vp-type-badge { background: rgba(78, 168, 255, 0.25);  color: #9dd0ff; }
.vp.type-comfytv_video      .vp-type-badge { background: rgba(255, 171, 64, 0.25);  color: #ffd089; }
.vp.type-comfytv_audio      .vp-type-badge { background: rgba(255, 100, 100, 0.22); color: #ffb0b0; }
.vp.type-comfytv_storyboard  .vp-type-badge { background: rgba(200, 130, 255, 0.25); color: #d8b0ff; }
.vp.type-comfytv_images .vp-type-badge { background: rgba(255, 140, 200, 0.25); color: #ffb0d8; }

.vp-empty {
  opacity: 0.5;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 40px;
  font-style: italic;
}

.vp-text {
  margin: 0;
  padding: 2px 4px;
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow: auto;
  color: #ddd;
}

.vp-img {
  display: block;
  width: 100%;
  max-height: 160px;
  object-fit: contain;
  border-radius: 2px;
}

.vp-img-zoom {
  position: relative;
  width: 100%;
  max-height: 160px;
  height: 160px;
  overflow: hidden;
  border-radius: 2px;
  cursor: grab;
  touch-action: none;
}
.vp-img-zoom.is-panning { cursor: grabbing; }
.vp-img-zoom .vp-img {
  width: 100%;
  height: 100%;
  max-height: none;
  -webkit-user-drag: none;
  user-select: none;
}

.vp-video {
  display: block;
  width: 100%;
  max-height: 200px;
  border-radius: 2px;
  background: #000;
}

.vp-audio {
  display: block;
  width: 100%;
  margin-top: 14px;
}

.vp-storyboard {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 14px;
  max-height: 220px;
  overflow: auto;
}
.vp-shot-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 5px;
  font-size: 11px;
  border-left: 2px solid rgba(200, 130, 255, 0.4);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 2px;
}
.vp-shot-no {
  font-weight: 700;
  color: #d8b0ff;
  flex: 0 0 auto;
}
.vp-shot-dur {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.55);
  flex: 0 0 auto;
}
.vp-shot-prompt {
  color: #ccc;
  flex: 1 1 auto;
  word-break: break-word;
}

.vp-image-batch {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 4px;
  padding-top: 14px;
  max-height: 320px;
  overflow: auto;
}
.vp-batch-cell {
  position: relative;
  border-radius: 2px;
  overflow: hidden;
  background: #000;
  aspect-ratio: 16 / 9;
  border: 1px solid rgba(255, 140, 200, 0.3);
  padding: 0;
  transition: transform 80ms ease, border-color 120ms ease;
}
.vp-image-batch.is-pickable .vp-batch-cell { cursor: pointer; }
.vp-image-batch.is-pickable .vp-batch-cell:hover {
  border-color: rgba(255, 140, 200, 0.8);
  transform: translateY(-1px);
}
.vp-image-batch.is-pickable .vp-batch-cell:active { transform: translateY(0); }
.vp-batch-cell.is-readonly { cursor: default; }
.vp-batch-cell img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.vp-batch-cell-no {
  position: absolute;
  bottom: 2px; left: 2px;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffb0d8;
}
.vp-batch-cell-hint {
  position: absolute;
  top: 2px; right: 2px;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 120ms ease;
}
.vp-batch-cell:hover .vp-batch-cell-hint { opacity: 1; }

.vp-batch-cell.is-selected {
  border-color: #4ea8ff;
  box-shadow: 0 0 0 2px rgba(78, 168, 255, 0.5);
}
.vp-batch-cell.is-selected:hover { border-color: #79bfff; }
.vp-batch-cell-check {
  position: absolute;
  top: 2px; left: 2px;
  font-size: 10px;
  font-weight: 700;
  width: 16px; height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #4ea8ff;
  color: #fff;
}

.vp-img-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 120ms ease;
  z-index: 5;
  pointer-events: none;
}
.vp-img-zoom:hover .vp-img-actions,
.vp-batch-cell:hover .vp-img-actions {
  opacity: 1;
  pointer-events: auto;
}
.vp-img-action {
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
}
.vp-img-action:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
}

.vp-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.vp-lightbox-img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  cursor: default;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.vp-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vp-lightbox-close:hover {
  background: rgba(0, 0, 0, 0.85);
  border-color: rgba(255, 255, 255, 0.55);
}
</style>
