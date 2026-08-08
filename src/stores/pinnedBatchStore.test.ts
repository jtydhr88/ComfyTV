import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stageState = {
  pool: null as string | null,
  outputs: [null as string | null],
  output: null as string | null,
}
vi.mock('@/stores/stageStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/stageStore')>()
  return {
    ...actual,
    useStageStore: () => ({ getStage: () => stageState }),
  }
})

const ls = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, v) },
  removeItem: (k: string) => { ls.delete(k) },
})

import { usePinnedBatchStore } from './pinnedBatchStore'

const batchJson = (urls: string[]) => JSON.stringify({
  images: urls.map((u, i) => ({ index: String(i + 1), image_url: u })),
})

function appWithNode(uid: string | null): any {
  return {
    graph: {
      _nodes: uid ? [{ id: 1, properties: { comfytv_stage_uid: uid } }] : [],
    },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  ls.clear()
  stageState.pool = null
  stageState.outputs = [null]
  stageState.output = null
})

describe('pinnedBatchStore', () => {
  it('pins a snapshot and lists it per project', () => {
    const store = usePinnedBatchStore()
    const entry = store.pin('p1', {
      label: 'ImageStage #3', sourceUid: 'uid-1', batchJson: batchJson(['/a', '/b']),
    })
    expect(entry).not.toBeNull()
    expect(store.list('p1')).toHaveLength(1)
    expect(store.list('p1')[0].urls).toEqual(['/a', '/b'])
    expect(store.list('p2')).toHaveLength(0)
    expect(store.byId('p1', entry!.id)?.label).toBe('ImageStage #3')
  })

  it('rejects empty batches', () => {
    const store = usePinnedBatchStore()
    expect(store.pin('p1', { label: 'x', sourceUid: null, batchJson: '{"images":[]}' })).toBeNull()
    expect(store.pin('p1', { label: 'x', sourceUid: null, batchJson: null })).toBeNull()
    expect(store.list('p1')).toHaveLength(0)
  })

  it('persists to localStorage and reloads in a fresh store', () => {
    const store = usePinnedBatchStore()
    const entry = store.pin('p1', { label: 'A', sourceUid: null, batchJson: batchJson(['/a']) })!

    setActivePinia(createPinia())
    const fresh = usePinnedBatchStore()
    expect(fresh.byId('p1', entry.id)?.urls).toEqual(['/a'])

    fresh.unpin('p1', entry.id)
    expect(fresh.list('p1')).toHaveLength(0)

    setActivePinia(createPinia())
    expect(usePinnedBatchStore().list('p1')).toHaveLength(0)
  })

  it('refresh re-snapshots from the live source stage output', () => {
    const store = usePinnedBatchStore()
    const entry = store.pin('p1', {
      label: 'A', sourceUid: 'uid-1', batchJson: batchJson(['/old']),
    })!
    stageState.outputs = [batchJson(['/new1', '/new2'])]
    expect(store.refresh('p1', entry.id, appWithNode('uid-1'))).toBe(true)
    expect(store.byId('p1', entry.id)?.urls).toEqual(['/new1', '/new2'])
  })

  it('refresh prefers the picker pool over the picked output', () => {
    const store = usePinnedBatchStore()
    const entry = store.pin('p1', {
      label: 'Picker #5', sourceUid: 'uid-1', batchJson: batchJson(['/old']),
    })!
    stageState.pool = batchJson(['/p1', '/p2', '/p3'])
    stageState.outputs = ['/picked-single.png']
    expect(store.refresh('p1', entry.id, appWithNode('uid-1'))).toBe(true)
    expect(store.byId('p1', entry.id)?.urls).toEqual(['/p1', '/p2', '/p3'])
  })

  it('refresh normalizes a bare single-image output into a one-item batch', () => {
    const store = usePinnedBatchStore()
    const entry = store.pin('p1', {
      label: 'A', sourceUid: 'uid-1', batchJson: batchJson(['/old']),
    })!
    stageState.outputs = ['/view?filename=single.png']
    expect(store.refresh('p1', entry.id, appWithNode('uid-1'))).toBe(true)
    expect(store.byId('p1', entry.id)?.urls).toEqual(['/view?filename=single.png'])
  })

  it('refresh fails gracefully when the source is gone or empty', () => {
    const store = usePinnedBatchStore()
    const entry = store.pin('p1', {
      label: 'A', sourceUid: 'uid-1', batchJson: batchJson(['/old']),
    })!
    expect(store.refresh('p1', entry.id, appWithNode(null))).toBe(false)
    stageState.outputs = [null]
    expect(store.refresh('p1', entry.id, appWithNode('uid-1'))).toBe(false)
    expect(store.byId('p1', entry.id)?.urls).toEqual(['/old'])

    const noSource = store.pin('p1', { label: 'B', sourceUid: null, batchJson: batchJson(['/x']) })!
    expect(store.refresh('p1', noSource.id, appWithNode('uid-1'))).toBe(false)
  })
})
