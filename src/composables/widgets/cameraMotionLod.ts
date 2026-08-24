import { useDebounceFn, useIntervalFn } from '@vueuse/core'
import { effectScope, type EffectScope } from 'vue'

import { app } from '@/lib/comfyApp'

export const MOTION_LOD_CLASS = 'ctv-cam-lod'
const SETTLE_MS = 256
const HEAVY_NODE_COUNT = 30
const LOD_MAX_SCALE = 0.35
const CANVAS_POLL_MS = 200

const CSS = `
.${MOTION_LOD_CLASS} [data-node-id],
.${MOTION_LOD_CLASS} [data-node-id] * {
  box-shadow: none !important;
  filter: none !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}
`

function paneEl(): Element | null {
  return document.querySelector('[data-testid="transform-pane"]')
    ?? document.querySelector('[data-node-id]')?.closest('.ph-no-capture')
    ?? null
}

let scope: EffectScope | null = null
let styleEl: HTMLStyleElement | null = null
let boundEl: HTMLCanvasElement | null = null
let onWheel: ((e: Event) => void) | null = null
let onPointerMove: ((e: PointerEvent) => void) | null = null
let lodPane: Element | null = null

function clearLod(): void {
  lodPane?.classList.remove(MOTION_LOD_CLASS)
  paneEl()?.classList.remove(MOTION_LOD_CLASS)
  lodPane = null
}

export function installCameraMotionLod(): () => void {
  if (scope) return uninstallCameraMotionLod
  styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)
  scope = effectScope(true)
  scope.run(() => {
    const settle = useDebounceFn(clearLod, SETTLE_MS)

    const onMotion = () => {
      const host = app as {
        canvas?: { ds?: { scale: number } }
        graph?: { _nodes?: unknown[] }
      }
      const scale = host?.canvas?.ds?.scale ?? 1
      const nodes = host?.graph?._nodes?.length ?? 0
      if (scale <= LOD_MAX_SCALE && nodes >= HEAVY_NODE_COUNT) {
        const pane = paneEl()
        if (pane && pane !== lodPane) clearLod()
        pane?.classList.add(MOTION_LOD_CLASS)
        lodPane = pane
      } else {
        clearLod()
      }
      void settle()
    }

    const bind = (el: HTMLCanvasElement) => {
      boundEl = el
      onWheel = () => onMotion()
      onPointerMove = (e: PointerEvent) => {
        if (e.buttons > 0) onMotion()
      }
      el.addEventListener('wheel', onWheel, { capture: true, passive: true })
      el.addEventListener('pointermove', onPointerMove,
        { capture: true, passive: true })
    }

    const tryBind = (): boolean => {
      const el = (app as { canvas?: { canvas?: HTMLCanvasElement } })
        ?.canvas?.canvas
      if (!el) return false
      bind(el)
      return true
    }
    if (!tryBind()) {
      const poll = useIntervalFn(() => {
        if (tryBind()) poll.pause()
      }, CANVAS_POLL_MS)
    }
  })
  return uninstallCameraMotionLod
}

export function uninstallCameraMotionLod(): void {
  if (boundEl) {
    if (onWheel) boundEl.removeEventListener('wheel', onWheel, { capture: true })
    if (onPointerMove) {
      boundEl.removeEventListener('pointermove', onPointerMove,
        { capture: true })
    }
  }
  boundEl = null
  onWheel = null
  onPointerMove = null
  scope?.stop()
  scope = null
  styleEl?.remove()
  styleEl = null
  clearLod()
}
