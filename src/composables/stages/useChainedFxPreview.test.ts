import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const registryCalls: string[] = []
const rendererFlags = {
  fail: new Set<string>(),
  lost: new Set<string>(),
  disposed: [] as string[],
}
vi.mock('@/composables/stages/fxChainPreviewRegistry', () => {
  function fakeRenderer(tag: string) {
    return {
      error: `${tag}-error`,
      renderToCanvas: (
        src: unknown,
        _params: unknown,
        target: { dataset?: Record<string, string> },
      ) => {
        if (rendererFlags.fail.has(tag)) return false
        registryCalls.push(
          `${tag}<${(src as { dataset?: Record<string, string> })?.dataset
            ?.tag ?? 'video'}`)
        if (target?.dataset) target.dataset.tag = tag
        return true
      },
      isLost: () => rendererFlags.lost.has(tag),
      dispose: () => { rendererFlags.disposed.push(tag) },
    }
  }
  return {
    CHAIN_PREVIEW_STAGES: {
      'ComfyTV.VideoColorStage': {
        create: () => fakeRenderer('color'),
        paramsOf: () => ({}),
      },
      'ComfyTV.VideoCurvesStage': {
        create: () => fakeRenderer('curves'),
        paramsOf: () => ({}),
      },
    },
  }
})

import {
  collectUpstreamFxStack,
  createChainCompositor,
  useChainedFxPreview,
} from './useChainedFxPreview'
import { getPreviewSource } from './previewBus'

function makeGraph(nodes: any[], links: Record<number, any>) {
  return {
    graph: {
      links,
      getNodeById: (id: unknown) => nodes.find((n) => n.id === id) ?? null,
    },
  }
}

function fxNode(id: number, cls: string, videoLink: number | null,
                extraInputs: any[] = []) {
  return {
    id,
    comfyClass: cls,
    inputs: [{ name: 'video', link: videoLink }, ...extraInputs],
  }
}

describe('collectUpstreamFxStack', () => {
  it('walks passthrough fx nodes in source-first order', () => {
    const src = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const color = fxNode(2, 'ComfyTV.VideoColorStage', 10)
    const curves = fxNode(3, 'ComfyTV.VideoCurvesStage', 11)
    const me = fxNode(4, 'ComfyTV.VideoStylizeStage', 12)
    const graphApp = makeGraph([src, color, curves, me], {
      10: { origin_id: 1 }, 11: { origin_id: 2 }, 12: { origin_id: 3 },
    })
    const stack = collectUpstreamFxStack(me, graphApp)
    expect(stack.map((n: any) => n.id)).toEqual([2, 3])
  })

  it('stops at non-fx nodes and empty links', () => {
    const loader = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const me = fxNode(2, 'ComfyTV.VideoColorStage', 10)
    const graphApp = makeGraph([loader, me], { 10: { origin_id: 1 } })
    expect(collectUpstreamFxStack(me, graphApp)).toEqual([])
    expect(collectUpstreamFxStack(
      fxNode(3, 'ComfyTV.VideoColorStage', null), graphApp)).toEqual([])
  })

  it('treats keyers with wired side inputs as baked and stops there', () => {
    const src = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const keyer = fxNode(2, 'ComfyTV.KeyerStage', 10,
      [{ name: 'in_mask', link: 99 }])
    const curves = fxNode(3, 'ComfyTV.VideoCurvesStage', 11)
    const me = fxNode(4, 'ComfyTV.VideoColorStage', 12)
    const graphApp = makeGraph([src, keyer, curves, me], {
      10: { origin_id: 1 }, 11: { origin_id: 2 }, 12: { origin_id: 3 },
    })
    expect(collectUpstreamFxStack(me, graphApp).map((n: any) => n.id))
      .toEqual([3])
  })

  it('includes keyers without side inputs', () => {
    const src = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const keyer = fxNode(2, 'ComfyTV.KeyerStage', 10,
      [{ name: 'in_mask', link: null }])
    const me = fxNode(3, 'ComfyTV.VideoColorStage', 11)
    const graphApp = makeGraph([src, keyer, me], {
      10: { origin_id: 1 }, 11: { origin_id: 2 },
    })
    expect(collectUpstreamFxStack(me, graphApp).map((n: any) => n.id))
      .toEqual([2])
  })
})

describe('createChainCompositor', () => {
  afterEach(() => {
    registryCalls.length = 0
    rendererFlags.fail.clear()
    rendererFlags.lost.clear()
    rendererFlags.disposed.length = 0
    vi.restoreAllMocks()
  })

  function chainGraph() {
    const src = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const color = fxNode(2, 'ComfyTV.VideoColorStage', 10)
    const me = fxNode(3, 'ComfyTV.VideoStylizeStage', 11)
    const graphApp = makeGraph([src, color, me], {
      10: { origin_id: 1 }, 11: { origin_id: 2 }, 13: { origin_id: 1 },
    })
    return { me, graphApp }
  }

  it('returns null and warns when an upstream renderer fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { me, graphApp } = chainGraph()
    const compositor = createChainCompositor(me, graphApp)
    rendererFlags.fail.add('color')
    expect(compositor.render({ currentTime: 0.5 } as never)).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ComfyTV.VideoColorStage'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('color-error'))
    compositor.dispose()
  })

  it('disposes renderers for nodes that leave the chain', () => {
    const { me, graphApp } = chainGraph()
    const compositor = createChainCompositor(me, graphApp)
    expect(compositor.render({} as never)).not.toBeNull()
    expect(registryCalls).toEqual(['color<video'])
    me.inputs[0].link = 13
    expect(compositor.render({} as never)).not.toBeNull()
    expect(rendererFlags.disposed).toEqual(['color'])
    compositor.dispose()
  })

  it('reports lost upstream renderer classes', () => {
    const { me, graphApp } = chainGraph()
    const compositor = createChainCompositor(me, graphApp)
    compositor.render({} as never)
    expect(compositor.lostClasses()).toEqual([])
    rendererFlags.lost.add('color')
    expect(compositor.lostClasses()).toEqual(['ComfyTV.VideoColorStage'])
    compositor.dispose()
    expect(rendererFlags.disposed).toEqual(['color'])
  })
})

describe('useChainedFxPreview pipeline', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    registryCalls.length = 0
    rendererFlags.fail.clear()
    rendererFlags.lost.clear()
    rendererFlags.disposed.length = 0
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function makeVideo(): HTMLVideoElement {
    const v = document.createElement('video')
    Object.defineProperty(v, 'readyState', { value: 2, configurable: true })
    Object.defineProperty(v, 'paused', { value: true, configurable: true })
    return v
  }

  it('renders upstream stack in order then its own renderer', () => {
    const src = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const color = fxNode(2, 'ComfyTV.VideoColorStage', 10)
    const curves = fxNode(3, 'ComfyTV.VideoCurvesStage', 11)
    const me = fxNode(4, 'ComfyTV.VideoStylizeStage', 12)
    const graphApp = makeGraph([src, color, curves, me], {
      10: { origin_id: 1 }, 11: { origin_id: 2 }, 12: { origin_id: 3 },
    })

    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const canvasEl = ref<HTMLCanvasElement | null>(
      document.createElement('canvas'))
    const own = {
      renderToCanvas: vi.fn((s: any) => {
        registryCalls.push(`own<${s?.dataset?.tag ?? 'video'}`)
        return true
      }),
      dispose: vi.fn(),
    }
    const wrapper = mount(defineComponent({
      setup() {
        useChainedFxPreview({
          videoEl,
          canvasEl,
          node: me as never,
          params: () => ({}),
          createRenderer: () => own,
          graphApp,
        })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    expect(registryCalls).toEqual(['color<video', 'curves<color',
      'own<curves'])
  })

  it('skips unknown kinds and still renders own stage', () => {
    const src = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const denoise = fxNode(2, 'ComfyTV.VideoDenoiseStage', 10)
    const me = fxNode(3, 'ComfyTV.VideoColorStage', 11)
    const graphApp = makeGraph([src, denoise, me], {
      10: { origin_id: 1 }, 11: { origin_id: 2 },
    })
    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const canvasEl = ref<HTMLCanvasElement | null>(
      document.createElement('canvas'))
    const own = {
      renderToCanvas: vi.fn((s: any) => {
        registryCalls.push(`own<${s?.dataset?.tag ?? 'video'}`)
        return true
      }),
      dispose: vi.fn(),
    }
    const wrapper = mount(defineComponent({
      setup() {
        useChainedFxPreview({
          videoEl,
          canvasEl,
          node: me as never,
          params: () => ({}),
          createRenderer: () => own,
          graphApp,
        })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    expect(registryCalls).toEqual(['own<video'])
  })

  function simpleChain() {
    const src = { id: 1, comfyClass: 'ComfyTV.VideoLoaderStage', inputs: [] }
    const color = fxNode(2, 'ComfyTV.VideoColorStage', 10)
    const me = fxNode(3, 'ComfyTV.VideoStylizeStage', 11)
    const graphApp = makeGraph([src, color, me], {
      10: { origin_id: 1 }, 11: { origin_id: 2 },
    })
    return { me, graphApp }
  }

  function mountPreview(opts: {
    node: unknown
    graphApp: unknown
    own: any
    videoEl?: any
    canvasEl?: any
    nodeId?: string
    track?: boolean
  }) {
    const videoEl = opts.videoEl ?? ref<HTMLVideoElement | null>(makeVideo())
    const canvasEl = opts.canvasEl
      ?? ref<HTMLCanvasElement | null>(document.createElement('canvas'))
    let api!: ReturnType<typeof useChainedFxPreview>
    const wrapper = mount(defineComponent({
      setup() {
        api = useChainedFxPreview({
          videoEl,
          canvasEl,
          nodeId: opts.nodeId,
          node: opts.node as never,
          params: () => ({}),
          createRenderer: () => opts.own,
          graphApp: opts.graphApp,
        })
        return () => null
      },
    }))
    if (opts.track !== false) wrappers.push(wrapper)
    return { api, wrapper, videoEl, canvasEl }
  }

  function okOwn() {
    return {
      renderToCanvas: vi.fn(() => true),
      dispose: vi.fn(),
    }
  }

  it('registers a preview source under its nodeId until unmount', () => {
    const { me, graphApp } = simpleChain()
    const { wrapper, canvasEl } = mountPreview({
      node: me, graphApp, own: okOwn(), nodeId: 'node-7', track: false,
    })
    expect(getPreviewSource('node-7')?.()).toBe(canvasEl.value)
    wrapper.unmount()
    expect(getPreviewSource('node-7')).toBeNull()
  })

  it('disables the preview when the upstream chain fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    rendererFlags.fail.add('color')
    const { me, graphApp } = simpleChain()
    const own = okOwn()
    const { api } = mountPreview({ node: me, graphApp, own })
    expect(api.supported.value).toBe(false)
    expect(own.renderToCanvas).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('upstream chain failed'))
    api.renderOnce()
    expect(own.renderToCanvas).not.toHaveBeenCalled()
  })

  it('disables the preview when its own renderer fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { me, graphApp } = simpleChain()
    const own = {
      renderToCanvas: vi.fn(() => false),
      error: 'own-boom',
      dispose: vi.fn(),
    }
    const { api } = mountPreview({ node: me, graphApp, own })
    expect(api.supported.value).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('own render failed'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('own-boom'))
  })

  it('warns about stale previews when a chained context is lost', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { me, graphApp } = simpleChain()
    const own = {
      renderToCanvas: vi.fn(() => true),
      isLost: () => true,
      dispose: vi.fn(),
    }
    const { api } = mountPreview({ node: me, graphApp, own })
    expect(api.supported.value).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('STALE'))
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ComfyTV.VideoStylizeStage (own)'))
  })

  it('runs a rAF loop while playing and stops on pause', () => {
    const rafCbs: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame',
      (cb: FrameRequestCallback) => { rafCbs.push(cb); return rafCbs.length })
    const caf = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', caf)
    const { me, graphApp } = simpleChain()
    const own = okOwn()
    const v = makeVideo()
    Object.defineProperty(v, 'paused', { value: false, configurable: true })
    const videoEl = ref<HTMLVideoElement | null>(v)
    mountPreview({ node: me, graphApp, own, videoEl })

    expect(rafCbs.length).toBe(1)
    expect(own.renderToCanvas).not.toHaveBeenCalled()
    rafCbs[0](0)
    expect(own.renderToCanvas).toHaveBeenCalledTimes(1)
    expect(rafCbs.length).toBe(2)

    Object.defineProperty(v, 'paused', { value: true, configurable: true })
    v.dispatchEvent(new Event('pause'))
    expect(caf).toHaveBeenCalled()
    expect(own.renderToCanvas).toHaveBeenCalledTimes(1)

    Object.defineProperty(v, 'currentTime', { value: 2, configurable: true })
    v.dispatchEvent(new Event('seeked'))
    expect(own.renderToCanvas).toHaveBeenCalledTimes(2)
  })

  it('idle interval re-renders only when the chain state changes', () => {
    vi.useFakeTimers()
    try {
      const { me, graphApp } = simpleChain()
      const own = okOwn()
      const { videoEl } = mountPreview({ node: me, graphApp, own })
      expect(own.renderToCanvas).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1000)
      expect(own.renderToCanvas).toHaveBeenCalledTimes(1)
      Object.defineProperty(videoEl.value!, 'currentTime',
        { value: 2, configurable: true })
      vi.advanceTimersByTime(500)
      expect(own.renderToCanvas).toHaveBeenCalledTimes(2)
      vi.advanceTimersByTime(500)
      expect(own.renderToCanvas).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
