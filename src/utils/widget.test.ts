import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

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

describe('detaching', () => {
  it('bindWidgetCallback returns a detach that restores the original callback', () => {
    const orig = vi.fn()
    const apply = vi.fn()
    const w = { name: 'angle', value: 0, callback: orig } as any
    const detach = bindWidgetCallback(nodeWith([w]), 'angle', apply)
    detach()
    w.callback(1)
    expect(orig).toHaveBeenCalledWith(1)
    expect(apply).not.toHaveBeenCalled()
  })

  it('onNodeConfigure stops calling back once detached, even if chained after', () => {
    const cb = vi.fn()
    const later = vi.fn()
    const node = {} as unknown as LGraphNode
    const detach = onNodeConfigure(node, cb)
    onNodeConfigure(node, later)
    detach()
    ;(node as any).onConfigure({})
    expect(cb).not.toHaveBeenCalled()
    expect(later).toHaveBeenCalledTimes(1)
  })

  it('both hooks detach automatically when the surrounding scope is disposed', () => {
    const cb = vi.fn()
    const apply = vi.fn()
    const w = { name: 'angle', value: 0 } as any
    const node = { widgets: [w] } as unknown as LGraphNode
    const scope = effectScope()
    scope.run(() => {
      onNodeConfigure(node, cb)
      bindWidgetCallback(node, 'angle', apply)
    })
    scope.stop()
    ;(node as any).onConfigure?.({})
    w.callback?.(3)
    expect(cb).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
    expect((node as any).onConfigure).toBeUndefined()
  })
})
