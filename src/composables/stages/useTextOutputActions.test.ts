import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock('@/utils/download', () => ({ downloadBlob }))

import { TEXT_COPIED_RESET_MS, useTextOutputActions } from './useTextOutputActions'

let wrappers: VueWrapper[] = []

function setup(getText: () => string) {
  let api!: ReturnType<typeof useTextOutputActions>
  const wrapper = mount(defineComponent({
    setup() {
      api = useTextOutputActions(getText)
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return api
}

beforeEach(() => {
  vi.useFakeTimers()
  downloadBlob.mockClear()
})

afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useTextOutputActions — copy', () => {
  it('copies via the clipboard API and resets the flag after the delay', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const api = setup(() => 'hello')
    await api.copyText()
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(api.textCopied.value).toBe(true)
    await vi.advanceTimersByTimeAsync(TEXT_COPIED_RESET_MS)
    expect(api.textCopied.value).toBe(false)
  })

  it('falls back to a hidden textarea + execCommand when clipboard fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) },
    })
    const execCommand = vi.fn()
    ;(document as any).execCommand = execCommand
    const api = setup(() => 'fallback text')
    await api.copyText()
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(api.textCopied.value).toBe(true)
    expect(document.querySelector('textarea')).toBeNull()
    delete (document as any).execCommand
  })

  it('is a no-op for empty text', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const api = setup(() => '')
    await api.copyText()
    expect(writeText).not.toHaveBeenCalled()
    expect(api.textCopied.value).toBe(false)
  })
})

describe('useTextOutputActions — download', () => {
  it('downloads a timestamped .txt blob', () => {
    const api = setup(() => 'file body')
    api.downloadText()
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [name, blob] = downloadBlob.mock.calls[0]
    expect(String(name)).toMatch(/^comfytv-text-\d+\.txt$/)
    expect((blob as Blob).type).toBe('text/plain;charset=utf-8')
  })

  it('skips the download for empty text', () => {
    const api = setup(() => '')
    api.downloadText()
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})
