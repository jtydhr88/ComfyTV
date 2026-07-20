import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const proxyEnsure = vi.fn()
vi.mock('@/api', () => ({
  proxyEnsure: (...a: unknown[]) => proxyEnsure(...a),
}))

const queuePrompt = vi.fn(async () => ({}))
vi.mock('@/lib/comfyApp', () => ({
  app: {
    api: {
      queuePrompt: (...a: unknown[]) => (queuePrompt as (...x: unknown[]) => unknown)(...a),
    },
  },
}))

import {
  clearProxyCaches,
  requestProxyBuild,
  useProxiedVideoUrl,
} from './useProxiedVideoUrl'

const SRC = '/view?filename=big.mp4&type=output'
const PROXY = '/view?filename=px1.mp4&subfolder=comfytv-proxies&type=output'

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await vi.advanceTimersByTimeAsync(0)
}

function advance(ms: number): Promise<void> {
  return vi.advanceTimersByTimeAsync(ms) as unknown as Promise<void>
}

describe('useProxiedVideoUrl', () => {
  let wrappers: VueWrapper[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    clearProxyCaches()
    proxyEnsure.mockReset()
    queuePrompt.mockClear()
  })

  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    vi.useRealTimers()
  })

  function setup(initial: string | null = SRC) {
    const source = ref<string | null>(initial)
    let api!: ReturnType<typeof useProxiedVideoUrl>
    const wrapper = mount(defineComponent({
      setup() {
        api = useProxiedVideoUrl(source)
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, source, wrapper }
  }

  it('starts with the source url and swaps to an existing proxy', async () => {
    proxyEnsure.mockResolvedValue({ status: 'ready', proxy_url: PROXY })
    const { api } = setup()
    expect(api.url.value).toBe(SRC)
    await flush()
    expect(api.url.value).toBe(PROXY)
    expect(api.isProxy.value).toBe(true)
  })

  it('keeps the source when the server says original and caches the answer', async () => {
    proxyEnsure.mockResolvedValue({ status: 'original' })
    const a = setup()
    await flush()
    expect(a.api.url.value).toBe(SRC)
    expect(a.api.canProxy.value).toBe(false)
    expect(proxyEnsure).toHaveBeenCalledTimes(1)
    setup()
    await flush()
    expect(proxyEnsure).toHaveBeenCalledTimes(1)
  })

  it('marks candidates without building and does not poll', async () => {
    proxyEnsure.mockResolvedValue({ status: 'candidate' })
    const { api } = setup()
    await flush()
    expect(api.canProxy.value).toBe(true)
    expect(api.building.value).toBe(false)
    expect(api.url.value).toBe(SRC)
    await advance(10000)
    await flush()
    expect(proxyEnsure).toHaveBeenCalledTimes(1)
  })

  it('requestProxy creates the build and polls until ready', async () => {
    proxyEnsure
      .mockResolvedValueOnce({ status: 'candidate' })
      .mockResolvedValueOnce({ status: 'pending', pct: 0 })
      .mockResolvedValueOnce({ status: 'running', pct: 50 })
      .mockResolvedValueOnce({ status: 'ready', proxy_url: PROXY })
    const { api } = setup()
    await flush()
    expect(api.canProxy.value).toBe(true)

    void api.requestProxy()
    await flush()
    expect(proxyEnsure).toHaveBeenCalledWith(SRC, { create: true, retry: true })
    expect(queuePrompt).toHaveBeenCalledTimes(1)
    const promptArg = (queuePrompt.mock.calls[0] as unknown[])[1] as any
    expect(JSON.stringify(promptArg.output)).toContain('ComfyTV.MakeProxyStage')
    expect(api.building.value).toBe(true)
    await flush()
    await advance(2600)
    await flush()
    expect(api.pct.value).toBe(50)
    await advance(2600)
    await flush()
    expect(api.url.value).toBe(PROXY)
    expect(api.isProxy.value).toBe(true)
    expect(api.building.value).toBe(false)
  })

  it('polls a build already in flight elsewhere', async () => {
    proxyEnsure
      .mockResolvedValueOnce({ status: 'running', pct: 30 })
      .mockResolvedValueOnce({ status: 'ready', proxy_url: PROXY })
    const { api } = setup()
    await flush()
    expect(api.building.value).toBe(true)
    await advance(2600)
    await flush()
    expect(api.isProxy.value).toBe(true)
  })

  it('requestProxyBuild wakes passive instances watching the same url', async () => {
    proxyEnsure.mockResolvedValue({ status: 'candidate' })
    const { api } = setup()
    await flush()
    expect(api.canProxy.value).toBe(true)

    proxyEnsure.mockReset()
    proxyEnsure
      .mockResolvedValueOnce({ status: 'pending', pct: 0 })
      .mockResolvedValueOnce({ status: 'pending', pct: 10 })
    await requestProxyBuild(SRC)
    await flush()
    expect(proxyEnsure).toHaveBeenCalledWith(SRC, { create: true, retry: false })
    expect(api.building.value).toBe(true)
  })

  it('failed exposes the candidate button again', async () => {
    proxyEnsure.mockResolvedValue({ status: 'failed', error: 'boom' })
    const { api } = setup()
    await flush()
    expect(api.canProxy.value).toBe(true)
    expect(api.building.value).toBe(false)
    expect(api.url.value).toBe(SRC)
  })

  it('uses the ready cache without refetching', async () => {
    proxyEnsure.mockResolvedValue({ status: 'ready', proxy_url: PROXY })
    setup()
    await flush()
    expect(proxyEnsure).toHaveBeenCalledTimes(1)
    const b = setup()
    expect(b.api.url.value).toBe(PROXY)
    expect(proxyEnsure).toHaveBeenCalledTimes(1)
  })

  it('resets state when the source changes', async () => {
    proxyEnsure.mockResolvedValueOnce({ status: 'candidate' })
    const other = '/view?filename=other.mp4&type=output'
    proxyEnsure.mockResolvedValueOnce({ status: 'original' })
    const { api, source } = setup()
    await flush()
    expect(api.canProxy.value).toBe(true)
    source.value = other
    await flush()
    expect(api.url.value).toBe(other)
    expect(api.canProxy.value).toBe(false)
  })

  it('discards stale responses after the source changed mid-flight', async () => {
    let resolveFirst!: (v: unknown) => void
    proxyEnsure.mockImplementationOnce(
      () => new Promise((r) => { resolveFirst = r }))
    proxyEnsure.mockResolvedValueOnce({ status: 'original' })
    const other = '/view?filename=other.mp4&type=output'
    const { api, source } = setup()
    source.value = other
    await flush()
    resolveFirst({ status: 'ready', proxy_url: PROXY })
    await flush()
    expect(api.url.value).toBe(other)
    expect(api.isProxy.value).toBe(false)
  })

  it('ignores empty and non-view urls', async () => {
    const a = setup(null)
    const b = setup('blob:abc123')
    await flush()
    expect(a.api.url.value).toBeNull()
    expect(b.api.url.value).toBe('blob:abc123')
    expect(proxyEnsure).not.toHaveBeenCalled()
  })

  it('stops polling on unmount', async () => {
    proxyEnsure.mockResolvedValue({ status: 'pending', pct: 0 })
    const { wrapper } = setup()
    await flush()
    wrapper.unmount()
    await advance(10000)
    await flush()
    expect(proxyEnsure).toHaveBeenCalledTimes(1)
  })
})

