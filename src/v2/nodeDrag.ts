import { useTimeoutFn } from '@vueuse/core'
import { effectScope, type EffectScope } from 'vue'

import { app, type ComfyNode } from '@/lib/comfyApp'

const nudgeScope = effectScope(true)
let nudgeFlip = false
let nudgeRoot: HTMLElement | null = null
const nudgeTimer = nudgeScope.run(() => useTimeoutFn(() => {
  const root = nudgeRoot
  nudgeRoot = null
  const id = root?.getAttribute('data-node-id')
  if (id == null) return
  const graph: any = (app as any).graph
  const n = graph?.getNodeById?.(id) ?? graph?.getNodeById?.(Number(id))
  if (!n?.setSize) return
  nudgeFlip = !nudgeFlip
  n.setSize([n.size[0], n.size[1] + (nudgeFlip ? 0.01 : -0.01)])
}, 60, { immediate: false }))!
function nudgeSlotAnchors(root: HTMLElement) {
  nudgeRoot = root
  nudgeTimer.start()
}

export function bindClusterHoverIntent(root: HTMLElement, scope: EffectScope) {
  const clusters = root.querySelectorAll<HTMLElement>(
    '[data-testid^="node-body-"] > div:first-child > div',
  )
  for (const c of clusters) {
    if (c.dataset.v2Hover) continue
    c.dataset.v2Hover = '1'
    const leave = scope.run(() => useTimeoutFn(() => {
      c.classList.remove('v2-open')
      nudgeSlotAnchors(root)
    }, 220, { immediate: false }))
    if (!leave) continue
    c.addEventListener('pointerenter', () => {
      leave.stop()
      if (!c.classList.contains('v2-open')) {
        c.classList.add('v2-open')
        nudgeSlotAnchors(root)
      }
    })
    c.addEventListener('pointerleave', () => {
      leave.stop()
      leave.start()
    })
  }
}

function draggedItems(node: ComfyNode, canvas: any, e: PointerEvent): Iterable<any> {
  const selected: Set<any> | undefined = canvas?.selectedItems
  if (!selected || !selected.has(node) || selected.size <= 1) return [node]
  if (e.ctrlKey || e.metaKey) return selected
  const all = new Set<any>()
  const add = (item: any) => {
    if (!item || item.pinned || all.has(item)) return
    all.add(item)
    if (item.children) for (const child of item.children) add(child)
  }
  for (const item of selected) add(item)
  return all
}

function selectForPointer(node: ComfyNode, canvas: any, e: PointerEvent) {
  if (typeof canvas?.processSelect === 'function') canvas.processSelect(node, e)
  else canvas?.selectNode(node, e.shiftKey || e.ctrlKey || e.metaKey)
}

export function bindNodeDrag(node: ComfyNode, surface: HTMLElement) {
  let drag: { x: number; y: number; moved: boolean } | null = null
  surface.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    try {
      surface.setPointerCapture(e.pointerId)
    } catch { }
    drag = { x: e.clientX, y: e.clientY, moved: false }
  })
  surface.addEventListener('pointermove', (e) => {
    if (!drag || !(e.buttons & 1)) return
    e.stopPropagation()
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    const canvas = (app as any).canvas
    if (!drag.moved) {
      drag.moved = true
      if (!(node as any).selected) selectForPointer(node, canvas, e)
    }
    drag.x = e.clientX
    drag.y = e.clientY
    const scale = canvas?.ds?.scale || 1
    const gdx = dx / scale
    const gdy = dy / scale
    for (const item of draggedItems(node, canvas, e)) {
      if (item.pinned) continue
      item.pos = [item.pos[0] + gdx, item.pos[1] + gdy]
    }
    ;(app as any).graph?.setDirtyCanvas(true, true)
  })
  const endDrag = (e: PointerEvent) => {
    if (!drag) return
    e.stopPropagation()
    try {
      if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId)
    } catch { }
    const wasClick = !drag.moved
    drag = null
    if (wasClick) selectForPointer(node, (app as any).canvas, e)
  }
  surface.addEventListener('pointerup', endDrag)
  surface.addEventListener('pointercancel', endDrag)
}
