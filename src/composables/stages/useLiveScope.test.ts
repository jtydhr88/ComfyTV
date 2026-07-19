import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { LGraphNode } from '@/lib/comfyApp'
import { useLiveScope, resolveUpstreamNodeId, type UseLiveScopeOptions } from './useLiveScope'
import { registerPreviewSource } from './previewBus'
import type { ImageDataLike, ScopeKind } from './scopeMath'

function makeNode(link: number | null = 5, originId: number | string = 42): LGraphNode {
  return {
    id: 9,
    inputs: link == null ? [{ name: 'video' }] : [{ name: 'video', link }],
    graph: { links: new Map([[5, { origin_id: originId }]]) },
  } as unknown as LGraphNode
}

function captureRaf() {
  let cb: FrameRequestCallback | null = null
  const raf = vi.spyOn(window, 'requestAnimationFrame')
    .mockImplementation((fn: FrameRequestCallback) => {
      cb = fn
      return 11
    })
  const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  return { raf, caf, tick: (ts: number) => { const fn = cb; cb = null; fn?.(ts) } }
}

describe('resolveUpstreamNodeId', () => {
  it('resolves the origin id through a Map links registry', () => {
    expect(resolveUpstreamNodeId(makeNode(), 'video')).toBe('42')
  })

  it('resolves through a plain-object links registry', () => {
    const node = {
      inputs: [{ name: 'video', link: 3 }],
      graph: { links: { 3: { origin_id: 7 } } },
    } as unknown as LGraphNode
    expect(resolveUpstreamNodeId(node, 'video')).toBe('7')
  })

  it('falls back to graph.getLink', () => {
    const node = {
      inputs: [{ name: 'video', link: 3 }],
      graph: { getLink: (id: number) => (id === 3 ? { origin_id: 'abc' } : null) },
    } as unknown as LGraphNode
    expect(resolveUpstreamNodeId(node, 'video')).toBe('abc')
  })

  it('returns null when the slot is missing, unlinked, or the link is unknown', () => {
    expect(resolveUpstreamNodeId(makeNode(null), 'video')).toBeNull()
    expect(resolveUpstreamNodeId(makeNode(), 'audio')).toBeNull()
    const node = {
      inputs: [{ name: 'video', link: 99 }],
      graph: { links: new Map() },
    } as unknown as LGraphNode
    expect(resolveUpstreamNodeId(node, 'video')).toBeNull()
  })
})

describe('useLiveScope', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    vi.restoreAllMocks()
  })

  function setup(overrides: Partial<UseLiveScopeOptions> = {}) {
    const src = document.createElement('canvas')
    const target = document.createElement('canvas')
    const canvasEl = ref<HTMLCanvasElement | null>(target)
    const img: ImageDataLike = { data: new Uint8ClampedArray(4), width: 1, height: 1 }
    const sample = vi.fn(() => img)
    const paint = vi.fn()
    const scope = ref<ScopeKind>('waveform')
    const getSource = vi.fn((id: string) => (id === '42' ? () => src : null))
    let api!: ReturnType<typeof useLiveScope>
    const wrapper = mount(defineComponent({
      setup() {
        api = useLiveScope({
          node: makeNode(),
          scope: () => scope.value,
          canvasEl,
          fps: 15,
          getSource,
          sample,
          paint,
          ...overrides,
        })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, wrapper, canvasEl, src, target, img, sample, paint, scope, getSource }
  }

  it('is not live and starts no loop without an upstream link', () => {
    const { raf } = captureRaf()
    const { api } = setup({ node: makeNode(null) })
    expect(api.live.value).toBe(false)
    expect(raf).not.toHaveBeenCalled()
  })

  it('is not live when no publisher exists for the upstream id', () => {
    const { raf } = captureRaf()
    const { api } = setup({ getSource: () => null })
    expect(api.live.value).toBe(false)
    expect(raf).not.toHaveBeenCalled()
  })

  it('starts the loop and samples the upstream canvas into the scope', () => {
    const { raf, tick } = captureRaf()
    const { api, src, target, img, sample, paint } = setup()
    expect(api.live.value).toBe(true)
    expect(raf).toHaveBeenCalledTimes(1)
    tick(1000)
    expect(sample).toHaveBeenCalledWith(src, 320)
    expect(paint).toHaveBeenCalledWith(target, 'waveform', img)
    expect(raf).toHaveBeenCalledTimes(2)
  })

  it('throttles below the configured fps', () => {
    const { tick } = captureRaf()
    const { paint } = setup()
    tick(1000)
    tick(1010)
    expect(paint).toHaveBeenCalledTimes(1)
    tick(1100)
    expect(paint).toHaveBeenCalledTimes(2)
  })

  it('passes the current scope kind on every frame', () => {
    const { tick } = captureRaf()
    const { paint, scope } = setup()
    tick(1000)
    scope.value = 'histogram'
    tick(2000)
    expect(paint).toHaveBeenLastCalledWith(expect.anything(), 'histogram', expect.anything())
  })

  it('skips painting when the sample fails', () => {
    const { tick } = captureRaf()
    const failing = vi.fn(() => null)
    const { paint } = setup({ sample: failing })
    tick(1000)
    expect(failing).toHaveBeenCalledTimes(1)
    expect(paint).not.toHaveBeenCalled()
  })

  it('skips painting when the target canvas is gone', () => {
    const { tick } = captureRaf()
    const { paint, canvasEl } = setup()
    canvasEl.value = null
    tick(1000)
    expect(paint).not.toHaveBeenCalled()
  })

  it('goes live when a publisher registers on the real bus and stops when it unregisters', async () => {
    const { raf, caf, tick } = captureRaf()
    const paint = vi.fn()
    const { api, wrapper } = setup({ getSource: undefined, paint })
    expect(api.live.value).toBe(false)
    const src = document.createElement('canvas')
    const off = registerPreviewSource('42', () => src)
    await wrapper.vm.$nextTick()
    expect(api.live.value).toBe(true)
    expect(raf).toHaveBeenCalled()
    tick(1000)
    expect(paint).toHaveBeenCalledTimes(1)
    caf.mockClear()
    off()
    await wrapper.vm.$nextTick()
    expect(api.live.value).toBe(false)
    expect(caf).toHaveBeenCalled()
  })

  it('stops the loop on unmount', () => {
    const { caf } = captureRaf()
    const { wrapper } = setup()
    caf.mockClear()
    wrapper.unmount()
    expect(caf).toHaveBeenCalled()
  })
})
