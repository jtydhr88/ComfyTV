import { markRaw } from 'vue'
import IconCamera from '~icons/lucide/camera'
import IconLibrary from '~icons/lucide/library'

import {
  useLayerEditorStage,
  type LayerEditorController,
  type LayerEditorStorage,
  type PentradoHost,
  type PentradoMediaInput,
  type UseLayerEditorStageOptions,
} from '@jtydhr88/pentrado'

import { listResources } from '@/api'
import type { Asset } from '@/api/schemas'
import PentradoAssetPicker from '@/components/stages/PentradoAssetPicker.vue'
import { useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { t } from '@/i18n'
import { app, type LGraphNode } from '@/lib/comfyApp'
import { downloadBlob } from '@/utils/download'
import { uploadBlobNamed, uploadCanvas } from '@/utils/uploadCanvas'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'

const STATE_WIDGET = 'layer_state'
const WIDTH_WIDGET = 'width'
const HEIGHT_WIDGET = 'height'
const IMAGE_WIDGET = 'captured_image'
const IMAGES_WIDGET = 'captured_images'
const SUBFOLDER = 'comfytv/layer-editor'

export function assetToMedia(asset: Asset): PentradoMediaInput {
  return { url: asset.payload_url, name: asset.name, mime: asset.mime_type }
}

export const pentradoHost: PentradoHost = {
  uploadBlob: (blob, opts) => uploadBlobNamed(blob, opts),
  uploadCanvas: (canvas, opts) => uploadCanvas(canvas, opts),
  download: downloadBlob,
  notify(kind, message) {
    ;(app as any)?.extensionManager?.toast?.add?.({
      severity: kind === 'error' ? 'error' : 'success',
      summary: 'ComfyTV',
      detail: message,
      life: kind === 'error' ? 5000 : 4000,
    })
  },
  t,
  fontManifestUrl: '/comfytv/fonts/manifest.json',
  async listFonts() {
    const res = await listResources('font')
    return res.resources.filter((r) => !r.missing).map((r) => ({ name: r.name, url: r.url }))
  },
  async saveToLibrary({ blob, filename, mime, width, height, preview }) {
    const previewUrl = await uploadCanvas(preview, {
      subfolder: 'comfytv/assets',
      filenamePrefix: 'comfytv-psd-preview',
    })
    const res = await uploadBlobNamed(blob, { subfolder: 'comfytv/assets', filename })
    const { useAssetStore } = await import('@/stores/assetStore')
    const asset = await useAssetStore().create({
      name: filename,
      payload_url: res.url,
      media_type: 'image',
      mime_type: mime,
      width,
      height,
      size_bytes: blob.size,
      source: 'layer-editor',
      metadata: { preview_url: previewUrl },
    })
    if (!asset) throw new Error('asset create failed')
  },
  components: { AssetPicker: markRaw(PentradoAssetPicker) },
  toolbarActions: [
    {
      id: 'capture',
      get label() { return t('pentradoActions.capture') },
      get title() { return t('pentradoActions.captureHint') },
      icon: markRaw(IconCamera),
      busy: (editor: LayerEditorController) => editor.capturing.value,
      run: (editor: LayerEditorController) => editor.captureBatch(),
    },
    {
      id: 'save-to-library',
      get title() { return t('pentradoActions.saveToLibraryHint') },
      icon: markRaw(IconLibrary),
      busy: (editor: LayerEditorController) => editor.exportingPsd.value,
      run: (editor: LayerEditorController) => editor.exportPsdToLibrary(),
    },
  ],
  createCanvasDropHandler(target) {
    return useLoaderFileDrop({
      kind: () => 'image',
      onFiles: (files: File[]) => {
        for (const f of files) target.addImageFromFile(f)
      },
      onAsset: (asset: Asset) => {
        void target.addMedia(assetToMedia(asset))
      },
    })
  },
}

export function widgetStorage(node: LGraphNode): LayerEditorStorage {
  return {
    subfolder: SUBFOLDER,
    readState: () => readWidgetStr(node, STATE_WIDGET, '{}'),
    writeState: (json, width, height) => {
      writeWidget(node, STATE_WIDGET, json, { fireCallback: false })
      writeWidget(node, WIDTH_WIDGET, width, { fireCallback: false })
      writeWidget(node, HEIGHT_WIDGET, height, { fireCallback: false })
    },
    readCapturedImage: () => readWidgetStr(node, IMAGE_WIDGET, ''),
    beginCapture: () => (url, stale) => {
      if (stale) return
      writeWidget(node, IMAGE_WIDGET, url, { fireCallback: false })
    },
    commitBatch: (json) => writeWidget(node, IMAGES_WIDGET, json, { fireCallback: false }),
  }
}

export function useNodePentradoEditor(
  node: LGraphNode,
  opts?: Pick<UseLayerEditorStageOptions, 'onCaptured' | 'onBatchCaptured'>,
) {
  const editor = useLayerEditorStage({
    storage: widgetStorage(node),
    instanceId: node.id,
    host: pentradoHost,
    ...opts,
  })
  onNodeConfigure(node, editor.reload)
  return editor
}
