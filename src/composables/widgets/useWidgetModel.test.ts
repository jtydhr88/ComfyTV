import { describe, it, expect, vi } from 'vitest'
import type { LGraphNode } from '@/lib/comfyApp'
import { useNumWidget, useStrWidget, useBoolWidget } from './useWidgetModel'

interface FakeWidget {
  name: string
  value: unknown
  callback?: (value: unknown) => void
}

function makeNode(widgets: FakeWidget[]): LGraphNode {
  return { widgets } as unknown as LGraphNode
}

describe('useNumWidget', () => {
  it('reads the initial widget value as a number', () => {
    const node = makeNode([{ name: 'fps', value: '24' }])
    const model = useNumWidget(node, 'fps', 15)
    expect(model.value).toBe(24)
  })

  it('falls back when the widget is missing', () => {
    const node = makeNode([])
    const model = useNumWidget(node, 'fps', 15)
    expect(model.value).toBe(15)
  })

  it('writes the widget and fires its original callback on set', () => {
    const orig = vi.fn()
    const node = makeNode([{ name: 'fps', value: 24, callback: orig }])
    const model = useNumWidget(node, 'fps', 15)
    model.value = 30
    expect(model.value).toBe(30)
    expect((node as any).widgets[0].value).toBe(30)
    expect(orig).toHaveBeenCalledWith(30)
  })

  it('ignores non-finite sets', () => {
    const node = makeNode([{ name: 'fps', value: 24 }])
    const model = useNumWidget(node, 'fps', 15)
    model.value = NaN
    expect(model.value).toBe(24)
    expect((node as any).widgets[0].value).toBe(24)
  })

  it('mirrors external widget callback invocations', () => {
    const node = makeNode([{ name: 'fps', value: 24 }])
    const model = useNumWidget(node, 'fps', 15)
    ;(node as any).widgets[0].callback('60')
    expect(model.value).toBe(60)
  })

  it('ignores non-numeric callback values', () => {
    const node = makeNode([{ name: 'fps', value: 24 }])
    const model = useNumWidget(node, 'fps', 15)
    ;(node as any).widgets[0].callback('abc')
    expect(model.value).toBe(24)
  })

  it('re-reads the widget on node configure and preserves the original hook', () => {
    const origConfigure = vi.fn()
    const node = makeNode([{ name: 'fps', value: 24 }])
    ;(node as any).onConfigure = origConfigure
    const model = useNumWidget(node, 'fps', 15)
    ;(node as any).widgets[0].value = 48
    ;(node as any).onConfigure({})
    expect(model.value).toBe(48)
    expect(origConfigure).toHaveBeenCalled()
  })
})

describe('useStrWidget', () => {
  it('reads the initial widget value', () => {
    const node = makeNode([{ name: 'label', value: 'hello' }])
    const model = useStrWidget(node, 'label', 'fb')
    expect(model.value).toBe('hello')
  })

  it('falls back on empty or missing values', () => {
    expect(useStrWidget(makeNode([{ name: 'label', value: '' }]), 'label', 'fb').value).toBe('fb')
    expect(useStrWidget(makeNode([]), 'label', 'fb').value).toBe('fb')
  })

  it('writes the widget on set', () => {
    const node = makeNode([{ name: 'label', value: 'a' }])
    const model = useStrWidget(node, 'label', 'fb')
    model.value = 'b'
    expect(model.value).toBe('b')
    expect((node as any).widgets[0].value).toBe('b')
  })

  it('mirrors external callback values and coerces nullish to empty', () => {
    const node = makeNode([{ name: 'label', value: 'a' }])
    const model = useStrWidget(node, 'label', 'fb')
    ;(node as any).widgets[0].callback('x')
    expect(model.value).toBe('x')
    ;(node as any).widgets[0].callback(null)
    expect(model.value).toBe('')
  })

  it('re-reads the widget on node configure', () => {
    const node = makeNode([{ name: 'label', value: 'a' }])
    const model = useStrWidget(node, 'label', 'fb')
    ;(node as any).widgets[0].value = 'restored'
    ;(node as any).onConfigure({})
    expect(model.value).toBe('restored')
  })
})

describe('useBoolWidget', () => {
  it('coerces the initial widget value to boolean', () => {
    expect(useBoolWidget(makeNode([{ name: 'on', value: 0 }]), 'on', true).value).toBe(false)
    expect(useBoolWidget(makeNode([{ name: 'on', value: 1 }]), 'on', false).value).toBe(true)
  })

  it('falls back when the widget is missing or nullish', () => {
    expect(useBoolWidget(makeNode([]), 'on', true).value).toBe(true)
    expect(useBoolWidget(makeNode([{ name: 'on', value: null }]), 'on', true).value).toBe(true)
  })

  it('writes the widget on set', () => {
    const node = makeNode([{ name: 'on', value: false }])
    const model = useBoolWidget(node, 'on', false)
    model.value = true
    expect(model.value).toBe(true)
    expect((node as any).widgets[0].value).toBe(true)
  })

  it('mirrors external callback values', () => {
    const node = makeNode([{ name: 'on', value: false }])
    const model = useBoolWidget(node, 'on', false)
    ;(node as any).widgets[0].callback(1)
    expect(model.value).toBe(true)
    ;(node as any).widgets[0].callback(0)
    expect(model.value).toBe(false)
  })

  it('re-reads the widget on node configure and keeps local on nullish', () => {
    const node = makeNode([{ name: 'on', value: true }])
    const model = useBoolWidget(node, 'on', false)
    ;(node as any).widgets[0].value = null
    ;(node as any).onConfigure({})
    expect(model.value).toBe(true)
    ;(node as any).widgets[0].value = false
    ;(node as any).onConfigure({})
    expect(model.value).toBe(false)
  })
})
