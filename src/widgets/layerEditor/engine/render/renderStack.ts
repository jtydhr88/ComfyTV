import { ADJUST_CODE, packParams, type AdjustmentOp } from '../adjust'
import type { Compositor, CompositeInput, NodeTexture } from '../compositor'
import type { ContentStore } from '../content'
import type { Document } from '../document'
import { resolveMode } from '../mode'
import type { AdjustmentData, GroupData, Rect, SceneNode, Transform } from '../node'
import { getNodeKind, type RenderNodeCtx } from '../nodeKind'
import { placeBitmap, type Bitmap } from './place'

export interface PlacedEntry {
  stamp: string
  canvas: HTMLCanvasElement
}

export interface RenderDeps {
  content: ContentStore
  compositor: Compositor
  devicePixelRatio?: number
  overrides?: Map<string, HTMLCanvasElement>
  placedCache?: Map<string, PlacedEntry>
}

export interface BuiltInputs {
  inputs: CompositeInput[]
  cleanup: () => void
}

function transformStamp(t: Transform): string {
  return `${t.x},${t.y},${t.w},${t.h},${t.rotation}`
}

function makePlaced(deps: RenderDeps, region: Rect, used: Set<string>) {
  return (
    cacheKey: string,
    contentStamp: string,
    bitmap: Bitmap,
    transform: Transform,
    linear = false
  ): NodeTexture | null => {
    const stamp = `${contentStamp}|${transformStamp(transform)}|${region.w}x${region.h}`
    const cache = deps.placedCache
    if (!cache) {
      const canvas = placeBitmap(bitmap, transform, region.w, region.h)
      return canvas ? { source: canvas, rect: region, linear, key: stamp } : null
    }
    used.add(cacheKey)
    const entry = cache.get(cacheKey)
    if (entry && entry.stamp === stamp) {
      return { source: entry.canvas, rect: region, linear, key: stamp }
    }
    const canvas = placeBitmap(bitmap, transform, region.w, region.h, entry?.canvas)
    if (!canvas) return null
    cache.set(cacheKey, { stamp, canvas })
    return { source: canvas, rect: region, linear, key: stamp }
  }
}

type PlacedFn = ReturnType<typeof makePlaced>

function renderMaskTexture(
  node: SceneNode,
  region: Rect,
  deps: RenderDeps,
  placed: PlacedFn
): NodeTexture | undefined {
  const m = node.mask
  if (!m || !m.enabled) return undefined
  const tf =
    node.transform.w > 0 && node.transform.h > 0
      ? node.transform
      : { x: 0, y: 0, w: region.w, h: region.h, rotation: 0 }
  const override = deps.overrides?.get(`mask:${node.id}`)
  if (override) {
    const canvas = placeBitmap(override, tf, region.w, region.h)
    return canvas ? { source: canvas, rect: region, linear: true } : undefined
  }
  const bitmap = deps.content.get(m.contentId)?.canvas
  if (!bitmap) return undefined
  return placed(`mask:${node.id}`, m.contentId, bitmap, tf, true) ?? undefined
}

function renderLeafTexture(node: SceneNode, ctx: RenderNodeCtx, deps: RenderDeps): NodeTexture | null {
  const override = deps.overrides?.get(`content:${node.id}`)
  if (override) {
    const canvas = placeBitmap(override, node.transform, ctx.region.w, ctx.region.h)
    if (canvas) return { source: canvas, rect: ctx.region, linear: false }
  }
  return getNodeKind(node.kind).renderNode(node, ctx)
}

function buildInputs(group: GroupData, doc: Document, deps: RenderDeps, used: Set<string>): BuiltInputs {
  const region: Rect = { x: 0, y: 0, w: doc.width, h: doc.height }
  const inputs: CompositeInput[] = []
  const cleanups: Array<() => void> = []
  const placed = makePlaced(deps, region, used)
  const ctx: RenderNodeCtx = {
    compositor: deps.compositor,
    content: deps.content,
    renderChild: () => null,
    placed,
    region,
    devicePixelRatio: deps.devicePixelRatio ?? 1,
  }

  for (const node of group.children) {
    if (!node.visible || node.opacity <= 0) continue

    if (node.kind === 'adjustment') {
      const adj = node as AdjustmentData
      const docSpace = { ...node, transform: { x: 0, y: 0, w: region.w, h: region.h, rotation: 0 } } as SceneNode
      inputs.push({
        adjust: { op: ADJUST_CODE[adj.op as AdjustmentOp] ?? 0, params: packParams(adj.op as AdjustmentOp, adj.params) },
        opacity: node.opacity,
        mask: renderMaskTexture(docSpace, region, deps, placed),
      })
      continue
    }

    if (node.kind === 'group') {
      const g = node as GroupData
      const sub = buildInputs(g, doc, deps, used)
      if (g.passThrough) {
        inputs.push(...sub.inputs)
        cleanups.push(sub.cleanup)
        continue
      }
      const handle = deps.compositor.allocTarget(doc.width, doc.height)
      deps.compositor.composite(sub.inputs, handle)
      sub.cleanup()
      cleanups.push(() => deps.compositor.freeTarget(handle))
      inputs.push({
        texture: { source: deps.compositor.targetTexture(handle), rect: region, linear: true },
        opacity: node.opacity,
        mode: resolveMode(node.mode),
        mask: renderMaskTexture(node, region, deps, placed),
      })
      continue
    }

    const texture = renderLeafTexture(node, ctx, deps)
    if (!texture) continue
    inputs.push({
      texture,
      opacity: node.opacity,
      mode: resolveMode(node.mode),
      mask: renderMaskTexture(node, region, deps, placed),
    })
  }

  return { inputs, cleanup: () => cleanups.forEach((fn) => fn()) }
}

export function buildDocumentInputs(doc: Document, deps: RenderDeps): BuiltInputs {
  return buildInputs(doc.root, doc, deps, new Set())
}

export function renderDocument(doc: Document, deps: RenderDeps, extra?: CompositeInput[]): void {
  deps.compositor.beginFrame?.()
  const used = new Set<string>()
  const { inputs, cleanup } = buildInputs(doc.root, doc, deps, used)
  deps.compositor.composite(extra?.length ? [...inputs, ...extra] : inputs, null)
  cleanup()
  if (deps.placedCache) {
    for (const key of [...deps.placedCache.keys()]) {
      if (!used.has(key)) deps.placedCache.delete(key)
    }
  }
}
