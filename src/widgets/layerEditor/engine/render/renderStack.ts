import type { Compositor, CompositeInput, NodeTexture } from '../compositor'
import type { ContentStore } from '../content'
import type { Document } from '../document'
import { resolveMode } from '../mode'
import type { GroupData, Rect, SceneNode } from '../node'
import { getNodeKind, type RenderNodeCtx } from '../nodeKind'
import { placeBitmap } from './place'

export interface RenderDeps {
  content: ContentStore
  compositor: Compositor
  devicePixelRatio?: number

  overrides?: Map<string, HTMLCanvasElement>
}

export interface BuiltInputs {
  inputs: CompositeInput[]
  cleanup: () => void
}

function renderMaskTexture(node: SceneNode, region: Rect, deps: RenderDeps): NodeTexture | undefined {
  const m = node.mask
  if (!m || !m.enabled) return undefined
  const override = deps.overrides?.get(`mask:${node.id}`)
  const bitmap = override ?? deps.content.get(m.contentId)?.canvas
  if (!bitmap) return undefined
  const canvas = placeBitmap(bitmap, node.transform, region.w, region.h)
  if (!canvas) return undefined
  return { source: canvas, rect: region, linear: true }
}

function renderLeafTexture(node: SceneNode, ctx: RenderNodeCtx, deps: RenderDeps): NodeTexture | null {
  const override = deps.overrides?.get(`content:${node.id}`)
  if (override) {
    const canvas = placeBitmap(override, node.transform, ctx.region.w, ctx.region.h)
    if (canvas) return { source: canvas, rect: ctx.region, linear: false }
  }
  return getNodeKind(node.kind).renderNode(node, ctx)
}

function buildInputs(group: GroupData, doc: Document, deps: RenderDeps): BuiltInputs {
  const region: Rect = { x: 0, y: 0, w: doc.width, h: doc.height }
  const inputs: CompositeInput[] = []
  const cleanups: Array<() => void> = []
  const ctx: RenderNodeCtx = {
    compositor: deps.compositor,
    content: deps.content,
    renderChild: () => null,
    region,
    devicePixelRatio: deps.devicePixelRatio ?? 1,
  }

  for (const node of group.children) {
    if (!node.visible || node.opacity <= 0) continue

    if (node.kind === 'group') {
      const g = node as GroupData
      const sub = buildInputs(g, doc, deps)
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
        mask: renderMaskTexture(node, region, deps),
      })
      continue
    }

    const texture = renderLeafTexture(node, ctx, deps)
    if (!texture) continue
    inputs.push({
      texture,
      opacity: node.opacity,
      mode: resolveMode(node.mode),
      mask: renderMaskTexture(node, region, deps),
    })
  }

  return { inputs, cleanup: () => cleanups.forEach((fn) => fn()) }
}

export function buildDocumentInputs(doc: Document, deps: RenderDeps): BuiltInputs {
  return buildInputs(doc.root, doc, deps)
}

export function renderDocument(doc: Document, deps: RenderDeps): void {
  const { inputs, cleanup } = buildInputs(doc.root, doc, deps)
  deps.compositor.composite(inputs, null)
  cleanup()
}
