import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  REMOTE_PROBE_TIMEOUT_MS,
  fetchRemoteCapabilities,
} from './index'

const CAPS = {
  version: '1.8.0',
  node_ids: ['ComfyTV.VideoColorStage', 'ComfyTV.VideoLUTStage'],
  resources: { lut: [{ filename: 'warm.cube', sha256: 'abc' }], font: [] },
  resource_fields: { 'ComfyTV.VideoLUTStage': { lut_file: 'lut' } },
}

const fetchMock = vi.fn()

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fetchRemoteCapabilities', () => {
  it('parses a valid payload as installed', async () => {
    fetchMock.mockResolvedValue(json(CAPS))
    const probe = await fetchRemoteCapabilities('http://10.0.0.2:8188')
    expect(probe.installed).toBe(true)
    if (probe.installed) {
      expect(probe.capabilities.version).toBe('1.8.0')
      expect(probe.capabilities.node_ids).toContain('ComfyTV.VideoLUTStage')
      expect(probe.capabilities.resource_fields['ComfyTV.VideoLUTStage']).toEqual({ lut_file: 'lut' })
    }
  })

  it('hits the capabilities path and trims trailing slashes', async () => {
    fetchMock.mockResolvedValue(json(CAPS))
    await fetchRemoteCapabilities('http://10.0.0.2:8188/')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.0.2:8188/comfytv/capabilities',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('maps 404 to installed:false', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }))
    const probe = await fetchRemoteCapabilities('http://10.0.0.2:8188')
    expect(probe).toEqual({ installed: false, error: 'HTTP 404' })
  })

  it('maps network/CORS failure to installed:false', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const probe = await fetchRemoteCapabilities('http://10.0.0.2:8188')
    expect(probe).toEqual({ installed: false, error: 'Failed to fetch' })
  })

  it('maps an unrecognized payload to installed:false', async () => {
    fetchMock.mockResolvedValue(json({ hello: 'world' }))
    const probe = await fetchRemoteCapabilities('http://10.0.0.2:8188')
    expect(probe).toEqual({ installed: false, error: 'unrecognized capabilities payload' })
  })

  it('maps non-JSON body to installed:false', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }))
    const probe = await fetchRemoteCapabilities('http://10.0.0.2:8188')
    expect(probe.installed).toBe(false)
  })

  it('aborts after the probe timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')))
      }))
    const pending = fetchRemoteCapabilities('http://10.0.0.2:8188')
    await vi.advanceTimersByTimeAsync(REMOTE_PROBE_TIMEOUT_MS + 1)
    const probe = await pending
    expect(probe.installed).toBe(false)
  })
})
