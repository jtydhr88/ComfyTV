import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DefaultContentStore } from '../impl/contentStore'
import { getPaintCore } from '../paint'
import { brushProfile } from './brushProfile'
import { compositeStroke, maskGrayFromColor } from './blendStroke'
import { CoverageBuffer } from './coverage'
import { flattenCatmullRom, stepDabs, stepStroke, type StrokePoint } from './interpolate'
import { registerBuiltinPaintCores } from './paintCore'
import { clearStampCache, getStamp, stampCacheSize } from './stampCache'

// happy-dom has no 2d context; finish() bails without one, so stub enough of
// it for the stroke-lifecycle tests.
let restoreGetContext: (() => void) | null = null
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as { getContext: unknown }
  const original = proto.getContext
  proto.getContext = () => ({
    drawImage() {},
    putImageData() {},
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  })
  restoreGetContext = () => {
    proto.getContext = original
  }
})
afterAll(() => restoreGetContext?.())

describe('brushProfile (GIMP generated brush)', () => {
  it('is 1 at the centre and 0 at the edge for any hardness', () => {
    for (const h of [0, 0.5, 1]) {
      expect(brushProfile(0, h)).toBeCloseTo(1, 5)
      expect(brushProfile(1, h)).toBe(0)
    }
  })

  it('decreases monotonically with distance', () => {
    let prev = Infinity
    for (let r = 0; r <= 1; r += 0.1) {
      const v = brushProfile(r, 0.5)
      expect(v).toBeLessThanOrEqual(prev + 1e-9)
      prev = v
    }
  })

  it('a harder brush has a fuller interior', () => {
    expect(brushProfile(0.7, 0.9)).toBeGreaterThan(brushProfile(0.7, 0.1))
  })
})

describe('stepStroke (dab spacing)', () => {
  it('places evenly spaced dabs along a segment', () => {
    const { dabs, carry } = stepStroke({ x: 0, y: 0 }, { x: 10, y: 0 }, 5, 0)
    expect(dabs).toEqual([
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ])
    expect(carry).toBe(0)
  })

  it('carries leftover distance across short segments', () => {
    const r = stepStroke({ x: 0, y: 0 }, { x: 4, y: 0 }, 5, 3)
    expect(r.dabs).toEqual([{ x: 2, y: 0 }])
    expect(r.carry).toBe(2)
  })

  it('emits no dabs for a zero-length segment', () => {
    expect(stepStroke({ x: 3, y: 3 }, { x: 3, y: 3 }, 5, 1).dabs).toEqual([])
  })
})

describe('CoverageBuffer — GIMP constant-mode accumulation', () => {
  it('overlapping dabs build toward the flow but never beyond it', () => {
    const buf = new CoverageBuffer(20, 20)
    buf.stampCircle(10, 10, 4, 1, 0.5)
    const one = buf.maxAt(10, 10)
    expect(one).toBeCloseTo(0.25, 6)
    buf.stampCircle(10, 10, 4, 1, 0.5)
    const two = buf.maxAt(10, 10)
    expect(two).toBeGreaterThan(one)
    expect(two).toBeLessThanOrEqual(0.5)
    for (let i = 0; i < 40; i++) buf.stampCircle(10, 10, 4, 1, 0.5)
    expect(buf.maxAt(10, 10)).toBeCloseTo(0.5, 3)
  })

  it('a later higher-flow dab keeps building toward the new flow cap', () => {
    const buf = new CoverageBuffer(20, 20)
    buf.stampCircle(10, 10, 4, 1, 0.5)
    const low = buf.maxAt(10, 10)
    buf.stampCircle(10, 10, 4, 1, 0.8)
    const raised = buf.maxAt(10, 10)
    expect(raised).toBeGreaterThan(low)
    expect(raised).toBeLessThanOrEqual(0.8)
    for (let i = 0; i < 60; i++) buf.stampCircle(10, 10, 4, 1, 0.8)
    expect(buf.maxAt(10, 10)).toBeCloseTo(0.8, 3)
  })

  it('coverage falls off from centre to edge and tracks a dirty rect', () => {
    const buf = new CoverageBuffer(20, 20)
    buf.stampCircle(10, 10, 5, 0.3, 1)
    expect(buf.maxAt(10, 10)).toBeGreaterThan(buf.maxAt(14, 10))
    expect(buf.dirty).not.toBeNull()
  })
})

describe('stamp cache', () => {
  it('caches stamps by size/hardness/subpixel and reuses them', () => {
    clearStampCache()
    const a = getStamp(8, 0.5, false, 0, 0)
    const b = getStamp(8, 0.5, false, 0, 0)
    expect(b).toBe(a)
    expect(stampCacheSize()).toBe(1)
    getStamp(8, 0.5, false, 0.25, 0)
    expect(stampCacheSize()).toBe(2)
  })

  it('stamp values match the direct brush profile computation', () => {
    clearStampCache()
    const radius = 5
    const stamp = getStamp(radius, 0.3, false, 0, 0)
    const c = stamp.center
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 3], [3, 3]]) {
      const d = Math.hypot(dx, dy)
      const want = d > radius ? 0 : brushProfile(d / radius, 0.3)
      expect(stamp.data[(c + dy) * stamp.size + (c + dx)]).toBeCloseTo(want, 6)
    }
  })

  it('subpixel offsets shift the stamp centre', () => {
    clearStampCache()
    const on = getStamp(4, 0.5, false, 0, 0)
    const off = getStamp(4, 0.5, false, 0.5, 0)
    const c = on.center
    expect(off.data[c * off.size + c + 4]).toBeGreaterThan(on.data[c * on.size + c + 4])
  })
})

describe('CoverageBuffer — extent allocation', () => {
  it('allocates storage for the stroked area, not the whole layer', () => {
    const buf = new CoverageBuffer(4096, 4096)
    buf.stampCircle(100, 100, 8, 1, 1)
    expect(buf.allocatedLength()).toBeGreaterThan(0)
    expect(buf.allocatedLength()).toBeLessThan(200 * 200)
  })

  it('grows the extent as the stroke moves and keeps earlier coverage', () => {
    const buf = new CoverageBuffer(1024, 1024)
    buf.stampCircle(50, 50, 4, 1, 0.5)
    const at50 = buf.valueAt(50, 50)
    buf.stampCircle(500, 500, 4, 1, 0.8)
    expect(buf.valueAt(50, 50)).toBe(at50)
    expect(buf.valueAt(500, 500)).toBeCloseTo(0.8 * 0.8, 6)
  })

  it('reads 0 outside the allocated extent', () => {
    const buf = new CoverageBuffer(1024, 1024)
    buf.stampCircle(50, 50, 4, 1, 1)
    expect(buf.valueAt(900, 900)).toBe(0)
    expect(buf.valueAt(-1, 5)).toBe(0)
  })
})

describe('catmull-rom stroke interpolation', () => {
  const p = (x: number, y: number, pressure = 1): StrokePoint => ({ x, y, pressure })

  it('collinear points flatten to the straight segment', () => {
    const pts = flattenCatmullRom(p(0, 0), p(10, 0), p(20, 0), p(30, 0))
    expect(pts[pts.length - 1]).toMatchObject({ x: 20, y: 0 })
    for (const q of pts) expect(Math.abs(q.y)).toBeLessThan(1e-9)
  })

  it('a corner is rounded through intermediate points off the chord', () => {
    const pts = flattenCatmullRom(p(0, 0), p(10, 0), p(10, 10), p(10, 20))
    expect(pts.length).toBeGreaterThan(1)
    const mid = pts[Math.floor(pts.length / 2)]
    const chordDist = Math.abs((mid.x - 10) * (10 - 0) - (mid.y - 0) * (10 - 10)) / 10
    expect(chordDist).toBeGreaterThan(0.05)
  })

  it('interpolates pressure from segment start to end', () => {
    const pts = flattenCatmullRom(p(0, 0, 0.2), p(10, 0, 0.2), p(20, 0, 0.8), p(30, 0, 0.8))
    expect(pts[pts.length - 1].pressure).toBeCloseTo(0.8, 6)
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].pressure).toBeGreaterThanOrEqual(pts[i - 1].pressure - 1e-9)
    }
  })

  it('stepDabs lerps pressure along the segment', () => {
    const { dabs } = stepDabs({ x: 0, y: 0, pressure: 0 }, { x: 10, y: 0, pressure: 1 }, 5, 0)
    expect(dabs.map((d) => d.x)).toEqual([5, 10])
    expect(dabs[0].pressure).toBeCloseTo(0.5, 6)
    expect(dabs[1].pressure).toBeCloseTo(1, 6)
  })
})

describe('pressure dynamics', () => {
  function strokeWith(dynamics: { size?: boolean; opacity?: boolean } | undefined, pressure: number) {
    registerBuiltinPaintCores()
    const content = new DefaultContentStore()
    const bitmap = document.createElement('canvas')
    bitmap.width = 64
    bitmap.height = 64
    const slot = { contentId: content.register(bitmap) }
    const core = getPaintCore('brush').create()
    core.start(
      {
        drawable: {} as never,
        channel: 'content',
        bitmap,
        slot,
        content,
        toLocal: (pt) => pt,
        selection: null,
        scale: 1,
      },
      { size: 16, hardness: 1, spacing: 0.1, opacity: 1, flow: 1, color: '#ff0000', dynamics },
      { x: 32, y: 32, pressure, time: 0 }
    )
    return core as unknown as { cov: CoverageBuffer }
  }

  it('size dynamics shrink the dab with light pressure', () => {
    const light = strokeWith({ size: true }, 0.25)
    const full = strokeWith({ size: true }, 1)
    expect(light.cov.valueAt(32 + 6, 32)).toBe(0)
    expect(full.cov.valueAt(32 + 6, 32)).toBeGreaterThan(0)
  })

  it('opacity dynamics scale the flow; disabled dynamics ignore pressure', () => {
    const half = strokeWith({ opacity: true }, 0.5)
    expect(half.cov.valueAt(32, 32)).toBeCloseTo(0.25, 6)
    const off = strokeWith(undefined, 0.5)
    expect(off.cov.valueAt(32, 32)).toBeCloseTo(1, 6)
  })
})

describe('compositeStroke — apply once at stroke opacity', () => {
  const cov = (v: number) => Float32Array.of(v)

  it('content brush paints colour over a transparent base', () => {
    const out = compositeStroke(Uint8ClampedArray.of(0, 0, 0, 0), cov(1), {
      mode: 'brush',
      channel: 'content',
      color: [255, 0, 0],
      opacity: 1,
    })
    expect([...out]).toEqual([255, 0, 0, 255])
  })

  it('content brush at half coverage over an opaque base is a 50/50 mix', () => {
    const out = compositeStroke(Uint8ClampedArray.of(0, 0, 255, 255), cov(0.5), {
      mode: 'brush',
      channel: 'content',
      color: [255, 0, 0],
      opacity: 1,
    })
    expect(out[0]).toBeCloseTo(128, -0.5)
    expect(out[2]).toBeCloseTo(128, -0.5)
    expect(out[3]).toBe(255)
  })

  it('eraser reduces alpha by the coverage', () => {
    const out = compositeStroke(Uint8ClampedArray.of(10, 20, 30, 255), cov(1), {
      mode: 'eraser',
      channel: 'content',
      color: [0, 0, 0],
      opacity: 1,
    })
    expect(out[3]).toBe(0)
    expect([out[0], out[1], out[2]]).toEqual([10, 20, 30])
  })

  it('selection coverage clips the stroke (GIMP aux2 semantics)', () => {
    const base = new Uint8ClampedArray(8)
    const out = compositeStroke(base, Float32Array.of(1, 1), {
      mode: 'brush',
      channel: 'content',
      color: [255, 0, 0],
      opacity: 1,
    }, Float32Array.of(0, 1))
    expect(out[3]).toBe(0)
    expect(out[7]).toBe(255)
  })

  it('mask brush paints the colour grayscale with a normal blend (GIMP paint-on-mask)', () => {
    const out = compositeStroke(Uint8ClampedArray.of(255, 255, 255, 255), cov(1), {
      mode: 'brush',
      channel: 'mask',
      color: [0, 0, 0],
      opacity: 1,
    })
    expect([out[0], out[1], out[2], out[3]]).toEqual([0, 0, 0, 255])
  })

  it('mask brush can paint arbitrary grays and blends by coverage', () => {
    const luma = Math.round(maskGrayFromColor([255, 0, 0]))
    const out = compositeStroke(Uint8ClampedArray.of(0, 0, 0, 255), cov(1), {
      mode: 'brush',
      channel: 'mask',
      color: [255, 0, 0],
      opacity: 1,
    })
    expect(out[0]).toBeCloseTo(luma, -0.5)

    const half = compositeStroke(Uint8ClampedArray.of(0, 0, 0, 255), cov(0.5), {
      mode: 'brush',
      channel: 'mask',
      color: [255, 255, 255],
      opacity: 1,
    })
    expect(half[0]).toBeCloseTo(128, -0.5)
  })

  it('mask eraser paints back toward white (GIMP background colour)', () => {
    const out = compositeStroke(Uint8ClampedArray.of(40, 40, 40, 255), cov(1), {
      mode: 'eraser',
      channel: 'mask',
      color: [0, 0, 0],
      opacity: 1,
    })
    expect([out[0], out[1], out[2], out[3]]).toEqual([255, 255, 255, 255])
  })

  it('lockAlpha: brush recolors but never changes alpha (GIMP lock_alpha)', () => {
    const base = Uint8ClampedArray.of(0, 0, 255, 128, 0, 0, 255, 0)
    const out = compositeStroke(base, Float32Array.of(1, 1), {
      mode: 'brush',
      channel: 'content',
      color: [255, 0, 0],
      opacity: 1,
      lockAlpha: true,
    })
    expect(out[0]).toBe(255)
    expect(out[3]).toBe(128)
    expect(out[7]).toBe(0)
  })

  it('lockAlpha: eraser is a no-op on alpha', () => {
    const base = Uint8ClampedArray.of(10, 20, 30, 200)
    const out = compositeStroke(base, Float32Array.of(1), {
      mode: 'eraser',
      channel: 'content',
      color: [0, 0, 0],
      opacity: 1,
      lockAlpha: true,
    })
    expect(out[3]).toBe(200)
  })

  it('selection clips the eraser too', () => {
    const base = Uint8ClampedArray.of(10, 20, 30, 255, 10, 20, 30, 255)
    const out = compositeStroke(base, Float32Array.of(1, 1), {
      mode: 'eraser',
      channel: 'content',
      color: [0, 0, 0],
      opacity: 1,
    }, Float32Array.of(0, 1))
    expect(out[3]).toBe(255)
    expect(out[7]).toBe(0)
  })
})

describe('paint stroke lifecycle (url dirtiness for re-upload)', () => {
  it('finish clears the slot url and undo restores it', () => {
    registerBuiltinPaintCores()
    const content = new DefaultContentStore()
    const bitmap = document.createElement('canvas')
    bitmap.width = 8
    bitmap.height = 8
    const beforeId = content.register(bitmap, { uploadedUrl: 'http://x/old.png' })
    const slot = { contentId: beforeId, url: 'http://x/old.png' }
    const core = getPaintCore('brush').create()
    core.start(
      {
        drawable: {} as never,
        channel: 'content',
        bitmap,
        slot,
        content,
        toLocal: (pt) => pt,
        selection: null,
        scale: 1,
      },
      { size: 4, hardness: 1, spacing: 0.1, opacity: 1, flow: 1, color: '#ff0000' },
      { x: 4, y: 4, pressure: 1, time: 0 }
    )
    const cmd = core.finish()
    expect(cmd).not.toBeNull()
    const afterId = slot.contentId
    expect(afterId).not.toBe(beforeId)
    expect(slot.url).toBeUndefined()
    expect(cmd!.contentRefs?.()).toBeUndefined()

    cmd!.apply('undo')
    expect(slot.contentId).not.toBe(afterId)
    expect(slot.url).toBe('http://x/old.png')
    expect(content.get(slot.contentId)?.uploadedUrl).toBe('http://x/old.png')
    cmd!.apply('redo')
    expect(slot.url).toBeUndefined()
  })

  it('region undo keeps the history budget at patch size, not layer size', () => {
    registerBuiltinPaintCores()
    const content = new DefaultContentStore()
    const bitmap = document.createElement('canvas')
    bitmap.width = 256
    bitmap.height = 256
    const beforeId = content.register(bitmap)
    const slot = { contentId: beforeId }
    const core = getPaintCore('brush').create()
    core.start(
      {
        drawable: {} as never,
        channel: 'content',
        bitmap,
        slot,
        content,
        toLocal: (pt) => pt,
        selection: null,
        scale: 1,
      },
      { size: 8, hardness: 1, spacing: 0.1, opacity: 1, flow: 1, color: '#ff0000' },
      { x: 10, y: 10, pressure: 1, time: 0 }
    )
    const cmd = core.finish()
    expect(cmd).not.toBeNull()
    expect(cmd!.sizeBytes()).toBeLessThan(256 * 256 * 4)
  })
})
