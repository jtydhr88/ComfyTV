import { useResizeObserver } from '@vueuse/core'
import { effectScope, watch, type EffectScope } from 'vue'

import { app, type ComfyNode } from '@/lib/comfyApp'

export const I = (d: string, sw = 1.7) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}">${d}</svg>`
export const ICON_STOP = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>`
export const RUN_BUTTON_HTML = `<span class="v2-run__up">${I(`<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>`, 2.4)}</span><span class="v2-run__stop">${ICON_STOP}</span>`

export const ICON_GRIP = `<svg class="v2-grip" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="5" r="1.7"/><circle cx="16" cy="5" r="1.7"/><circle cx="8" cy="12" r="1.7"/><circle cx="16" cy="12" r="1.7"/><circle cx="8" cy="19" r="1.7"/><circle cx="16" cy="19" r="1.7"/></svg>`

export function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

export function bindPromptResize(node: ComfyNode, promptAnchor: HTMLElement, scope: EffectScope) {
  scope.run(() => {
    let last = -1
    useResizeObserver(promptAnchor, (entries) => {
      const h = entries[0]?.contentRect.height ?? 0
      if (last >= 0) {
        const delta = h - last
        if (Math.abs(delta) > 1) {
          node.setSize([node.size[0], node.size[1] + delta])
          ;(app as any).graph?.setDirtyCanvas(true, true)
        }
      }
      last = h
    })
  })
}

export function ensureMinSize(node: ComfyNode, minW: number, minH: number) {
  if ((node as any).__comfytvFromSave) return
  const [w0, h0] = node.size
  node.setSize([Math.max(w0, minW), Math.max(h0, minH)])
}

export function createNodeScope(node: ComfyNode): EffectScope {
  const scope = effectScope(true)
  const anyNode = node as any
  const prev = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    scope.stop()
    prev?.apply(this, args)
  }
  return scope
}

export function bindProgressRing(
  card: HTMLElement,
  state: { running?: boolean; progress?: { value: number; max: number; text?: string } | null },
) {
  const ring = document.createElement('div')
  ring.className = 'v2-ring'
  card.appendChild(ring)
  watch(
    () => [state.running, state.progress?.value, state.progress?.max] as const,
    ([running, v, m]) => {
      const value = Number(v) || 0
      const max = Number(m) || 0
      const p = running && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
      ring.style.setProperty('--v2-p', p.toFixed(4))
      ring.dataset.on = running ? '1' : ''
      ring.dataset.indeterminate = running && p <= 0 ? '1' : ''
    },
    { immediate: true },
  )
  return ring
}
