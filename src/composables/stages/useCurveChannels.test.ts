import { describe, it, expect, vi } from 'vitest'
import { parseCurve, serializeCurve, useCurveChannels, type CurvePts } from './useCurveChannels'

const IDENTITY: CurvePts = [[0, 0], [1, 1]]

describe('parseCurve', () => {
  it('parses a JSON point list', () => {
    expect(parseCurve('[[0,0],[0.5,0.7],[1,1]]')).toEqual([[0, 0], [0.5, 0.7], [1, 1]])
  })
  it('falls back to identity for empty, invalid, or short input', () => {
    expect(parseCurve('')).toEqual(IDENTITY)
    expect(parseCurve('oops')).toEqual(IDENTITY)
    expect(parseCurve('[[0,0]]')).toEqual(IDENTITY)
    expect(parseCurve('{"a":1}')).toEqual(IDENTITY)
  })
})

describe('serializeCurve', () => {
  it('serializes an identity curve as empty string', () => {
    expect(serializeCurve([[0, 0], [1, 1]])).toBe('')
  })
  it('rounds points to 3 decimals', () => {
    expect(serializeCurve([[0, 0.12345], [1, 1]])).toBe('[[0,0.123],[1,1]]')
  })
  it('keeps non-identity two-point curves', () => {
    expect(serializeCurve([[0, 0.1], [1, 1]])).toBe('[[0,0.1],[1,1]]')
  })
})

function makeWidget(name: string, value: unknown = '') {
  return { name, value, callback: vi.fn() }
}

function makeNode() {
  return {
    id: 1,
    widgets: [
      makeWidget('master_pts'),
      makeWidget('red_pts'),
      makeWidget('green_pts'),
      makeWidget('blue_pts'),
    ],
    onConfigure: null as any,
  } as any
}

describe('useCurveChannels', () => {
  it('starts on the master channel with an identity curve', () => {
    const api = useCurveChannels(makeNode())
    expect(api.channel.value).toBe('master')
    expect(api.activeCurve.value).toEqual(IDENTITY)
  })

  it('writes the active channel widget on set', () => {
    const node = makeNode()
    const api = useCurveChannels(node)
    api.activeCurve.value = [[0, 0], [0.5, 0.6], [1, 1]]
    expect(node.widgets[0].value).toBe('[[0,0],[0.5,0.6],[1,1]]')
    expect(api.activeCurve.value).toEqual([[0, 0], [0.5, 0.6], [1, 1]])
  })

  it('clears the widget when set back to identity', () => {
    const node = makeNode()
    const api = useCurveChannels(node)
    api.activeCurve.value = [[0, 0], [0.5, 0.6], [1, 1]]
    api.activeCurve.value = [[0, 0], [1, 1]]
    expect(node.widgets[0].value).toBe('')
  })

  it('switching channels reads and writes the matching widget', () => {
    const node = makeNode()
    node.widgets[1].value = '[[0,0.2],[1,1]]'
    const api = useCurveChannels(node)
    api.channel.value = 'red'
    expect(api.activeCurve.value).toEqual([[0, 0.2], [1, 1]])
    api.activeCurve.value = [[0, 0.3], [1, 1]]
    expect(node.widgets[1].value).toBe('[[0,0.3],[1,1]]')
    expect(node.widgets[0].value).toBe('')
  })

  it('resetActive clears only the active channel', () => {
    const node = makeNode()
    node.widgets[0].value = '[[0,0.1],[1,1]]'
    node.widgets[2].value = '[[0,0.2],[1,1]]'
    const api = useCurveChannels(node)
    api.resetActive()
    expect(node.widgets[0].value).toBe('')
    expect(node.widgets[2].value).toBe('[[0,0.2],[1,1]]')
  })
})
