import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { ResolvedInput, StageState } from '@/stores/stageStore'

import { useSplitPartPrompts } from './useSplitPartPrompts'

function makeWidget(name: string, value: unknown = '') {
  return { name, value, callback: vi.fn() }
}

function makeNode(partsJson = ''): any {
  return { id: 3, widgets: [makeWidget('parts_data', partsJson)], onConfigure: null as any }
}

function makeState(image: string | null = '/img.png'): StageState {
  const inputs: ResolvedInput[] = image == null
    ? [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'empty', content: null }]
    : [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'upstream', content: image }]
  return reactive({
    kind: 'image', variant: 'splitpart',
    outputType: 'COMFYTV_IMAGES',
    output: null, outputs: [null],
    running: false, inputs, mainPrompt: '',
  }) as unknown as StageState
}

describe('useSplitPartPrompts', () => {
  it('exposes the upstream image url', () => {
    expect(useSplitPartPrompts(makeNode(), makeState('/a.png')).sourceImageUrl.value).toBe('/a.png')
    expect(useSplitPartPrompts(makeNode(), makeState(null)).sourceImageUrl.value).toBeNull()
  })

  it('seeds parts from the widget json', () => {
    const json = JSON.stringify({ parts: [{ id: 1, kind: 'box', box: { x: 1, y: 2, w: 3, h: 4 } }] })
    const { parts } = useSplitPartPrompts(makeNode(json), makeState())
    expect(parts.value).toEqual([{ id: 1, kind: 'box', box: { x: 1, y: 2, w: 3, h: 4 } }])
  })

  it('starts a new point group when none is active', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.addPoint({ x: 10, y: 20, label: 1 })
    expect(api.parts.value).toEqual([{ id: 1, kind: 'points', points: [{ x: 10, y: 20, label: 1 }] }])
    expect(api.activePartId.value).toBe(1)
  })

  it('appends points to the active point group', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.addPoint({ x: 10, y: 20, label: 1 })
    api.addPoint({ x: 30, y: 40, label: 0 })
    expect(api.parts.value).toHaveLength(1)
    expect((api.parts.value[0] as { points: unknown[] }).points).toHaveLength(2)
  })

  it('creates a new group when the active part is a box', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.addBox({ x: 0, y: 0, w: 10, h: 10 })
    api.addPoint({ x: 5, y: 5, label: 1 })
    expect(api.parts.value).toHaveLength(2)
    expect(api.activePartId.value).toBe(2)
  })

  it('addBox always creates a fresh part with the next id', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.addBox({ x: 0, y: 0, w: 10, h: 10 })
    api.addBox({ x: 5, y: 5, w: 20, h: 20 })
    expect(api.parts.value.map((p) => p.id)).toEqual([1, 2])
    expect(api.activePartId.value).toBe(2)
  })

  it('startNewGroup deselects and leaves box tool', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.tool.value = 'box'
    api.addBox({ x: 0, y: 0, w: 10, h: 10 })
    api.startNewGroup()
    expect(api.activePartId.value).toBeNull()
    expect(api.tool.value).toBe('point-pos')
  })

  it('startNewGroup keeps point tools selected', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.tool.value = 'point-neg'
    api.startNewGroup()
    expect(api.tool.value).toBe('point-neg')
  })

  it('removePart deletes and clears selection only for the removed id', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.addBox({ x: 0, y: 0, w: 10, h: 10 })
    api.addBox({ x: 1, y: 1, w: 10, h: 10 })
    api.removePart(1)
    expect(api.parts.value.map((p) => p.id)).toEqual([2])
    expect(api.activePartId.value).toBe(2)
    api.removePart(2)
    expect(api.parts.value).toEqual([])
    expect(api.activePartId.value).toBeNull()
  })

  it('clearParts wipes everything', () => {
    const api = useSplitPartPrompts(makeNode(), makeState())
    api.addPoint({ x: 1, y: 1, label: 1 })
    api.clearParts()
    expect(api.parts.value).toEqual([])
    expect(api.activePartId.value).toBeNull()
  })

  it('persists parts to the widget on change', async () => {
    const node = makeNode()
    const api = useSplitPartPrompts(node, makeState())
    api.addBox({ x: 1.4, y: 2.6, w: 10, h: 10 })
    await nextTick()
    expect(JSON.parse(node.widgets[0].value)).toEqual({
      parts: [{ id: 1, kind: 'box', box: { x: 1, y: 3, w: 10, h: 10 } }],
    })
  })

  it('reloads parts and resets selection on node configure', () => {
    const node = makeNode()
    const api = useSplitPartPrompts(node, makeState())
    api.addPoint({ x: 1, y: 1, label: 1 })
    node.widgets[0].value = JSON.stringify({
      parts: [{ id: 7, kind: 'points', points: [{ x: 2, y: 2, label: 0 }] }],
    })
    node.onConfigure?.({})
    expect(api.parts.value).toEqual([{ id: 7, kind: 'points', points: [{ x: 2, y: 2, label: 0 }] }])
    expect(api.activePartId.value).toBeNull()
  })
})
