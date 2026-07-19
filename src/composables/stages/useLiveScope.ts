import { computed, onBeforeUnmount, watch, type Ref } from 'vue'
import { app, type LGraphNode } from '@/lib/comfyApp'
import {
  getPreviewSource,
  previewBusRevision,
  type PreviewCanvasGetter,
} from '@/composables/stages/previewBus'
import { drawScope, type ImageDataLike, type ScopeKind } from '@/composables/stages/scopeMath'

export function resolveUpstreamNodeId(node: LGraphNode, slot: string): string | null {
  const n = node as any
  const inp = (n.inputs ?? []).find((i: any) => i?.name === slot)
  if (!inp || inp.link == null) return null
  const graph: any = n.graph ?? (app as any)?.graph
  const linksMap: any = graph?.links
  const link = (linksMap && typeof linksMap.get === 'function')
    ? linksMap.get(inp.link)
    : (linksMap?.[inp.link] ?? graph?.getLink?.(inp.link))
  const origin = link?.origin_id
  return origin == null ? null : String(origin)
}

export interface UseLiveScopeOptions {
  node: LGraphNode
  slot?: string
  scope: () => ScopeKind
  canvasEl: Ref<HTMLCanvasElement | null>
  deps?: () => unknown
  fps?: number
  sampleWidth?: number
  getSource?: (id: string) => PreviewCanvasGetter | null
  sample?: (src: HTMLCanvasElement, maxW: number) => ImageDataLike | null
  paint?: (target: HTMLCanvasElement, kind: ScopeKind, img: ImageDataLike) => void
}

export function useLiveScope(opts: UseLiveScopeOptions) {
  const slot = opts.slot ?? 'video'
  const frameMs = 1000 / (opts.fps ?? 15)
  const maxW = opts.sampleWidth ?? 320
  const getSource = opts.getSource ?? getPreviewSource

  let sampleCanvas: HTMLCanvasElement | null = null
  function defaultSample(src: HTMLCanvasElement, limit: number): ImageDataLike | null {
    if (!src.width || !src.height) return null
    const w = Math.min(limit, src.width)
    const h = Math.max(1, Math.round((src.height * w) / src.width))
    sampleCanvas ??= document.createElement('canvas')
    sampleCanvas.width = w
    sampleCanvas.height = h
    const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    try {
      ctx.drawImage(src, 0, 0, w, h)
      return ctx.getImageData(0, 0, w, h)
    } catch {
      return null
    }
  }

  function defaultPaint(target: HTMLCanvasElement, kind: ScopeKind, img: ImageDataLike): void {
    if (!target.width || !target.height) return
    const ctx = target.getContext('2d')
    if (!ctx) return
    drawScope(ctx, kind, img, target.width, target.height)
  }

  const sample = opts.sample ?? defaultSample
  const paint = opts.paint ?? defaultPaint

  const live = computed(() => {
    previewBusRevision.value
    opts.deps?.()
    const id = resolveUpstreamNodeId(opts.node, slot)
    return id != null && getSource(id) != null
  })

  let rafId = 0
  let lastTs = -Infinity

  function tick(ts: number): void {
    rafId = requestAnimationFrame(tick)
    if (ts - lastTs < frameMs) return
    lastTs = ts
    const target = opts.canvasEl.value
    if (!target) return
    const id = resolveUpstreamNodeId(opts.node, slot)
    const src = id != null ? getSource(id)?.() : null
    if (!src) return
    const img = sample(src, maxW)
    if (!img) return
    paint(target, opts.scope(), img)
  }

  function start(): void {
    if (rafId) return
    lastTs = -Infinity
    rafId = requestAnimationFrame(tick)
  }

  function stop(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  watch(live, (on) => {
    if (on) start()
    else stop()
  }, { immediate: true })

  onBeforeUnmount(() => {
    stop()
    sampleCanvas = null
  })

  return { live }
}
