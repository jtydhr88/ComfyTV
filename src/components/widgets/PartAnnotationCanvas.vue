<template>
  <div
    class="ctv:flex ctv:flex-col ctv:w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div
      ref="containerEl"
      class="ctv:relative ctv:w-full ctv:h-[340px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle ctv:touch-none ctv:select-none"
      :style="{ cursor: sourceImageUrl ? 'crosshair' : 'default' }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @contextmenu.prevent
    >
      <div v-if="!sourceImageUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-image ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('splitPart.noInputImage') }}</div>
      </div>

      <template v-else>
        <img
          ref="imageEl"
          :src="sourceImageUrl"
          class="ctv:block ctv:size-full ctv:object-contain ctv:pointer-events-none ctv:select-none"
          draggable="false"
          alt=""
          @load="onImageLoad"
          @dragstart.prevent
        />

        <div
          v-for="b in boxOverlays"
          :key="`box-${b.id}`"
          class="ctv:absolute ctv:pointer-events-none ctv:rounded-xs"
          :style="{
            left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`,
            border: `2px solid ${b.color}`,
            background: b.active ? `${b.color}2a` : `${b.color}14`,
            boxShadow: b.active ? `0 0 0 1px ${b.color}` : 'none',
          }"
        />

        <div
          v-if="draftBox"
          class="ctv:absolute ctv:pointer-events-none ctv:rounded-xs ctv:border-2 ctv:border-dashed ctv:border-white/80 ctv:bg-white/10"
          :style="{ left: `${draftBox.x}px`, top: `${draftBox.y}px`, width: `${draftBox.w}px`, height: `${draftBox.h}px` }"
        />

        <span
          v-for="pt in pointOverlays"
          :key="pt.key"
          class="ctv:absolute ctv:pointer-events-none ctv:flex ctv:items-center ctv:justify-center
                 ctv:size-4 ctv:-ml-2 ctv:-mt-2 ctv:rounded-full ctv:text-[9px] ctv:font-bold ctv:leading-none ctv:text-white"
          :style="{
            left: `${pt.x}px`, top: `${pt.y}px`,
            background: pt.label === 1 ? pt.color : '#3a3a42',
            border: `2px solid ${pt.label === 1 ? '#ffffff' : pt.color}`,
            opacity: pt.active ? 1 : 0.75,
          }"
        >{{ pt.label === 1 ? '+' : '−' }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { partColor, type Part, type PartBox } from '@/widgets/splitpart/types'

const props = defineProps<{
  sourceImageUrl: string | null
  parts: Part[]
  activePartId: number | null
  /** 'point-pos' | 'point-neg' | 'box' */
  tool: string
}>()

const emit = defineEmits<{
  (e: 'add-point', p: { x: number; y: number; label: 0 | 1 }): void
  (e: 'add-box', b: PartBox): void
}>()

const containerEl = ref<HTMLDivElement | null>(null)
const imageEl = ref<HTMLImageElement | null>(null)
const naturalW = ref(0)
const naturalH = ref(0)

function onImageLoad(): void {
  naturalW.value = imageEl.value?.naturalWidth ?? 0
  naturalH.value = imageEl.value?.naturalHeight ?? 0
}

function contentRect(): { left: number; top: number; scale: number } | null {
  const host = containerEl.value
  if (!host || !naturalW.value || !naturalH.value) return null
  const cw = host.clientWidth
  const ch = host.clientHeight
  const scale = Math.min(cw / naturalW.value, ch / naturalH.value)
  return {
    left: (cw - naturalW.value * scale) / 2,
    top: (ch - naturalH.value * scale) / 2,
    scale,
  }
}

function toNatural(e: PointerEvent): { x: number; y: number } | null {
  const host = containerEl.value
  const rect = host?.getBoundingClientRect()
  const c = contentRect()
  if (!host || !rect || !rect.width || !c || c.scale <= 0) return null
  const zoom = rect.width / host.clientWidth
  if (!Number.isFinite(zoom) || zoom <= 0) return null
  const x = ((e.clientX - rect.left) / zoom - c.left) / c.scale
  const y = ((e.clientY - rect.top) / zoom - c.top) / c.scale
  if (x < 0 || y < 0 || x > naturalW.value || y > naturalH.value) return null
  return { x, y }
}

function toDisplay(x: number, y: number): { x: number; y: number } | null {
  const c = contentRect()
  if (!c) return null
  return { x: c.left + x * c.scale, y: c.top + y * c.scale }
}

const overlayTick = ref(0)

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !containerEl.value) return
  resizeObserver = new ResizeObserver(() => overlayTick.value++)
  resizeObserver.observe(containerEl.value)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

const boxOverlays = computed(() => {
  void overlayTick.value
  const out: { id: number; x: number; y: number; w: number; h: number; color: string; active: boolean }[] = []
  const c = contentRect()
  if (!c) return out
  for (const p of props.parts) {
    if (p.kind !== 'box') continue
    const tl = toDisplay(p.box.x, p.box.y)
    if (!tl) continue
    out.push({
      id: p.id,
      x: tl.x, y: tl.y,
      w: p.box.w * c.scale, h: p.box.h * c.scale,
      color: partColor(p.id),
      active: p.id === props.activePartId,
    })
  }
  return out
})

const pointOverlays = computed(() => {
  void overlayTick.value
  const out: { key: string; x: number; y: number; label: 0 | 1; color: string; active: boolean }[] = []
  for (const p of props.parts) {
    if (p.kind !== 'points') continue
    p.points.forEach((q, i) => {
      const d = toDisplay(q.x, q.y)
      if (!d) return
      out.push({
        key: `${p.id}-${i}`,
        x: d.x, y: d.y,
        label: q.label,
        color: partColor(p.id),
        active: p.id === props.activePartId,
      })
    })
  }
  return out
})

const DRAG_THRESHOLD_PX = 5

let dragStart: { x: number; y: number; nx: number; ny: number } | null = null
const draftBox = ref<{ x: number; y: number; w: number; h: number } | null>(null)

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0 && e.button !== 2) return
  const nat = toNatural(e)
  if (!nat) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragStart = { x: e.clientX, y: e.clientY, nx: nat.x, ny: nat.y }
  draftBox.value = null
}

function onPointerMove(e: PointerEvent): void {
  overlayTick.value++
  if (!dragStart || props.tool !== 'box') return
  if (Math.abs(e.clientX - dragStart.x) < DRAG_THRESHOLD_PX
    && Math.abs(e.clientY - dragStart.y) < DRAG_THRESHOLD_PX) return
  const nat = toNatural(e)
  if (!nat) return
  const x = Math.min(dragStart.nx, nat.x)
  const y = Math.min(dragStart.ny, nat.y)
  const w = Math.abs(nat.x - dragStart.nx)
  const h = Math.abs(nat.y - dragStart.ny)
  const tl = toDisplay(x, y)
  const c = contentRect()
  draftBox.value = tl && c ? { x: tl.x, y: tl.y, w: w * c.scale, h: h * c.scale } : null
}

function onPointerUp(e: PointerEvent): void {
  const start = dragStart
  dragStart = null
  draftBox.value = null
  if (!start) return
  const nat = toNatural(e) ?? { x: start.nx, y: start.ny }
  const moved = Math.abs(e.clientX - start.x) >= DRAG_THRESHOLD_PX
    || Math.abs(e.clientY - start.y) >= DRAG_THRESHOLD_PX

  if (props.tool === 'box' && moved) {
    const box: PartBox = {
      x: Math.min(start.nx, nat.x),
      y: Math.min(start.ny, nat.y),
      w: Math.abs(nat.x - start.nx),
      h: Math.abs(nat.y - start.ny),
    }
    if (box.w >= 4 && box.h >= 4) emit('add-box', box)
    return
  }
  if (moved) return

  const label: 0 | 1 = e.button === 2 || props.tool === 'point-neg' ? 0 : 1
  emit('add-point', { x: start.nx, y: start.ny, label })
}
</script>
