import { computed, nextTick, ref, watch, type Ref } from 'vue'

import { listResources } from '@/api'
import type { Resource } from '@/api'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import type { TextData } from '@/widgets/layerEditor/engine'
import type { FontRef } from '@/widgets/layerEditor/types'

export function clampNumber(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min))
}

export function fontRefToValue(ref: FontRef): string {
  return ref.kind === 'builtin' ? `builtin:${ref.id}` : `url:${ref.url}`
}

export function parseFontValue(v: unknown): FontRef | null {
  const s = String(v ?? '')
  if (s.startsWith('builtin:')) return { kind: 'builtin', id: s.slice('builtin:'.length) }
  if (s.startsWith('url:')) return { kind: 'url', url: s.slice('url:'.length) }
  return null
}

export function useTextEditPopup(
  editor: LayerEditorController,
  textareaEl: Ref<HTMLTextAreaElement | null>,
) {
  const layer = computed<TextData | null>(() => {
    const id = editor.editingTextId.value
    const row = id ? editor.layers.value.find((x) => x.node.id === id) : null
    return row?.node.kind === 'text' ? (row.node as TextData) : null
  })

  watch(() => editor.editingTextId.value, async (id) => {
    if (!id) return
    await nextTick()
    textareaEl.value?.focus()
  })

  function close(): void {
    editor.editingTextId.value = null
  }

  function patch(p: Partial<TextData>): void {
    const l = layer.value
    if (l) editor.updateTextLayer(l.id, p)
  }

  function clampNum(e: Event, min: number, max: number): number {
    return clampNumber(Number((e.target as HTMLInputElement).value), min, max)
  }

  const resourceFonts = ref<Resource[]>([])
  void listResources('font')
    .then((res) => {
      resourceFonts.value = res.resources.filter((r) => !r.missing)
    })
    .catch(() => {
      resourceFonts.value = []
    })

  const fontOptions = computed(() => [
    ...editor.fontStore.builtins().map((b) => ({
      label: b.name,
      value: `builtin:${b.id}`,
    })),
    ...resourceFonts.value.map((r) => ({
      label: r.name,
      value: `url:${r.url}`,
    })),
  ])

  const fontValue = computed(() => {
    const l = layer.value
    return l ? fontRefToValue(l.fontRef) : ''
  })

  const fontFailed = computed(() => {
    const l = layer.value
    return l ? editor.fontStore.hasFailed(l.fontRef) : false
  })

  function onFontChange(v: unknown): void {
    const fontRef = parseFontValue(v)
    if (!fontRef) return
    if (fontRef.kind === 'url') {
      const match = resourceFonts.value.find((r) => r.url === fontRef.url)
      patch({ fontRef: match ? { ...fontRef, name: match.name } : fontRef })
      return
    }
    patch({ fontRef })
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
