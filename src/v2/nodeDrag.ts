import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { effectScope, type EffectScope } from 'vue'

import { app, type ComfyNode } from '@/lib/comfyApp'

const nudgeScope = effectScope(true)
const nudgePending = new Set<HTMLElement>()
let nudged: HTMLElement[] = []
const poke = (roots: HTMLElement[], on: boolean) => {
  for (const root of roots) {
    const grid = root.querySelector<HTMLElement>('[data-widgets-grid-node-id]')
    const card = root.querySelector<HTMLElement>('.v2-card')
    if (!grid || !card) continue
    grid.style.paddingBottom = on ? '1px' : ''
    card.style.marginBottom = on ? '-1px' : ''
  }
}
const nudgeRevert = nudgeScope.run(() => useTimeoutFn(() => {
  poke(nudged, false)
  nudged = []
}, 40, { immediate: false }))!
const nudgeTimer = nudgeScope.run(() => useTimeoutFn(() => {
  if (nudged.length) { nudgeTimer.start(); return }
  const roots = [...nudgePending].filter((r) => r.isConnected)
  nudgePending.clear()
  if (!roots.length) return
  nudged = roots
  poke(roots, true)
  nudgeRevert.start()
}, 60, { immediate: false }))!
export function nudgeSlotAnchors(root: HTMLElement) {
  nudgePending.add(root)
  nudgeTimer.start()
}

const CLUSTER = '[data-testid^="node-body-"] > div:first-child > div'

export function bindClusterHoverIntent(root: HTMLElement, scope: EffectScope) {
  const clusters = root.querySelectorAll<HTMLElement>(CLUSTER)
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
      document.body.toggleAttribute('data-v2-slot-hover', true)
      if (!c.classList.contains('v2-open')) {
        c.classList.add('v2-open')
        nudgeSlotAnchors(root)
      }
    })
    c.addEventListener('pointerleave', () => {
      leave.stop()
      leave.start()
      document.body.toggleAttribute('data-v2-slot-hover', false)
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

let linkHoverNode: HTMLElement | null = null
let linkHoverCluster: HTMLElement | null = null

function setLinkHover(node: HTMLElement | null, cluster: HTMLElement | null): void {
  if (node !== linkHoverNode) {
    linkHoverNode?.removeAttribute('data-v2-link-hover')
    node?.setAttribute('data-v2-link-hover', '')
  }
  if (cluster !== linkHoverCluster && linkHoverCluster && !linkHoverCluster.matches(':hover')) {
    linkHoverCluster.classList.remove('v2-open')
    if (linkHoverNode) nudgeSlotAnchors(linkHoverNode)
  }
  if (cluster && cluster !== linkHoverCluster && node) {
    cluster.classList.add('v2-open')
    nudgeSlotAnchors(node)
  }
  linkHoverNode = node
  linkHoverCluster = cluster
}

function trackLinkDragHover(e: PointerEvent): void {
  const connector = (app as any).canvas?.linkConnector
  const side = connector?.isConnecting ? connector.state?.connectingTo : null
  if (!side) {
    if (linkHoverNode) setLinkHover(null, null)
    return
  }
  const hit = document.elementFromPoint(e.clientX, e.clientY)
  const node = hit?.closest<HTMLElement>('[data-node-id][data-v2-shell]') ?? null
  const cluster = node ? hit!.closest<HTMLElement>(CLUSTER) : null
  setLinkHover(node, cluster && cluster.classList.contains('ml-auto') === (side === 'output') ? cluster : null)
}

function dropCanvasLinkOnV2Slot(e: PointerEvent): void {
  const canvas = (app as any).canvas
  const connector = canvas?.linkConnector
  if (!connector?.isConnecting || e.target !== canvas.canvas) return
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-node-id][data-v2-shell]')
  const node = el ? canvas.graph?.getNodeById(el.dataset.nodeId) : null
  if (!node) return
  const rect = canvas.canvas.getBoundingClientRect()
  const [canvasX, canvasY] = canvas.ds.convertCanvasToOffset([e.clientX - rect.left, e.clientY - rect.top])
  if (node.isPointInside(canvasX, canvasY)) return
  connector.dropOnNode(node, { canvasX, canvasY })
  connector.reset()
}

let linkHoverScope: EffectScope | null = null

export function installLinkDragHover(root: Document = document): void {
  if (linkHoverScope) return
  linkHoverScope = effectScope(true)
  linkHoverScope.run(() => {
    useEventListener(root, 'pointermove', trackLinkDragHover, { capture: true, passive: true })
    useEventListener(root, 'pointerup', (e: PointerEvent) => {
      dropCanvasLinkOnV2Slot(e)
      setLinkHover(null, null)
    }, { capture: true, passive: true })
  })
}
