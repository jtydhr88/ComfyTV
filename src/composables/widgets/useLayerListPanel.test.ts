import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { LayerEditorController } from './useLayerEditorStage'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { clampArtboard, useLayerListPanel } from './useLayerListPanel'

function makeEditor() {
  const layers = [
    { id: 'a', type: 'raster', name: 'A', contentId: 'c1' },
    { id: 'b', type: 'text', name: 'B', color: '#fff' },
  ]
  const state = ref({ width: 1024, height: 768, layers })
  const activeId = ref<string | null>('a')
  const editor = {
    state,
    activeLayer: computed(() => layers.find((l) => l.id === activeId.value) ?? null),
    editingTextId: ref<string | null>(null),
    content: new Map([['c1', { canvas: {} as HTMLCanvasElement, width: 100, height: 50 }]]),
    addImageFromUrl: vi.fn(async () => {}),
    addImageFromFile: vi.fn(),
    addTextLayerAt: vi.fn((..._a: unknown[]) => 'new-text-id'),
    renameLayer: vi.fn(),
    setArtboardSize: vi.fn(),
  }
  return { editor: editor as unknown as LayerEditorController, raw: editor, activeId }
}

function inputEvent(value: string) {
  return { target: { value } } as unknown as Event
}

describe('clampArtboard', () => {
  it('rounds and clamps into [64, 4096]', () => {
    expect(clampArtboard(100.6)).toBe(101)
    expect(clampArtboard(1)).toBe(64)
    expect(clampArtboard(99999)).toBe(4096)
  })

  it('returns null for non-finite input', () => {
    expect(clampArtboard(Number.NaN)).toBeNull()
    expect(clampArtboard(Infinity)).toBeNull()
  })
})

describe('useLayerListPanel', () => {
  it('lists layers top-most first', () => {
    const { editor } = makeEditor()
    const api = useLayerListPanel(editor)
    expect(api.reversedLayers.value.map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('exposes the active layer', () => {
    const { editor, activeId } = makeEditor()
    const api = useLayerListPanel(editor)
    expect(api.active.value?.id).toBe('a')
    activeId.value = null
    expect(api.active.value).toBeNull()
  })

  it('builds translated blend options for every mode', () => {
    const { editor } = makeEditor()
    const api = useLayerListPanel(editor)
    const options = api.blendOptions.value
    expect(options).toHaveLength(12)
    expect(options[0]).toEqual({ label: 'layerEditor.blend.normal', value: 'source-over' })
    expect(options.map((o) => o.value)).toContain('color-dodge')
  })

  it('adds a picked asset and closes the picker', () => {
    const { editor, raw } = makeEditor()
    const api = useLayerListPanel(editor)
    api.pickerOpen.value = true
    api.onAssetPicked({ payload_url: '/u.png', name: 'pic' } as never)
    expect(api.pickerOpen.value).toBe(false)
    expect(raw.addImageFromUrl).toHaveBeenCalledWith('/u.png', 'pic')
  })

  it('imports picked files and resets the input', () => {
    const { editor, raw } = makeEditor()
    const api = useLayerListPanel(editor)
    const f1 = { name: 'a.png' }
    const f2 = { name: 'b.png' }
    const target = { files: [f1, f2], value: 'x' }
    api.onFilesPicked({ target } as unknown as Event)
    expect(raw.addImageFromFile).toHaveBeenCalledTimes(2)
    expect(target.value).toBe('')
  })

  it('adds a text layer near the artboard center and opens the editor', () => {
    const { editor, raw } = makeEditor()
    const api = useLayerListPanel(editor)
    api.addText()
    const at = raw.addTextLayerAt.mock.calls[0][0] as unknown as { x: number; y: number }
    expect(at.x).toBeCloseTo(256)
    expect(at.y).toBeCloseTo(307.2)
    expect(raw.editingTextId.value).toBe('new-text-id')
  })

  it('commits a rename only for the layer being renamed', () => {
    const { editor, raw } = makeEditor()
    const api = useLayerListPanel(editor)
    api.renamingId.value = 'a'
    api.commitRename('b', inputEvent('nope'))
    expect(raw.renameLayer).not.toHaveBeenCalled()
    api.commitRename('a', inputEvent('renamed'))
    expect(raw.renameLayer).toHaveBeenCalledWith('a', 'renamed')
    expect(api.renamingId.value).toBeNull()
  })

  it('resizes one artboard axis with clamping', () => {
    const { editor, raw } = makeEditor()
    const api = useLayerListPanel(editor)
    api.onArtboardSize(inputEvent('9999'), 'w')
    expect(raw.setArtboardSize).toHaveBeenCalledWith(4096, 768)
    api.onArtboardSize(inputEvent('10'), 'h')
    expect(raw.setArtboardSize).toHaveBeenCalledWith(1024, 64)
    raw.setArtboardSize.mockClear()
    api.onArtboardSize(inputEvent('junk'), 'w')
    expect(raw.setArtboardSize).not.toHaveBeenCalled()
  })

  describe('drawThumb', () => {
    function makeThumbCanvas() {
      const ctx = {
        clearRect: vi.fn(),
        fillText: vi.fn(),
        drawImage: vi.fn(),
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
      }
      const el = {
        width: 28,
        height: 28,
        getContext: vi.fn(() => ctx),
      } as unknown as HTMLCanvasElement
      return { el, ctx }
    }

    it('paints a centered T for text layers', () => {
      const { editor, raw } = makeEditor()
      const api = useLayerListPanel(editor)
      const { el, ctx } = makeThumbCanvas()
      api.drawThumb(el, raw.state.value.layers[1] as never)
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 28, 28)
      expect(ctx.fillText).toHaveBeenCalledWith('T', 14, 15)
      expect(ctx.drawImage).not.toHaveBeenCalled()
    })

    it('fits raster content into the thumbnail with letterboxing', () => {
      const { editor, raw } = makeEditor()
      const api = useLayerListPanel(editor)
      const { el, ctx } = makeThumbCanvas()
      api.drawThumb(el, raw.state.value.layers[0] as never)
      const [, x, y, w, h] = ctx.drawImage.mock.calls[0] as unknown as [unknown, number, number, number, number]
      expect(x).toBeCloseTo(0)
      expect(y).toBeCloseTo(7)
      expect(w).toBeCloseTo(28)
      expect(h).toBeCloseTo(14)
    })

    it('skips missing elements, contexts, and content', () => {
      const { editor, raw } = makeEditor()
      const api = useLayerListPanel(editor)
      api.drawThumb(null, raw.state.value.layers[0] as never)
      const { el, ctx } = makeThumbCanvas()
      ;(el.getContext as ReturnType<typeof vi.fn>).mockReturnValue(null)
      api.drawThumb(el, raw.state.value.layers[0] as never)
      expect(ctx.drawImage).not.toHaveBeenCalled()
      const { el: el2, ctx: ctx2 } = makeThumbCanvas()
      api.drawThumb(el2, { id: 'x', type: 'raster', contentId: 'missing' } as never)
      expect(ctx2.drawImage).not.toHaveBeenCalled()
    })
  })
})
