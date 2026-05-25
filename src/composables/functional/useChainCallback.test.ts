import { describe, it, expect, vi } from 'vitest'
import { useChainCallback } from './useChainCallback'

describe('useChainCallback', () => {
  it('runs original then extra callbacks in order', () => {
    const order: string[] = []
    const orig = function (this: any, x: number) { order.push(`orig:${x}`); return 'r' }
    const extra1 = function (this: any, x: number) { order.push(`e1:${x}`) }
    const extra2 = function (this: any, x: number) { order.push(`e2:${x}`) }
    const wrapped = useChainCallback(orig, extra1, extra2)
    wrapped.call({} as any, 42)
    expect(order).toEqual(['orig:42', 'e1:42', 'e2:42'])
  })

  it('skips original when undefined', () => {
    const called: number[] = []
    const wrapped = useChainCallback<any, any>(undefined, function (this: any, x: number) { called.push(x) })
    wrapped.call({} as any, 7)
    expect(called).toEqual([7])
  })

  it('preserves `this` binding', () => {
    const ctx = { name: 'host' }
    const seen: string[] = []
    const wrapped = useChainCallback<any, any>(
      function (this: any) { seen.push(`orig:${this.name}`) },
      function (this: any) { seen.push(`extra:${this.name}`) },
    )
    wrapped.call(ctx as any)
    expect(seen).toEqual(['orig:host', 'extra:host'])
  })

  it('does not propagate original return value (TS type lies)', () => {
    const orig = function (this: any) { return 'value' }
    const wrapped = useChainCallback(orig)
    const result = wrapped.call({} as any)
    expect(result).toBeUndefined()
  })
})
