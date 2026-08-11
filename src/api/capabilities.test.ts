import { beforeEach, describe, expect, it, vi } from 'vitest'

const CAPS = {
  version: '1.8.0',
  node_ids: ['ComfyTV.VideoColorStage', 'ComfyTV.VideoLUTStage'],
  resources: { lut: [{ filename: 'warm.cube', sha256: 'abc' }], font: [] },
  resource_fields: { 'ComfyTV.VideoLUTStage': { lut_file: 'lut' } },
}

async function loadWithFetch(fetchImpl: any) {
  vi.resetModules()
  vi.doMock('@/lib/comfyApp', () => ({
    app: { api: { fetchApi: fetchImpl } },
  }))
  return await import('./index')
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.resetModules()
})

describe('fetchRemoteCapabilities', () => {
  it('parses a valid relayed payload as installed', async () => {
    const fetchApi = vi.fn(async () => json({ installed: true, capabilities: CAPS }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const probe = await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(probe.installed).toBe(true)
    if (probe.installed) {
      expect(probe.capabilities.version).toBe('1.8.0')
      expect(probe.capabilities.node_ids).toContain('ComfyTV.VideoLUTStage')
      expect(probe.capabilities.resource_fields['ComfyTV.VideoLUTStage']).toEqual({ lut_file: 'lut' })
    }
  })

  it('posts host and port to the local proxy endpoint', async () => {
    const fetchApi = vi.fn(async () => json({ installed: true, capabilities: CAPS }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(fetchApi).toHaveBeenCalledWith(
      '/comfytv/servers/probe_capabilities',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ host: '10.0.0.2', port: 8188 }),
      }),
    )
  })

  it('relays installed:false probes from the backend', async () => {
    const fetchApi = vi.fn(async () => json({ installed: false, error: 'HTTP 404' }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const probe = await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(probe).toEqual({ installed: false, error: 'HTTP 404' })
  })

  it('maps local endpoint failure to installed:false', async () => {
    const fetchApi = vi.fn(async () => new Response('nope', { status: 500 }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const probe = await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(probe).toEqual({ installed: false, error: 'HTTP 500' })
  })

  it('maps network failure to installed:false', async () => {
    const fetchApi = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const probe = await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(probe).toEqual({ installed: false, error: 'Failed to fetch' })
  })

  it('maps an unrecognized capabilities payload to installed:false', async () => {
    const fetchApi = vi.fn(async () => json({ installed: true, capabilities: { hello: 'world' } }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const probe = await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(probe).toEqual({ installed: false, error: 'unrecognized capabilities payload' })
  })

  it('maps a probe body without installed flag to installed:false', async () => {
    const fetchApi = vi.fn(async () => json({ hello: 'world' }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const probe = await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(probe).toEqual({ installed: false, error: 'probe failed' })
  })

  it('maps non-JSON body to installed:false', async () => {
    const fetchApi = vi.fn(async () => new Response('<html>', { status: 200 }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const probe = await fetchRemoteCapabilities('10.0.0.2', 8188)
    expect(probe.installed).toBe(false)
  })
})
