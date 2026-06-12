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

  it('binds progress and progress_text listeners', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    expect(api.listeners.get('progress')?.size).toBeGreaterThanOrEqual(1)
    expect(api.listeners.get('progress_text')?.size).toBeGreaterThanOrEqual(1)
  })

  it('progress dispatches to the matching node and updates nodeProgress', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    const seen: any[] = []
    store.registerNodeHandlers({ getNodeId: () => '7', onProgress: d => seen.push(d) })
    api.fire('progress', { node: '7', value: 2, max: 4 })
    expect(seen).toHaveLength(1)
    expect(store.progressForNode('7')).toMatchObject({ value: 2, max: 4 })
    expect(store.progressForNode(7)).toMatchObject({ value: 2, max: 4 })
  })

  it('progress for an unregistered node is ignored', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    api.fire('progress', { node: '99', value: 1, max: 2 })
    expect(store.progressForNode('99')).toBeUndefined()
  })

  it('progress_text carries text into nodeProgress', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    const seen: any[] = []
    store.registerNodeHandlers({ getNodeId: () => '8', onProgressText: d => seen.push(d) })
    api.fire('progress', { node: '8', value: 1, max: 3 })
    api.fire('progress_text', { node: '8', text: 'denoising' })
    expect(seen).toHaveLength(1)
    expect(store.progressForNode('8')).toMatchObject({ value: 1, max: 3, text: 'denoising' })
  })

  it('execution_error dispatches only to the node matching node_id', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    const a: any[] = []
    const b: any[] = []
    store.registerNodeHandlers({ getNodeId: () => '1', onError: d => a.push(d) })
    store.registerNodeHandlers({ getNodeId: () => '2', onError: d => b.push(d) })
    api.fire('execution_error', { node_id: '2', exception_message: 'boom' })
    expect(a).toHaveLength(0)
    expect(b).toHaveLength(1)
  })

  it('execution_interrupted dispatches only to the matching node', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    const seen: any[] = []
    store.registerNodeHandlers({ getNodeId: () => '5', onInterrupted: d => seen.push(d) })
    store.registerNodeHandlers({ getNodeId: () => '6', onInterrupted: () => { throw new Error('wrong node') } })
    api.fire('execution_interrupted', { node_id: '5' })
    expect(seen).toHaveLength(1)
  })

  it('execution_success and status broadcast to all registered nodes', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    let successes = 0
    let statuses = 0
    store.registerNodeHandlers({ getNodeId: () => '1', onSuccess: () => { successes++ }, onStatus: () => { statuses++ } })
    store.registerNodeHandlers({ getNodeId: () => '2', onSuccess: () => { successes++ }, onStatus: () => { statuses++ } })
    api.fire('execution_success', { prompt_id: 'p1' })
    api.fire('status', { status: { exec_info: { queue_remaining: 0 } } })
    expect(successes).toBe(2)
    expect(statuses).toBe(2)
  })

  it('unregister stops dispatch and clears progress', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    const seen: any[] = []
    const handlers = { getNodeId: () => '3', onProgress: (d: any) => seen.push(d) }
    store.registerNodeHandlers(handlers)
    api.fire('progress', { node: '3', value: 1, max: 2 })
    store.unregisterNodeHandlers(handlers)
    api.fire('progress', { node: '3', value: 2, max: 2 })
    expect(seen).toHaveLength(1)
    expect(store.progressForNode('3')).toBeUndefined()
  })

  it('dispatch resolves node id lazily via getNodeId', () => {
    const store = useExecutionStore()
    store.bindToApi(api)
    let id = '-1'
    const seen: any[] = []
    store.registerNodeHandlers({ getNodeId: () => id, onProgress: d => seen.push(d) })
    api.fire('progress', { node: '10', value: 1, max: 2 })
    expect(seen).toHaveLength(0)
    id = '10'
    api.fire('progress', { node: '10', value: 1, max: 2 })
    expect(seen).toHaveLength(1)
  })
})
