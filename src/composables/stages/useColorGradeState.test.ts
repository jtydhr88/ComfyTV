import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { defaultValues, getEffect } from '@/widgets/glsl/effects'
import {
  GRADE_STATE_WIDGET,
  parseGradeState,
  serializeGradeState,
  useColorGradeState,
} from './useColorGradeState'

interface FakeWidget {
  name: string
  value: unknown
  callback?: (v: unknown) => void
}

function makeNode(gradeState = ''): { node: LGraphNode; widget: FakeWidget } {
  const widget: FakeWidget = { name: GRADE_STATE_WIDGET, value: gradeState }
  const node = { widgets: [widget] } as unknown as LGraphNode
  return { node, widget }
}

function persisted(widget: FakeWidget): { effect: string; all: Record<string, Record<string, unknown>> } {
  return JSON.parse(String(widget.value))
}

describe('serializeGradeState / parseGradeState', () => {
  it('round-trips effect id and per-effect values', () => {
    const all = { brightness_contrast: { brightness: 40, contrast: -10 } }
    const raw = serializeGradeState('brightness_contrast', all)
    const parsed = parseGradeState(raw)
    expect(parsed.effect).toBe('brightness_contrast')
    expect(parsed.all.brightness_contrast).toMatchObject({ brightness: 40, contrast: -10 })
  })

  it('merges stored values over effect defaults', () => {
    const raw = serializeGradeState('brightness_contrast', {
      brightness_contrast: { brightness: 12 },
    })
    const parsed = parseGradeState(raw)
    expect(parsed.all.brightness_contrast).toEqual({ brightness: 12, contrast: 0 })
  })

  it('returns an empty state for corrupt JSON', () => {
    expect(parseGradeState('{not json')).toEqual({ effect: null, all: {} })
    expect(parseGradeState('null')).toEqual({ effect: null, all: {} })
  })

  it('returns an empty state for an empty string', () => {
    expect(parseGradeState('')).toEqual({ effect: null, all: {} })
  })

  it('rejects an unknown effect id but keeps its stored values under the raw key', () => {
    const raw = JSON.stringify({ effect: 'bogus_fx', all: { bogus_fx: { foo: 1 } } })
    const parsed = parseGradeState(raw)
    expect(parsed.effect).toBeNull()
    expect(parsed.all.bogus_fx).toMatchObject({ ...defaultValues(getEffect('bogus_fx')), foo: 1 })
  })
})

describe('useColorGradeState initialisation', () => {
  it('starts on the default effect with default values', () => {
    const { node } = makeNode()
    const s = useColorGradeState(node)
    expect(s.effectId.value).toBe('brightness_contrast')
    expect(s.values.value).toEqual(defaultValues(getEffect('brightness_contrast')))
  })

  it('restores effect and values persisted in the widget', () => {
    const raw = serializeGradeState('color_adjustment', {
      color_adjustment: { temperature: 33 },
    })
    const { node } = makeNode(raw)
    const s = useColorGradeState(node)
    expect(s.effectId.value).toBe('color_adjustment')
    expect(s.num('temperature')).toBe(33)
    expect(s.num('tint')).toBe(0)
  })

  it('falls back to defaults on corrupt widget JSON', () => {
    const { node } = makeNode('{{{')
    const s = useColorGradeState(node)
    expect(s.effectId.value).toBe('brightness_contrast')
    expect(s.values.value).toEqual(defaultValues(getEffect('brightness_contrast')))
  })

  it('ignores an unknown persisted effect id', () => {
    const { node } = makeNode(JSON.stringify({ effect: 'nope', all: {} }))
    const s = useColorGradeState(node)
    expect(s.effectId.value).toBe('brightness_contrast')
  })
})

describe('useColorGradeState value edits', () => {
  it('setValueByKey persists and fires onChange but not onCommit', () => {
    const { node, widget } = makeNode()
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const s = useColorGradeState(node, { onChange, onCommit })
    s.setValueByKey('brightness', 25)
    expect(s.num('brightness')).toBe(25)
    expect(persisted(widget).all.brightness_contrast.brightness).toBe(25)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('setValueCommit fires onChange and onCommit', () => {
    const { node } = makeNode()
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const s = useColorGradeState(node, { onChange, onCommit })
    s.setValueCommit('contrast', -5)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('commitNow only fires onCommit', () => {
    const { node } = makeNode()
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const s = useColorGradeState(node, { onChange, onCommit })
    s.commitNow()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps values isolated per effect across switches', () => {
    const { node } = makeNode()
    const s = useColorGradeState(node)
    s.setValueByKey('brightness', 77)
    s.onEffectChange('color_adjustment')
    expect(s.effectId.value).toBe('color_adjustment')
    expect(s.num('temperature')).toBe(0)
    s.setValueByKey('temperature', -40)
    s.onEffectChange('brightness_contrast')
    expect(s.num('brightness')).toBe(77)
    s.onEffectChange('color_adjustment')
    expect(s.num('temperature')).toBe(-40)
  })

  it('onEffectChange persists the new selection and commits', () => {
    const { node, widget } = makeNode()
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const s = useColorGradeState(node, { onChange, onCommit })
    s.onEffectChange('image_levels')
    expect(persisted(widget).effect).toBe('image_levels')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('resetEffect restores defaults for the current effect only', () => {
    const { node } = makeNode()
    const s = useColorGradeState(node)
    s.setValueByKey('brightness', 50)
    s.onEffectChange('color_adjustment')
    s.setValueByKey('tint', 9)
    s.resetEffect()
    expect(s.values.value).toEqual(defaultValues(getEffect('color_adjustment')))
    s.onEffectChange('brightness_contrast')
    expect(s.num('brightness')).toBe(50)
  })

  it('num falls back to 0 for missing keys and bool reads defaults', () => {
    const { node } = makeNode()
    const s = useColorGradeState(node)
    expect(s.num('does_not_exist')).toBe(0)
    s.onEffectChange('color_balance')
    expect(s.bool('preserve_luminosity')).toBe(true)
  })
})

describe('useColorGradeState curve selection', () => {
  it('activates the first curve uniform when the effect exposes curves', async () => {
    const { node } = makeNode()
    const s = useColorGradeState(node)
    expect(s.activeCurveKey.value).toBe('')
    s.onEffectChange('color_curves')
    await nextTick()
    expect(s.activeCurveKey.value).toBe('curve_master')
    expect(s.activeCurveUniform.value?.key).toBe('curve_master')
  })

  it('falls back to identity points until a curve is edited', async () => {
    const { node } = makeNode()
    const s = useColorGradeState(node)
    s.onEffectChange('color_curves')
    await nextTick()
    expect(s.activeCurvePoints.value).toEqual([[0, 0], [1, 1]])
  })

  it('writing points stores curve data and preserves interpolation', async () => {
    const { node, widget } = makeNode()
    const s = useColorGradeState(node)
    s.onEffectChange('color_curves')
    await nextTick()
    s.activeCurvePoints.value = [[0, 0.2], [0.5, 0.5], [1, 1]]
    expect(s.activeCurvePoints.value).toEqual([[0, 0.2], [0.5, 0.5], [1, 1]])
    const stored = persisted(widget).all.color_curves.curve_master as {
      points: [number, number][]
      interpolation: string
    }
    expect(stored.interpolation).toBe('monotone_cubic')
    expect(stored.points).toHaveLength(3)
  })

  it('clears the active key when switching to a curve-less effect', async () => {
    const { node } = makeNode()
    const s = useColorGradeState(node)
    s.onEffectChange('color_curves')
    await nextTick()
    s.activeCurveKey.value = 'curve_b'
    s.onEffectChange('brightness_contrast')
    await nextTick()
    expect(s.activeCurveKey.value).toBe('')
  })

  it('resetActiveCurve restores identity and commits', async () => {
    const { node } = makeNode()
    const onCommit = vi.fn()
    const s = useColorGradeState(node, { onCommit })
    s.onEffectChange('color_curves')
    await nextTick()
    onCommit.mockClear()
    s.activeCurvePoints.value = [[0, 0.4], [1, 0.9]]
    s.resetActiveCurve()
    expect(s.activeCurvePoints.value).toEqual([[0, 0], [1, 1]])
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('resetActiveCurve is a no-op without an active curve', () => {
    const { node } = makeNode()
    const onCommit = vi.fn()
    const s = useColorGradeState(node, { onCommit })
    s.resetActiveCurve()
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('useColorGradeState widget reload semantics', () => {
  it('reloads when the widget callback fires with an external value', () => {
    const { node, widget } = makeNode()
    const s = useColorGradeState(node)
    const raw = serializeGradeState('image_levels', { image_levels: { gamma: 2 } })
    widget.value = raw
    widget.callback?.(raw)
    expect(s.effectId.value).toBe('image_levels')
    expect(s.num('gamma')).toBe(2)
  })

  it('reloads on node configure', () => {
    const { node, widget } = makeNode()
    const s = useColorGradeState(node)
    widget.value = serializeGradeState('color_adjustment', {
      color_adjustment: { saturation: 15 },
    })
    ;(node as unknown as { onConfigure: (info: unknown) => void }).onConfigure({})
    expect(s.effectId.value).toBe('color_adjustment')
    expect(s.num('saturation')).toBe(15)
  })

  it('survives a missing widget without persisting', () => {
    const node = { widgets: [] } as unknown as LGraphNode
    const s = useColorGradeState(node)
    expect(() => s.setValueCommit('brightness', 1)).not.toThrow()
    expect(s.num('brightness')).toBe(1)
  })
})
