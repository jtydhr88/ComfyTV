import type { Pinia } from 'pinia'

import type { Asset } from '@/api/schemas'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import { clientToCanvasPos, createAssetLoaderNode } from '@/composables/stages/assetLoaderNode'
import { app } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { mediaTypeOf, type AssetMediaType } from '@/utils/mediaFileTypes'

export const ASSET_DRAG_MIME = 'application/x-comfytv-asset-id'
export const EAGLE_DRAG_MIME = 'application/x-comfytv-eagle-item'

export type ResolveAsset = (id: number) => Asset | null

const MULTI_DROP_STEP = 40
const LOADER_FILE_KINDS = new Set<AssetMediaType | null>(['image', 'video', 'audio'])

let dropFilesAsLoaders = false

export function applyCanvasDropSetting(rows: Array<{ key: string; value: unknown }>): void {
  const row = rows.find((r) => r.key === 'drop-files-as-loaders')
  if (row) dropFilesAsLoaders = row.value === true
}

export function parseAssetDragIds(raw: string): number[] {
  const out: number[] = []
  for (const part of raw.split(',')) {
    const id = Number(part.trim())
    if (part.trim() && Number.isFinite(id) && !out.includes(id)) out.push(id)
  }
  return out
}

function hasMime(e: DragEvent, mime: string): boolean {
  const types = e.dataTransfer?.types
  return !!types && Array.from(types).includes(mime)
}

export function handleAssetDragOver(e: DragEvent): void {
  if (!hasMime(e, ASSET_DRAG_MIME) && !hasMime(e, EAGLE_DRAG_MIME)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

export function handleAssetDrop(e: DragEvent, resolveAsset: ResolveAsset): void {
  if (hasMime(e, EAGLE_DRAG_MIME)) {
    e.preventDefault()
    e.stopPropagation()
    const eagleId = e.dataTransfer?.getData(EAGLE_DRAG_MIME) ?? ''
    if (!eagleId) return
    const pos = clientToCanvasPos(e.clientX, e.clientY)
    void (async () => {
      try {
        const { importEagleItem } = await import('@/api/eagle')
        const res = await importEagleItem(eagleId)
        if (res.asset) {
          createAssetLoaderNode(res.asset, pos, { anchor: 'center', select: true })
        }
      } catch (err) {
        console.warn('[ComfyTV/eagle] drop import failed:', err)
      }
    })()
    return
  }

  if (!hasMime(e, ASSET_DRAG_MIME)) {
    handleFileDrop(e)
    return
  }
  e.preventDefault()
  e.stopPropagation()

  const raw = e.dataTransfer?.getData(ASSET_DRAG_MIME) ?? ''
  const assets = parseAssetDragIds(raw).map(resolveAsset).filter((a): a is Asset => !!a)
  if (!assets.length) {
    console.warn('[ComfyTV/assets] dropped asset not found:', raw)
    return
  }
  const [x, y] = clientToCanvasPos(e.clientX, e.clientY)
  assets.forEach((asset, i) => {
    createAssetLoaderNode(asset, [x + i * MULTI_DROP_STEP, y + i * MULTI_DROP_STEP], {
      anchor: 'center',
      select: true,
    })
  })
}

function handleFileDrop(e: DragEvent): void {
  if (!dropFilesAsLoaders || (app as any).dragOverNode) return
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (!files.length || !files.every((f) => LOADER_FILE_KINDS.has(mediaTypeOf(f)))) return
  e.preventDefault()
  e.stopPropagation()
  const [x, y] = clientToCanvasPos(e.clientX, e.clientY)
  void (async () => {
    try {
      const assets = await importAssetFiles(files)
      assets.forEach((asset, i) => {
        createAssetLoaderNode(asset, [x + i * MULTI_DROP_STEP, y + i * MULTI_DROP_STEP], {
          anchor: 'center',
          select: true,
        })
      })
    } catch (err) {
      console.warn('[ComfyTV/assets] file drop import failed:', err)
    }
  })()
}

let installed = false

export function installAssetCanvasDrop(pinia: Pinia): void {
  if (installed) return
  installed = true

  const resolveAsset: ResolveAsset = (id) => useAssetStore(pinia).byId(id) ?? null

  let tries = 0
  const tryInstall = () => {
    const el = (app as any)?.canvas?.canvas as HTMLCanvasElement | undefined
    if (!el) {
      if (tries++ < 1200) requestAnimationFrame(tryInstall)
      else console.warn('[ComfyTV/assets] graph canvas never appeared; drag-to-canvas disabled')
      return
    }
    el.addEventListener('dragover', handleAssetDragOver)
    el.addEventListener('drop', (e) => handleAssetDrop(e, resolveAsset))
  }
  tryInstall()
}
