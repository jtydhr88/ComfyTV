import { computed, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { computeFit } from '@/composables/widgets/useVideoViewport'
import { t } from '@/i18n'
import { BLEND_MODES, type BlendMode, type Layer } from '@/widgets/layerEditor/types'

export const ARTBOARD_MIN = 64
export const ARTBOARD_MAX = 4096

export const BLEND_KEYS: Record<BlendMode, string> = {
  'source-over': 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
  darken: 'darken', lighten: 'lighten', 'color-dodge': 'colorDodge', 'color-burn': 'colorBurn',
  'hard-light': 'hardLight', 'soft-light': 'softLight', difference: 'difference', exclusion: 'exclusion',
}

export function clampArtboard(v: number): number | null {
  const rounded = Math.round(v)
  if (!Number.isFinite(rounded)) return null
  return Math.min(ARTBOARD_MAX, Math.max(ARTBOARD_MIN, rounded))
}

export function useLayerListPanel(editor: LayerEditorController) {
  const pickerOpen = ref(false)
  const renamingId = ref<string | null>(null)

  const reversedLayers = computed(() => [...editor.state.value.layers].reverse())
  const active = computed(() => editor.activeLayer.value)

  const blendOptions = computed(() =>
    BLEND_MODES.map((mode) => ({ label: t(`layerEditor.blend.${BLEND_KEYS[mode]}`), value: mode })),
  )

  function onAssetPicked(asset: Asset): void {
    pickerOpen.value = false
    void editor.addImageFromUrl(asset.payload_url, asset.name)
  }

  function onFilesPicked(e: Event): void {
    const input = e.target as HTMLInputElement
    for (const file of Array.from(input.files ?? [])) editor.addImageFromFile(file)
    input.value = ''
  }

  function addText(): void {
    const doc = editor.state.value
    const id = editor.addTextLayerAt({ x: doc.width * 0.25, y: doc.height * 0.4 })
    editor.editingTextId.value = id
  }

  function commitRename(id: string, e: Event): void {
    if (renamingId.value !== id) return
    renamingId.value = null
    editor.renameLayer(id, (e.target as HTMLInputElement).value)
  }

  function onArtboardSize(e: Event, axis: 'w' | 'h'): void {
    const clamped = clampArtboard(Number((e.target as HTMLInputElement).value))
    if (clamped == null) return
    const doc = editor.state.value
    editor.setArtboardSize(axis === 'w' ? clamped : doc.width, axis === 'h' ? clamped : doc.height)
  }

  function drawThumb(el: HTMLCanvasElement | null, layer: Layer): void {
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, el.width, el.height)
    if (layer.type === 'text') {
      ctx.fillStyle = layer.color
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('T', el.width / 2, el.height / 2 + 1)
      return
    }
    const entry = editor.content.get(layer.contentId)
    if (!entry) return
    const fit = computeFit(el.width, el.height, entry.width, entry.height)
    ctx.drawImage(
      entry.canvas,
      fit.offX,
      fit.offY,
      entry.width * fit.scale,
      entry.height * fit.scale,
    )
  }

  return {
    pickerOpen,
    renamingId,
    reversedLayers,
    active,
    blendOptions,
    onAssetPicked,
    onFilesPicked,
    addText,
    commitRename,
    onArtboardSize,
    drawThumb,
  }
}
