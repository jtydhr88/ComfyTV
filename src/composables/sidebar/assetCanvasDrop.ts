import type { Pinia } from 'pinia'

import type { Asset } from '@/api/schemas'
import { clientToCanvasPos, createAssetLoaderNode } from '@/composables/stages/assetLoaderNode'
import { app } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'

export const ASSET_DRAG_MIME = 'application/x-comfytv-asset-id'

export type ResolveAsset = (id: number) => Asset | null

function isAssetDrag(e: DragEvent): boolean {
  const types = e.dataTransfer?.types
  return !!types && Array.from(types).includes(ASSET_DRAG_MIME)
}

export function handleAssetDragOver(e: DragEvent): void {
  if (!isAssetDrag(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

export function handleAssetDrop(e: DragEvent, resolveAsset: ResolveAsset): void {
  if (!isAssetDrag(e)) return
  e.preventDefault()
  e.stopPropagation()

  const raw = e.dataTransfer?.getData(ASSET_DRAG_MIME) ?? ''
  const id = Number(raw)
  if (!Number.isFinite(id)) return
  const asset = resolveAsset(id)
  if (!asset) {
    console.warn('[ComfyTV/assets] dropped asset not found:', raw)
    return
  }
  createAssetLoaderNode(asset, clientToCanvasPos(e.clientX, e.clientY), {
    anchor: 'center',
    select: true,
  })
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
