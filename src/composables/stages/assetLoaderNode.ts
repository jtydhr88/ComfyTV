import type { Asset } from '@/api/schemas'
import { app } from '@/lib/comfyApp'

const LOADER_CLASS_BY_MEDIA: Record<string, string> = {
  image: 'ComfyTV.AssetImageLoaderStage',
  video: 'ComfyTV.AssetVideoLoaderStage',
  audio: 'ComfyTV.AssetAudioLoaderStage',
}

export function assetLoaderClass(mediaType: string): string | null {
  return LOADER_CLASS_BY_MEDIA[mediaType] ?? null
}

function setWidget(node: any, name: string, value: any) {
  const w = node.widgets?.find((wi: any) => wi.name === name)
  if (w) w.value = value
}

export function canvasCenter(): [number, number] {
  try {
    const canvas = (app as any)?.canvas
    const ds = canvas?.ds
    const el = canvas?.canvas
    const rect = el?.getBoundingClientRect?.()
    const w = rect?.width || el?.clientWidth || el?.width || 1000
    const h = rect?.height || el?.clientHeight || el?.height || 700
    if (ds?.convertCanvasToOffset) {
      const out = ds.convertCanvasToOffset([w / 2, h / 2], [0, 0])
      if (Array.isArray(out)) return [out[0], out[1]]
    }
    const scale = ds?.scale || 1
    const off = ds?.offset
    if (off) return [w / 2 / scale - off[0], h / 2 / scale - off[1]]
  } catch (e) {
    console.warn('[ComfyTV/asset-loader] canvasCenter failed', e)
  }
  return [0, 0]
}

export function clientToCanvasPos(clientX: number, clientY: number): [number, number] {
  try {
    const canvas = (app as any)?.canvas
    const ds = canvas?.ds
    const el = canvas?.canvas
    const rect = el?.getBoundingClientRect?.()
    const x = clientX - (rect?.left ?? 0)
    const y = clientY - (rect?.top ?? 0)
    if (ds?.convertCanvasToOffset) {
      const out = ds.convertCanvasToOffset([x, y], [0, 0])
      if (Array.isArray(out)) return [out[0], out[1]]
    }
    const scale = ds?.scale || 1
    const off = ds?.offset
    if (off) return [x / scale - off[0], y / scale - off[1]]
    return [x, y]
  } catch (e) {
    console.warn('[ComfyTV/asset-loader] clientToCanvasPos failed', e)
    return [0, 0]
  }
}

export interface SpawnAssetLoaderOpts {
  anchor?: 'topleft' | 'center'
  select?: boolean
}

export function createAssetLoaderNode(
  asset: Asset,
  pos: [number, number],
  opts: SpawnAssetLoaderOpts = {},
): any | null {
  const win = window as any
  if (!win.LiteGraph?.createNode) {
    console.error('[ComfyTV/asset-loader] LiteGraph.createNode not available')
    return null
  }
  const loaderClass = assetLoaderClass(asset.media_type)
  if (!loaderClass) return null
  const node = win.LiteGraph.createNode(loaderClass)
  if (!node) {
    console.error('[ComfyTV/asset-loader] createNode returned null for', asset.media_type)
    return null
  }
  ;(app as any)?.graph?.add(node)

  if (opts.anchor === 'center') {
    const sw = node.size?.[0] || 280
    const sh = node.size?.[1] || 200
    node.pos = [pos[0] - sw / 2, pos[1] - sh / 2]
  } else {
    node.pos = pos
  }

  const category = asset.category_ids.length > 0 ? String(asset.category_ids[0]) : 'none'
  setWidget(node, 'category', category)
  setWidget(node, 'asset_url', asset.payload_url)
  setWidget(node, 'asset_id', asset.id)

  if (opts.select) (app as any)?.canvas?.selectNode?.(node)
  ;(app as any)?.graph?.setDirtyCanvas?.(true, true)

  return node
}
