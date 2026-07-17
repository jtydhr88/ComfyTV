import { computed, nextTick, watch, type Ref } from 'vue'

import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import type { FontRef, TextLayer } from '@/widgets/layerEditor/types'

export function clampNumber(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min))
}

export function fontRefToValue(ref: FontRef): string {
  return ref.kind === 'builtin' ? `builtin:${ref.id}` : `url:${ref.url}`
}

export function parseFontValue(v: unknown): FontRef | null {
  const s = String(v ?? '')
  if (!s.startsWith('builtin:')) return null
  return { kind: 'builtin', id: s.slice('builtin:'.length) }
}

export function useTextEditPopup(
  editor: LayerEditorController,
  textareaEl: Ref<HTMLTextAreaElement | null>,
) {
  const layer = computed<TextLayer | null>(() => {
    const id = editor.editingTextId.value
    const l = id ? editor.state.value.layers.find((x) => x.id === id) : null
    return l?.type === 'text' ? l : null
  })

  watch(() => editor.editingTextId.value, async (id) => {
    if (!id) return
    await nextTick()
    textareaEl.value?.focus()
  })

  function close(): void {
    editor.editingTextId.value = null
  }

  function patch(p: Partial<TextLayer>): void {
    const l = layer.value
    if (l) editor.updateTextLayer(l.id, p)
  }

  function clampNum(e: Event, min: number, max: number): number {
    return clampNumber(Number((e.target as HTMLInputElement).value), min, max)
  }

  const fontOptions = computed(() =>
    editor.fontStore.builtins().map((b) => ({
      label: b.name,
      value: `builtin:${b.id}`,
    })),
  )

  const fontValue = computed(() => {
    const l = layer.value
    return l ? fontRefToValue(l.fontRef) : ''
  })

  const fontFailed = computed(() => {
    const l = layer.value
    return l ? editor.fontStore.hasFailed(l.fontRef) : false
  })

  function onFontChange(v: unknown): void {
    const ref = parseFontValue(v)
    if (ref) patch({ fontRef: ref })
  }

  return {
    layer,
    close,
    patch,
    clampNum,
    fontOptions,
    fontValue,
    fontFailed,
    onFontChange,
  }
}
