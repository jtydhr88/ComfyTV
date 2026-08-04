import { ADJUST_CODE, lutDataFor, packParams, type AdjustmentOp } from '../adjust'
import type { Compositor, CompositeInput, FBOHandle, NodeTexture, TileLayerInput } from '../compositor'
import type { ContentStore } from '../content'
import type { Document } from '../document'
import { defaultMode, resolveMode } from '../mode'
import type { AdjustmentData, GroupData, RasterData, Rect, SceneNode, Transform } from '../node'
import { getNodeKind, type RenderNodeCtx } from '../nodeKind'
import { fxStamp, getFxProcessed, type LayerFxData } from './layerFx'
import type { Bitmap } from './place'

export interface PreviewOverride {
  canvas: HTMLCanvasElement
  version: number
  rects?: Rect[] | null
}

export interface RenderDeps {
  content: ContentStore
  compositor: Compositor
  devicePixelRatio?: number
  overrides?: Map<string, PreviewOverride>
}

export interface BuiltInputs {
  inputs: CompositeInput[]
  cleanup: () => void
}

export function docRectToSourceRect(r: Rect, q: Transform, srcW: number, srcH: number): Rect {
  const cx = q.x + q.w / 2
  const cy = q.y + q.h / 2
  const cos = Math.cos(q.rotation)
  const sin = Math.sin(q.rotation)
  const sx = srcW / Math.max(1e-6, q.w)
  const sy = srcH / Math.max(1e-6, q.h)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [px, py] of [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ] as const) {
    const dx = px - cx
    const dy = py - cy
    const lx = (cos * dx + sin * dy + q.w / 2) * sx
    const ly = (-sin * dx + cos * dy + q.h / 2) * sy
    minX = Math.min(minX, lx)
    minY = Math.min(minY, ly)
    maxX = Math.max(maxX, lx)
    maxY = Math.max(maxY, ly)
  }
  const x = Math.max(0, Math.floor(minX) - 1)
  const y = Math.max(0, Math.floor(minY) - 1)
  return {
    x,
    y,
    w: Math.min(srcW, Math.ceil(maxX) + 1) - x,
    h: Math.min(srcH, Math.ceil(maxY) + 1) - y,
  }
}

function makePlaced(deps: RenderDeps, region: Rect, fxRef: { current: LayerFxData[] | null }) {
  return (
    cacheKey: string,
    contentStamp: string,
    bitmap: Bitmap,
    transform: Transform,
    linear = false,
    version?: number,
    dirtyRects?: Rect[] | null
  ): NodeTexture | null => {
    let fxTag = ''
    const fx = fxRef.current
    if (fx && fx.length && cacheKey.startsWith('content:')) {
      const processed = getFxProcessed(cacheKey, contentStamp, bitmap, fx)
      if (processed) {
        const sx = transform.w / Math.max(1, bitmap.width)
        const sy = transform.h / Math.max(1, bitmap.height)
        bitmap = processed.canvas
        transform = {
          x: transform.x - processed.pad * sx,
          y: transform.y - processed.pad * sy,
          w: transform.w + 2 * processed.pad * sx,
          h: transform.h + 2 * processed.pad * sy,
          rotation: transform.rotation,
        }
        fxTag = `|${fxStamp(fx)}`
      }
    }
    // Key uploads by content identity + source dims, NOT by node: layers that
    // share pixels (duplicates, shared masks) share one GPU texture.
    const stamp = `tex:${contentStamp}|${bitmap.width}x${bitmap.height}${fxTag}`
    return {
      source: bitmap,
      rect: region,
      linear,
      quad: transform,
      key: stamp,
      stamp,
      version: fxTag ? undefined : version,
      dirtyRects: fxTag ? undefined : (dirtyRects ?? undefined),
    }
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
    return renderPreviewTexture(`preview:mask:${node.id}`, override, tf, region, true) ?? undefined
  }
  const entry = deps.content.get(m.contentId)
  if (!entry) return undefined
  const scale = Math.min(tf.w / Math.max(1, entry.width), tf.h / Math.max(1, entry.height))
  const src = deps.content.renderSource?.(m.contentId, scale)
  const bitmap = src?.bitmap ?? entry.canvas
  if (!bitmap) return undefined
  return placed(`mask:${node.id}`, m.contentId, bitmap, tf, true, src?.version, src?.dirtyRects) ?? undefined
}

/**
 * Composite a tiled raster straight from its CPU tile grid via the GPU atlas
 * — no dense materialization. Falls back (returns null) whenever the
 * monolithic path is needed for correctness:
 *  - a paint preview override is active (dense preview texture)
 *  - layer fx (they process dense bitmaps)
 *  - minification below 0.5 (the atlas has no mip chain)
 */
function tryTileInput(
  node: SceneNode,
  region: Rect,
  deps: RenderDeps,
  placed: PlacedFn
): TileLayerInput | null {
  if (node.kind !== 'raster' || node.fx?.length) return null
  if (deps.overrides?.get(`content:${node.id}`)) return null
  const raster = node as RasterData
  if (deps.content.get(raster.contentId)?.isBlank) return null
  const grid = deps.content.tileGridOf?.(raster.contentId)
  if (!grid) return null
  const t = node.transform
  const scale = Math.min(t.w / Math.max(1, grid.width), t.h / Math.max(1, grid.height))
  if (scale < 0.5) return null
  const mode = resolveMode(node.mode)
  return {
    tiles: { grid, quad: t, linear: false, drawZero: mode.composite !== 'union' },
    mode,
    opacity: node.opacity,
    mask: renderMaskTexture(node, region, deps, placed),
  }
}

function renderLeafTexture(node: SceneNode, ctx: RenderNodeCtx, deps: RenderDeps): NodeTexture | null {
  const override = deps.overrides?.get(`content:${node.id}`)
  if (override) {
    const texture = renderPreviewTexture(`preview:content:${node.id}`, override, node.transform, ctx.region, false)
    if (texture) return texture
  }
  return getNodeKind(node.kind).renderNode(node, ctx)
}

function renderPreviewTexture(
  cacheKey: string,
  override: PreviewOverride,
  transform: Transform,
  region: Rect,
  linear: boolean
): NodeTexture | null {
  const src = override.canvas
  const dirty = override.rects
    ? override.rects.map((r) => docRectToSourceRect(r, transform, src.width, src.height))
    : undefined
  return {
    source: src,
    rect: region,
    linear,
    quad: transform,
    key: cacheKey,
    version: override.version,
    dirtyRects: dirty,
  }
}

/** True when a node is a clipping-mask member (clips to the layer below). */
function isClip(node: SceneNode): boolean {
  return node.clip === true
}

function buildInputs(group: GroupData, doc: Document, deps: RenderDeps): BuiltInputs {
  const region: Rect = { x: 0, y: 0, w: doc.width, h: doc.height }
  const inputs: CompositeInput[] = []
  const cleanups: Array<() => void> = []
  const fxRef: { current: LayerFxData[] | null } = { current: null }
  const placed = makePlaced(deps, region, fxRef)
  const ctx: RenderNodeCtx = {
    compositor: deps.compositor,
    content: deps.content,
    renderChild: () => null,
    placed,
    region,
    devicePixelRatio: deps.devicePixelRatio ?? 1,
  }

  // A layer with visible clipping children forms a clip group: composite the
  // base + clipped members into an isolated target (clipped members' coverage
  // times the accumulated base alpha), then blend that as one input with the
  // base's own mode/opacity — matching Photoshop's isolated clip semantics.
  const children = group.children
  // Emit one node's composite input(s) into `out`. Does NOT re-detect clip
  // groups — the caller handles clip grouping so this never recurses on clips.
  const emitNode = (node: SceneNode, out: CompositeInput[]): void => {
    if (node.kind === 'adjustment') { emitAdjustment(node, out, region, deps, placed); return }
    if (node.kind === 'group') { emitGroup(node as GroupData, doc, deps, out, cleanups, region, placed); return }
    const tileInput = tryTileInput(node, region, deps, placed)
    if (tileInput) { out.push(tileInput); return }
    fxRef.current = node.fx?.length ? node.fx : null
    const texture = renderLeafTexture(node, ctx, deps)
    fxRef.current = null
    if (!texture) return
    out.push({ texture, opacity: node.opacity, mode: resolveMode(node.mode), mask: renderMaskTexture(node, region, deps, placed) })
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (!node.visible || node.opacity <= 0) continue
    // Clip members with no visible base are orphans — treat as normal layers.
    if (isClip(node)) { emitNode(node, inputs); continue }

    // Does a clip group start here? (base + one or more clipping members above)
    let j = i + 1
    while (j < children.length && isClip(children[j])) j++
    const clipMembers = children.slice(i + 1, j).filter((n) => n.visible && n.opacity > 0)
    if (!clipMembers.length) { emitNode(node, inputs); continue }

    // Isolate: composite base (as normal onto transparent) + clipped members
    // (each clipped to the accumulated base alpha) into one target, then blend
    // that with the base's own mode/opacity — Photoshop clip semantics.
    const handle = deps.compositor.allocTarget(doc.width, doc.height)
    const sub: CompositeInput[] = []
    emitNode({ ...node, mode: defaultMode('normal'), opacity: 1 } as SceneNode, sub)
    const baseCount = sub.length
    for (const member of clipMembers) emitNode(member, sub)
    for (let k = baseCount; k < sub.length; k++) {
      const inp = sub[k]
      if ('texture' in inp || 'tiles' in inp) (inp as { clipToBackdrop?: boolean }).clipToBackdrop = true
    }
    deps.compositor.composite(sub, handle)
    cleanups.push(() => deps.compositor.freeTarget(handle))
    inputs.push({
      texture: { source: deps.compositor.targetTexture(handle), rect: region, linear: true },
      opacity: node.opacity,
      mode: resolveMode(node.mode),
      mask: renderMaskTexture(node, region, deps, placed),
    })
    i = j - 1
  }

  return { inputs, cleanup: () => cleanups.forEach((fn) => fn()) }
}

function emitAdjustment(node: SceneNode, inputs: CompositeInput[], region: Rect, deps: RenderDeps, placed: PlacedFn): void {
  const adj = node as AdjustmentData
  const docSpace = { ...node, transform: { x: 0, y: 0, w: region.w, h: region.h, rotation: 0 } } as SceneNode
  inputs.push({
    adjust: {
      op: ADJUST_CODE[adj.op as AdjustmentOp] ?? 0,
      params: packParams(adj.op as AdjustmentOp, adj.params),
      lut: lutDataFor(adj.op as AdjustmentOp, adj.params, adj.curves),
    },
    opacity: node.opacity,
    mask: renderMaskTexture(docSpace, region, deps, placed),
  })
}

function emitGroup(
  g: GroupData,
  doc: Document,
  deps: RenderDeps,
  inputs: CompositeInput[],
  cleanups: Array<() => void>,
  region: Rect,
  placed: PlacedFn
): void {
  const sub = buildInputs(g, doc, deps)
  if (g.passThrough) {
    inputs.push(...sub.inputs)
    cleanups.push(sub.cleanup)
    return
  }
  const handle = deps.compositor.allocTarget(doc.width, doc.height)
  deps.compositor.composite(sub.inputs, handle)
  sub.cleanup()
  cleanups.push(() => deps.compositor.freeTarget(handle))
  inputs.push({
    texture: { source: deps.compositor.targetTexture(handle), rect: region, linear: true },
    opacity: g.opacity,
    mode: resolveMode(g.mode),
    mask: renderMaskTexture(g, region, deps, placed),
  })
}

export function buildDocumentInputs(doc: Document, deps: RenderDeps): BuiltInputs {
  return buildInputs(doc.root, doc, deps)
}

export function renderDocument(doc: Document, deps: RenderDeps, extra?: CompositeInput[], region?: Rect | null): void {
  deps.compositor.beginFrame?.()
  const { inputs, cleanup } = buildInputs(doc.root, doc, deps)
  deps.compositor.composite(extra?.length ? [...inputs, ...extra] : inputs, null, region ?? undefined)
  cleanup()
}

/* ------------------------------------------------------------------------- *
 * Merge caches: while one root-level subtree is being edited, the composite
 * of everything below it and everything above it is kept in two persistent
 * targets, so a paint frame costs ~3 passes instead of one per layer.
 * ------------------------------------------------------------------------- */

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

/** Caching only pays off once rebuild-on-structure-change beats per-frame passes. */
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

/**
 * Per-node stamp memo. Serializing every node each frame was the dominant
 * drag cost on layer-heavy documents, so a node's stamp is reused as long as
 * a shallow dependency list is reference/value-equal. The engine's mutation
 * convention makes this sound: pixel-affecting nested state is replaced, not
 * mutated in place (new contentId per edit, new mode/path/fill/params/fx
 * objects, primitive fields for the rest).
 */
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
  if (childStamps) deps.push(childStamps.length, childStamps.join(''))
  const hit = stampMemo.get(n)
  if (hit && hit.deps.length === deps.length && hit.deps.every((v, i) => v === deps[i])) return hit.stamp
  const stamp = JSON.stringify(getNodeKind(n.kind).serialize(n))
  stampMemo.set(n, { deps, stamp })
  return stamp
}

function sliceStamp(nodes: SceneNode[], deps: RenderDeps, doc: Document): string {
  const parts: string[] = [`${doc.width}x${doc.height}`]
  const ids: string[] = []
  for (const n of nodes) {
    parts.push(nodeStamp(n))
    collectIds(n, ids)
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

/** Merging above-layers is only exact when their compositing is associative. */
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
  const below = children.slice(0, pivotIndex)
  const pivot = children[pivotIndex]
  const above = children.slice(pivotIndex + 1)
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

    const pivotBuilt = buildInputs({ ...doc.root, children: [pivot] }, doc, deps)
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
    // A lost GL context invalidates cached target handles mid-frame; recover
    // by dropping the caches and doing a plain full render.
    console.warn('[pentrado] merge-cache render failed, falling back to full render', e)
    invalidateMergeCache(cache, deps.compositor)
    renderDocument(doc, deps, extra, region)
  }
}
