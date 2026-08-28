import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('@/utils/botRefs', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/botRefs')>()
  return {
    ...original,
    listCanvasStages: vi.fn(() => [
      { kind: 'stage', uid: 'st-1', graph_node_id: '4',
        stage_class: 'ImageStage', title: 'Hero shot' },
      { kind: 'stage', uid: 'st-2', graph_node_id: '7',
        stage_class: 'VideoStage', title: 'B-roll' },
    ]),
  }
})

vi.mock('@/stores/assetStore', () => ({
  useAssetStore: () => ({
    assets: [
      { id: 11, name: 'logo.png', media_type: 'image' },
      { id: 12, name: 'readme.txt', media_type: 'text' },
    ],
    ensureHydrated: vi.fn(),
  }),
}))

import { useBotMentions } from './useBotMentions'

describe('useBotMentions', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('opens on a trailing @ token and filters by query', async () => {
    const draft = ref('please tweak @her')
    const m = useBotMentions(draft)
    await nextTick()
    expect(m.open.value).toBe(true)
    expect(m.matches.value.map(r => r.title ?? r.name)).toEqual(['Hero shot'])
    draft.value = 'no mention here'
    expect(m.open.value).toBe(false)
  })

  it('lists media assets but not text assets', async () => {
    const draft = ref('@')
    const m = useBotMentions(draft)
    await nextTick()
    const names = m.matches.value.map(r => r.title ?? r.name)
    expect(names).toContain('logo.png')
    expect(names).not.toContain('readme.txt')
  })

  it('pick strips the query, adds a chip once, and hides taken items', async () => {
    const draft = ref('use @hero')
    const m = useBotMentions(draft)
    await nextTick()
    m.pick(m.matches.value[0]!)
    expect(draft.value).toBe('use ')
    expect(m.refs.value).toHaveLength(1)
    m.addRef({ kind: 'stage', uid: 'st-1', graph_node_id: '4',
               stage_class: 'ImageStage', title: 'Hero shot' })
    expect(m.refs.value).toHaveLength(1)
    draft.value = 'use @'
    await nextTick()
    expect(m.matches.value.some(r => r.uid === 'st-1')).toBe(false)
  })

  it('pickFirst answers enter, removeRef drops the chip', async () => {
    const draft = ref('@b-roll')
    const m = useBotMentions(draft)
    await nextTick()
    expect(m.pickFirst()).toBe(true)
    expect(m.refs.value[0]?.uid).toBe('st-2')
    m.removeRef('stage:st-2')
    expect(m.refs.value).toEqual([])
    expect(m.pickFirst()).toBe(false)
  })
})
