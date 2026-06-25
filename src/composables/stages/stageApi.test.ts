import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'
import { postPickedIndex } from './stageApi'

const fetchApi = app.api!.fetchApi as unknown as ReturnType<typeof vi.fn>

describe('postPickedIndex', () => {
  beforeEach(() => {
    fetchApi.mockReset()
  })

  it('POSTs the picked index to the right endpoint', async () => {
    fetchApi.mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await postPickedIndex(42, 3)
    expect(fetchApi).toHaveBeenCalledWith(
      '/comfytv/outputs/42/picked_index',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ picked_index: 3 }),
      }),
    )
  })

  it('warns on a non-ok, non-404 response without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchApi.mockResolvedValueOnce(new Response('', { status: 500 }))
    await expect(postPickedIndex(1, 0)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('ignores a 404 response', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchApi.mockResolvedValueOnce(new Response('', { status: 404 }))
    await postPickedIndex(1, 0)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('swallows a thrown error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchApi.mockRejectedValueOnce(new Error('network'))
    await expect(postPickedIndex(1, 0)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
