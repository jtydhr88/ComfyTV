import { describe, expect, it } from 'vitest'

import { type PanZoomEls, createPanZoom } from './panZoom'

function makeEls(viewportW = 800, viewportH = 600): PanZoomEls {
  const viewport = document.createElement('div')
  Object.defineProperty(viewport, 'clientWidth', { value: viewportW, configurable: true })
  Object.defineProperty(viewport, 'clientHeight', { value: viewportH, configurable: true })
  const container = document.createElement('div')
  return { viewport, container }
}

function styleNumbers(container: HTMLElement) {
  const s = container.style
  return {
    width: parseFloat(s.width),
    height: parseFloat(s.height),
    left: parseFloat(s.left),
    top: parseFloat(s.top),
  }
}

function wheel(deltaY: number, offsetX = 0, offsetY = 0): WheelEvent {
  return { deltaY, offsetX, offsetY } as WheelEvent
}

describe('createPanZoom', () => {
  it('starts with zoom 1', () => {
    const pz = createPanZoom(() => null)
    expect(pz.zoom()).toBe(1)
  })

  describe('when getEls returns null', () => {
    it('all operations are safe no-ops', () => {
      const pz = createPanZoom(() => null)
      expect(() => pz.invalidate()).not.toThrow()
      expect(() => pz.fit(512, 512)).not.toThrow()
      expect(() => pz.panBy(10, 10)).not.toThrow()
      expect(() => pz.handleWheel(wheel(-1))).not.toThrow()
      expect(pz.zoom()).toBe(1)
      expect(pz.screenToArtboard(100, 100)).toEqual({ x: 0, y: 0 })
    })
  })

  describe('fit', () => {
    it('fits a large artboard into the viewport at 90% and centers it', () => {
      const els = makeEls(800, 600)
      const pz = createPanZoom(() => els)
      pz.fit(1024, 1024)
      const zoom = (600 / 1024) * 0.9
      expect(pz.zoom()).toBeCloseTo(zoom)
      const st = styleNumbers(els.container)
      expect(st.width).toBeCloseTo(1024 * zoom)
      expect(st.height).toBeCloseTo(1024 * zoom)
      expect(st.left).toBeCloseTo((800 - 1024 * zoom) / 2)
      expect(st.top).toBeCloseTo((600 - 1024 * zoom) / 2)
    })

    it('caps zoom at 0.9 for artboards smaller than the viewport', () => {
      const els = makeEls(800, 600)
      const pz = createPanZoom(() => els)
      pz.fit(100, 100)
      expect(pz.zoom()).toBeCloseTo(0.9)
    })

    it('enforces the 0.01 zoom floor', () => {
      const els = makeEls(800, 600)
      const pz = createPanZoom(() => els)
      pz.fit(4096 * 100, 4096 * 100)
      expect(pz.zoom()).toBe(0.01)
    })

    it('bails when the viewport has no size, keeping the previous zoom', () => {
      const els = makeEls(0, 0)
      const pz = createPanZoom(() => els)
      pz.fit(512, 512)
      expect(pz.zoom()).toBe(1)
      expect(els.container.style.width).toBe('')
    })
  })

  describe('panBy', () => {
    it('accumulates pan offsets into left/top', () => {
      const els = makeEls()
      const pz = createPanZoom(() => els)
      pz.panBy(10, 20)
      pz.panBy(-4, 6)
      const st = styleNumbers(els.container)
      expect(st.left).toBeCloseTo(6)
      expect(st.top).toBeCloseTo(26)
    })
  })

  describe('handleWheel', () => {
    it('zooms in by 1.1 on negative deltaY and out on positive', () => {
      const els = makeEls()
      const pz = createPanZoom(() => els)
      pz.handleWheel(wheel(-1))
      expect(pz.zoom()).toBeCloseTo(1.1)
      pz.handleWheel(wheel(1))
      expect(pz.zoom()).toBeCloseTo(1)
    })

    it('keeps the cursor position fixed while zooming', () => {
      const els = makeEls()
      const pz = createPanZoom(() => els)
      pz.invalidate() // pan = (0, 0)
      pz.handleWheel(wheel(-1, 100, 50))
      const st = styleNumbers(els.container)
      // mouse at artboard-space (100, 50); zoom 1 -> 1.1 shifts pan by -0.1 * mouse
      expect(st.left).toBeCloseTo(100 - 100 * 1.1)
      expect(st.top).toBeCloseTo(50 - 50 * 1.1)
    })

    it('clamps zoom to the [0.05, 20] range', () => {
      const els = makeEls()
      const pz = createPanZoom(() => els)
      for (let i = 0; i < 60; i++) pz.handleWheel(wheel(-1))
      expect(pz.zoom()).toBe(20)
      for (let i = 0; i < 120; i++) pz.handleWheel(wheel(1))
      expect(pz.zoom()).toBe(0.05)
    })

    it('updates the container size to match the new zoom', () => {
      const els = makeEls()
      const pz = createPanZoom(() => els)
      pz.fit(1000, 500)
      const before = styleNumbers(els.container)
      pz.handleWheel(wheel(-1))
      const after = styleNumbers(els.container)
      expect(after.width).toBeCloseTo(before.width * 1.1)
      expect(after.height).toBeCloseTo(before.height * 1.1)
    })
  })

  describe('screenToArtboard', () => {
    it('maps client coordinates through the container rect to artboard space', () => {
      const els = makeEls()
      els.container.getBoundingClientRect = () =>
        ({ left: 100, top: 50, width: 512, height: 256 }) as DOMRect
      const pz = createPanZoom(() => els)
      pz.fit(1024, 512)
      expect(pz.screenToArtboard(100, 50)).toEqual({ x: 0, y: 0 })
      expect(pz.screenToArtboard(612, 306)).toEqual({ x: 1024, y: 512 })
      expect(pz.screenToArtboard(356, 178)).toEqual({ x: 512, y: 256 })
    })

    it('returns the origin when the container rect is degenerate', () => {
      const els = makeEls()
      els.container.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect
      const pz = createPanZoom(() => els)
      expect(pz.screenToArtboard(50, 50)).toEqual({ x: 0, y: 0 })
    })

    it('uses the default 1024x1024 artboard before any fit call', () => {
      const els = makeEls()
      els.container.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 1024, height: 1024 }) as DOMRect
      const pz = createPanZoom(() => els)
      expect(pz.screenToArtboard(512, 512)).toEqual({ x: 512, y: 512 })
    })
  })
})
