<template>
  <div
    ref="rootEl"
    class="v2-refs"
    :data-drop="strip.fileDrop.dragActive.value ? '1' : ''"
    @pointerdown.stop
    @dragenter="strip.fileDrop.onDragEnter"
    @dragover="strip.fileDrop.onDragOver"
    @dragleave="strip.fileDrop.onDragLeave"
    @drop="strip.fileDrop.onDrop"
  >
    <div
      v-for="(it, i) in visibleItems"
      :key="`${it.type}:${it.entry.key}`"
      class="v2-refchip"
      :data-src="it.entry.src"
      :data-type="it.type"
      :data-dragging="drag?.from === i ? '1' : ''"
      :data-drop-before="drag && drag.over === i && drag.from !== i ? '1' : ''"
      :title="it.label"
      @pointerdown="onChipPointerDown($event, i)"
      @pointermove="onChipPointerMove($event)"
      @pointerup="onChipPointerUp($event)"
      @pointercancel="cancelDrag"
    >
      <ThumbImg
        v-if="it.url && it.type === 'image'"
        :src="it.url"
        :thumb-max="64"
        loading="lazy"
        class="v2-refchip__img"
        draggable="false"
      />
      <video
        v-else-if="it.url && it.type === 'video'"
        :src="it.url"
        muted
        playsinline
        preload="metadata"
        class="v2-refchip__img"
      />
      <span v-else-if="it.type === 'audio'" class="v2-refchip__glyph">♪</span>
      <span v-else class="v2-refchip__glyph v2-refchip__glyph--pending">…</span>
      <span class="v2-refchip__pos" :style="{ background: it.color }">{{ it.position }}</span>
      <span v-if="it.entry.src === 'link'" class="v2-refchip__link">⟜</span>
      <button type="button" class="v2-refchip__x" :title="$t('imageRefs.remove')" @pointerdown.stop @click.stop="strip.remove(it)">×</button>
    </div>
    <div v-if="hiddenCount > 0" class="v2-refchip v2-refchip--more">+{{ hiddenCount }}</div>
    <button type="button" class="v2-refchip v2-refchip--add" :title="$t('imageRefs.add')" @click.stop="open = !open">＋</button>
  </div>
  <div v-if="strip.warnings.value.length" class="v2-refs-warns" @pointerdown.stop>
    <div v-for="(w, i) in strip.warnings.value" :key="i" class="v2-refs-warns__row">{{ w }}</div>
  </div>
  <AssetPickerPopup
    v-if="open"
    :added-ids="strip.addedIds.value"
    :media-types="strip.acceptedMediaTypes.value"
    :batch-groups="strip.batchGroups.value"
    :added-batch-keys="strip.addedBatchKeys.value"
    @select="strip.onAddAsset"
    @select-batch="strip.onAddBatchImage"
    @refresh-batch="strip.onRefreshBatch"
    @unpin-batch="strip.onUnpinBatch"
    @close="open = false"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import ThumbImg from '@/components/widgets/ThumbImg.vue'
import type { MediaType } from '@/composables/stages/mediaOrder'
import { type StripItem, useMediaStrip } from '@/composables/stages/useMediaStrip'
import type { LGraphNode } from '@/lib/comfyApp'

const MAX_VISIBLE = 12
const DRAG_THRESHOLD = 4

const props = defineProps<{
  getNode: () => LGraphNode | undefined
  types?: MediaType[]
}>()

const rootEl = ref<HTMLElement | null>(null)
const open = ref(false)

const strip = useMediaStrip(props.getNode, props.types ? { types: props.types } : undefined)

const visibleItems = computed(() => strip.items.value.slice(0, MAX_VISIBLE))
const hiddenCount = computed(() => Math.max(0, strip.items.value.length - MAX_VISIBLE))

interface DragState {
  from: number
  over: number | null
  startX: number
  startY: number
  active: boolean
  pointerId: number
}
const drag = ref<DragState | null>(null)

function chipElements(): HTMLElement[] {
  return [...(rootEl.value?.querySelectorAll<HTMLElement>('.v2-refchip[data-src]') ?? [])]
}

function onChipPointerDown(e: PointerEvent, index: number) {
  if (e.button !== 0) return
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  drag.value = { from: index, over: null, startX: e.clientX, startY: e.clientY, active: false, pointerId: e.pointerId }
}

function onChipPointerMove(e: PointerEvent) {
  const d = drag.value
  if (!d || d.pointerId !== e.pointerId) return
  if (!d.active) {
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return
    d.active = true
  }
  const chips = chipElements()
  const fromType = visibleItems.value[d.from]?.type
  let over: number | null = null
  chips.forEach((el, i) => {
    if (visibleItems.value[i]?.type !== fromType) return
    const r = el.getBoundingClientRect()
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      over = e.clientX < r.left + r.width / 2 ? i : i + 1
    }
  })
  if (over != null) {
    const last = visibleItems.value.map((it, i) => (it.type === fromType ? i : -1)).filter(i => i >= 0).at(-1)!
    if (over > last) over = last + 1
  }
  d.over = over
}

function onChipPointerUp(e: PointerEvent) {
  const d = drag.value
  drag.value = null
  if (!d || d.pointerId !== e.pointerId || !d.active || d.over == null) return
  const item: StripItem | undefined = visibleItems.value[d.from]
  if (!item) return
  const sameType = visibleItems.value.filter(it => it.type === item.type)
  const firstIndex = visibleItems.value.indexOf(sameType[0]!)
  let to = d.over - firstIndex
  const from = item.index
  if (to > from) to -= 1
  if (to === from) return
  strip.move(item.type, from, to)
}

function cancelDrag() {
  drag.value = null
}

onMounted(() => strip.init())
</script>

<style scoped>
.v2-refs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  border-radius: 8px;
}
.v2-refs[data-drop="1"] {
  outline: 2px dashed var(--v2-text-muted);
  outline-offset: 2px;
}
.v2-refchip {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  overflow: hidden;
  background: var(--v2-chip-bg);
  border: 1px solid var(--v2-chip-border);
  flex: none;
  touch-action: none;
  user-select: none;
}
.v2-refchip[data-src] { cursor: grab; }
.v2-refchip[data-dragging="1"] { opacity: .45; }
.v2-refchip[data-drop-before="1"] { box-shadow: -3px 0 0 0 var(--v2-text-strong); }
.v2-refchip__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.v2-refchip__glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--v2-text-mid);
  font: 500 14px/1 system-ui, sans-serif;
}
.v2-refchip__glyph--pending { color: var(--v2-text-muted); }
.v2-refchip__pos {
  position: absolute;
  left: 2px;
  bottom: 2px;
  min-width: 13px;
  height: 13px;
  padding: 0 3px;
  border-radius: 999px;
  color: #0b0b0e;
  font: 600 9px/13px system-ui, sans-serif;
  text-align: center;
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}
.v2-refchip__link {
  position: absolute;
  right: 2px;
  bottom: 1px;
  color: #e6e6ea;
  font: 700 11px/1 system-ui, sans-serif;
  text-shadow: 0 0 2px #000, 0 0 2px #000;
  pointer-events: none;
}
.v2-refchip__x {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(12, 12, 16, 0.78);
  color: #e6e6ea;
  font: 500 10px/1 system-ui, sans-serif;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}
.v2-refchip:hover .v2-refchip__x { display: flex; }
@media (hover: none) {
  .v2-refchip__x { display: flex; }
}
.v2-refchip--more {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v2-text-mid);
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-refchip--add {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v2-text-mid);
  font: 400 16px/1 system-ui, sans-serif;
  cursor: pointer;
  background: transparent;
  border: 1px dashed var(--v2-scrollbar);
}
.v2-refchip--add:hover {
  border-color: var(--v2-text-muted);
  color: var(--v2-text-strong);
}
</style>
