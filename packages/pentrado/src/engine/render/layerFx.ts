import { applyLayerFxChainGpu } from './fxGpu'
import { applyLayerFxChain } from './layerFxCpu'
import { fxPad, fxStamp, type LayerFxData } from './layerFxDefs'
import type { Bitmap } from './place'

export * from './layerFxDefs'
export { applyLayerFxChain, blurBoxRadii, gaussianIsNoop } from './layerFxCpu'

interface FxCacheEntry {
  stamp: string
  canvas: HTMLCanvasElement
  pad: number
}

const fxCache = new Map<string, FxCacheEntry>()
const FX_CACHE_MAX = 64

export function getFxProcessed(
  cacheKey: string,
  contentStamp: string,
  bitmap: Bitmap,
  fx: LayerFxData[]
): { canvas: HTMLCanvasElement; pad: number } | null {
  const stamp = `${contentStamp}|${bitmap.width}x${bitmap.height}|${fxStamp(fx)}`
  const entry = fxCache.get(cacheKey)
  if (entry && entry.stamp === stamp) return { canvas: entry.canvas, pad: entry.pad }
  const active = fx.filter((f) => f.enabled)
  const pad = active.reduce((n, f) => n + fxPad(f), 0)
  const gpuCanvas =
    bitmap.width + 2 * pad <= 16384 && bitmap.height + 2 * pad <= 16384
      ? applyLayerFxChainGpu(bitmap, active, pad)
      : null
  const result = gpuCanvas ? { canvas: gpuCanvas, pad } : applyLayerFxChain(bitmap, fx)
  if (!result) return null
  if (fxCache.size >= FX_CACHE_MAX && !fxCache.has(cacheKey)) {
    const first = fxCache.keys().next().value
    if (first !== undefined) fxCache.delete(first)
  }
  fxCache.set(cacheKey, { stamp, canvas: result.canvas, pad: result.pad })
  return result
}
