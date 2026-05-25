import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useExecutionStore } from './executionStore'


class MockApi {
  listeners = new Map<string, Set<(e: any) => void>>()
  addEventListener(name: string, fn: (e: any) => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set())
    this.listeners.get(name)!.add(fn)
  }
  removeEventListener(name: string, fn: (e: any) => void) {
    this.listeners.get(name)?.delete(fn)
  }
  fire(name: string, detail: any) {
    for (const fn of this.listeners.get(name) ?? []) fn({ detail })
  }
}


describe('executionStore.bindToApi', () => {
  let api: MockApi
  beforeEach(() => {
    setActivePinia(createPinia())
    api = new MockApi()
  })

  it('registers handlers for all WS events', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    const names = ['status', 'execution_start', 'executing',
      'execution_success', 'execution_error', 'execution_interrupted',
      'execution_cached']
    for (const name of names) {
      expect(api.listeners.get(name)?.size).toBeGreaterThanOrEqual(1)
    }
  })

  it('status updates queueRemaining', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('status', { status: { exec_info: { queue_remaining: 3 } } })
    expect(store.queueRemaining).toBe(3)
  })

  it('status reads exec_info from top-level too', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('status', { exec_info: { queue_remaining: 5 } })
    expect(store.queueRemaining).toBe(5)
  })

  it('execution_start sets currentPromptId and pushes event', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('execution_start', { prompt_id: 'p1' })
    expect(store.currentPromptId).toBe('p1')
    expect(store.recentEvents[0]).toMatchObject({ kind: 'started', promptId: 'p1' })
  })

  it('executing sets currentNodeId', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('executing', { node: '42' })
    expect(store.currentNodeId).toBe('42')
  })

  it('executing with display_node prefers it', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('executing', { node: '1', display_node: '42' })
    expect(store.currentNodeId).toBe('42')
  })

  it('executing with null node clears it', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('executing', { node: '1' })
    api.fire('executing', { node: null })
    expect(store.currentNodeId).toBeNull()
  })

  it('execution_success clears currentNodeId and logs', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('executing', { node: '1' })
    api.fire('execution_success', { prompt_id: 'p1' })
    expect(store.currentNodeId).toBeNull()
    expect(store.recentEvents[0]).toMatchObject({ kind: 'finished', promptId: 'p1' })
  })

  it('execution_error logs message', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('execution_error', { prompt_id: 'p1', exception_message: 'boom' })
    expect(store.recentEvents[0]).toMatchObject({ kind: 'error', label: 'boom' })
  })

  it('execution_error without message has fallback label', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('execution_error', { prompt_id: 'p1' })
    expect(store.recentEvents[0]).toMatchObject({ kind: 'error' })
    expect(store.recentEvents[0].label).toBeTruthy()
  })

  it('execution_interrupted logs cancellation', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('execution_interrupted', { prompt_id: 'p1' })
    expect(store.currentNodeId).toBeNull()
    expect(store.recentEvents[0]).toMatchObject({ kind: 'cancelled' })
  })

  it('execution_cached logs only when nodes present', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('execution_cached', { prompt_id: 'p1', nodes: ['a', 'b', 'c'] })
    expect(store.recentEvents[0]).toMatchObject({ kind: 'cached', label: '3 cached' })
  })

  it('execution_cached with empty nodes skips push', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('execution_cached', { prompt_id: 'p1', nodes: [] })
    expect(store.recentEvents).toHaveLength(0)
  })

  it('history is capped at 30', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    for (let i = 0; i < 40; i++) {
      api.fire('execution_start', { prompt_id: `p${i}` })
    }
    expect(store.recentEvents).toHaveLength(30)
    // Most recent first
    expect(store.recentEvents[0].promptId).toBe('p39')
  })

  it('isBusy true when node running', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('executing', { node: '1' })
    expect(store.isBusy).toBe(true)
  })

  it('isBusy true when queue has items', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('status', { status: { exec_info: { queue_remaining: 2 } } })
    expect(store.isBusy).toBe(true)
  })

  it('isBusy false when idle', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    expect(store.isBusy).toBe(false)
  })

  it('returns unsubscribe that removes listeners', () => {
    const store = useExecutionStore()
    const unsub = store.bindToApi(api)
    unsub()
    expect(api.listeners.get('status')?.size).toBe(0)
    expect(api.listeners.get('executing')?.size).toBe(0)
  })
})
