import { ref } from 'vue'

import type { Asset } from '@/api/schemas'
import { ASSET_DRAG_MIME } from '@/composables/sidebar/assetCanvasDrop'
import { t } from '@/i18n'
import { app } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { type AssetMediaType, dragMayMatchKind, mediaTypeOf } from '@/utils/mediaFileTypes'

export interface LoaderFileDropOptions {
  kind: () => AssetMediaType
  onFiles: (files: File[]) => void | Promise<void>
  onAsset?: (asset: Asset) => void
}

function toast(severity: 'warn' | 'error', summary: string, detail: string): void {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

export function toastLoaderUploadFailed(e: unknown): void {
  toast('error', t('loaderDrop.failedTitle'), t('loaderDrop.uploadFailed', {
    detail: String((e as Error)?.message ?? e),
  }))
}

export function useLoaderFileDrop(opts: LoaderFileDropOptions) {
  const dragDepth = ref(0)
  const dragActive = ref(false)

  const isAssetDrag = (e: DragEvent): boolean =>
    !!opts.onAsset && Array.from(e.dataTransfer?.types ?? []).includes(ASSET_DRAG_MIME)

  const isFileDrag = (e: DragEvent): boolean =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files')
    && !Array.from(e.dataTransfer?.types ?? []).includes(ASSET_DRAG_MIME)

  const claims = (e: DragEvent): boolean =>
    isAssetDrag(e) || (isFileDrag(e) && dragMayMatchKind(e, opts.kind()))

  function accept(e: DragEvent): void {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function onDragEnter(e: DragEvent): void {
    if (!claims(e)) return
    accept(e)
    dragDepth.value += 1
    dragActive.value = true
  }

  function onDragOver(e: DragEvent): void {
    if (!claims(e)) return
    accept(e)
    dragActive.value = true
  }

  function onDragLeave(e: DragEvent): void {
    if (!claims(e)) return
    dragDepth.value = Math.max(0, dragDepth.value - 1)
    if (dragDepth.value === 0) dragActive.value = false
  }

  function reset(): void {
    dragDepth.value = 0
    dragActive.value = false
  }

  function onDrop(e: DragEvent): void {
    const kind = opts.kind()

    if (isAssetDrag(e)) {
      accept(e)
      reset()
      const raw = e.dataTransfer?.getData(ASSET_DRAG_MIME) ?? ''
      const id = Number(raw)
      const asset = Number.isFinite(id) ? useAssetStore().byId(id) : undefined
      if (!asset) return
      if (asset.media_type !== kind) {
        toast('warn', t('loaderDrop.mismatchTitle'), t('loaderDrop.assetTypeMismatch', {
          expected: t(`assets.media.${kind}`),
          actual: t(`assets.media.${asset.media_type}`),
        }))
        return
      }
      opts.onAsset?.(asset)
      return
    }

    if (!isFileDrag(e) || !dragMayMatchKind(e, kind)) return
    accept(e)
    reset()
    const matched = Array.from(e.dataTransfer?.files ?? [])
      .filter((f) => mediaTypeOf(f) === kind)
    if (matched.length === 0) {
      toast('warn', t('loaderDrop.mismatchTitle'), t('loaderDrop.typeMismatch', {
        kind: t(`assets.media.${kind}`),
      }))
      return
    }
    void opts.onFiles(matched)
  }

  return { dragActive, onDragEnter, onDragOver, onDragLeave, onDrop }
}
