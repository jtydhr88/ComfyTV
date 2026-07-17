import { describe, it, expect, vi } from 'vitest'
import { rotationStyle, useVideoRotate } from './useVideoRotate'

function makeWidget(name: string, value: unknown) {
  return { name, value, callback: vi.fn() }
}

function makeNode(deg = 0, flipH = false, flipV = false) {
  return {
    id: 1,
    widgets: [
      makeWidget('rotate_deg', deg),
      makeWidget('flip_h', flipH),
      makeWidget('flip_v', flipV),
    ],
    onConfigure: null as any,
  } as any
}

function setup(deg = 0, flipH = false, flipV = false) {
  const node = makeNode(deg, flipH, flipV)
  const api = useVideoRotate(node, () => null)
  return { node, api }
}

describe('rotationStyle', () => {
  it('keeps scale 1 for upright and upside-down video', () => {
    expect(rotationStyle(0, false, false, 0.5).transform)
      .toBe('scaleX(1) scaleY(1) scale(1) rotate(0deg)')
    expect(rotationStyle(180, false, false, 0.5).transform)
      .toBe('scaleX(1) scaleY(1) scale(1) rotate(180deg)')
  })

  it('shrinks sideways video to the box ratio, capped at 1', () => {
    expect(rotationStyle(90, false, false, 0.5).transform)
      .toContain('scale(0.5) rotate(90deg)')
    expect(rotationStyle(270, false, false, 2).transform)
      .toContain('scale(1) rotate(270deg)')
  })

  it('encodes flips as negative axis scales', () => {
    expect(rotationStyle(0, true, true, 0.5).transform)
      .toBe('scaleX(-1) scaleY(-1) scale(1) rotate(0deg)')
  })

  it('always includes the transition', () => {
    expect(rotationStyle(0, false, false, 0.5).transition).toBe('transform 0.15s ease')
  })
})

describe('useVideoRotate', () => {
  it('seeds state from the widgets', () => {
    const { api } = setup(90, true, false)
    expect(api.rotateDeg.value).toBe(90)
    expect(api.flipH.value).toBe(true)
    expect(api.flipV.value).toBe(false)
  })

  it('rotateBy accumulates, wraps into [0, 360), and writes the widget', () => {
    const { api, node } = setup()
    api.rotateBy(90)
    expect(api.rotateDeg.value).toBe(90)
    expect(node.widgets[0].value).toBe(90)
    api.rotateBy(-90)
    api.rotateBy(-90)
    expect(api.rotateDeg.value).toBe(270)
    expect(node.widgets[0].value).toBe(270)
  })

  it('setFlipH/setFlipV write their widgets', () => {
    const { api, node } = setup()
    api.setFlipH(true)
    api.setFlipV(true)
    expect(node.widgets[1].value).toBe(true)
    expect(node.widgets[2].value).toBe(true)
    expect(api.flipH.value).toBe(true)
    expect(api.flipV.value).toBe(true)
  })

  it('normalizes external rotate_deg callbacks', () => {
    const { api, node } = setup()
    node.widgets[0].callback(-90)
    expect(api.rotateDeg.value).toBe(270)
    node.widgets[0].callback(450)
    expect(api.rotateDeg.value).toBe(90)
    node.widgets[0].callback('junk')
    expect(api.rotateDeg.value).toBe(90)
  })

  it('applies external flip callbacks', () => {
    const { api, node } = setup()
    node.widgets[1].callback(true)
    node.widgets[2].callback(1)
    expect(api.flipH.value).toBe(true)
    expect(api.flipV.value).toBe(true)
  })

  it('restores state on node configure', () => {
    const { api, node } = setup()
    node.widgets[0].value = 180
    node.widgets[1].value = true
    node.onConfigure({})
    expect(api.rotateDeg.value).toBe(180)
    expect(api.flipH.value).toBe(true)
  })

  it('videoStyle tracks rotation, flips, and box ratio', () => {
    const { api } = setup()
    api.rotateBy(90)
    api.setFlipH(true)
    api.boxRatio.value = 0.6
    expect(api.videoStyle.value.transform)
      .toBe('scaleX(-1) scaleY(1) scale(0.6) rotate(90deg)')
  })
})
