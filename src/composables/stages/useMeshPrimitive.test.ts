import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/comfyApp'
import type { ModelViewCaptureOptions } from '@/composables/stages/useModelViewCapture'

const scheduleCapture = vi.fn()
const cancelCapture = vi.fn()
let captureOpts: ModelViewCaptureOptions | null = null
vi.mock('@/composables/stages/useModelViewCapture', () => ({
  useModelViewCapture: (o: ModelViewCaptureOptions) => {
    captureOpts = o
    return { scheduleCapture, cancelCapture, runCapture: vi.fn() }
  },
}))

import {
  buildPrimitiveGeometry,
  PRIM_KINDS,
  PRIM_PARAMS,
  primitiveRecipeJson,
  useMeshPrimitive,
  type PrimKind,
} from './useMeshPrimitive'
import { parsePrimitiveRecipe } from '@/widgets/three/primitiveGeometry'

function defaultsFor(kind: PrimKind): Record<string, number | boolean> {
  return Object.fromEntries(PRIM_PARAMS[kind].map((d) => [d.key, d.default]))
}

describe('useMeshPrimitive', () => {
  it('every kind builds a non-empty indexed geometry with defaults', () => {
    for (const kind of PRIM_KINDS) {
      const geom = buildPrimitiveGeometry(kind, defaultsFor(kind))
      expect(geom.getAttribute('position').count).toBeGreaterThan(0)
      expect(geom.index).not.toBeNull()
      expect(geom.getAttribute('normal')).toBeTruthy()
      expect(geom.getAttribute('uv')).toBeTruthy()
    }
  })

  it('recipe json carries three.js geometry.parameters names the backend reads', () => {
    const recipe = JSON.parse(primitiveRecipeJson('cylinder', {
      radiusTop: 0, radiusBottom: 1, height: 2, radialSegments: 16,
      heightSegments: 1, openEnded: true, thetaStart: 0, thetaLength: Math.PI,
    }))
    expect(recipe).toMatchObject({
      radiusTop: 0, radiusBottom: 1, height: 2, radialSegments: 16, openEnded: true,
    })
  })

  it('wire payload {"__prim__":{...}} round-trips into a buildable geometry', () => {
    for (const kind of PRIM_KINDS) {
      const params = JSON.parse(primitiveRecipeJson(kind, defaultsFor(kind)))
      const wire = JSON.stringify({ __prim__: { kind, ...params } })
      const parsed = parsePrimitiveRecipe(wire)
      expect(parsed?.kind).toBe(kind)
      const geom = buildPrimitiveGeometry(parsed!.kind, parsed!.params)
      expect(geom.getAttribute('position').count).toBeGreaterThan(0)
    }
  })

  it('non-recipe strings (URLs) are not mistaken for recipes', () => {
    expect(parsePrimitiveRecipe('/view?filename=m.glb&type=input')).toBeNull()
    expect(parsePrimitiveRecipe('')).toBeNull()
    expect(parsePrimitiveRecipe('{"foo":1}')).toBeNull()
  })

  it('recipe param keys for each kind are a subset of the backend-known parameters', () => {
    const KNOWN: Record<PrimKind, string[]> = {
      cube: ['width', 'height', 'depth', 'widthSegments', 'heightSegments', 'depthSegments'],
      sphere: ['radius', 'widthSegments', 'heightSegments', 'phiStart', 'phiLength', 'thetaStart', 'thetaLength'],
      cylinder: ['radiusTop', 'radiusBottom', 'height', 'radialSegments', 'heightSegments', 'openEnded', 'thetaStart', 'thetaLength'],
      cone: ['radius', 'height', 'radialSegments', 'heightSegments', 'openEnded', 'thetaStart', 'thetaLength'],
      plane: ['width', 'height', 'widthSegments', 'heightSegments'],
      torus: ['radius', 'tube', 'radialSegments', 'tubularSegments', 'arc'],
    }
    for (const kind of PRIM_KINDS) {
      const recipe = JSON.parse(primitiveRecipeJson(kind, defaultsFor(kind)))
      for (const key of Object.keys(recipe)) {
        expect(KNOWN[kind]).toContain(key)
      }
    }
  })
})

interface FakeWidget {
  name: string
  value: unknown
}

function makeNode(overrides: Record<string, unknown> = {}): LGraphNode {
  const widgets: FakeWidget[] = [
    { name: 'kind', value: 'cube' },
    { name: 'recipe', value: '' },
    { name: 'captured_image', value: '' },
  ]
  for (const [name, value] of Object.entries(overrides)) {
    const w = widgets.find((x) => x.name === name)
    if (w) w.value = value
    else widgets.push({ name, value })
  }
  return { widgets } as unknown as LGraphNode
}

function widgetValue(node: LGraphNode, name: string): unknown {
  return (node as unknown as { widgets: FakeWidget[] })
    .widgets.find((w) => w.name === name)?.value
}

function setup(overrides: Record<string, unknown> = {}) {
  const node = makeNode(overrides)
  const canvas = document.createElement('canvas')
  const api = useMeshPrimitive(node, { captureCanvas: () => canvas })
  return { node, canvas, api }
}

beforeEach(() => {
  scheduleCapture.mockClear()
  cancelCapture.mockClear()
  captureOpts = null
})

describe('useMeshPrimitive initialization', () => {
  it('starts from widget kind with defaults and syncs the recipe', () => {
    const { node, api } = setup({ kind: 'sphere' })
    expect(api.kind.value).toBe('sphere')
    expect(api.params.radius).toBe(0.5)
    expect(api.params.widthSegments).toBe(32)
    const recipe = JSON.parse(String(widgetValue(node, 'recipe'))) as Record<string, unknown>
    expect(recipe.radius).toBe(0.5)
    expect(recipe.heightSegments).toBe(16)
  })

  it('normalizes an unknown kind to cube', () => {
    const { api } = setup({ kind: 'dodecahedron' })
    expect(api.kind.value).toBe('cube')
    expect(api.params.depth).toBe(1)
  })

  it('applies stored recipe values over the defaults', () => {
    const { api } = setup({
      kind: 'sphere',
      recipe: '{"radius":2,"widthSegments":"12","bogus":9}',
    })
    expect(api.params.radius).toBe(2)
    expect(api.params.widthSegments).toBe(12)
    expect(api.params.bogus).toBeUndefined()
    expect(api.params.heightSegments).toBe(16)
  })

  it('falls back to defaults on malformed recipe json', () => {
    const { api } = setup({ recipe: '{not json' })
    expect(api.params.width).toBe(1)
  })

  it('skips null recipe entries', () => {
    const { api } = setup({ recipe: '{"width":null,"height":4}' })
    expect(api.params.width).toBe(1)
    expect(api.params.height).toBe(4)
  })
})

describe('setKind', () => {
  it('switches kind, resets params, writes widgets and schedules a capture', () => {
    const { node, api } = setup()
    api.setKind('torus')
    expect(api.kind.value).toBe('torus')
    expect(widgetValue(node, 'kind')).toBe('torus')
    expect(api.params.tube).toBe(0.2)
    expect(api.params.width).toBeUndefined()
    const recipe = JSON.parse(String(widgetValue(node, 'recipe'))) as Record<string, unknown>
    expect(recipe.arc).toBeCloseTo(Math.PI * 2)
    expect(scheduleCapture).toHaveBeenCalledTimes(1)
  })

  it('ignores setting the current kind again', () => {
    const { api } = setup()
    api.setKind('cube')
    expect(scheduleCapture).not.toHaveBeenCalled()
  })
})

describe('setParam', () => {
  it('clamps floats to the declared range', () => {
    const { api } = setup()
    const width = PRIM_PARAMS.cube[0]
    api.setParam(width, 99)
    expect(api.params.width).toBe(10)
    api.setParam(width, -5)
    expect(api.params.width).toBe(0.1)
    expect(scheduleCapture).toHaveBeenCalledTimes(2)
  })

  it('rounds integer params and syncs the recipe', () => {
    const { node, api } = setup()
    const seg = PRIM_PARAMS.cube.find((d) => d.key === 'widthSegments')!
    api.setParam(seg, 2.6)
    expect(api.params.widthSegments).toBe(3)
    const recipe = JSON.parse(String(widgetValue(node, 'recipe'))) as Record<string, unknown>
    expect(recipe.widthSegments).toBe(3)
  })

  it('ignores non-finite numeric input', () => {
    const { api } = setup()
    const width = PRIM_PARAMS.cube[0]
    api.setParam(width, Number.NaN)
    expect(api.params.width).toBe(1)
    expect(scheduleCapture).not.toHaveBeenCalled()
  })

  it('coerces boolean params', () => {
    const { api } = setup({ kind: 'cylinder' })
    const open = PRIM_PARAMS.cylinder.find((d) => d.key === 'openEnded')!
    api.setParam(open, 1 as unknown as boolean)
    expect(api.params.openEnded).toBe(true)
  })
})

describe('configure and capture wiring', () => {
  it('re-reads widget state when the node is configured', () => {
    const { node, api } = setup()
    const widgets = (node as unknown as { widgets: FakeWidget[] }).widgets
    widgets.find((w) => w.name === 'kind')!.value = 'plane'
    widgets.find((w) => w.name === 'recipe')!.value = '{"width":3}'
    const n = node as unknown as { onConfigure: (info: unknown) => void }
    n.onConfigure({})
    expect(api.kind.value).toBe('plane')
    expect(api.params.width).toBe(3)
    expect(api.params.depth).toBeUndefined()
  })

  it('exposes the capture canvas and writes the captured image url', () => {
    const { node, canvas } = setup()
    expect(captureOpts).not.toBeNull()
    expect(captureOpts!.getCanvas()).toBe(canvas)
    captureOpts!.onCaptured('/view?filename=cap.png')
    expect(widgetValue(node, 'captured_image')).toBe('/view?filename=cap.png')
  })

  it('re-exports capture controls', () => {
    const { api } = setup()
    api.scheduleCapture()
    api.cancelCapture()
    expect(scheduleCapture).toHaveBeenCalledTimes(1)
    expect(cancelCapture).toHaveBeenCalledTimes(1)
  })
})
