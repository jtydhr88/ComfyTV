import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/comfyApp'

import { bindWidgetCallback, onNodeConfigure } from './widget'

function nodeWith(widgets: Array<{ name: string; value?: unknown; callback?: (v: unknown) => void }>): LGraphNode {
  return { widgets } as unknown as LGraphNode
}

describe('bindWidgetCallback', () => {
  it('invokes apply with the widget value when the callback fires', () => {
    const apply = vi.fn()
    const w = { name: 'angle', value: 0 } as any
    bindWidgetCallback(nodeWith([w]), 'angle', apply)
    w.callback(42)
    expect(apply).toHaveBeenCalledWith(42)
  })

  it('preserves the original widget callback', () => {
    const orig = vi.fn()
    const apply = vi.fn()
    const w = { name: 'angle', value: 0, callback: orig } as any
    bindWidgetCallback(nodeWith([w]), 'angle', apply)
    w.callback(7)
    expect(orig).toHaveBeenCalledWith(7)
    expect(apply).toHaveBeenCalledWith(7)
  })

  it('is a no-op when the widget is missing', () => {
    const apply = vi.fn()
    expect(() => bindWidgetCallback(nodeWith([]), 'nope', apply)).not.toThrow()
    expect(() => bindWidgetCallback(null, 'nope', apply)).not.toThrow()
  })
})

describe('onNodeConfigure', () => {
  it('runs the callback after the original onConfigure', () => {
    const calls: string[] = []
    const node = { onConfigure: () => calls.push('orig') } as unknown as LGraphNode
    onNodeConfigure(node, () => calls.push('cb'))
    ;(node as any).onConfigure({})
    expect(calls).toEqual(['orig', 'cb'])
  })

  it('works when there is no original onConfigure', () => {
    const cb = vi.fn()
    const node = {} as unknown as LGraphNode
    onNodeConfigure(node, cb)
    ;(node as any).onConfigure({})
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('is a no-op for a null node', () => {
    expect(() => onNodeConfigure(null, vi.fn())).not.toThrow()
  })
})
