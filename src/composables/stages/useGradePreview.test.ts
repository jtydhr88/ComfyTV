import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { ColorGradeEffect } from '@/widgets/glsl/effects'
import type { GradeValues } from '@/widgets/glsl/renderGrade'

const mocks = vi.hoisted(() => ({
  renderToCanvas: vi.fn<(...args: unknown[]) => boolean>(() => true),
  dispose: vi.fn(),
  error: null as string | null,
}))

vi.mock('@/widgets/glsl/renderGrade', () => ({
  GradeRenderer: class {
    renderToCanvas = mocks.renderToCanvas
    dispose = mocks.dispose
    get error() { return mocks.error }
  },
}))

import { GRADE_PREVIEW_DEBOUNCE_MS, useGradePreview } from './useGradePreview'

class FakeImage {
  static instances: FakeImage[] = []
  onload: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  crossOrigin: string | null = null
  complete = false
  src = ''
  constructor() {
    FakeImage.instances.push(this)
  }
}

function makeEffect(): ColorGradeEffect {
  return { id: 'fx', labelKey: 'x', frag: '', uniforms: [] }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

let wrappers: VueWrapper[] = []

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('Image', FakeImage)
  FakeImage.instances = []
  mocks.renderToCanvas.mockClear()
  mocks.renderToCanvas.mockReturnValue(true)
  mocks.dispose.mockClear()
  mocks.error = null
})

afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function setup(url: string | null = '/view?filename=a.png') {
  const sourceImageUrl = ref<string | null>(url)
  const canvasEl = ref<HTMLCanvasElement | null>(document.createElement('canvas'))
  const effect = ref<ColorGradeEffect>(makeEffect())
  const values = ref<GradeValues>({})
  let api!: ReturnType<typeof useGradePreview>
  const wrapper = mount(defineComponent({
    setup() {
      api = useGradePreview({ sourceImageUrl, canvasEl, effect, values })
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, wrapper, sourceImageUrl, canvasEl, effect, values }
}

async function completeImageLoad(idx = 0): Promise<void> {
  const img = FakeImage.instances[idx]
  img.complete = true
  img.onload?.()
  await flushMicrotasks()
}

describe('useGradePreview debounce', () => {
  it('coalesces rapid renderPreview calls into a single render', async () => {
    const { api } = setup()
    api.renderPreview()
    api.renderPreview()
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS - 1)
    expect(FakeImage.instances).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(FakeImage.instances).toHaveLength(1)
    await completeImageLoad()
    expect(mocks.renderToCanvas).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a source url', async () => {
    const { api } = setup(null)
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    await flushMicrotasks()
    expect(FakeImage.instances).toHaveLength(0)
    expect(mocks.renderToCanvas).not.toHaveBeenCalled()
  })

  it('does nothing without a canvas element', async () => {
    const { api, canvasEl } = setup()
    canvasEl.value = null
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    await flushMicrotasks()
    expect(mocks.renderToCanvas).not.toHaveBeenCalled()
  })
})

describe('useGradePreview rendering', () => {
  it('renders to the preview canvas and clears the error on success', async () => {
    const { api, canvasEl, effect, values } = setup()
    mocks.error = 'stale'
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    await completeImageLoad()
    expect(mocks.renderToCanvas).toHaveBeenCalledWith(
      FakeImage.instances[0],
      effect.value,
      values.value,
      canvasEl.value,
    )
    expect(api.renderError.value).toBeNull()
  })

  it('surfaces the renderer error when rendering fails', async () => {
    const { api } = setup()
    mocks.renderToCanvas.mockReturnValue(false)
    mocks.error = 'Shader compilation failed'
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    await completeImageLoad()
    expect(api.renderError.value).toBe('Shader compilation failed')
  })

  it('flags an image load failure', async () => {
    const { api } = setup()
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    FakeImage.instances[0].onerror?.(new Event('error'))
    await flushMicrotasks()
    expect(api.renderError.value).toBe('Failed to load image')
    expect(mocks.renderToCanvas).not.toHaveBeenCalled()
  })

  it('reuses the loaded image for the same url', async () => {
    const { api } = setup()
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    await completeImageLoad()
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    await flushMicrotasks()
    expect(FakeImage.instances).toHaveLength(1)
    expect(mocks.renderToCanvas).toHaveBeenCalledTimes(2)
  })

  it('loads a fresh image when the url changes', async () => {
    const { api, sourceImageUrl } = setup()
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    await completeImageLoad()
    sourceImageUrl.value = '/view?filename=b.png'
    api.renderPreview()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS)
    expect(FakeImage.instances).toHaveLength(2)
    await completeImageLoad(1)
    expect(mocks.renderToCanvas).toHaveBeenCalledTimes(2)
  })
})

describe('useGradePreview teardown', () => {
  it('cancels a pending render and disposes the renderer on unmount', async () => {
    const { api, wrapper } = setup()
    api.renderPreview()
    wrapper.unmount()
    vi.advanceTimersByTime(GRADE_PREVIEW_DEBOUNCE_MS * 2)
    await flushMicrotasks()
    expect(FakeImage.instances).toHaveLength(0)
    expect(mocks.dispose).toHaveBeenCalledTimes(1)
  })
})
