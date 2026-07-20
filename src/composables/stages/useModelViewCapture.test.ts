import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const uploadCanvas = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => '/view/captured.png'))
vi.mock('@/utils/uploadCanvas', () => ({
  uploadCanvas: (...a: unknown[]) => uploadCanvas(...(a as [HTMLCanvasElement, unknown]))
}))

import {
  MODEL_VIEW_CAPTURE_DELAY_MS,
  useModelViewCapture
} from './useModelViewCapture'

function setup(overrides?: {
  getCanvas?: () => HTMLCanvasElement | null
  enabled?: () => boolean
}) {
  const canvas = document.createElement('canvas')
  const onCaptured = vi.fn()
  const api = useModelViewCapture({
    getCanvas: overrides?.getCanvas ?? (() => canvas),
    filenamePrefix: 'comfytv-test-view',
    logTag: 'test',
    onCaptured,
    enabled: overrides?.enabled
  })
  return { api, canvas, onCaptured }
}

beforeEach(() => {
  vi.useFakeTimers()
  uploadCanvas.mockClear()
  uploadCanvas.mockResolvedValue('/view/captured.png')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useModelViewCapture', () => {
  it('debounces schedule calls into one capture', async () => {
    const { api, onCaptured } = setup()
    api.scheduleCapture()
    api.scheduleCapture()
    api.scheduleCapture()
    await vi.advanceTimersByTimeAsync(MODEL_VIEW_CAPTURE_DELAY_MS + 10)
    expect(uploadCanvas).toHaveBeenCalledTimes(1)
    expect(onCaptured).toHaveBeenCalledWith('/view/captured.png')
  })

  it('uploads with the configured prefix and subfolder', async () => {
    const { api } = setup()
    api.scheduleCapture()
    await vi.advanceTimersByTimeAsync(MODEL_VIEW_CAPTURE_DELAY_MS + 10)
    const opts = uploadCanvas.mock.calls[0][1] as { subfolder: string; filename: string }
    expect(opts.subfolder).toBe('comfytv/model3d-view')
    expect(opts.filename).toMatch(/^comfytv-test-view-\d+\.png$/)
  })

  it('honours a custom delayMs override', async () => {
    const canvas = document.createElement('canvas')
    const onCaptured = vi.fn()
    const api = useModelViewCapture({
      getCanvas: () => canvas,
      filenamePrefix: 'comfytv-test-view',
      logTag: 'test',
      onCaptured,
      delayMs: 250
    })
    api.scheduleCapture()
    await vi.advanceTimersByTimeAsync(249)
    expect(uploadCanvas).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onCaptured).toHaveBeenCalledWith('/view/captured.png')
  })

  it('skips scheduling when disabled', async () => {
    const { api } = setup({ enabled: () => false })
    api.scheduleCapture()
    await vi.advanceTimersByTimeAsync(MODEL_VIEW_CAPTURE_DELAY_MS + 10)
    expect(uploadCanvas).not.toHaveBeenCalled()
  })

  it('skips capture when there is no canvas', async () => {
    const { api } = setup({ getCanvas: () => null })
    await api.runCapture()
    expect(uploadCanvas).not.toHaveBeenCalled()
  })

  it('cancel clears the pending timer', async () => {
    const { api } = setup()
    api.scheduleCapture()
    api.cancelCapture()
    await vi.advanceTimersByTimeAsync(MODEL_VIEW_CAPTURE_DELAY_MS + 10)
    expect(uploadCanvas).not.toHaveBeenCalled()
  })

  it('cancel invalidates an in-flight upload', async () => {
    const { api, onCaptured } = setup()
    let resolveUpload!: (url: string) => void
    uploadCanvas.mockImplementationOnce(
      () => new Promise<string>((resolve) => { resolveUpload = resolve })
    )
    const pending = api.runCapture()
    api.cancelCapture()
    resolveUpload('/view/late.png')
    await pending
    expect(onCaptured).not.toHaveBeenCalled()
  })

  it('a newer capture supersedes an older one', async () => {
    const { api, onCaptured } = setup()
    let resolveFirst!: (url: string) => void
    uploadCanvas.mockImplementationOnce(
      () => new Promise<string>((resolve) => { resolveFirst = resolve })
    )
    const first = api.runCapture()
    const second = api.runCapture()
    resolveFirst('/view/old.png')
    await Promise.all([first, second])
    expect(onCaptured).toHaveBeenCalledTimes(1)
    expect(onCaptured).toHaveBeenCalledWith('/view/captured.png')
  })

  it('swallows upload failures', async () => {
    const { api, onCaptured } = setup()
    uploadCanvas.mockRejectedValueOnce(new Error('nope'))
    await expect(api.runCapture()).resolves.toBeUndefined()
    expect(onCaptured).not.toHaveBeenCalled()
  })
})
