import { describe, it, expect } from 'vitest'
import { floodFill, type PixelBuffer } from './floodFill'

const RED = { r: 255, g: 0, b: 0 }

function makeBuffer(width: number, height: number): PixelBuffer {
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

function alphaAt(buf: PixelBuffer, x: number, y: number): number {
  return buf.data[(y * buf.width + x) * 4 + 3]
}

function paint(buf: PixelBuffer, x: number, y: number, alpha: number) {
  const p = (y * buf.width + x) * 4
  buf.data[p] = 0
  buf.data[p + 1] = 0
  buf.data[p + 2] = 0
  buf.data[p + 3] = alpha
}

describe('floodFill', () => {
  it('fills an empty canvas entirely', () => {
    const buf = makeBuffer(4, 4)
    expect(floodFill(buf, 0, 0, RED, 200)).toBe(true)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++)
        expect(alphaAt(buf, x, y)).toBe(200)
  })

  it('stops at an opaque boundary and leaves the outside untouched', () => {
    const buf = makeBuffer(5, 5)
    // vertical wall at x=2
    for (let y = 0; y < 5; y++) paint(buf, 2, y, 255)
    expect(floodFill(buf, 0, 2, RED, 200)).toBe(true)
    expect(alphaAt(buf, 1, 2)).toBe(200)
    expect(alphaAt(buf, 2, 2)).toBe(255) // wall intact
    expect(alphaAt(buf, 3, 2)).toBe(0)   // other side untouched
  })

  it('does not cross diagonal gaps (4-connectivity)', () => {
    const buf = makeBuffer(3, 3)
    // diagonal wall: only (1,1) is on the path between corners
    paint(buf, 1, 0, 255)
    paint(buf, 1, 1, 255)
    paint(buf, 1, 2, 255)
    floodFill(buf, 0, 1, RED, 200)
    expect(alphaAt(buf, 0, 0)).toBe(200)
    expect(alphaAt(buf, 2, 0)).toBe(0)
  })

  it('treats alpha within tolerance as the same region', () => {
    const buf = makeBuffer(3, 1)
    paint(buf, 1, 0, 20) // antialiased fringe, within default tolerance of 0
    floodFill(buf, 0, 0, RED, 200)
    expect(alphaAt(buf, 1, 0)).toBe(200)
    expect(alphaAt(buf, 2, 0)).toBe(200)
  })

  it('recolors an already-painted region when clicked on it', () => {
    const buf = makeBuffer(3, 1)
    for (let x = 0; x < 3; x++) paint(buf, x, 0, 180)
    floodFill(buf, 1, 0, RED, 255)
    const p = 0
    expect(buf.data[p]).toBe(255)     // r
    expect(alphaAt(buf, 0, 0)).toBe(255)
  })

  it('returns false for out-of-bounds clicks', () => {
    const buf = makeBuffer(2, 2)
    expect(floodFill(buf, -1, 0, RED, 200)).toBe(false)
    expect(floodFill(buf, 0, 5, RED, 200)).toBe(false)
  })

  it('clamps fill alpha to [0, 255]', () => {
    const buf = makeBuffer(1, 1)
    floodFill(buf, 0, 0, RED, 300)
    expect(alphaAt(buf, 0, 0)).toBe(255)
  })
})
