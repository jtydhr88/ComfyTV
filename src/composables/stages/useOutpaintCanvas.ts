import { computed, ref, watch, type Ref } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { readWidgetNum, writeWidget } from '@/utils/widget'

export type Side = 'left' | 'top' | 'right' | 'bottom'
export const SIDES: Side[] = ['left', 'top', 'right', 'bottom']

export function useOutpaintCanvas(
  node: LGraphNode,
  state: StageState,
  canvasEl: Ref<HTMLElement | null>,
  rootEl: Ref<HTMLElement | null>,
) {
  const sourceImageUrl = computed<string | null>(() => {
    const inp = state.inputs.find(i => i.slot === 'image')
    if (!inp || inp.source !== 'upstream' || !inp.content) return null
    return inp.content
  })

  const naturalW = ref(0)
  const naturalH = ref(0)
  function onSourceLoaded(e: Event) {
    const img = e.target as HTMLImageElement
    naturalW.value = img.naturalWidth
    naturalH.value = img.naturalHeight
  }

  function readPadFromWidgets(): Record<Side, number> {
    return {
      left:   readWidgetNum(node, 'pad_left',   0),
      top:    readWidgetNum(node, 'pad_top',    0),
      right:  readWidgetNum(node, 'pad_right',  0),
      bottom: readWidgetNum(node, 'pad_bottom', 0),
    }
  }

  const pad = ref<Record<Side, number>>(readPadFromWidgets())

  function setPad(side: Side, value: number) {
    const clamped = Math.max(0, Math.min(4096, Math.round(value || 0)))
    if (pad.value[side] === clamped) return
    pad.value = { ...pad.value, [side]: clamped }
  }

  function resetAll() {
    pad.value = { left: 0, top: 0, right: 0, bottom: 0 }
  }

  watch(pad, (v) => {
    writeWidget(node, 'pad_left',   v.left)
    writeWidget(node, 'pad_top',    v.top)
    writeWidget(node, 'pad_right',  v.right)
    writeWidget(node, 'pad_bottom', v.bottom)
  }, { deep: true })

  if (node) {
    node.onConfigure = useChainCallback(node.onConfigure, () => {
      pad.value = readPadFromWidgets()
    })
  }

  const canvasRect = ref({ w: 0, h: 0 })
  let ro: ResizeObserver | null = null
  watch(canvasEl, (el) => {
    ro?.disconnect()
    if (!el) return
    ro = new ResizeObserver(() => {
      canvasRect.value = { w: el.clientWidth, h: el.clientHeight }
    })
    ro.observe(el)
  })

  const virtualW = computed(() => Math.max(1, naturalW.value + pad.value.left + pad.value.right))
  const virtualH = computed(() => Math.max(1, naturalH.value + pad.value.top + pad.value.bottom))

  const scale = computed(() => {
    const cw = canvasRect.value.w - 24
    const ch = canvasRect.value.h - 24
    if (cw <= 0 || ch <= 0 || virtualW.value <= 0 || virtualH.value <= 0) return 1
    return Math.max(0.02, Math.min(cw / virtualW.value, ch / virtualH.value))
  })

  const offset = computed(() => {
    const w = virtualW.value * scale.value
    const h = virtualH.value * scale.value
    return {
      x: Math.max(0, (canvasRect.value.w - w) / 2),
      y: Math.max(0, (canvasRect.value.h - h) / 2),
    }
  })

  const padAreaStyle = computed(() => ({
    left:   `${offset.value.x}px`,
    top:    `${offset.value.y}px`,
    width:  `${virtualW.value * scale.value}px`,
    height: `${virtualH.value * scale.value}px`,
  }))

  const imgStyle = computed(() => ({
    left:   `${offset.value.x + pad.value.left * scale.value}px`,
    top:    `${offset.value.y + pad.value.top  * scale.value}px`,
    width:  `${naturalW.value * scale.value}px`,
    height: `${naturalH.value * scale.value}px`,
  }))

  function handleStyle(side: Side) {
    const ox = offset.value.x
    const oy = offset.value.y
    const ix = pad.value.left * scale.value
    const iy = pad.value.top  * scale.value
    const iw = naturalW.value * scale.value
    const ih = naturalH.value * scale.value
    const thick = 10
    if (side === 'left')   return { left: `${ox + ix - thick / 2}px`,           top: `${oy + iy}px`,                  width: `${thick}px`, height: `${ih}px` }
    if (side === 'right')  return { left: `${ox + ix + iw - thick / 2}px`,      top: `${oy + iy}px`,                  width: `${thick}px`, height: `${ih}px` }
    if (side === 'top')    return { left: `${ox + ix}px`,                       top: `${oy + iy - thick / 2}px`,      width: `${iw}px`,    height: `${thick}px` }
    return { left: `${ox + ix}px`,                       top: `${oy + iy + ih - thick / 2}px`, width: `${iw}px`,    height: `${thick}px` }
  }

  function badgeStyle(side: Side) {
    const ox = offset.value.x
    const oy = offset.value.y
    const ix = pad.value.left * scale.value
    const iy = pad.value.top  * scale.value
    const iw = naturalW.value * scale.value
    const ih = naturalH.value * scale.value
    if (side === 'left')   return { left: `${ox + ix * 0.5}px`,           top: `${oy + iy + ih / 2}px`, transform: 'translate(-50%, -50%)' }
    if (side === 'right')  return { left: `${ox + ix + iw + (virtualW.value * scale.value - ix - iw) * 0.5}px`, top: `${oy + iy + ih / 2}px`, transform: 'translate(-50%, -50%)' }
    if (side === 'top')    return { left: `${ox + ix + iw / 2}px`,        top: `${oy + iy * 0.5}px`,    transform: 'translate(-50%, -50%)' }
    return { left: `${ox + ix + iw / 2}px`,        top: `${oy + iy + ih + (virtualH.value * scale.value - iy - ih) * 0.5}px`, transform: 'translate(-50%, -50%)' }
  }

  const outDims = computed(() => {
    if (!naturalW.value) return '—'
    return `${virtualW.value} × ${virtualH.value}px`
  })

  function onHandlePointerDown(e: PointerEvent, side: Side) {
    if (!sourceImageUrl.value) return
    const el = rootEl.value
    if (!el) return
    el.setPointerCapture?.(e.pointerId)
    e.stopPropagation()

    const startClient = side === 'left' || side === 'right' ? e.clientX : e.clientY
    const startPad = pad.value[side]
    const sign = side === 'right' || side === 'bottom' ? 1 : -1
    const sc = scale.value

    const move = (ev: PointerEvent) => {
      const cur = side === 'left' || side === 'right' ? ev.clientX : ev.clientY
      const deltaPx = (cur - startClient) * sign
      const deltaSrc = Math.round(deltaPx / sc)
      setPad(side, startPad + deltaSrc)
    }
    const finish = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
      try { el.releasePointerCapture?.(e.pointerId) } catch {}
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
  }

  return {
    sourceImageUrl,
    pad, setPad, resetAll,
    onSourceLoaded,
    padAreaStyle, imgStyle, handleStyle, badgeStyle,
    outDims,
    onHandlePointerDown,
  }
}
