import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { useCollapsedFlag, useCollapsedNodeIds } from './useCollapsedState'

function installLocalStorage() {
  const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  }
}

describe('useCollapsedNodeIds', () => {
  beforeEach(() => { installLocalStorage() })

  it('starts empty for a fresh workflow id', async () => {
    const id = ref<number | null>(null)
    const { isCollapsed } = useCollapsedNodeIds(id)
    id.value = 42
    await nextTick()
    expect(isCollapsed('node-a')).toBe(false)
  })

  it('toggle flips state and persists to localStorage', async () => {
    const id = ref<number | null>(7)
    const { isCollapsed, toggle } = useCollapsedNodeIds(id)
    await nextTick()
    toggle('node-x')
    expect(isCollapsed('node-x')).toBe(true)
    toggle('node-x')
    expect(isCollapsed('node-x')).toBe(false)
  })

  it('reloads from localStorage when workflow id changes', async () => {
    localStorage.setItem('comfytv:sidebar:collapsed:99', JSON.stringify(['a', 'b']))
    const id = ref<number | null>(null)
    const { isCollapsed } = useCollapsedNodeIds(id)
    id.value = 99
    await nextTick()
    expect(isCollapsed('a')).toBe(true)
    expect(isCollapsed('b')).toBe(true)
    expect(isCollapsed('c')).toBe(false)
  })

  it('ignores garbage in localStorage', async () => {
    localStorage.setItem('comfytv:sidebar:collapsed:5', '{nope')
    const id = ref<number | null>(5)
    const { isCollapsed } = useCollapsedNodeIds(id)
    id.value = 5
    await nextTick()
    expect(isCollapsed('whatever')).toBe(false)
  })

  it('persists set across hook re-creations for the same workflow id', async () => {
    const id1 = ref<number | null>(11)
    const { toggle } = useCollapsedNodeIds(id1)
    await nextTick()
    toggle('saved-node')

    const id2 = ref<number | null>(null)
    const { isCollapsed } = useCollapsedNodeIds(id2)
    id2.value = 11
    await nextTick()
    expect(isCollapsed('saved-node')).toBe(true)
  })
})

describe('useCollapsedFlag', () => {
  beforeEach(() => { installLocalStorage() })

  it('defaults to the provided default when nothing is stored', async () => {
    const id = ref<number | null>(3)
    const { collapsed } = useCollapsedFlag(id, 'prefix:', true)
    await nextTick()
    expect(collapsed.value).toBe(true)
  })

  it('toggle flips and persists', async () => {
    const id = ref<number | null>(8)
    const { collapsed, toggle } = useCollapsedFlag(id, 'prefix:', false)
    await nextTick()
    expect(collapsed.value).toBe(false)
    toggle()
    expect(collapsed.value).toBe(true)
    expect(localStorage.getItem('prefix:8')).toBe('1')
    toggle()
    expect(collapsed.value).toBe(false)
    expect(localStorage.getItem('prefix:8')).toBe('0')
  })

  it('reads "1" / "0" from storage on workflow id change', async () => {
    localStorage.setItem('prefix:50', '1')
    const id = ref<number | null>(null)
    const { collapsed } = useCollapsedFlag(id, 'prefix:', false)
    id.value = 50
    await nextTick()
    expect(collapsed.value).toBe(true)
  })

  it('uses default when storage value is neither "0" nor "1"', async () => {
    localStorage.setItem('prefix:60', 'bogus')
    const id = ref<number | null>(null)
    const { collapsed } = useCollapsedFlag(id, 'prefix:', true)
    id.value = 60
    await nextTick()
    expect(collapsed.value).toBe(true)
  })
})
