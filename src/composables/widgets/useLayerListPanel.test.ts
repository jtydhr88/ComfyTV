import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { LayerEditorController } from './useLayerEditorStage'
import type { LayerRow } from '@/widgets/layerEditor/types'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { buildDisplayRows, clampArtboard, dropPositionFor, useLayerListPanel } from './useLayerListPanel'

function node(id: string, kind: string, extra: Record<string, unknown> = {}) {
  return {
    id, kind, name: id.toUpperCase(), visible: true, opacity: 1,
    mode: { blend: 'normal' }, transform: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    ...extra,
  }
}

function makeEditor() {
  const a = node('a', 'raster', { contentId: 'c1' })
  const b = node('b', 'text', { color: '#fff' })
  const rows: LayerRow[] = [
    { node: a as never, depth: 0, parentId: undefined },
    { node: b as never, depth: 0, parentId: undefined },
  ]
  const activeId = ref<string | null>('a')
  const editor = {
    layers: computed(() => rows),
    canvasSize: computed(() => ({ width: 1024, height: 768 })),
    activeNode: computed(() => rows.find((r) => r.node.id === activeId.value)?.node ?? null),
    activeId,
    editingTextId: ref<string | null>(null),
    content: new Map([['c1', { canvas: {} as HTMLCanvasElement, width: 100, height: 50 }]]),
    addImageFromUrl: vi.fn(async () => {}),
    addImageFromFile: vi.fn(),
    addTextLayerAt: vi.fn((..._a: unknown[]) => 'new-text-id'),
    renameLayer: vi.fn(),
    setArtboardSize: vi.fn(),
    moveLayerRelative: vi.fn(),
  }
  return { editor: editor as unknown as LayerEditorController, raw: editor, rows, activeId }
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

describe('buildDisplayRows', () => {
  const g = node('g', 'group')
  const x = node('x', 'raster')
  const y = node('y', 'raster')
  const z = node('z', 'raster')
  const rows: LayerRow[] = [
    { node: x as never, depth: 0, parentId: undefined },
    { node: g as never, depth: 0, parentId: undefined },
    { node: y as never, depth: 1, parentId: 'g' },
    { node: z as never, depth: 1, parentId: 'g' },
  ]

  it('shows top-most first with group children nested under the header', () => {
    const out = buildDisplayRows(rows, new Set())
    expect(out.map((r) => r.node.id)).toEqual(['g', 'z', 'y', 'x'])
  })

  it('hides descendants of collapsed groups', () => {
    const out = buildDisplayRows(rows, new Set(['g']))
    expect(out.map((r) => r.node.id)).toEqual(['g', 'x'])
  })
})

describe('dropPositionFor (GIMP GTK zones)', () => {
  it('group rows: top quarter above, bottom quarter below, middle into', () => {
    expect(dropPositionFor(true, 0.1)).toBe('above')
    expect(dropPositionFor(true, 0.5)).toBe('into')
    expect(dropPositionFor(true, 0.9)).toBe('below')
  })

  it('plain rows split at the middle', () => {
    expect(dropPositionFor(false, 0.3)).toBe('above')
    expect(dropPositionFor(false, 0.7)).toBe('below')
  })
})

describe('layer drag & drop', () => {
  function dragEvent(clientY: number, height = 40): DragEvent {
    return {
      clientY,
      preventDefault: vi.fn(),
      dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn() },
      currentTarget: { getBoundingClientRect: () => ({ top: 0, height }) },
    } as unknown as DragEvent
  }

  it('drop above/below maps through moveLayerRelative', () => {
    const { editor, raw, rows } = makeEditor()
    const api = useLayerListPanel(editor)
    api.onRowDragStart(rows[1], dragEvent(0))
    expect(api.dragId.value).toBe('b')

    api.onRowDragOver(rows[0], dragEvent(5))
    expect(api.dropHint.value).toEqual({ id: 'a', pos: 'above' })
    api.onRowDrop(rows[0], dragEvent(5))
    expect(raw.moveLayerRelative).toHaveBeenCalledWith('b', 'a', 'above')
    expect(api.dragId.value).toBeNull()
    expect(api.dropHint.value).toBeNull()
  })

  it('dropping into a group row uses the into position', () => {
    const { editor, raw, rows } = makeEditor()
    const api = useLayerListPanel(editor)
    const groupRow = { node: node('g', 'group') as never, depth: 0, parentId: undefined }
    api.onRowDragStart(rows[0], dragEvent(0))
    api.onRowDragOver(groupRow, dragEvent(20))
    expect(api.dropHint.value).toEqual({ id: 'g', pos: 'into' })
    api.onRowDrop(groupRow, dragEvent(20))
    expect(raw.moveLayerRelative).toHaveBeenCalledWith('a', 'g', 'into')
  })

  it('hovering into a collapsed group auto-expands it after a delay', () => {
    vi.useFakeTimers()
    try {
      const { editor, rows } = makeEditor()
      const api = useLayerListPanel(editor)
      api.toggleCollapsed('g')
      const groupRow = { node: node('g', 'group') as never, depth: 0, parentId: undefined }
      api.onRowDragStart(rows[0], dragEvent(0))
      api.onRowDragOver(groupRow, dragEvent(20))
      expect(api.collapsedGroups.value.has('g')).toBe(true)
      vi.advanceTimersByTime(700)
      expect(api.collapsedGroups.value.has('g')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('dropping on empty list space moves to the bottom of the root', () => {
    const { editor, raw, rows } = makeEditor()
    const api = useLayerListPanel(editor)
    api.onRowDragStart(rows[1], dragEvent(0))
    const container = {}
    const e = {
      preventDefault: vi.fn(),
      target: container,
      currentTarget: container,
      dataTransfer: { dropEffect: '' },
    } as unknown as DragEvent
    api.onListDrop(e)
    expect(raw.moveLayerRelative).toHaveBeenCalledWith('b', null, 'below')
  })

  it('ignores drops onto the dragged row itself', () => {
    const { editor, raw, rows } = makeEditor()
    const api = useLayerListPanel(editor)
    api.onRowDragStart(rows[0], dragEvent(0))
    api.onRowDragOver(rows[0], dragEvent(5))
    expect(api.dropHint.value).toBeNull()
    api.onRowDrop(rows[0], dragEvent(5))
    expect(raw.moveLayerRelative).not.toHaveBeenCalled()
  })
})

describe('useLayerListPanel', () => {
  it('lists layers top-most first', () => {
    const { editor } = makeEditor()
    const api = useLayerListPanel(editor)
    expect(api.displayRows.value.map((r) => r.node.id)).toEqual(['b', 'a'])
  })

  it('exposes the active node', () => {
    const { editor, activeId } = makeEditor()
    const api = useLayerListPanel(editor)
    expect(api.active.value?.id).toBe('a')
    activeId.value = null
    expect(api.active.value).toBeNull()
  })

  it('builds translated blend options for every engine mode', () => {
    const { editor } = makeEditor()
    const api = useLayerListPanel(editor)
    const options = api.blendOptions.value
    expect(options).toHaveLength(20)
    expect(options[0]).toEqual({ label: 'layerEditor.blend.normal', value: 'normal' })
    expect(options.map((o) => o.value)).toContain('color-dodge')
    expect(options.map((o) => o.value)).toContain('luminosity')
  })

  it('toggles group collapse state', () => {
    const { editor } = makeEditor()
    const api = useLayerListPanel(editor)
    api.toggleCollapsed('g')
    expect(api.collapsedGroups.value.has('g')).toBe(true)
    api.toggleCollapsed('g')
    expect(api.collapsedGroups.value.has('g')).toBe(false)
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
      const { editor, rows } = makeEditor()
      const api = useLayerListPanel(editor)
      const { el, ctx } = makeThumbCanvas()
      api.drawThumb(el, rows[1].node)
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 28, 28)
      expect(ctx.fillText).toHaveBeenCalledWith('T', 14, 15)
      expect(ctx.drawImage).not.toHaveBeenCalled()
    })

    it('fits raster content into the thumbnail with letterboxing', () => {
      const { editor, rows } = makeEditor()
      const api = useLayerListPanel(editor)
      const { el, ctx } = makeThumbCanvas()
      api.drawThumb(el, rows[0].node)
      const [, x, y, w, h] = ctx.drawImage.mock.calls[0] as unknown as [unknown, number, number, number, number]
      expect(x).toBeCloseTo(0)
      expect(y).toBeCloseTo(7)
      expect(w).toBeCloseTo(28)
      expect(h).toBeCloseTo(14)
    })

    it('skips missing elements, contexts, and content', () => {
      const { editor, rows } = makeEditor()
      const api = useLayerListPanel(editor)
      api.drawThumb(null, rows[0].node)
      const { el, ctx } = makeThumbCanvas()
      ;(el.getContext as ReturnType<typeof vi.fn>).mockReturnValue(null)
      api.drawThumb(el, rows[0].node)
      expect(ctx.drawImage).not.toHaveBeenCalled()
      const { el: el2, ctx: ctx2 } = makeThumbCanvas()
      api.drawThumb(el2, node('x', 'raster', { contentId: 'missing' }) as never)
      expect(ctx2.drawImage).not.toHaveBeenCalled()
    })
  })
})
