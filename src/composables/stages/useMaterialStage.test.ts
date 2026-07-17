import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  uploadCanvas: vi.fn(),
  setOutputSlot: vi.fn(),
}))

vi.mock('@/utils/uploadCanvas', () => ({
  uploadCanvas: mocks.uploadCanvas,
}))

vi.mock('@/stores/stageStore', () => ({
  useStageStore: () => ({ setOutputSlot: mocks.setOutputSlot }),
}))

import type { StageState } from '@/stores/stageStore'
import {
  DEFAULT_MATERIAL,
  MATERIAL_PRESETS,
  serializeMaterialState,
} from '@/widgets/material/types'
import { MATERIAL_SLIDERS, useMaterialStage } from './useMaterialStage'

interface FakeWidget {
  name: string
  value?: unknown
  callback?: (v: unknown) => void
}

function makeNode(over: { materialState?: string; capturedImage?: string } = {}) {
  const widgets: FakeWidget[] = [
    { name: 'material_state', value: over.materialState ?? '' },
    { name: 'captured_image', value: over.capturedImage ?? '' },
  ]
  return { widgets } as any
}

function makeState(): StageState {
  return reactive({
    kind: 'material',
    variant: 'default',
    outputType: 'COMFYTV_MATERIAL',
    output: null,
    outputs: [null, null],
    running: false,
    inputs: [],
    mainPrompt: '',
  }) as unknown as StageState
}

function widget(node: any, name: string): FakeWidget {
  return node.widgets.find((w: FakeWidget) => w.name === name)
}

function makeStage(over: {
  node?: any
  state?: StageState
  captureCanvas?: () => HTMLCanvasElement | null
} = {}) {
  const node = over.node ?? makeNode()
  const state = over.state ?? makeState()
  const stage = useMaterialStage(node, {
    getState: () => state,
    captureCanvas: over.captureCanvas ?? (() => null),
  })
  return { stage, node, state }
}

beforeEach(() => {
  mocks.uploadCanvas.mockReset()
  mocks.setOutputSlot.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useMaterialStage', () => {
  it('initializes params from the widget and syncs slot 0 immediately', () => {
    const saved = serializeMaterialState({ ...DEFAULT_MATERIAL, color: '#112233' })
    const { stage, node, state } = makeStage({ node: makeNode({ materialState: saved }) })
    expect(stage.params.color).toBe('#112233')
    expect(widget(node, 'material_state').value).toBe(saved)
    expect(mocks.setOutputSlot).toHaveBeenCalledWith(state, 0, saved)
  })

  it('falls back to the default material for an empty widget', () => {
    const { stage } = makeStage()
    expect({ ...stage.params }).toEqual(DEFAULT_MATERIAL)
  })

  it('setParam and setColor update and persist on the next tick', async () => {
    const { stage, node, state } = makeStage()
    stage.setParam('metalness', 0.8)
    stage.setColor('#FF0000')
    expect(stage.params.color).toBe('#ff0000')
    await nextTick()
    const json = serializeMaterialState(stage.params)
    expect(widget(node, 'material_state').value).toBe(json)
    expect(mocks.setOutputSlot).toHaveBeenLastCalledWith(state, 0, json)
    expect(JSON.parse(json as string).metalness).toBe(0.8)
  })

  it('applyPreset assigns the preset parameters', () => {
    const { stage } = makeStage()
    const metal = MATERIAL_PRESETS.find((p) => p.key === 'metalPolished')!
    stage.applyPreset(metal)
    expect(stage.params.metalness).toBe(1)
    expect(stage.params.roughness).toBe(0.08)
  })

  it('adopts an incoming stage output when it differs', async () => {
    const { stage, state } = makeStage()
    state.output = serializeMaterialState({ ...DEFAULT_MATERIAL, roughness: 0.9 })
    await nextTick()
    expect(stage.params.roughness).toBe(0.9)
  })

  it('ignores a stage output equal to the current params', async () => {
    const { stage, state } = makeStage()
    const before = { ...stage.params }
    state.output = serializeMaterialState(stage.params)
    await nextTick()
    expect({ ...stage.params }).toEqual(before)
  })

  it('captures after the settle delay, persists the url and fills slot 1', async () => {
    vi.useFakeTimers()
    const canvas = document.createElement('canvas')
    mocks.uploadCanvas.mockResolvedValue('/view?filename=mat.png')
    const { stage, node, state } = makeStage({ captureCanvas: () => canvas })
    stage.scheduleCapture()
    stage.scheduleCapture()
    await vi.advanceTimersByTimeAsync(699)
    expect(mocks.uploadCanvas).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.uploadCanvas).toHaveBeenCalledTimes(1)
    expect(mocks.uploadCanvas.mock.calls[0][1]).toMatchObject({ subfolder: 'material' })
    expect(widget(node, 'captured_image').value).toBe('/view?filename=mat.png')
    expect(mocks.setOutputSlot).toHaveBeenCalledWith(state, 1, '/view?filename=mat.png')
  })

  it('teardown cancels a pending capture', async () => {
    vi.useFakeTimers()
    const canvas = document.createElement('canvas')
    mocks.uploadCanvas.mockResolvedValue('/u')
    const { stage } = makeStage({ captureCanvas: () => canvas })
    stage.scheduleCapture()
    stage.teardown()
    await vi.advanceTimersByTimeAsync(700)
    expect(mocks.uploadCanvas).not.toHaveBeenCalled()
  })

  it('reloads params and the captured slot on node configure', () => {
    const { stage, node, state } = makeStage()
    const saved = serializeMaterialState({ ...DEFAULT_MATERIAL, clearcoat: 1 })
    widget(node, 'material_state').value = saved
    widget(node, 'captured_image').value = '/view?filename=old.png'
    node.onConfigure({})
    expect(stage.params.clearcoat).toBe(1)
    expect(mocks.setOutputSlot).toHaveBeenCalledWith(state, 1, '/view?filename=old.png')
  })

  it('exposes slider metadata covering all editable scalar params', () => {
    expect(MATERIAL_SLIDERS.map((s) => s.key)).toEqual([
      'metalness', 'roughness', 'transmission', 'opacity', 'clearcoat', 'ior',
    ])
  })
})
