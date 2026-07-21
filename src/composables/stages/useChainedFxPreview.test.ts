import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const registryCalls: string[] = []
vi.mock('@/composables/stages/fxChainPreviewRegistry', () => {
  function fakeRenderer(tag: string) {
    return {
      renderToCanvas: (
        src: unknown,
        _params: unknown,
        target: { dataset?: Record<string, string> },
      ) => {
        registryCalls.push(
          `${tag}<${(src as { dataset?: Record<string, string> })?.dataset
            ?.tag ?? 'video'}`)
        if (target?.dataset) target.dataset.tag = tag
        return true
      },
      dispose: vi.fn(),
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
  useChainedFxPreview,
} from './useChainedFxPreview'

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

describe('useChainedFxPreview pipeline', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    registryCalls.length = 0
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
})
