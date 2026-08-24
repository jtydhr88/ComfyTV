import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let settleFn: (() => void) | null = null
vi.mock('@vueuse/core', () => ({
  useDebounceFn: (cb: () => void) => {
    settleFn = cb
    return () => {}
  },
  useIntervalFn: () => ({ pause: vi.fn() }),
}))

const canvasEl = document.createElement('canvas')
const fakeApp: any = {
  canvas: { canvas: canvasEl, ds: { scale: 0.2 } },
  graph: { _nodes: new Array(50) },
}
vi.mock('@/lib/comfyApp', () => ({
  get app() { return fakeApp },
}))

import {
  MOTION_LOD_CLASS,
  installCameraMotionLod,
  uninstallCameraMotionLod,
} from './cameraMotionLod'

function wheel(): void {
  canvasEl.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
}

function drag(buttons = 1): void {
  canvasEl.dispatchEvent(new PointerEvent('pointermove', { buttons }))
}

describe('cameraMotionLod', () => {
  let pane: HTMLDivElement

  beforeEach(() => {
    pane = document.createElement('div')
    pane.setAttribute('data-testid', 'transform-pane')
    document.body.appendChild(pane)
    fakeApp.canvas.ds.scale = 0.2
    fakeApp.graph._nodes = new Array(50)
    installCameraMotionLod()
  })

  afterEach(() => {
    uninstallCameraMotionLod()
    document.body.innerHTML = ''
    settleFn = null
  })

  it('degrades the transform pane on zoomed-out wheel motion and restores on settle', () => {
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
    wheel()
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(true)
    settleFn?.()
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
  })

  it('degrades on pointer drag but not on hover', () => {
    drag(0)
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
    drag(1)
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(true)
  })

  it('stays off at working zoom levels', () => {
    fakeApp.canvas.ds.scale = 0.6
    wheel()
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
  })

  it('stays off for small graphs', () => {
    fakeApp.graph._nodes = new Array(5)
    wheel()
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
  })

  it('drops the degradation mid-gesture once zoomed past the threshold', () => {
    wheel()
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(true)
    fakeApp.canvas.ds.scale = 0.8
    wheel()
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
  })

  it('injects the LOD stylesheet and cleans everything on uninstall', () => {
    expect(document.head.innerHTML).toContain(MOTION_LOD_CLASS)
    wheel()
    uninstallCameraMotionLod()
    expect(document.head.innerHTML).not.toContain(MOTION_LOD_CLASS)
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
    wheel()
    expect(pane.classList.contains(MOTION_LOD_CLASS)).toBe(false)
  })
})
