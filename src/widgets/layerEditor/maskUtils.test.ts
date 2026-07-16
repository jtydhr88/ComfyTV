import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { alphaMaskToLuminance, createOpaqueMask, luminanceToAlphaMask } from './maskUtils'

interface FakeImageData {
  width: number
  height: number
  data: Uint8ClampedArray
}

/**
 * happy-dom's HTMLCanvasElement.getContext returns null, so we back every
 * canvas with a tiny software 2d context implementing only what maskUtils uses:
 * fillRect, getImageData, createImageData, putImageData, drawImage.
 */
class FakeCtx {
  fillStyle = '#000000'
  private data: Uint8ClampedArray

  constructor(private canvas: HTMLCanvasElement) {
    this.data = new Uint8ClampedArray(canvas.width * canvas.height * 4)
  }

  pixels(): Uint8ClampedArray {
    return this.data
  }

  setPixel(x: number, y: number, rgba: [number, number, number, number]): void {
    const i = (y * this.canvas.width + x) * 4
    this.data.set(rgba, i)
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const hex = /^#([0-9a-f]{6})$/i.exec(String(this.fillStyle))
    const rgb = hex ? parseInt(hex[1], 16) : 0
    const [r, g, b] = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, [r, g, b, 255])
      }
    }
  }

  getImageData(_x: number, _y: number, w: number, h: number): FakeImageData {
    return { width: w, height: h, data: this.data.slice(0, w * h * 4) }
  }

  createImageData(w: number, h: number): FakeImageData {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
  }

  putImageData(img: FakeImageData, _x: number, _y: number): void {
    this.data.set(img.data, 0)
  }

  drawImage(img: CanvasImageSource, _x: number, _y: number, w: number, h: number): void {
    // Tests always draw same-sized canvases, so a straight copy suffices.
    const src = contexts.get(img as HTMLCanvasElement)
    if (!src) throw new Error('drawImage source has no fake context')
    expect(w).toBe(this.canvas.width)
    expect(h).toBe(this.canvas.height)
    this.data.set(src.pixels(), 0)
  }
}

const contexts = new WeakMap<HTMLCanvasElement, FakeCtx>()

function ctxOf(canvas: HTMLCanvasElement): FakeCtx {
  const ctx = contexts.get(canvas)
  if (!ctx) throw new Error('canvas has no fake context')
  return ctx
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    kind: string,
  ) {
    expect(kind).toBe('2d')
    let ctx = contexts.get(this)
    if (!ctx) {
      ctx = new FakeCtx(this)
      contexts.set(this, ctx)
    }
    return ctx as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

describe('createOpaqueMask', () => {
  it('creates a canvas of the requested size filled with opaque white', () => {
    const mask = createOpaqueMask(3, 2)
    expect(mask.width).toBe(3)
    expect(mask.height).toBe(2)
    const data = ctxOf(mask).pixels()
    expect(data.length).toBe(3 * 2 * 4)
    for (let i = 0; i < data.length; i += 4) {
      expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([255, 255, 255, 255])
    }
  })
})

describe('alphaMaskToLuminance', () => {
  it('copies the source alpha into RGB and makes the output fully opaque', () => {
    const mask = makeCanvas(2, 1)
    mask.getContext('2d') // materialize the fake ctx
    const ctx = ctxOf(mask)
    ctx.setPixel(0, 0, [10, 20, 30, 200]) // painted pixel, alpha 200
    ctx.setPixel(1, 0, [99, 99, 99, 0]) // erased pixel, alpha 0

    const out = alphaMaskToLuminance(mask)
    expect(out.width).toBe(2)
    expect(out.height).toBe(1)
    const data = ctxOf(out).pixels()
    expect(Array.from(data.subarray(0, 4))).toEqual([200, 200, 200, 255])
    expect(Array.from(data.subarray(4, 8))).toEqual([0, 0, 0, 255])
  })

  it('round-trips a freshly created opaque mask to pure white', () => {
    const out = alphaMaskToLuminance(createOpaqueMask(2, 2))
    const data = ctxOf(out).pixels()
    for (let i = 0; i < data.length; i += 4) {
      expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([255, 255, 255, 255])
    }
  })
})

describe('luminanceToAlphaMask', () => {
  it('maps the source red channel to alpha over solid white', () => {
    const lum = makeCanvas(2, 1)
    lum.getContext('2d')
    const ctx = ctxOf(lum)
    ctx.setPixel(0, 0, [255, 255, 255, 255]) // white -> fully opaque
    ctx.setPixel(1, 0, [64, 0, 0, 255]) // dark -> alpha 64

    const out = luminanceToAlphaMask(lum, 2, 1)
    expect(out.width).toBe(2)
    expect(out.height).toBe(1)
    const data = ctxOf(out).pixels()
    expect(Array.from(data.subarray(0, 4))).toEqual([255, 255, 255, 255])
    expect(Array.from(data.subarray(4, 8))).toEqual([255, 255, 255, 64])
  })

  it('is the inverse of alphaMaskToLuminance', () => {
    const mask = makeCanvas(1, 2)
    mask.getContext('2d')
    const ctx = ctxOf(mask)
    ctx.setPixel(0, 0, [0, 0, 0, 128])
    ctx.setPixel(0, 1, [0, 0, 0, 255])

    const lum = alphaMaskToLuminance(mask)
    const back = luminanceToAlphaMask(lum, 1, 2)
    const data = ctxOf(back).pixels()
    expect(data[3]).toBe(128)
    expect(data[7]).toBe(255)
  })
})
