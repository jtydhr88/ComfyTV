import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { app, type LGraphNode } from '@/lib/comfyApp'
import { registerPreviewSource } from '@/composables/stages/previewBus'
import {
  CHAIN_PREVIEW_STAGES,
  type ChainRendererLike,
} from '@/composables/stages/fxChainPreviewRegistry'
import { isChainableFx } from '@/stores/stageStore'
import type { FxPreviewSource } from '@/widgets/glsl/fxPreviewSource'

const PAUSED_REFRESH_MS = 500
const MAX_CHAIN_DEPTH = 16

function nodeClass(node: unknown): string {
  const n = node as { comfyClass?: unknown; type?: unknown }
  return String(n?.comfyClass ?? n?.type ?? '')
}

export const isChainable = isChainableFx

function upstreamVideoNode(node: unknown, graphApp: unknown): unknown {
  const inputs = (node as { inputs?: { name?: string; link?: unknown }[] })
    ?.inputs ?? []
  const vin = inputs.find((i) => i?.name === 'video')
  if (vin?.link == null) return null
  const graph: any = (graphApp as any)?.graph
  const linksMap: any = graph?.links
  const link = (linksMap && typeof linksMap.get === 'function')
    ? linksMap.get(vin.link)
    : (linksMap?.[vin.link as any] ?? graph?.getLink?.(vin.link))
  return link ? graph?.getNodeById?.(link.origin_id) ?? null : null
}

export function collectUpstreamFxStack(
  node: unknown,
  graphApp: unknown = app,
): unknown[] {
  const stack: unknown[] = []
  let cur = upstreamVideoNode(node, graphApp)
  let depth = 0
  while (cur && depth < MAX_CHAIN_DEPTH && isChainable(cur)) {
    stack.unshift(cur)
    cur = upstreamVideoNode(cur, graphApp)
    depth++
  }
  return stack
}

interface StackEntry {
  node: unknown
  cls: string
  renderer: ChainRendererLike
  canvas: HTMLCanvasElement
}

export interface ChainCompositor {
  render(src: FxPreviewSource): FxPreviewSource | null
  signature(): string
  lostClasses(): string[]
  dispose(): void
}

export function createChainCompositor(
  node: unknown,
  graphApp: unknown = app,
): ChainCompositor {
  const stackEntries = new Map<unknown, StackEntry>()

  function syncStack(): StackEntry[] {
    const nodes = collectUpstreamFxStack(node, graphApp)
    const alive = new Set(nodes)
    for (const [key, entry] of stackEntries) {
      if (!alive.has(key)) {
        entry.renderer.dispose()
        stackEntries.delete(key)
      }
    }
    const out: StackEntry[] = []
    for (const n of nodes) {
      const cls = nodeClass(n)
      const def = CHAIN_PREVIEW_STAGES[cls]
      if (!def) continue
      let entry = stackEntries.get(n)
      if (entry == null || entry.cls !== cls) {
        entry?.renderer.dispose()
        entry = {
          node: n,
          cls,
          renderer: def.create(),
          canvas: document.createElement('canvas'),
        }
        stackEntries.set(n, entry)
      }
      out.push(entry)
    }
    return out
  }

  function render(src: FxPreviewSource): FxPreviewSource | null {
    let cur = src
    const stack = syncStack()
    const t = (src as { currentTime?: unknown }).currentTime
    const timeSec = typeof t === 'number' ? t : undefined
    for (const entry of stack) {
      const def = CHAIN_PREVIEW_STAGES[entry.cls]
      if (!def) continue
      if (!entry.renderer.renderToCanvas(cur, def.paramsOf(entry.node),
                                         entry.canvas, timeSec)) {
        console.warn(`[ComfyTV/fx-preview] upstream ${entry.cls} render failed: `
          + (entry.renderer.error ?? 'unknown'))
        return null
      }
      cur = entry.canvas
    }
    return cur
  }

  function signature(): string {
    const stack = syncStack()
    let out = ''
    for (const entry of stack) {
      const def = CHAIN_PREVIEW_STAGES[entry.cls]
      if (!def) continue
      out += `${entry.cls}${JSON.stringify(def.paramsOf(entry.node))};`
    }
    return out
  }

  function lostClasses(): string[] {
    const out: string[] = []
    for (const entry of stackEntries.values()) {
      if (entry.renderer.isLost?.()) out.push(entry.cls)
    }
    return out
  }

  function dispose(): void {
    for (const entry of stackEntries.values()) entry.renderer.dispose()
    stackEntries.clear()
  }

  return { render, signature, lostClasses, dispose }
}

export interface UseChainedFxPreviewOptions<TParams> {
  videoEl: Ref<HTMLVideoElement | null>
  canvasEl: Ref<HTMLCanvasElement | null>
  nodeId?: string
  node: LGraphNode
  params: () => Partial<TParams>
  createRenderer: () => ChainRendererLike
  graphApp?: unknown
}

export function useChainedFxPreview<TParams>(
  opts: UseChainedFxPreviewOptions<TParams>,
) {
  const supported = ref(true)
  const unregister = opts.nodeId != null
    ? registerPreviewSource(opts.nodeId, () => opts.canvasEl.value)
    : null
  let ownRenderer: ChainRendererLike | null = null
  const compositor = createChainCompositor(opts.node, opts.graphApp ?? app)
  let rafId = 0
  let vfc: { v: HTMLVideoElement; id: number } | null = null
  let idleTimer: ReturnType<typeof setInterval> | null = null
  let attached: HTMLVideoElement | null = null
  let lastHealthAt = 0
  let visible = true
  let lastSignature: string | null = null
  let io: IntersectionObserver | null = null

  function ownClass(): string {
    return nodeClass(opts.node)
  }

  function healthCheck(): void {
    if (Date.now() - lastHealthAt < 3000) return
    lastHealthAt = Date.now()
    const lost = compositor.lostClasses()
    if (ownRenderer?.isLost?.()) lost.push(`${ownClass()} (own)`)
    if (lost.length) {
      console.warn(`[ComfyTV/fx-preview] ${ownClass()} preview is STALE — `
        + `lost GL contexts in its chain: ${lost.join(', ')}`)
    }
  }

  function renderOnce(): void {
    if (!supported.value || !visible) return
    const v = opts.videoEl.value
    const target = opts.canvasEl.value
    if (!v || !target || v.readyState < 2) return
    const sig = `${v.currentSrc}|${v.currentTime}|`
      + `${JSON.stringify(opts.params())}|${compositor.signature()}`
    if (v.paused && sig === lastSignature) return
    ownRenderer ??= opts.createRenderer()

    const src = compositor.render(v)
    if (src == null) {
      console.warn(`[ComfyTV/fx-preview] ${ownClass()}: upstream chain failed — `
        + 'preview disabled for this card')
      supported.value = false
      stopLoop()
      return
    }
    if (!ownRenderer.renderToCanvas(
        src, opts.params() as Record<string, unknown>, target,
        v.currentTime)) {
      console.warn(`[ComfyTV/fx-preview] ${ownClass()}: own render failed: `
        + `${ownRenderer.error ?? 'unknown'} — preview disabled for this card`)
      supported.value = false
      stopLoop()
      return
    }
    lastSignature = sig
    healthCheck()
  }

  function scheduleNext(): void {
    if (!supported.value) return
    const v = attached
    const anyV = v as (HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
    }) | null
    if (anyV?.requestVideoFrameCallback) {
      vfc = {
        v: anyV,
        id: anyV.requestVideoFrameCallback(() => {
          vfc = null
          renderOnce()
          scheduleNext()
        }),
      }
    } else {
      rafId = requestAnimationFrame(() => {
        rafId = 0
        renderOnce()
        scheduleNext()
      })
    }
  }

  function startLoop(): void {
    stopLoop()
    if (!supported.value) return
    scheduleNext()
  }

  function stopLoop(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    if (vfc) {
      const anyV = vfc.v as HTMLVideoElement & {
        cancelVideoFrameCallback?: (id: number) => void
      }
      anyV.cancelVideoFrameCallback?.(vfc.id)
      vfc = null
    }
  }

  function startIdleRefresh(): void {
    stopIdleRefresh()
    idleTimer = setInterval(() => {
      if (attached && attached.paused) renderOnce()
    }, PAUSED_REFRESH_MS)
  }

  function stopIdleRefresh(): void {
    if (idleTimer != null) clearInterval(idleTimer)
    idleTimer = null
  }

  const onPlay = (): void => startLoop()
  const onStop = (): void => {
    stopLoop()
    renderOnce()
  }
  const onFrame = (): void => renderOnce()

  function detach(): void {
    if (!attached) return
    attached.removeEventListener('play', onPlay)
    attached.removeEventListener('pause', onStop)
    attached.removeEventListener('ended', onStop)
    attached.removeEventListener('seeked', onFrame)
    attached.removeEventListener('loadeddata', onFrame)
    attached = null
  }

  watch(opts.canvasEl, (c) => {
    io?.disconnect()
    io = null
    visible = true
    if (!c || typeof IntersectionObserver === 'undefined') return
    io = new IntersectionObserver((entries) => {
      const wasVisible = visible
      visible = entries[entries.length - 1]?.isIntersecting ?? true
      if (visible && !wasVisible) renderOnce()
    })
    io.observe(c)
  }, { immediate: true })

  watch(opts.videoEl, (v) => {
    detach()
    stopLoop()
    stopIdleRefresh()
    if (!v) return
    attached = v
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onStop)
    v.addEventListener('ended', onStop)
    v.addEventListener('seeked', onFrame)
    v.addEventListener('loadeddata', onFrame)
    startIdleRefresh()
    if (v.paused) renderOnce()
    else startLoop()
  }, { immediate: true })

  watch(() => opts.params(), () => renderOnce())

  onBeforeUnmount(() => {
    unregister?.()
    io?.disconnect()
    io = null
    detach()
    stopLoop()
    stopIdleRefresh()
    ownRenderer?.dispose()
    ownRenderer = null
    compositor.dispose()
  })

  return { supported, renderOnce, startLoop, stopLoop }
}
