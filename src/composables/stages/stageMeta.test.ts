import { describe, it, expect, vi, beforeEach } from 'vitest'

async function loadModuleWithFetch(fetchImpl: any) {
  vi.resetModules()
  vi.doMock('@/lib/comfyApp', () => ({
    app: { api: { fetchApi: fetchImpl } },
  }))
  return await import('./stageMeta')
}

const json = (data: any) => new Response(JSON.stringify(data), {
  status: 200, headers: { 'content-type': 'application/json' },
})

describe('stageMeta.loadStageMeta', () => {
  beforeEach(() => vi.resetModules())

  it('fetches and caches', async () => {
    const fetchImpl = vi.fn(async () => json({ stages: [
      { node_id: 'ComfyTV.ImageStage', kind: 'image-batch', variant: undefined, workflow_kind: 'image' },
    ]}))
    const mod = await loadModuleWithFetch(fetchImpl)
    const m = await mod.loadStageMeta()
    expect(m.get('ComfyTV.ImageStage')?.kind).toBe('image-batch')
    await mod.loadStageMeta()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('handles fetch error by returning empty map', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('net') })
    const mod = await loadModuleWithFetch(fetchImpl)
    const m = await mod.loadStageMeta()
    expect(m.size).toBe(0)
  })

  it('getStageMeta returns undefined before load resolves', async () => {
    const fetchImpl = vi.fn(async () => json({ stages: [] }))
    const mod = await loadModuleWithFetch(fetchImpl)
    expect(mod.getStageMeta('NotLoaded')).toBeUndefined()
  })

  it('getStageMeta hits the cache after load', async () => {
    const fetchImpl = vi.fn(async () => json({ stages: [
      { node_id: 'ComfyTV.X', kind: 'image', workflow_kind: 'image' },
    ]}))
    const mod = await loadModuleWithFetch(fetchImpl)
    await mod.loadStageMeta()
    expect(mod.getStageMeta('ComfyTV.X')?.kind).toBe('image')
  })
})

describe('stageMeta.isStageKind', () => {
  it('rejects project sentinel', async () => {
    const mod = await import('./stageMeta')
    expect(mod.isStageKind('project')).toBe(false)
  })
  it('accepts real kinds', async () => {
    const mod = await import('./stageMeta')
    expect(mod.isStageKind('image')).toBe(true)
    expect(mod.isStageKind('video')).toBe(true)
  })
})
