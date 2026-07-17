import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  mirrorPreviewStyle,
  mirrorToCanvas,
  rotatePreviewStyle,
  rotatedSize,
  rotateToCanvas,
} from './imageOrientPreview'

describe('preview styles', () => {
  it('encodes flips as negative scales', () => {
    expect(mirrorPreviewStyle(false, false).transform).toBe('scale(1, 1)')
    expect(mirrorPreviewStyle(true, false).transform).toBe('scale(-1, 1)')
    expect(mirrorPreviewStyle(false, true).transform).toBe('scale(1, -1)')
    expect(mirrorPreviewStyle(true, true).transform).toBe('scale(-1, -1)')
  })

  it('encodes rotation in degrees with a shared transition', () => {
    const s = rotatePreviewStyle(45)
    expect(s.transform).toBe('rotate(45deg)')
    expect(s.transition).toBe(mirrorPreviewStyle(false, false).transition)
  })
})

describe('rotatedSize', () => {
  it('keeps dimensions at 0 degrees', () => {
    expect(rotatedSize(640, 480, 0)).toEqual({ width: 640, height: 480 })
  })

  it('swaps dimensions at 90 and -90 degrees within ceil rounding', () => {
    expect(rotatedSize(640, 480, 90)).toEqual({ width: 481, height: 640 })
    expect(rotatedSize(640, 480, -90)).toEqual({ width: 481, height: 640 })
  })

  it('expands the bounding box for diagonal angles', () => {
    const { width, height } = rotatedSize(100, 100, 45)
    expect(width).toBe(Math.ceil(100 * Math.SQRT2))
    expect(height).toBe(width)
  })

  it('never collapses below 1px', () => {
    expect(rotatedSize(0, 0, 33)).toEqual({ width: 1, height: 1 })
  })
})

describe('canvas transforms', () => {
  function mockCtx() {
    return {
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mirrorToCanvas flips around the image extents', () => {
    const ctx = mockCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    const img = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement
    const canvas = mirrorToCanvas(img, true, false)
    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)
    expect(ctx.translate).toHaveBeenCalledWith(640, 0)
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0)
  })

  it('mirrorToCanvas leaves the identity transform when nothing flips', () => {
    const ctx = mockCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    const img = { naturalWidth: 10, naturalHeight: 20 } as HTMLImageElement
    mirrorToCanvas(img, false, false)
    expect(ctx.translate).toHaveBeenCalledWith(0, 0)
    expect(ctx.scale).toHaveBeenCalledWith(1, 1)
  })

  it('rotateToCanvas rotates around the expanded center', () => {
    const ctx = mockCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    const img = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement
    const canvas = rotateToCanvas(img, 90)
    expect(canvas.width).toBe(481)
    expect(canvas.height).toBe(640)
    expect(ctx.translate).toHaveBeenCalledWith(240.5, 320)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, -320, -240)
  })

  it('both throw without a 2d context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const img = { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement
    expect(() => mirrorToCanvas(img, true, true)).toThrow()
    expect(() => rotateToCanvas(img, 45)).toThrow()
  })
})
