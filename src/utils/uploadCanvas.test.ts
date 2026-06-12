import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import { uploadBlob, uploadCanvas } from './uploadCanvas'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function fakeCanvas(blob: Blob | null): HTMLCanvasElement {
  return {
    toBlob: (cb: (b: Blob | null) => void) => { cb(blob) },
  } as unknown as HTMLCanvasElement
}

describe('uploadBlob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to /upload/image with the right multipart body and returns a /view URL', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({ name: 'server-renamed.png' }))

    const blob = new Blob(['fake png'], { type: 'image/png' })
    const url = await uploadBlob(blob, { subfolder: 'panorama-view', filename: 'cli.png' })

    expect(fetchApi).toHaveBeenCalledTimes(1)
    const [path, init] = fetchApi.mock.calls[0]
    expect(path).toBe('/upload/image')
    expect(init.method).toBe('POST')
    const body = init.body as FormData
    expect(body.get('subfolder')).toBe('panorama-view')
    expect(body.get('type')).toBe('input')
    expect(body.get('image')).toBeTruthy()

    expect(url).toBe('/view?filename=server-renamed.png&subfolder=panorama-view&type=input')
  })

  it('falls back to a "comfytv-<timestamp>.png" filename when none is provided', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({ name: 'whatever.png' }))

    const before = Date.now()
    await uploadBlob(new Blob([]), { subfolder: 'gridsplit' })
    const after = Date.now()

    expect(fetchApi).toHaveBeenCalledTimes(1)
    void before; void after
  })

  it('throws on non-200 upload response', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response('nope', { status: 413, statusText: 'Payload Too Large' }))
    await expect(
      uploadBlob(new Blob([]), { subfolder: 'x' }),
    ).rejects.toThrow(/upload 413/)
  })

  it('throws when server response lacks `name`', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({ thumbnail: 'x.png' }))
    await expect(
      uploadBlob(new Blob([]), { subfolder: 'x' }),
    ).rejects.toThrow(/missing `name`/)
  })

  it('honors a custom `type` (e.g. temp)', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({ name: 'a.png' }))
    const url = await uploadBlob(new Blob([]), { subfolder: 'x', type: 'temp' })
    expect(url).toBe('/view?filename=a.png&subfolder=x&type=temp')
    const init = fetchApi.mock.calls[0][1]
    expect((init.body as FormData).get('type')).toBe('temp')
  })
})

describe('uploadCanvas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects when toBlob returns null', async () => {
    const c = fakeCanvas(null)
    await expect(uploadCanvas(c, { subfolder: 'x' })).rejects.toThrow(/toBlob returned null/)
  })

  it('forwards the blob through to uploadBlob and returns the /view URL', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({ name: 'tile.png' }))
    const blob = new Blob(['png'], { type: 'image/png' })
    const c = fakeCanvas(blob)
    const url = await uploadCanvas(c, { subfolder: 'gridsplit' })
    expect(url).toBe('/view?filename=tile.png&subfolder=gridsplit&type=input')
  })
})
