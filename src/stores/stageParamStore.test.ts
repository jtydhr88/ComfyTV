import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import { useStageParamStore } from './stageParamStore'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function param(over: Partial<any> = {}) {
  return {
    id: 1, kind: 'audio', key: 'guidance', label: 'Guidance', type: 'float',
    default: 5.0, config: {}, origin: 1, order: 10, ...over,
  }
}

describe('stageParamStore', () => {
  let fetchApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockReset()
  })

  it('hydrates the param list', async () => {
    fetchApi.mockResolvedValue(jsonResp({ params: [param()] }))
    const s = useStageParamStore()
    await s.hydrate()
    expect(s.params).toHaveLength(1)
  })

  it('forKind filters by kind and sorts by order then id', async () => {
    fetchApi.mockResolvedValue(jsonResp({ params: [
      param({ id: 3, kind: 'audio', key: 'b', order: 20 }),
      param({ id: 1, kind: 'audio', key: 'a', order: 10 }),
      param({ id: 2, kind: 'image', key: 'c', order: 5 }),
    ] }))
    const s = useStageParamStore()
    await s.hydrate()
    expect(s.forKind('audio').map(p => p.key)).toEqual(['a', 'b'])
    expect(s.forKind('image').map(p => p.key)).toEqual(['c'])
  })

  it('create appends the returned param', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true, param: param({ id: 9, key: 'bpm', label: 'BPM' }) }))
    const created = await s.create({ kind: 'audio', label: 'BPM', type: 'int' })
    expect(created?.key).toBe('bpm')
    expect(s.params.map(p => p.id)).toEqual([9])
  })

  it('remove drops it optimistically', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param({ id: 7 })] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))
    await s.remove(7)
    expect(s.params).toHaveLength(0)
  })
})
