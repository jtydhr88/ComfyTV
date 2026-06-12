import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExposedWidget } from './workflowConfigCatalog'
import { useBindingWriter } from './useBindingWriter'

function widget(over: Partial<ExposedWidget> = {}): ExposedWidget {
  return {
    node_id: '1', node_title: 'N', node_type: 'X',
    group_title: null, widget_name: 'w', widget_type: 'STRING',
    widget_props: {}, current_value: '',
    stage_binding: null, override_value: null, cast: null,
    ...over,
  }
}

function setup() {
  const postBinding = vi.fn(async (_: any) => {})
  const deleteBinding = vi.fn(async (_n: string, _w: string) => {})
  return { postBinding, deleteBinding, ...useBindingWriter(postBinding, deleteBinding) }
}

describe('useBindingWriter — pure helpers', () => {
  it('isStageBound: only true for non-literal upstream/option/computed bindings', () => {
    const { isStageBound } = setup()
    expect(isStageBound(widget({ stage_binding: null }))).toBe(false)
    expect(isStageBound(widget({ stage_binding: 'literal:42' }))).toBe(false)
    expect(isStageBound(widget({ stage_binding: 'option:seed' }))).toBe(true)
    expect(isStageBound(widget({ stage_binding: 'upstream_image:annotated[0]' }))).toBe(true)
  })

  it('dropdownValueFor returns __VALUE__ unless a non-literal binding is set', () => {
    const { dropdownValueFor } = setup()
    expect(dropdownValueFor(widget({ stage_binding: null }))).toBe('__VALUE__')
    expect(dropdownValueFor(widget({ stage_binding: 'literal:7' }))).toBe('__VALUE__')
    expect(dropdownValueFor(widget({ stage_binding: 'option:seed' }))).toBe('option:seed')
  })

  it('coerceForWidget: INT/FLOAT → Number, BOOLEAN → bool, others pass through', () => {
    const { coerceForWidget } = setup()
    expect(coerceForWidget(widget({ widget_type: 'INT' }), '42')).toBe(42)
    expect(coerceForWidget(widget({ widget_type: 'FLOAT' }), '3.14')).toBe(3.14)
    expect(coerceForWidget(widget({ widget_type: 'INT', current_value: 99 }), 'oops')).toBe(99)
    expect(coerceForWidget(widget({ widget_type: 'BOOLEAN' }), 'true')).toBe(true)
    expect(coerceForWidget(widget({ widget_type: 'BOOLEAN' }), '1')).toBe(true)
    expect(coerceForWidget(widget({ widget_type: 'BOOLEAN' }), 'no')).toBe(false)
    expect(coerceForWidget(widget({ widget_type: 'STRING' }), 'hello')).toBe('hello')
  })

  it('effectiveValue prefers literal-binding suffix, then override, then current_value', () => {
    const { effectiveValue } = setup()
    expect(
      effectiveValue(widget({ widget_type: 'INT', stage_binding: 'literal:7', current_value: 0 })),
    ).toBe(7)
    expect(
      effectiveValue(widget({ widget_type: 'STRING', override_value: 'hi', current_value: 'old' })),
    ).toBe('hi')
    expect(
      effectiveValue(widget({ widget_type: 'STRING', current_value: 'fallback' })),
    ).toBe('fallback')
  })

  it('comboOptions returns the widget_props.values array stringified, [] otherwise', () => {
    const { comboOptions } = setup()
    expect(comboOptions(widget({ widget_type: 'COMBO', widget_props: { values: ['a', 1, 'b'] } })))
      .toEqual(['a', '1', 'b'])
    expect(comboOptions(widget({ widget_type: 'STRING' }))).toEqual([])
    expect(comboOptions(widget({ widget_type: 'COMBO', widget_props: {} }))).toEqual([])
  })

  it('numProp reads widget_props numbers, else undefined', () => {
    const { numProp } = setup()
    expect(numProp(widget({ widget_props: { min: 0, max: 10 } }), 'min')).toBe(0)
    expect(numProp(widget({ widget_props: { min: '0' } }), 'min')).toBeUndefined()
    expect(numProp(widget({ widget_props: {} }), 'min')).toBeUndefined()
  })

  it('inferCast maps INT/FLOAT/BOOLEAN, others null', () => {
    const { inferCast } = setup()
    expect(inferCast('INT')).toBe('int')
    expect(inferCast('FLOAT')).toBe('float')
    expect(inferCast('BOOLEAN')).toBe('bool')
    expect(inferCast('STRING')).toBeNull()
  })
})

describe('useBindingWriter — mutation flows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('onValueChange writes a literal:* binding and mutates the widget in place', async () => {
    const { onValueChange, postBinding } = setup()
    const w = widget({ widget_type: 'INT' })
    await onValueChange(w, 5)
    expect(w.stage_binding).toBe('literal:5')
    expect(w.override_value).toBe('5')
    expect(w.cast).toBe('int')
    expect(postBinding).toHaveBeenCalledWith({
      node_id: '1', input_name: 'w', from: 'literal:5',
      default: '5', cast: 'int', required: false,
    })
  })

  it('onValueChange with cleared input deletes the binding', async () => {
    const { onValueChange, deleteBinding } = setup()
    const w = widget({ stage_binding: 'literal:old', override_value: 'old' })
    await onValueChange(w, '')
    expect(w.stage_binding).toBeNull()
    expect(w.override_value).toBeNull()
    expect(deleteBinding).toHaveBeenCalledWith('1', 'w')
  })

  it('onValueChange is a no-op when the widget is currently stage-bound', async () => {
    const { onValueChange, postBinding, deleteBinding } = setup()
    const w = widget({ stage_binding: 'option:seed' })
    await onValueChange(w, 'whatever')
    expect(postBinding).not.toHaveBeenCalled()
    expect(deleteBinding).not.toHaveBeenCalled()
    expect(w.stage_binding).toBe('option:seed')
  })

  it('onBindingChange to __VALUE__ deletes the existing binding', async () => {
    const { onBindingChange, deleteBinding } = setup()
    const w = widget({ stage_binding: 'option:seed', cast: 'int', override_value: 'random_int31' })
    await onBindingChange(w, '__VALUE__')
    expect(w.stage_binding).toBeNull()
    expect(w.override_value).toBeNull()
    expect(deleteBinding).toHaveBeenCalled()
  })

  it('onBindingChange to option:seed seeds cast=int + default=random_int31', async () => {
    const { onBindingChange, postBinding } = setup()
    const w = widget()
    await onBindingChange(w, 'option:seed')
    expect(postBinding).toHaveBeenCalledWith({
      node_id: '1', input_name: 'w', from: 'option:seed',
      default: 'random_int31', cast: 'int', required: false,
    })
  })

  it('onBindingChange to a computed key seeds cast=int with no default', async () => {
    const { onBindingChange, postBinding } = setup()
    const w = widget()
    await onBindingChange(w, 'computed:width')
    expect(postBinding).toHaveBeenCalledWith({
      node_id: '1', input_name: 'w', from: 'computed:width',
      default: null, cast: 'int', required: false,
    })
  })

  it('onBindingChange to an upstream_* binding marks `required: true`', async () => {
    const { onBindingChange, postBinding } = setup()
    const w = widget()
    await onBindingChange(w, 'upstream_image:annotated[0]')
    expect(postBinding).toHaveBeenCalledWith(expect.objectContaining({
      from: 'upstream_image:annotated[0]',
      required: true,
    }))
  })
})
