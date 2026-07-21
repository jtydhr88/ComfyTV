import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { app, type LGraphNode } from '@/lib/comfyApp'
import { registerPreviewSource } from '@/composables/stages/previewBus'
import {
  CHAIN_PREVIEW_STAGES,
  type ChainRendererLike,
} from '@/composables/stages/fxChainPreviewRegistry'
import { FX_PASSTHROUGH_CLASSES } from '@/stores/stageStore'
import type { FxPreviewSource } from '@/widgets/glsl/fxPreviewSource'

const PAUSED_REFRESH_MS = 500
const MAX_CHAIN_DEPTH = 16

const SIDE_SLOTS: Record<string, string[]> = {
  'ComfyTV.KeyerStage': ['in_mask', 'out_mask', 'bg_video'],
  'ComfyTV.PIKStage': ['clean_plate_video', 'clean_plate', 'in_mask',
    'out_mask', 'bg_video'],
  'ComfyTV.VideoTransformStage': ['track'],
}

function nodeClass(node: unknown): string {
  const n = node as { comfyClass?: unknown; type?: unknown }
  return String(n?.comfyClass ?? n?.type ?? '')
}

export function isChainable(node: unknown): boolean {
  const cls = nodeClass(node)
  if (!FX_PASSTHROUGH_CLASSES.has(cls)) return false
  const sides = SIDE_SLOTS[cls]
  if (!sides) return true
  const inputs = (node as { inputs?: { name?: string; link?: unknown }[] })
    ?.inputs ?? []
  return !inputs.some((i) => sides.includes(String(i?.name))
    && i?.link != null)
}

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

  let lastStackDebugAt = 0

  function render(src: FxPreviewSource): FxPreviewSource | null {
    let cur = src
    const stack = syncStack()
    if (stack.length && Date.now() - lastStackDebugAt > 2000) {
      lastStackDebugAt = Date.now()
      console.debug('[ComfyTV/fx-preview] stack '
        + JSON.stringify(stack.map((e) => ({
            cls: e.cls,
            params: CHAIN_PREVIEW_STAGES[e.cls]?.paramsOf(e.node),
          })), null, 1))
    }
    for (const entry of stack) {
      const def = CHAIN_PREVIEW_STAGES[entry.cls]
      if (!def) continue
      if (!entry.renderer.renderToCanvas(cur, def.paramsOf(entry.node),
                                         entry.canvas)) {
        return null
      }
      cur = entry.canvas
    }
    return cur
  }

  function dispose(): void {
    for (const entry of stackEntries.values()) entry.renderer.dispose()
    stackEntries.clear()
  }

  return { render, dispose }
}

function debugMeanOf(src: CanvasImageSource): string {
  const c = document.createElement('canvas')
  c.width = 80
  c.height = 45
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 'n/a'
  ctx.drawImage(src, 0, 0, 80, 45)
  const d = ctx.getImageData(0, 0, 80, 45).data
  let r = 0
  let g = 0
  let b = 0
  const n = d.length / 4
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
  }
  return `[${(r / n).toFixed(1)}, ${(g / n).toFixed(1)}, ${(b / n).toFixed(1)}]`
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
  let idleTimer: ReturnType<typeof setInterval> | null = null
  let attached: HTMLVideoElement | null = null
  let lastDebugAt = 0

  function renderOnce(): void {
    if (!supported.value) return
    const v = opts.videoEl.value
    const target = opts.canvasEl.value
    if (!v || !target || v.readyState < 2) return
    ownRenderer ??= opts.createRenderer()

    const src = compositor.render(v)
    if (src == null) {
      supported.value = false
      stopLoop()
      return
    }
    if (!ownRenderer.renderToCanvas(
        src, opts.params() as Record<string, unknown>, target)) {
      supported.value = false
      stopLoop()
      return
    }
    if (Date.now() - lastDebugAt > 1000) {
      lastDebugAt = Date.now()
      console.debug(`[ComfyTV/fx-preview] t=${v.currentTime.toFixed(2)}s `
        + `src mean=${debugMeanOf(v)} composited mean=${debugMeanOf(target)}`)
    }
  }

  function loop(): void {
    renderOnce()
    if (supported.value) rafId = requestAnimationFrame(loop)
  }

  function startLoop(): void {
    stopLoop()
    if (!supported.value) return
    rafId = requestAnimationFrame(loop)
  }

  function stopLoop(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
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
    detach()
    stopLoop()
    stopIdleRefresh()
    ownRenderer?.dispose()
    ownRenderer = null
    compositor.dispose()
  })

  return { supported, renderOnce, startLoop, stopLoop }
}
