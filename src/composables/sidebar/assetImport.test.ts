import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = { create: vi.fn(async (opts: any) => ({ id: 42, ...opts })) }
vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))
vi.mock('@/utils/uploadCanvas', () => ({
  uploadBlobNamed: vi.fn(async (_f: File, o: any) => ({
    name: o.filename, subfolder: o.subfolder, type: 'input', url: `/up/${o.filename}`,
  })),
}))

import { uploadBlobNamed } from '@/utils/uploadCanvas'

import { importAssetFiles } from './assetImport'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('importAssetFiles', () => {
  it('uploads to comfytv/assets, creates DB rows, and returns the created assets', async () => {
    const song = new File(['x'], 'song.mp3', { type: 'audio/mpeg' })
    const created = await importAssetFiles([song], { categoryIds: [3] })

    expect(uploadBlobNamed).toHaveBeenCalledWith(song, {
      subfolder: 'comfytv/assets', type: 'input', filename: 'song.mp3',
    })
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'song',
      payload_url: '/up/song.mp3',
      media_type: 'audio',
      category_ids: [3],
      source: 'upload',
    }))
    expect(created).toHaveLength(1)
    expect(created[0].id).toBe(42)
  })

  it('skips files whose media type is unknown and reports progress per media file', async () => {
    const onProgress = vi.fn()
    const created = await importAssetFiles([
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      new File(['x'], 'a.mp3', { type: 'audio/mpeg' }),
      new File(['x'], 'b.mp3', { type: 'audio/mpeg' }),
    ], { onProgress })

    expect(created).toHaveLength(2)
    expect(uploadBlobNamed).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('detects 3D models by extension', async () => {
    await importAssetFiles([new File(['x'], 'thing.glb', { type: '' })])
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ media_type: 'model' }))
  })

  it('propagates upload failures, keeping earlier assets', async () => {
    ;(uploadBlobNamed as any).mockRejectedValueOnce(new Error('boom'))
    await expect(importAssetFiles([new File(['x'], 'a.mp3', { type: 'audio/mpeg' })]))
      .rejects.toThrow('boom')
    expect(store.create).not.toHaveBeenCalled()
  })
})
