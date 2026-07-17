import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { clampUniformN, useFrameMarks } from './useFrameMarks'

function makeWidget(name: string, value: unknown = '') {
  return { name, value, callback: vi.fn() }
}

function makeNode(marks = '') {
  return { id: 1, widgets: [makeWidget('marks', marks)], onConfigure: null as any } as any
}

function setup(marksJson = '', duration = 10, currentTime = 0) {
  const node = makeNode(marksJson)
  const dur = ref(duration)
  const cur = ref(currentTime)
  const api = useFrameMarks(node, { duration: dur, currentTime: cur })
  return { node, dur, cur, api }
}

describe('clampUniformN', () => {
  it('clamps into [2, 48] and rounds', () => {
    expect(clampUniformN('6')).toBe(6)
    expect(clampUniformN('100')).toBe(48)
    expect(clampUniformN('1')).toBe(2)
    expect(clampUniformN('7.6')).toBe(8)
  })
  it('falls back to 2 for garbage', () => {
    expect(clampUniformN('')).toBe(2)
    expect(clampUniformN('abc')).toBe(2)
    expect(clampUniformN(undefined)).toBe(2)
  })
})

describe('useFrameMarks', () => {
  it('seeds marks from the widget', () => {
    const { api } = setup('[3, 1]')
    expect(api.marks.value).toEqual([1, 3])
  })

  it('addMarkAtPlayhead adds a normalized mark and writes the widget', () => {
    const { api, node, cur } = setup('[1]')
    cur.value = 2.505
    api.addMarkAtPlayhead()
    expect(api.marks.value).toEqual([1, 2.51])
    expect(node.widgets[0].value).toBe('[1,2.51]')
  })

  it('addMarkAtPlayhead is a no-op without duration', () => {
    const { api } = setup('', 0)
    api.addMarkAtPlayhead()
    expect(api.marks.value).toEqual([])
  })

  it('addUniform spreads uniformN marks over the duration', () => {
    const { api, node } = setup('', 8)
    api.setUniformN('4')
    api.addUniform()
    expect(api.marks.value).toEqual([1, 3, 5, 7])
    expect(node.widgets[0].value).toBe('[1,3,5,7]')
  })

  it('addUniform is a no-op without duration', () => {
    const { api } = setup('[1]', 0)
    api.addUniform()
    expect(api.marks.value).toEqual([1])
  })

  it('removeMark drops by index; clearMarks empties', () => {
    const { api, node } = setup('[1, 2, 3]')
    api.removeMark(1)
    expect(api.marks.value).toEqual([1, 3])
    api.clearMarks()
    expect(api.marks.value).toEqual([])
    expect(node.widgets[0].value).toBe('[]')
  })

  it('setUniformN clamps the ref', () => {
    const { api } = setup()
    expect(api.uniformN.value).toBe(6)
    api.setUniformN('99')
    expect(api.uniformN.value).toBe(48)
  })

  it('syncs from an external widget callback', () => {
    const { api, node } = setup('[1]')
    node.widgets[0].callback('[5, 2]')
    expect(api.marks.value).toEqual([2, 5])
  })

  it('restores marks on node configure', () => {
    const { api, node } = setup('[1]')
    node.widgets[0].value = '[7, 4]'
    node.onConfigure({})
    expect(api.marks.value).toEqual([4, 7])
  })
})
