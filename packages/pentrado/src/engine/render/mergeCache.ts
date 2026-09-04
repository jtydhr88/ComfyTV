import type { Compositor, CompositeInput, FBOHandle } from '../compositor'
import type { Document } from '../document'
import { defaultMode, resolveMode } from '../mode'
import type { GroupData, RasterData, Rect, SceneNode } from '../node'
import { getNodeKind } from '../nodeKind'
import { buildInputs, renderDocument } from './renderInputs'
import type { RenderDeps } from './renderStack'

export const VIEWPORT_STAMP_QUANTUM = 256

export function viewportStamp(v: Rect | null | undefined): string {
  if (!v) return ''
  const q = VIEWPORT_STAMP_QUANTUM
  return `vp:${Math.floor(v.x / q)},${Math.floor(v.y / q)},${Math.ceil((v.x + v.w) / q)},${Math.ceil((v.y + v.h) / q)}`
}

export interface MergeCache {
  below: FBOHandle | null
  above: FBOHandle | null
  belowStamp: string | null
  aboveStamp: string | null
}

export function createMergeCache(): MergeCache {
  return { below: null, above: null, belowStamp: null, aboveStamp: null }
}

export function invalidateMergeCache(cache: MergeCache, compositor?: Compositor): void {
  if (compositor) {
    if (cache.below) compositor.freeTarget(cache.below)
    if (cache.above) compositor.freeTarget(cache.above)
  }
  cache.below = cache.above = null
  cache.belowStamp = cache.aboveStamp = null
}

const MERGE_MIN_SIBLINGS = 6

function subtreeContains(node: SceneNode, id: string): boolean {
  if (node.id === id) return true
  if (node.kind !== 'group') return false
  return (node as GroupData).children.some((c) => subtreeContains(c, id))
}

function collectIds(node: SceneNode, out: string[]): void {
  out.push(node.id)
  if (node.kind === 'group') for (const c of (node as GroupData).children) collectIds(c, out)
}

const stampMemo = new WeakMap<SceneNode, { deps: unknown[]; stamp: string }>()

function nodeStamp(n: SceneNode): string {
  const childStamps = n.kind === 'group' ? (n as GroupData).children.map(nodeStamp) : null
  const t = n.transform
  const a = n as SceneNode & Record<string, unknown>
  const deps: unknown[] = [
    n.visible, n.opacity, n.mode, t.x, t.y, t.w, t.h, t.rotation,
    n.mask?.contentId, n.mask?.enabled, n.fx,
    a.contentId, a.lockAlpha,
    a.text, a.fontSize, a.color, a.letterSpacing, a.lineHeight, a.align, a.fontRef,
    a.path, a.fill, a.stroke,
    a.op, a.params, a.curves,
    a.passThrough,
  ]
  if (childStamps) deps.push(childStamps.length, childStamps.join(''))
  const hit = stampMemo.get(n)
  if (hit && hit.deps.length === deps.length && hit.deps.every((v, i) => v === deps[i])) return hit.stamp
  const stamp = JSON.stringify(getNodeKind(n.kind).serialize(n))
  stampMemo.set(n, { deps, stamp })
  return stamp
}

function forEachRaster(n: SceneNode, fn: (r: RasterData) => void): void {
  if (n.kind === 'raster') fn(n as RasterData)
  else if (n.kind === 'group') for (const ch of (n as GroupData).children) forEachRaster(ch, fn)
}

function sliceStamp(nodes: SceneNode[], deps: RenderDeps, doc: Document): string {
  const parts: string[] = [`${doc.width}x${doc.height}`, viewportStamp(deps.viewport)]
  const ids: string[] = []
  for (const n of nodes) {
    parts.push(nodeStamp(n))
    collectIds(n, ids)
  }
  if (deps.content.residencyOf) {
    for (const n of nodes) {
      forEachRaster(n, (x) => parts.push(`rs:${x.id}:${deps.content.residencyOf!(x.contentId)}`))
    }
  }
  if (deps.overrides?.size) {
    for (const id of ids) {
      const c = deps.overrides.get(`content:${id}`)
      if (c) parts.push(`ov:${id}:${c.version}`)
      const m = deps.overrides.get(`mask:${id}`)
      if (m) parts.push(`ovm:${id}:${m.version}`)
    }
  }
  return parts.join('|')
}

function mergeableAbove(nodes: SceneNode[]): boolean {
  for (const n of nodes) {
    if (!n.visible || n.opacity <= 0) continue
    if (n.kind === 'adjustment') return false
    const m = resolveMode(n.mode)
    if (m.blend !== 'normal' || m.composite !== 'union' || m.compositeSpace !== 'linear') return false
    if (n.kind === 'group' && (n as GroupData).passThrough && !mergeableAbove((n as GroupData).children)) return false
  }
  return true
}

function compositeSlice(
  nodes: SceneNode[],
  doc: Document,
  deps: RenderDeps,
  target: FBOHandle
): void {
  const synthetic: GroupData = { ...doc.root, children: nodes }
  const { inputs, cleanup } = buildInputs(synthetic, doc, deps)
  deps.compositor.composite(inputs, target)
  cleanup()
}

function sliceInput(deps: RenderDeps, handle: FBOHandle, doc: Document): CompositeInput {
  return {
    texture: {
      source: deps.compositor.targetTexture(handle),
      rect: { x: 0, y: 0, w: doc.width, h: doc.height },
      linear: true,
    },
    opacity: 1,
    mode: resolveMode(defaultMode('normal')),
  }
}

export function clipRunAround(children: SceneNode[], index: number): [number, number] {
  let start = index
  while (start > 0 && children[start].clip === true) start--
  let end = index
  while (end + 1 < children.length && children[end + 1].clip === true) end++
  return [start, end]
}

export function renderDocumentCached(
  doc: Document,
  deps: RenderDeps,
  activeId: string | null,
  cache: MergeCache,
  extra?: CompositeInput[],
  region?: Rect | null
): void {
  const children = doc.root.children
  const pivotIndex = activeId ? children.findIndex((c) => subtreeContains(c, activeId)) : -1
  if (pivotIndex < 0 || children.length < MERGE_MIN_SIBLINGS) {
    invalidateMergeCache(cache, deps.compositor)
    renderDocument(doc, deps, extra, region)
    return
  }
  const [pivotStart, pivotEnd] = clipRunAround(children, pivotIndex)
  const below = children.slice(0, pivotStart)
  const pivotNodes = children.slice(pivotStart, pivotEnd + 1)
  const above = children.slice(pivotEnd + 1)
  const aboveOk = mergeableAbove(above)

  try {
    deps.compositor.beginFrame?.()
    const finalInputs: CompositeInput[] = []

    if (below.length) {
      const stamp = sliceStamp(below, deps, doc)
      const sizeOk = cache.below != null && cache.below.width === doc.width && cache.below.height === doc.height
      if (!sizeOk) {
        if (cache.below) deps.compositor.freeTarget(cache.below)
        cache.below = deps.compositor.allocTarget(doc.width, doc.height)
        cache.belowStamp = null
      }
      if (cache.belowStamp !== stamp) {
        compositeSlice(below, doc, deps, cache.below!)
        cache.belowStamp = stamp
      }
      finalInputs.push(sliceInput(deps, cache.below!, doc))
    } else if (cache.below) {
      deps.compositor.freeTarget(cache.below)
      cache.below = null
      cache.belowStamp = null
    }

    const pivotBuilt = buildInputs({ ...doc.root, children: pivotNodes }, doc, deps)
    finalInputs.push(...pivotBuilt.inputs)

    let aboveCleanup: (() => void) | null = null
    if (above.length && aboveOk) {
      const stamp = sliceStamp(above, deps, doc)
      const sizeOk = cache.above != null && cache.above.width === doc.width && cache.above.height === doc.height
      if (!sizeOk) {
        if (cache.above) deps.compositor.freeTarget(cache.above)
        cache.above = deps.compositor.allocTarget(doc.width, doc.height)
        cache.aboveStamp = null
      }
      if (cache.aboveStamp !== stamp) {
        compositeSlice(above, doc, deps, cache.above!)
        cache.aboveStamp = stamp
      }
      finalInputs.push(sliceInput(deps, cache.above!, doc))
    } else {
      if (cache.above) {
        deps.compositor.freeTarget(cache.above)
        cache.above = null
        cache.aboveStamp = null
      }
      if (above.length) {
        const built = buildInputs({ ...doc.root, children: above }, doc, deps)
        finalInputs.push(...built.inputs)
        aboveCleanup = built.cleanup
      }
    }

    if (extra?.length) finalInputs.push(...extra)
    deps.compositor.composite(finalInputs, null, region ?? undefined)
    pivotBuilt.cleanup()
    aboveCleanup?.()
  } catch (e) {
    console.warn('[pentrado] merge-cache render failed, falling back to full render', e)
    invalidateMergeCache(cache, deps.compositor)
    renderDocument(doc, deps, extra, region)
  }
}
