import { describe, it, expect } from 'vitest'
import {
  SCOPE_BINS,
  computeWaveform,
  computeVectorscope,
  computeHistogram,
  rgbToCbCr,
  lumaBt601,
  vectorscopeTargets,
  renderWaveformPixels,
  renderVectorscopePixels,
  renderHistogramPixels,
  renderScopePixels,
  drawScope,
  type ImageDataLike,
} from './scopeMath'

function solidFrame(r: number, g: number, b: number, w = 8, h = 8): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  return { data, width: w, height: h }
}

function grayRamp(w = 256, h = 4): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const v = Math.floor((x * 256) / w)
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

function argmax(a: Uint32Array): number {
  let best = 0
  for (let i = 1; i < a.length; i++) if (a[i] > a[best]) best = i
  return best
}

describe('scopeMath', () => {
  describe('computeWaveform', () => {
    it('gray ramp produces a diagonal in luma mode', () => {
      const img = grayRamp()
      const wf = computeWaveform(img, 'luma')
      expect(wf.channels).toBe(1)
      expect(wf.width).toBe(256)
      for (const x of [0, 64, 128, 200, 255]) {
        expect(wf.data[x * SCOPE_BINS + x]).toBe(img.height)
        const col = wf.data.slice(x * SCOPE_BINS, (x + 1) * SCOPE_BINS)
        expect(argmax(col)).toBe(x)
      }
    })

    it('luma uses BT.601 weights', () => {
      const img = solidFrame(255, 0, 0, 2, 2)
      const wf = computeWaveform(img, 'luma')
      const bin = Math.round(lumaBt601(255, 0, 0))
      expect(wf.data[0 * SCOPE_BINS + bin]).toBe(2)
      expect(bin).toBe(76)
    })

    it('parade splits channels', () => {
      const img = solidFrame(10, 20, 30, 4, 4)
      const wf = computeWaveform(img, 'parade')
      expect(wf.channels).toBe(3)
      expect(wf.data[(0 * 4 + 1) * SCOPE_BINS + 10]).toBe(4)
      expect(wf.data[(1 * 4 + 1) * SCOPE_BINS + 20]).toBe(4)
      expect(wf.data[(2 * 4 + 1) * SCOPE_BINS + 30]).toBe(4)
    })
  })

  describe('computeVectorscope', () => {
    it('pure red concentrates all density at the red UV point', () => {
      const img = solidFrame(255, 0, 0)
      const density = computeVectorscope(img)
      const [cb, cr] = rgbToCbCr(255, 0, 0)
      const idx = Math.min(255, Math.round(cr)) * SCOPE_BINS + Math.min(255, Math.round(cb))
      expect(argmax(density)).toBe(idx)
      expect(density[idx]).toBe(img.width * img.height)
      let total = 0
      density.forEach((v) => { total += v })
      expect(total).toBe(img.width * img.height)
    })

    it('neutral gray sits at the center', () => {
      const density = computeVectorscope(solidFrame(128, 128, 128))
      expect(argmax(density)).toBe(128 * SCOPE_BINS + 128)
    })

    it('red density aligns with the 100% R graticule target', () => {
      const density = computeVectorscope(solidFrame(255, 0, 0))
      const target = vectorscopeTargets(1).find((t) => t.label === 'R')!
      expect(argmax(density)).toBe(target.v * SCOPE_BINS + target.u)
    })
  })

  describe('vectorscopeTargets', () => {
    it('provides six standard color points', () => {
      const targets = vectorscopeTargets()
      expect(targets.map((t) => t.label)).toEqual(['R', 'Yl', 'G', 'Cy', 'B', 'Mg'])
      targets.forEach((t) => {
        expect(t.u).toBeGreaterThanOrEqual(0)
        expect(t.u).toBeLessThan(SCOPE_BINS)
        expect(t.v).toBeGreaterThanOrEqual(0)
        expect(t.v).toBeLessThan(SCOPE_BINS)
      })
      const red = targets.find((t) => t.label === 'R')!
      expect(red.v).toBeGreaterThan(128)
      expect(red.u).toBeLessThan(128)
    })
  })

  describe('computeHistogram', () => {
    it('black frame lands entirely in bin 0', () => {
      const img = solidFrame(0, 0, 0)
      const hist = computeHistogram(img)
      const n = img.width * img.height
      expect(hist.r[0]).toBe(n)
      expect(hist.g[0]).toBe(n)
      expect(hist.b[0]).toBe(n)
      expect(hist.r.slice(1).every((v) => v === 0)).toBe(true)
    })

    it('counts each channel independently', () => {
      const hist = computeHistogram(solidFrame(5, 100, 250, 3, 3))
      expect(hist.r[5]).toBe(9)
      expect(hist.g[100]).toBe(9)
      expect(hist.b[250]).toBe(9)
    })
  })

  describe('render helpers', () => {
    it('waveform render lights the diagonal with a green tint', () => {
      const wf = computeWaveform(grayRamp(), 'luma')
      const px = renderWaveformPixels(wf, 256, 256)
      const x = 128
      const y = 256 - 1 - 128
      const o = (y * 256 + x) * 4
      expect(px[o + 1]).toBeGreaterThan(0)
      expect(px[o + 1]).toBeGreaterThan(px[o])
      expect(px[o + 3]).toBe(255)
    })

    it('a single-pixel count is still visible after log mapping', () => {
      const img: ImageDataLike = {
        data: new Uint8ClampedArray([128, 128, 128, 255]),
        width: 1,
        height: 1,
      }
      const wf = computeWaveform(img, 'luma')
      const px = renderWaveformPixels(wf, 4, 256)
      const o = ((256 - 1 - 128) * 4 + 0) * 4
      expect(px[o + 1]).toBeGreaterThan(60)
    })

    it('vectorscope render puts a white dot at the red point', () => {
      const density = computeVectorscope(solidFrame(255, 0, 0))
      const size = 256
      const px = renderVectorscopePixels(density, size, size)
      const [cb, cr] = rgbToCbCr(255, 0, 0)
      const x = Math.min(255, Math.round(cb))
      const y = size - 1 - Math.min(255, Math.round(cr))
      const o = (y * size + x) * 4
      expect(px[o]).toBeGreaterThan(200)
      expect(px[o]).toBe(px[o + 1])
      expect(px[o + 1]).toBe(px[o + 2])
    })

    it('vectorscope render draws a dim graticule on empty frames', () => {
      const px = renderVectorscopePixels(new Uint32Array(SCOPE_BINS * SCOPE_BINS), 256, 256)
      const o = ((256 - 1 - 128) * 256 + 128) * 4
      expect(px[o + 1]).toBeGreaterThan(0)
      expect(px[o + 1]).toBeGreaterThan(px[o])
    })

    it('histogram render stacks RGB bars from the bottom', () => {
      const hist = computeHistogram(solidFrame(0, 0, 0))
      const px = renderHistogramPixels(hist, 256, 100)
      const o = (99 * 256 + 0) * 4
      expect(px[o]).toBeGreaterThan(0)
      expect(px[o + 1]).toBeGreaterThan(0)
      expect(px[o + 2]).toBeGreaterThan(0)
      const far = (99 * 256 + 200) * 4
      expect(px[far + 3]).toBe(0)
    })

    it('renderScopePixels dispatches all four kinds', () => {
      const img = solidFrame(200, 30, 30, 4, 4)
      for (const kind of ['waveform', 'waveform_parade', 'vectorscope', 'histogram'] as const) {
        const px = renderScopePixels(kind, img, 32, 32)
        expect(px.length).toBe(32 * 32 * 4)
        expect(px.some((v) => v > 0)).toBe(true)
      }
    })

    it('drawScope writes pixels through the 2D context', () => {
      const created = { data: new Uint8ClampedArray(8 * 8 * 4), width: 8, height: 8 }
      const ctx = {
        createImageData: (w: number, h: number) => {
          expect(w).toBe(8)
          expect(h).toBe(8)
          return created
        },
        putImageData: (frame: unknown, x: number, y: number) => {
          expect(frame).toBe(created)
          expect(x).toBe(0)
          expect(y).toBe(0)
        },
      } as unknown as CanvasRenderingContext2D
      drawScope(ctx, 'histogram', solidFrame(0, 0, 0, 2, 2), 8, 8)
      expect(created.data.some((v) => v > 0)).toBe(true)
    })
  })
})
