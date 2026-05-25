import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useSelectionStore } from './selectionStore'

vi.mock('@/composables/stages/stageMeta', () => ({
  getStageMeta: (cls: string) => {
    const map: Record<string, { workflow_kind?: string; kind: string }> = {
      'ComfyTV.ImageStage':   { workflow_kind: 'image',    kind: 'image-batch' },
      'ComfyTV.VideoStage':   { workflow_kind: 'video',    kind: 'video' },
      'ComfyTV.CropStage':    { kind: 'image' },
      'ComfyTV.UnknownStage': { kind: 'image' },
    }
    return map[cls]
  },
}))


function makeWindow(selectedNodes: any) {
  ;(global as any).window = { app: { canvas: { selected_nodes: selectedNodes } } }
}


describe('selectionStore.refreshFromCanvas', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    delete (global as any).window
  })

  it('null when no app on window', () => {
    const store = useSelectionStore()
    ;(global as any).window = {}
    store.refreshFromCanvas()
    expect(store.selected).toBeNull()
  })

  it('null when no selected_nodes', () => {
    const store = useSelectionStore()
    makeWindow(null)
    store.refreshFromCanvas()
    expect(store.selected).toBeNull()
  })

  it('null when multi-select (object map with >1)', () => {
    const store = useSelectionStore()
    makeWindow({ a: {}, b: {} })
    store.refreshFromCanvas()
    expect(store.selected).toBeNull()
  })

  it('null when multi-select (Set with >1)', () => {
    const store = useSelectionStore()
    makeWindow(new Set([{}, {}]))
    store.refreshFromCanvas()
    expect(store.selected).toBeNull()
  })

  it('populates from selection of one ComfyTV stage (object map)', () => {
    const store = useSelectionStore()
    const node = {
      id: 42,
      comfyClass: 'ComfyTV.ImageStage',
      widgets: [{ name: 'workflow', value: 'SD 1.5' }],
    }
    makeWindow({ 42: node })
    store.refreshFromCanvas()
    expect(store.selected).toEqual({
      nodeId: 42,
      comfyClass: 'ComfyTV.ImageStage',
      workflowKind: 'image',
      workflowLabel: 'SD 1.5',
    })
  })

  it('populates from Set-based selection', () => {
    const store = useSelectionStore()
    const node = {
      id: 7,
      comfyClass: 'ComfyTV.VideoStage',
      widgets: [{ name: 'workflow', value: 'Local LTX' }],
    }
    makeWindow(new Set([node]))
    store.refreshFromCanvas()
    expect(store.selected?.nodeId).toBe(7)
    expect(store.selected?.workflowKind).toBe('video')
  })

  it('null for stage without workflow_kind (transform)', () => {
    const store = useSelectionStore()
    const node = { id: 1, comfyClass: 'ComfyTV.CropStage', widgets: [] }
    makeWindow({ 1: node })
    store.refreshFromCanvas()
    expect(store.selected).toBeNull()
  })

  it('null for non-stage class', () => {
    const store = useSelectionStore()
    const node = { id: 1, comfyClass: 'Not.Stage', widgets: [] }
    makeWindow({ 1: node })
    store.refreshFromCanvas()
    expect(store.selected).toBeNull()
  })

  it('uses empty label when no workflow widget', () => {
    const store = useSelectionStore()
    const node = { id: 1, comfyClass: 'ComfyTV.ImageStage', widgets: [] }
    makeWindow({ 1: node })
    store.refreshFromCanvas()
    expect(store.selected?.workflowLabel).toBe('')
  })

  it('does not write same value twice (referential equality)', () => {
    const store = useSelectionStore()
    const node = {
      id: 1, comfyClass: 'ComfyTV.ImageStage',
      widgets: [{ name: 'workflow', value: 'X' }],
    }
    makeWindow({ 1: node })
    store.refreshFromCanvas()
    const first = store.selected
    store.refreshFromCanvas()  // no-op
    expect(store.selected).toBe(first)
  })

  it('updates when workflow label changes', () => {
    const store = useSelectionStore()
    const node = {
      id: 1, comfyClass: 'ComfyTV.ImageStage',
      widgets: [{ name: 'workflow', value: 'A' }],
    }
    makeWindow({ 1: node })
    store.refreshFromCanvas()
    node.widgets[0].value = 'B'
    store.refreshFromCanvas()
    expect(store.selected?.workflowLabel).toBe('B')
  })

  it('clears selection when previously selected stage gets deselected', () => {
    const store = useSelectionStore()
    const node = {
      id: 1, comfyClass: 'ComfyTV.ImageStage',
      widgets: [{ name: 'workflow', value: 'X' }],
    }
    makeWindow({ 1: node })
    store.refreshFromCanvas()
    expect(store.selected).not.toBeNull()
    makeWindow({})
    store.refreshFromCanvas()
    expect(store.selected).toBeNull()
  })
})


describe('selectionStore.selectedKey', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('null when nothing selected', () => {
    const store = useSelectionStore()
    expect(store.selectedKey).toBeNull()
  })

  it('combines kind + label', () => {
    const store = useSelectionStore()
    const node = {
      id: 1, comfyClass: 'ComfyTV.ImageStage',
      widgets: [{ name: 'workflow', value: 'X' }],
    }
    makeWindow({ 1: node })
    store.refreshFromCanvas()
    expect(store.selectedKey).toBe('image::X')
  })
})


describe('selectionStore.bumpBindings', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('increments bindingsVersion', () => {
    const store = useSelectionStore()
    const before = store.bindingsVersion
    store.bumpBindings()
    expect(store.bindingsVersion).toBe(before + 1)
  })
})
