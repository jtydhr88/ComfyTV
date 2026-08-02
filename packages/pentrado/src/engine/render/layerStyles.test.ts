import { describe, expect, it } from 'vitest'

import {
  applyBevel,
  applyColorOverlay,
  applyInnerGlow,
  applyInnerShadow,
  applyOuterGlow,
  applyStroke,
  distanceToShape,
} from './layerStyles'

function square(w: number, h: number, x0: number, y0: number, x1: number, y1: number): ImageData {
  const img = new ImageData(w, h)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4
      img.data[i] = 40
      img.data[i + 1] = 90
      img.data[i + 2] = 160
      img.data[i + 3] = 255
    }
  }
  return img
}

function px(img: ImageData, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}

describe('distanceToShape', () => {
  it('is zero inside, Euclidean outside', () => {
    const img = square(32, 32, 10, 10, 20, 20)
    const alpha = new Float32Array(32 * 32)
    for (let p = 0; p < alpha.length; p++) alpha[p] = img.data[p * 4 + 3] / 255
    const d = distanceToShape(alpha, 32, 32)
    expect(d[15 * 32 + 15]).toBe(0)
    expect(d[15 * 32 + 25]).toBeCloseTo(6, 0)
    // diagonal corner distance
    expect(d[5 * 32 + 5]).toBeCloseTo(Math.hypot(5, 5), 0)
  })
})

describe('stroke', () => {
  it('outside stroke paints a band beyond the shape and leaves the interior alone', () => {
    const img = square(40, 40, 12, 12, 28, 28)
    applyStroke(img, { size: 4, position: 0, strokeOpacity: 1, color: 0xff0000 })
    expect(px(img, 10, 20)).toEqual([255, 0, 0, 255])
    expect(px(img, 20, 20)).toEqual([40, 90, 160, 255])
    expect(px(img, 2, 2)[3]).toBe(0)
  })

  it('inside stroke stays within the shape', () => {
    const img = square(40, 40, 12, 12, 28, 28)
    applyStroke(img, { size: 4, position: 1, strokeOpacity: 1, color: 0x00ff00 })
    expect(px(img, 13, 20)[1]).toBe(255)
    expect(px(img, 10, 20)[3]).toBe(0)
    expect(px(img, 20, 20)).toEqual([40, 90, 160, 255])
  })
})

describe('glows and shadows', () => {
  it('outer glow adds alpha outside, under the layer', () => {
    const img = square(40, 40, 12, 12, 28, 28)
    applyOuterGlow(img, { size: 8, glowOpacity: 1, color: 0xffee00 })
    const outside = px(img, 9, 20)
    expect(outside[3]).toBeGreaterThan(40)
    expect(outside[0]).toBeGreaterThan(200)
    expect(px(img, 20, 20)).toEqual([40, 90, 160, 255])
  })

  it('inner glow tints only inside near the edge', () => {
    const img = square(40, 40, 12, 12, 28, 28)
    applyInnerGlow(img, { size: 6, glowOpacity: 1, color: 0xffffff })
    expect(px(img, 12, 20)[0]).toBeGreaterThan(150)
    expect(px(img, 20, 20)).toEqual([40, 90, 160, 255])
    expect(px(img, 9, 20)[3]).toBe(0)
  })

  it('inner shadow darkens the offset-facing edge only', () => {
    const img = square(40, 40, 12, 12, 28, 28)
    applyInnerShadow(img, { x: 4, y: 4, size: 6, shadowOpacity: 1, color: 0 })
    const litEdge = px(img, 13, 13)
    expect(litEdge[0]).toBeLessThan(20)
    const farEdge = px(img, 26, 26)
    expect(farEdge[0]).toBe(40)
    expect(px(img, 9, 9)[3]).toBe(0)
  })
})

describe('overlay and bevel', () => {
  it('color overlay replaces color, keeps alpha', () => {
    const img = square(20, 20, 5, 5, 15, 15)
    applyColorOverlay(img, { overlayOpacity: 1, color: 0x123456 })
    expect(px(img, 10, 10)).toEqual([0x12, 0x34, 0x56, 255])
    expect(px(img, 2, 2)[3]).toBe(0)
  })

  it('bevel lightens the lit edge and darkens the opposite edge', () => {
    const img = square(40, 40, 12, 12, 28, 28)
    applyBevel(img, { size: 5, depth: 1, angle: 180 })
    // Light from the left (angle 180): left edge brighter, right edge darker.
    expect(px(img, 13, 20)[0]).toBeGreaterThan(40)
    expect(px(img, 26, 20)[0]).toBeLessThan(40)
    expect(px(img, 20, 20)).toEqual([40, 90, 160, 255])
  })
})
