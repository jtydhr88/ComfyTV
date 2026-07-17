import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import type { ResolvedInput, StageState } from '@/stores/stageStore'

const pipelineState = vi.hoisted(() => ({
  requestRecompute: vi.fn(),
  lastOptions: null as any,
}))
vi.mock('@/composables/widgets/useTransformPipeline', () => ({
  useTransformPipeline: vi.fn((options: unknown) => {
    pipelineState.lastOptions = options
    return { computing: ref(false), requestRecompute: pipelineState.requestRecompute }
  }),
}))

import { clampCropRect, cropToCanvas, useCropStage } from './useCropStage'

function makeWidget(name: string, value: unknown = 0) {
  return { name, value, callback: vi.fn() }
}

function makeNode(b: Partial<{ x: number; y: number; w: number; h: number }> = {}): any {
  return {
    id: 5,
    widgets: [
      makeWidget('crop_x', b.x ?? 0),
      makeWidget('crop_y', b.y ?? 0),
      makeWidget('crop_w', b.w ?? 0),
      makeWidget('crop_h', b.h ?? 0),
    ],
    onConfigure: null as any,
  }
}

function makeState(image: string | null = '/img.png'): StageState {
  const inputs: ResolvedInput[] = image == null
    ? [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'empty', content: null }]
    : [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'upstream', content: image }]
  return reactive({
    kind: 'image', variant: 'crop',
    outputType: 'COMFYTV_IMAGE',
    output: null, outputs: [null],
    running: false, inputs, mainPrompt: '',
  }) as unknown as StageState
}

beforeEach(() => {
  pipelineState.requestRecompute.mockClear()
  pipelineState.lastOptions = null
})

describe('clampCropRect', () => {
  it('rounds and passes through in-range bounds', () => {
    expect(clampCropRect({ x: 10.4, y: 20.6, width: 100.2, height: 50.5 }, 640, 480))
      .toEqual({ sx: 10, sy: 21, sw: 100, sh: 51 })
  })

  it('clamps the origin into the image', () => {
    expect(clampCropRect({ x: -50, y: 9999, width: 10, height: 10 }, 640, 480))
      .toEqual({ sx: 0, sy: 479, sw: 10, sh: 1 })
  })

  it('limits size to the remaining image and enforces a 1px minimum', () => {
    expect(clampCropRect({ x: 600, y: 400, width: 500, height: 500 }, 640, 480))
      .toEqual({ sx: 600, sy: 400, sw: 40, sh: 80 })
    expect(clampCropRect({ x: 0, y: 0, width: 0, height: -5 }, 640, 480))
      .toEqual({ sx: 0, sy: 0, sw: 1, sh: 1 })
  })
})

describe('cropToCanvas', () => {
  it('draws the clamped source rect onto a matching canvas', () => {
    const drawImage = vi.fn()
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as never)
    try {
      const img = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement
      const canvas = cropToCanvas(img, { x: 10, y: 20, width: 100, height: 50 })
      expect(canvas.width).toBe(100)
      expect(canvas.height).toBe(50)
      expect(drawImage).toHaveBeenCalledWith(img, 10, 20, 100, 50, 0, 0, 100, 50)
    } finally {
      spy.mockRestore()
    }
  })

  it('throws when the 2d context is unavailable', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    try {
      const img = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement
      expect(() => cropToCanvas(img, { x: 0, y: 0, width: 10, height: 10 })).toThrow()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('useCropStage', () => {
  it('seeds bounds from the crop widgets', () => {
    const api = useCropStage(makeNode({ x: 1, y: 2, w: 3, h: 4 }), makeState())
    expect(api.bounds.value).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })

  it('exposes the upstream image url', () => {
    expect(useCropStage(makeNode(), makeState('/a.png')).sourceImageUrl.value).toBe('/a.png')
    expect(useCropStage(makeNode(), makeState(null)).sourceImageUrl.value).toBeNull()
  })

  it('writes bounds changes to widgets and schedules a recompute', async () => {
    const node = makeNode()
    const api = useCropStage(node, makeState())
    api.setBounds({ x: 5, y: 6, width: 7, height: 8 })
    await nextTick()
    expect(node.widgets.map((w: any) => w.value)).toEqual([5, 6, 7, 8])
    expect(pipelineState.requestRecompute).toHaveBeenCalled()
  })

  it('syncs external widget callbacks into bounds', () => {
    const node = makeNode()
    const api = useCropStage(node, makeState())
    node.widgets[2].callback(120)
    expect(api.bounds.value.width).toBe(120)
    node.widgets[0].callback(15)
    expect(api.bounds.value.x).toBe(15)
  })

  it('restores bounds on node configure only when they differ', async () => {
    const node = makeNode({ x: 1, y: 1, w: 10, h: 10 })
    const api = useCropStage(node, makeState())
    await nextTick()
    pipelineState.requestRecompute.mockClear()
    node.onConfigure?.({})
    await nextTick()
    expect(pipelineState.requestRecompute).not.toHaveBeenCalled()
    node.widgets[0].value = 42
    node.onConfigure?.({})
    expect(api.bounds.value.x).toBe(42)
  })

  it('recomputes immediately when a source arrives with valid bounds', () => {
    useCropStage(makeNode({ w: 10, h: 10 }), makeState('/img.png'))
    expect(pipelineState.requestRecompute).toHaveBeenCalled()
  })

  it('skips the initial recompute without valid bounds or source', () => {
    useCropStage(makeNode(), makeState('/img.png'))
    expect(pipelineState.requestRecompute).not.toHaveBeenCalled()
    useCropStage(makeNode({ w: 10, h: 10 }), makeState(null))
    expect(pipelineState.requestRecompute).not.toHaveBeenCalled()
  })

  it('passes a compute function that crops with the current bounds', () => {
    const drawImage = vi.fn()
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as never)
    try {
      const api = useCropStage(makeNode({ w: 10, h: 10 }), makeState())
      api.setBounds({ x: 2, y: 3, width: 20, height: 30 })
      const img = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement
      const canvas = pipelineState.lastOptions.compute(img) as HTMLCanvasElement
      expect(canvas.width).toBe(20)
      expect(canvas.height).toBe(30)
      expect(drawImage).toHaveBeenCalledWith(img, 2, 3, 20, 30, 0, 0, 20, 30)
    } finally {
      spy.mockRestore()
    }
  })

  it('configures the pipeline for the cropper subfolder', () => {
    useCropStage(makeNode(), makeState())
    expect(pipelineState.lastOptions).toMatchObject({
      nodeId: 5,
      filenamePrefix: 'comfytv-crop',
      subfolder: 'cropper',
    })
  })
})
