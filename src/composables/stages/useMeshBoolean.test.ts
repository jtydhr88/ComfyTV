import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { StageState } from '@/stores/stageStore'
import {
  clampResolution,
  computeFrameFit,
  parseTransformB,
  serializeTransformB,
  useMeshBoolean
} from './useMeshBoolean'

function makeWidget(name: string, value: unknown) {
  return { name, value, callback: vi.fn() }
}

function makeNode(operation = 'union', resolution = 256, transform = '') {
  return {
    id: 1,
    widgets: [
      makeWidget('operation', operation),
      makeWidget('resolution', resolution),
      makeWidget('transform_b', transform)
    ],
    onConfigure: null as unknown
  } as any
}

function makeState() {
  return reactive({
    inputs: [] as Array<{ slot: string; source: string; content: string | null }>,
    output: null as string | null
  }) as unknown as StageState
}

function widgetVal(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name).value
}

describe('parseTransformB', () => {
  it('returns null for empty or invalid json', () => {
    expect(parseTransformB('')).toBeNull()
    expect(parseTransformB('{oops')).toBeNull()
  })

  it('keeps only array fields', () => {
    const parsed = parseTransformB(
      JSON.stringify({ position: [1, 2, 3], quaternion: 'bad', scale: [2, 2, 2] })
    )
    expect(parsed).toEqual({ position: [1, 2, 3], scale: [2, 2, 2] })
  })

  it('parses a full transform', () => {
    const parsed = parseTransformB(
      JSON.stringify({ position: [0, 1, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] })
    )
    expect(parsed).toEqual({
      position: [0, 1, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1]
    })
  })
})

describe('serializeTransformB', () => {
  it('rounds every component to 5 decimals', () => {
    const json = serializeTransformB({
      position: [1.000004, 2.999996, 0],
      quaternion: [0.1234567, 0, 0, 1],
      scale: [1, 1, 1]
    })
    expect(JSON.parse(json)).toEqual({
      position: [1, 3, 0],
      quaternion: [0.12346, 0, 0, 1],
      scale: [1, 1, 1]
    })
  })
})

describe('clampResolution', () => {
  it('snaps to steps of 32 within [32, 1024]', () => {
    expect(clampResolution('300')).toBe(288)
    expect(clampResolution(0)).toBe(32)
    expect(clampResolution(99999)).toBe(1024)
    expect(clampResolution(256)).toBe(256)
  })
})

describe('computeFrameFit', () => {
  it('positions the camera relative to the bounds', () => {
    const fit = computeFrameFit({ x: 1, y: 2, z: 3 }, { x: 2, y: 1, z: 1 })
    const dist = 2 * 1.8
    expect(fit.position.x).toBeCloseTo(1 + dist * 0.7)
    expect(fit.position.y).toBeCloseTo(2 + dist * 0.55)
    expect(fit.position.z).toBeCloseTo(3 + dist * 0.7)
    expect(fit.near).toBeCloseTo(0.002)
    expect(fit.far).toBe(200)
  })

  it('falls back to a max dimension of 2 for degenerate bounds', () => {
    const fit = computeFrameFit({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
    expect(fit.position.x).toBeCloseTo(2 * 1.8 * 0.7)
    expect(fit.near).toBe(0.002)
    expect(fit.far).toBe(200)
  })

  it('enforces near/far floors', () => {
    const fit = computeFrameFit({ x: 0, y: 0, z: 0 }, { x: 0.001, y: 0.001, z: 0.001 })
    expect(fit.near).toBe(0.001)
    expect(fit.far).toBe(100)
  })
})

describe('useMeshBoolean', () => {
  it('seeds operation and resolution from widgets', () => {
    const api = useMeshBoolean(makeNode('difference', 512), makeState())
    expect(api.operation.value).toBe('difference')
    expect(api.resolution.value).toBe(512)
  })

  it('setOperation and setResolution write widgets with clamping', () => {
    const node = makeNode()
    const api = useMeshBoolean(node, makeState())
    api.setOperation('intersect')
    expect(widgetVal(node, 'operation')).toBe('intersect')
    api.setResolution('90')
    expect(api.resolution.value).toBe(96)
    expect(widgetVal(node, 'resolution')).toBe(96)
  })

  it('reacts to external widget callbacks', () => {
    const node = makeNode()
    const api = useMeshBoolean(node, makeState())
    node.widgets[0].callback('union')
    expect(api.operation.value).toBe('union')
    node.widgets[1].callback('128')
    expect(api.resolution.value).toBe(128)
    node.widgets[1].callback('junk')
    expect(api.resolution.value).toBe(256)
  })

  it('restores widget state on node configure', () => {
    const node = makeNode()
    const api = useMeshBoolean(node, makeState())
    node.widgets[0].value = 'difference'
    node.widgets[1].value = 64
    node.onConfigure({})
    expect(api.operation.value).toBe('difference')
    expect(api.resolution.value).toBe(64)
  })

  it('exposes model urls from upstream inputs only', () => {
    const state = makeState()
    const api = useMeshBoolean(makeNode(), state)
    expect(api.modelAUrl.value).toBeNull()
    expect(api.modelBUrl.value).toBeNull()
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/a.glb' },
      { slot: 'model_b', source: 'local', content: '/view/b.glb' }
    ]
    expect(api.modelAUrl.value).toBe('/view/a.glb')
    expect(api.modelBUrl.value).toBeNull()
  })

  it('flips to the result view when a result arrives', async () => {
    const state = makeState()
    const api = useMeshBoolean(makeNode(), state)
    api.showResult.value = false
    expect(api.viewingResult.value).toBe(false)
    ;(state as any).output = '/view/result.glb'
    await nextTick()
    expect(api.showResult.value).toBe(true)
    expect(api.viewingResult.value).toBe(true)
  })

  it('round-trips the transform widget', () => {
    const node = makeNode()
    const api = useMeshBoolean(node, makeState())
    expect(api.readTransformWidget()).toBeNull()
    api.writeTransformWidget({
      position: [1, 2, 3],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1]
    })
    expect(api.readTransformWidget()).toEqual({
      position: [1, 2, 3],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1]
    })
    api.clearTransformWidget()
    expect(widgetVal(node, 'transform_b')).toBe('')
    expect(api.readTransformWidget()).toBeNull()
  })
})
