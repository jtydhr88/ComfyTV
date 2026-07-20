import { computed } from 'vue'

import { toastLoaderUploadFailed, useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import type { LGraphNode } from '@/lib/comfyApp'
import type { AssetMediaType } from '@/utils/mediaFileTypes'
import { uploadBlobNamed } from '@/utils/uploadCanvas'
import { getWidget, writeWidget } from '@/utils/widget'

export interface PlainLoaderWidget {
  kind: AssetMediaType
  widget: string
}

export const PLAIN_LOADER_WIDGET: Record<string, PlainLoaderWidget> = {
  'ComfyTV.ImageLoaderStage': { kind: 'image', widget: 'image' },
  'ComfyTV.VideoLoaderStage': { kind: 'video', widget: 'video' },
  'ComfyTV.AudioLoaderStage': { kind: 'audio', widget: 'audio' },
}

export function loaderDropConfigOf(node: LGraphNode | undefined): PlainLoaderWidget | null {
  return node ? PLAIN_LOADER_WIDGET[(node as any).comfyClass] ?? null : null
}

export async function uploadLoaderFiles(
  node: LGraphNode,
  widgetName: string,
  files: File[],
): Promise<void> {
  let last = ''
  for (const f of files) {
    const uploaded = await uploadBlobNamed(f, { subfolder: 'comfytv/uploads', filename: f.name })
    last = uploaded.name
    const w = getWidget(node, widgetName) as any
    const values = w?.options?.values
    if (Array.isArray(values) && !values.includes(last)) values.push(last)
  }
  if (last) writeWidget(node, widgetName, last)
}

export function useStageLoaderDrop(getNode: () => LGraphNode | undefined) {
  const loaderDropCfg = computed(() => loaderDropConfigOf(getNode()))

  const fileDrop = useLoaderFileDrop({
    kind: () => loaderDropCfg.value?.kind ?? 'image',
    onFiles: async (files) => {
      const cfg = loaderDropCfg.value
      const node = getNode()
      if (!cfg || !node) return
      try {
        await uploadLoaderFiles(node, cfg.widget, files)
      } catch (e) {
        console.error('[ComfyTV/loader-drop] upload failed', e)
        toastLoaderUploadFailed(e)
      }
    },
  })

  function onCardDragEnter(e: DragEvent): void { if (loaderDropCfg.value) fileDrop.onDragEnter(e) }
  function onCardDragOver(e: DragEvent): void  { if (loaderDropCfg.value) fileDrop.onDragOver(e) }
  function onCardDragLeave(e: DragEvent): void { if (loaderDropCfg.value) fileDrop.onDragLeave(e) }
  function onCardDrop(e: DragEvent): void      { if (loaderDropCfg.value) fileDrop.onDrop(e) }

  return {
    loaderDropCfg,
    dragActive: fileDrop.dragActive,
    onCardDragEnter,
    onCardDragOver,
    onCardDragLeave,
    onCardDrop,
  }
}
