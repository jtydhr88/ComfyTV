import { describe, expect, it, vi } from 'vitest'

// Node's builtin (non-functional) localStorage shadows happy-dom's; install a
// working stub before the module under test creates its useStorage refs.
vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  }
})

import { useActionsCollapsed, useContextCollapsed } from './useContextCollapsed'

// The storage refs behind these composables are module-level singletons, so
// each test uses its own unique node ids to stay independent.
let seq = 0
const uid = () => `ctx-node-${++seq}`

describe('useContextCollapsed', () => {
  it('is collapsed by default for an unseen node id', () => {
    const c = useContextCollapsed(() => uid())
    expect(c.value).toBe(true)
  })

  it('reports collapsed when the node id is null or undefined', () => {
    expect(useContextCollapsed(() => null).value).toBe(true)
    expect(useContextCollapsed(() => undefined).value).toBe(true)
  })

  it('ignores writes when the node id is null', () => {
    const c = useContextCollapsed(() => null)
    c.value = false
    expect(c.value).toBe(true)
  })

  it('expands on set(false) and collapses again on set(true)', () => {
    const id = uid()
    const c = useContextCollapsed(() => id)
    c.value = false
    expect(c.value).toBe(false)
    c.value = true
    expect(c.value).toBe(true)
  })

  it('redundant writes are no-ops (no duplicates, no phantom removals)', () => {
    const id = uid()
    const c = useContextCollapsed(() => id)
    c.value = true // already collapsed: nothing to remove
    expect(c.value).toBe(true)
    c.value = false
    c.value = false // already expanded: must not duplicate
    expect(c.value).toBe(false)
    c.value = true
    expect(c.value).toBe(true)
  })

  it('coerces numeric node ids to their string key', () => {
    const idNum = 100000 + ++seq
    const asNumber = useContextCollapsed(() => idNum)
    const asString = useContextCollapsed(() => String(idNum))
    asNumber.value = false
    expect(asNumber.value).toBe(false)
    expect(asString.value).toBe(false)
  })

  it('shares state between two computeds pointing at the same node', () => {
    const id = uid()
    const a = useContextCollapsed(() => id)
    const b = useContextCollapsed(() => id)
    a.value = false
    expect(b.value).toBe(false)
  })
})

describe('useActionsCollapsed', () => {
  it('tracks state independently from the context collapse', () => {
    const id = uid()
    const actions = useActionsCollapsed(() => id)
    const context = useContextCollapsed(() => id)
    actions.value = false
    expect(actions.value).toBe(false)
    expect(context.value).toBe(true)
  })
})
