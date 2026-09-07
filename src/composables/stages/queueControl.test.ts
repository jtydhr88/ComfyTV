import { describe, expect, it, vi } from 'vitest'

import { cancelPrompt, promptInQueue } from './queueControl'

function fakeApi(queue: any) {
  const calls: Array<[string, any]> = []
  const api = {
    fetchApi: vi.fn(async (path: string, init?: any) => {
      calls.push([path, init ? JSON.parse(init.body) : null])
      if (path === '/queue' && !init) {
        if (queue === 'boom') throw new Error('offline')
        return { json: async () => queue }
      }
      return { json: async () => ({}) }
    }),
  }
  return { api, calls }
}

const running = [[1, 'p-run', {}, {}, []]]
const pending = [[2, 'p-wait', {}, {}, []]]

describe('cancelPrompt', () => {
  it('deletes a pending prompt without touching the running one', async () => {
    const { api, calls } = fakeApi({ queue_running: running, queue_pending: pending })
    expect(await cancelPrompt(api, 'p-wait')).toBe('deleted')
    expect(calls).toEqual([['/queue', null], ['/queue', { delete: ['p-wait'] }]])
  })

  it('interrupts only the prompt that is actually executing, by id', async () => {
    const { api, calls } = fakeApi({ queue_running: running, queue_pending: pending })
    expect(await cancelPrompt(api, 'p-run')).toBe('interrupted')
    expect(calls[1]).toEqual(['/interrupt', { prompt_id: 'p-run' }])
  })

  it('reports a prompt that is no longer queued instead of interrupting anything', async () => {
    const { api, calls } = fakeApi({ queue_running: running, queue_pending: [] })
    expect(await cancelPrompt(api, 'p-old')).toBe('gone')
    expect(calls).toHaveLength(1)
  })

  it('falls back to a targeted interrupt when the queue cannot be read', async () => {
    const { api, calls } = fakeApi('boom')
    expect(await cancelPrompt(api, 'p-x')).toBe('unknown')
    expect(calls[1]).toEqual(['/interrupt', { prompt_id: 'p-x' }])
  })
})

describe('promptInQueue', () => {
  it('answers from either list and null when unreadable', async () => {
    const { api } = fakeApi({ queue_running: running, queue_pending: pending })
    expect(await promptInQueue(api, 'p-run')).toBe(true)
    expect(await promptInQueue(api, 'p-wait')).toBe(true)
    expect(await promptInQueue(api, 'p-none')).toBe(false)
    expect(await promptInQueue(fakeApi('boom').api, 'p-run')).toBeNull()
  })
})
