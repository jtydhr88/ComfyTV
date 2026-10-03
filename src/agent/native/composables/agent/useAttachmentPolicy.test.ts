import { expect, it, vi } from 'vitest'
import { useAttachment } from './useAttachment'

it('refuses unsupported files before staging or uploading', async () => {
  const upload = vi.fn()
  const stage = vi.fn()
  const onError = vi.fn()
  const attachment = useAttachment({ upload, stage, update: vi.fn(), remove: vi.fn(), onError,
    allowed: (file: File) => file.type.startsWith('image/') })
  await attachment.addFiles([new File(['x'], 'movie.mp4', {type: 'video/mp4'})])
  expect(upload).not.toHaveBeenCalled()
  expect(stage).not.toHaveBeenCalled()
  expect(onError).toHaveBeenCalled()
})

it.each([false, true])('gates deferred resolution before staging (allowed=%s)', async (allowed) => {
  const stage = vi.fn()
  const resolve = vi.fn(async () => undefined)
  const onError = vi.fn()
  const attachment = useAttachment({ upload: vi.fn(), stage, update: vi.fn(), remove: vi.fn(), onError,
    allowDeferred: () => allowed })
  await attachment.addDeferredFile('unknown', resolve)
  expect(stage).toHaveBeenCalledTimes(allowed ? 1 : 0)
  expect(resolve).toHaveBeenCalledTimes(allowed ? 1 : 0)
  expect(onError).toHaveBeenCalledTimes(allowed ? 0 : 1)
})
