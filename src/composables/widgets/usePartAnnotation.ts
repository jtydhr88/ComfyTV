import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

import { computeFit } from '@/composables/widgets/useVideoViewport'
import { partColor, type Part, type PartBox, type PartPoint } from '@/widgets/splitpart/types'

export const DRAG_THRESHOLD_PX = 5
export const MIN_BOX_SIZE = 4

export interface ContentPlacement {
  left: number
  top: number
  scale: number
}

export interface BoxOverlay {
  id: number
  x: number
  y: number
  w: number
  h: number
  color: string
  active: boolean
}

export interface PointOverlay {
  key: string
  x: number
  y: number
  label: 0 | 1
  color: string
  active: boolean
}

export function contentPlacement(
  cw: number,
  ch: number,
  natW: number,
  natH: number,
): ContentPlacement | null {
  if (!natW || !natH) return null
  if (!cw || !ch) return { left: 0, top: 0, scale: 0 }
  const fit = computeFit(cw, ch, natW, natH)
  return { left: fit.offX, top: fit.offY, scale: fit.scale }
}

export function clientToNatural(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number },
  clientWidth: number,
  placement: ContentPlacement,
  natW: number,
  natH: number,
): { x: number; y: number } | null {
  if (!rect.width || placement.scale <= 0) return null
  const zoom = rect.width / clientWidth
  if (!Number.isFinite(zoom) || zoom <= 0) return null
  const x = ((clientX - rect.left) / zoom - placement.left) / placement.scale
  const y = ((clientY - rect.top) / zoom - placement.top) / placement.scale
  if (x < 0 || y < 0 || x > natW || y > natH) return null
  return { x, y }
}

export function naturalToDisplay(
  x: number,
  y: number,
  placement: ContentPlacement,
): { x: number; y: number } {
  return { x: placement.left + x * placement.scale, y: placement.top + y * placement.scale }
}

export function boxFromDrag(
  a: { x: number; y: number },
  b: { x: number; y: number },
): PartBox {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  }
}

export interface UsePartAnnotationOptions {
  containerEl: Ref<HTMLDivElement | null>
  imageEl: Ref<HTMLImageElement | null>
  parts: () => Part[]
  activePartId: () => number | null
  tool: () => string
  onAddPoint: (p: PartPoint) => void
  onAddBox: (b: PartBox) => void
}

export function usePartAnnotation(opts: UsePartAnnotationOptions) {
  const { containerEl, imageEl } = opts

  const naturalW = ref(0)
  const naturalH = ref(0)
  const overlayTick = ref(0)
  const draftBox = ref<{ x: number; y: number; w: number; h: number } | null>(null)

  let dragStart: { x: number; y: number; nx: number; ny: number } | null = null

  function onImageLoad(): void {
    naturalW.value = imageEl.value?.naturalWidth ?? 0
    naturalH.value = imageEl.value?.naturalHeight ?? 0
  }

  function placement(): ContentPlacement | null {
    const host = containerEl.value
    if (!host) return null
    return contentPlacement(host.clientWidth, host.clientHeight, naturalW.value, naturalH.value)
  }

  function toNatural(e: PointerEvent): { x: number; y: number } | null {
    const host = containerEl.value
    const c = placement()
    if (!host || !c) return null
    return clientToNatural(
      e.clientX,
      e.clientY,
      host.getBoundingClientRect(),
      host.clientWidth,
      c,
      naturalW.value,
      naturalH.value,
    )
  }

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

  const boxOverlays = computed<BoxOverlay[]>(() => {
    void overlayTick.value
    const out: BoxOverlay[] = []
    const c = placement()
    if (!c) return out
    for (const p of opts.parts()) {
      if (p.kind !== 'box') continue
      const tl = naturalToDisplay(p.box.x, p.box.y, c)
      out.push({
        id: p.id,
        x: tl.x,
        y: tl.y,
        w: p.box.w * c.scale,
        h: p.box.h * c.scale,
        color: partColor(p.id),
        active: p.id === opts.activePartId(),
      })
    }
    return out
  })

  const pointOverlays = computed<PointOverlay[]>(() => {
    void overlayTick.value
    const out: PointOverlay[] = []
    const c = placement()
    if (!c) return out
    for (const p of opts.parts()) {
      if (p.kind !== 'points') continue
      p.points.forEach((q, i) => {
        const d = naturalToDisplay(q.x, q.y, c)
        out.push({
          key: `${p.id}-${i}`,
          x: d.x,
          y: d.y,
          label: q.label,
          color: partColor(p.id),
          active: p.id === opts.activePartId(),
        })
      })
    }
    return out
  })

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
    if (!dragStart || opts.tool() !== 'box') return
    if (Math.abs(e.clientX - dragStart.x) < DRAG_THRESHOLD_PX
      && Math.abs(e.clientY - dragStart.y) < DRAG_THRESHOLD_PX) return
    const nat = toNatural(e)
    const c = placement()
    if (!nat || !c) return
    const box = boxFromDrag({ x: dragStart.nx, y: dragStart.ny }, nat)
    const tl = naturalToDisplay(box.x, box.y, c)
    draftBox.value = { x: tl.x, y: tl.y, w: box.w * c.scale, h: box.h * c.scale }
  }

  function onPointerUp(e: PointerEvent): void {
    const start = dragStart
    dragStart = null
    draftBox.value = null
    if (!start) return
    const nat = toNatural(e) ?? { x: start.nx, y: start.ny }
    const moved = Math.abs(e.clientX - start.x) >= DRAG_THRESHOLD_PX
      || Math.abs(e.clientY - start.y) >= DRAG_THRESHOLD_PX

    if (opts.tool() === 'box' && moved) {
      const box = boxFromDrag({ x: start.nx, y: start.ny }, nat)
      if (box.w >= MIN_BOX_SIZE && box.h >= MIN_BOX_SIZE) opts.onAddBox(box)
      return
    }
    if (moved) return

    const label: 0 | 1 = e.button === 2 || opts.tool() === 'point-neg' ? 0 : 1
    opts.onAddPoint({ x: start.nx, y: start.ny, label })
  }

  return {
    naturalW,
    naturalH,
    overlayTick,
    draftBox,
    boxOverlays,
    pointOverlays,
    onImageLoad,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
