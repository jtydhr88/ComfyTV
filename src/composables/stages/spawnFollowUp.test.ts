import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { app } from '@/lib/comfyApp'
import { useStageStore } from '@/stores/stageStore'

const assetStoreMock = vi.hoisted(() => ({
  hydrate: vi.fn(async () => {}),
  byPayloadUrl: vi.fn((_url: string): any => undefined),
  create: vi.fn(async (_opts: any): Promise<any> => null),
}))

const loaderMock = vi.hoisted(() => ({
  createAssetLoaderNode: vi.fn((_asset: any, _pos: any): any => ({ id: 42 })),
}))

vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => assetStoreMock }))
vi.mock('@/composables/stages/assetLoaderNode', () => loaderMock)
vi.mock('@/composables/widgets/useProxiedVideoUrl', () => ({
  autoProxyOutput: vi.fn(async () => {}),
}))

import {
  outputHasLinks,
  setWidget,
  spawnConsumingNode,
  spawnAssetImageLoader,
  spawnFollowUpStage,
} from './spawnFollowUp'

const DEFAULT_INPUT_NAMES = [
  'image',
  'video',
  'panorama',
  'texts.text0',
  'images.image0',
  'videos.video0',
  'models.model0',
]

let nextId = 1
let created: any[] = []
let inputsByClass: Record<string, string[]> = {}
let onCreated: ((node: any) => void) | null = null

function makeNode(over: Record<string, any> = {}): any {
  return {
    id: nextId++,
    comfyClass: 'X',
    pos: [100, 200],
    size: [280, 260],
    inputs: [],
    outputs: [{ name: 'out', links: [] }],
    widgets: [
      { name: 'workflow', value: '' },
      { name: 'main_prompt', value: '' },
      { name: 'variant_count', value: 0 },
      { name: 'parent_output_id', value: 0 },
      { name: 'view_count', value: 0 },
    ],
    connect: vi.fn(),
    ...over,
  }
}

function widgetValue(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name)?.value
}

beforeEach(() => {
  setActivePinia(createPinia())
  created = []
  inputsByClass = {}
  onCreated = null
  vi.clearAllMocks()
  assetStoreMock.byPayloadUrl.mockReturnValue(undefined)
  assetStoreMock.create.mockResolvedValue(null)
  loaderMock.createAssetLoaderNode.mockReturnValue({ id: 42 })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as any).LiteGraph = {
    createNode: vi.fn((cls: string) => {
      const names = inputsByClass[cls] ?? DEFAULT_INPUT_NAMES
      const node = makeNode({
        comfyClass: cls,
        inputs: names.map((n) => ({ name: n, link: null })),
      })
      created.push(node)
      onCreated?.(node)
      return node
    }),
  }
})

afterEach(() => {
  delete (window as any).LiteGraph
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('outputHasLinks', () => {
  it('returns true when the output slot has links', () => {
    const node = { outputs: [{ name: 'out', links: [3] }] }
    expect(outputHasLinks(node, 0)).toBe(true)
  })

  it('returns false for empty links', () => {
    const node = { outputs: [{ name: 'out', links: [] }] }
    expect(outputHasLinks(node, 0)).toBe(false)
  })

  it('returns false for missing output slot', () => {
    expect(outputHasLinks({ outputs: [] }, 2)).toBe(false)
  })

  it('returns false for null node', () => {
    expect(outputHasLinks(null, 0)).toBe(false)
  })
})

describe('setWidget', () => {
  it('sets the matching widget value', () => {
    const node = makeNode()
    setWidget(node, 'workflow', 'W1')
    expect(widgetValue(node, 'workflow')).toBe('W1')
  })

  it('ignores unknown widget names', () => {
    const node = makeNode()
    expect(() => setWidget(node, 'nope', 1)).not.toThrow()
  })

  it('tolerates nodes without widgets', () => {
    expect(() => setWidget({}, 'workflow', 1)).not.toThrow()
  })
})

describe('spawnConsumingNode', () => {
  it('creates the target, positions it right of the source and wires the slot', () => {
    const src = makeNode()
    const node = spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'image')
    expect(node).toBe(created[0])
    expect((app as any).graph.add).toHaveBeenCalledWith(node)
    expect(node.pos).toEqual([440, 200])
    expect(src.connect).toHaveBeenCalledWith(0, node, 0)
  })

  it('uses fallback position when source has no pos or size', () => {
    const src = makeNode({ pos: undefined, size: undefined })
    const node = spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'image')
    expect(node.pos).toEqual([340, 0])
  })

  it('passes a custom source slot', () => {
    const src = makeNode()
    const node = spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'video', 2)
    expect(src.connect).toHaveBeenCalledWith(2, node, 1)
  })

  it('stamps parent_output_id when the source stage has an output id', () => {
    const store = useStageStore()
    const src = makeNode()
    const state = store.registerStage(src, 'image')
    state.outputId = 7
    const node = spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'image')
    expect(widgetValue(node, 'parent_output_id')).toBe(7)
  })

  it('leaves parent_output_id untouched without lineage', () => {
    const src = makeNode()
    const node = spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'image')
    expect(widgetValue(node, 'parent_output_id')).toBe(0)
  })

  it('warns and returns the node when the input slot is missing', () => {
    inputsByClass['ComfyTV.PanoramaStage'] = ['other']
    const src = makeNode()
    const node = spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'image')
    expect(node).toBe(created[0])
    expect(src.connect).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })

  it('returns null when LiteGraph is not available', () => {
    delete (window as any).LiteGraph
    const src = makeNode()
    expect(spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'image')).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })

  it('returns null when createNode yields null', () => {
    ;(window as any).LiteGraph.createNode = vi.fn(() => null)
    const src = makeNode()
    expect(spawnConsumingNode(src, 'ComfyTV.PanoramaStage', 'image')).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('spawnFollowUpStage default path', () => {
  it('spawns a same-kind stage and wires the autogrow slot', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'text', 'anything')
    expect((window as any).LiteGraph.createNode)
      .toHaveBeenCalledWith('ComfyTV.TextStage')
    const node = created[0]
    expect(src.connect).toHaveBeenCalledWith(0, node, 3)
  })

  it('stamps lineage on the follow-up node', () => {
    const store = useStageStore()
    const src = makeNode()
    const state = store.registerStage(src, 'video')
    state.outputId = 11
    spawnFollowUpStage(src, 'video', 'unknown-action')
    expect(widgetValue(created[0], 'parent_output_id')).toBe(11)
  })

  it('warns when the new node lacks the autogrow group', () => {
    inputsByClass['ComfyTV.ImageStage'] = ['foo']
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'not-a-real-action')
    expect(src.connect).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })

  it('bails out when node creation fails', () => {
    ;(window as any).LiteGraph.createNode = vi.fn(() => null)
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'not-a-real-action')
    expect(src.connect).not.toHaveBeenCalled()
  })
})

describe('spawnFollowUpStage image handlers', () => {
  it('panorama action spawns a PanoramaStage from slot 0', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'panorama')
    expect((window as any).LiteGraph.createNode)
      .toHaveBeenCalledWith('ComfyTV.PanoramaStage')
    expect(src.connect).toHaveBeenCalledWith(0, created[0], 0)
  })

  it('multiangle action spawns a MultiangleStage', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'multiangle')
    expect((window as any).LiteGraph.createNode)
      .toHaveBeenCalledWith('ComfyTV.MultiangleStage')
  })

  it('material action spawns a MaterialStage', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'material')
    expect((window as any).LiteGraph.createNode)
      .toHaveBeenCalledWith('ComfyTV.MaterialStage')
  })

  it('image-batch handlers use source slot 1', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'image-batch', 'panorama')
    expect(src.connect).toHaveBeenCalledWith(1, created[0], 0)
  })

  it('variant preset spawns target class and seeds widgets', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'preset:face-3view')
    const node = created[0]
    expect(node.comfyClass).toBe('ComfyTV.ImageVariationsStage')
    expect(src.connect).toHaveBeenCalledWith(0, node, 0)
    expect(widgetValue(node, 'workflow')).toBe('Face 3-View')
    expect(widgetValue(node, 'variant_count')).toBe(3)
  })

  it('edit preset spawns the edit target class', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'edit:hd')
    expect(created[0].comfyClass).toBe('ComfyTV.UpscaleStage')
    expect(src.connect).toHaveBeenCalledWith(0, created[0], 0)
  })

  it('warns when preset target has no matching slot', () => {
    inputsByClass['ComfyTV.ImageVariationsStage'] = ['other']
    const src = makeNode()
    spawnFollowUpStage(src, 'image', 'preset:face-3view')
    expect(src.connect).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })

  it('mirrors main_prompt into registered stage state', () => {
    const store = useStageStore()
    const src = makeNode()
    onCreated = (n) => { store.registerStage(n, 'image') }
    spawnFollowUpStage(src, 'image', 'preset:cinematic-light')
    const state = store.getStage(created[0])
    expect(state?.mainPrompt).toContain('cinematic key light')
    expect(widgetValue(created[0], 'main_prompt'))
      .toContain('cinematic key light')
  })
})

describe('spawnFollowUpStage model handlers', () => {
  it('product-shot spawns an ImageEditStage from slot 1 with prompt', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'model', 'product-shot')
    const node = created[0]
    expect(node.comfyClass).toBe('ComfyTV.ImageEditStage')
    expect(src.connect).toHaveBeenCalledWith(1, node, 0)
    expect(widgetValue(node, 'workflow')).toBe('Qwen Edit 2511')
    expect(widgetValue(node, 'main_prompt')).toContain('product')
  })
})

describe('spawnFollowUpStage video handlers', () => {
  it('extend spawns extract-frame plus a new VideoStage chained together', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'video', 'extend')
    const [extract, video] = created
    expect(extract.comfyClass).toBe('ComfyTV.VideoExtractFrameStage')
    expect(video.comfyClass).toBe('ComfyTV.VideoStage')
    expect(src.connect).toHaveBeenCalledWith(0, extract, 1)
    expect(extract.connect).toHaveBeenCalledWith(0, video, 4)
  })

  it('extend stops when the extract node cannot be created', () => {
    ;(window as any).LiteGraph.createNode = vi.fn(() => null)
    const src = makeNode()
    spawnFollowUpStage(src, 'video', 'extend')
    expect(created).toHaveLength(0)
  })

  it('change preset spawns its target and wires the video socket', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'video', 'change:clip')
    expect(created[0].comfyClass).toBe('ComfyTV.VideoClipStage')
    expect(src.connect).toHaveBeenCalledWith(0, created[0], 1)
  })

  it('autogrow preset wires the first group slot', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'video', 'change:concat')
    expect(created[0].comfyClass).toBe('ComfyTV.VideoConcatStage')
    expect(src.connect).toHaveBeenCalledWith(0, created[0], 5)
  })

  it('demux spawns both targets stacked vertically', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'video', 'change:demux')
    const [a, b] = created
    expect(a.comfyClass).toBe('ComfyTV.AudioVideoDemuxAudioStage')
    expect(b.comfyClass).toBe('ComfyTV.AudioVideoDemuxVideoStage')
    expect(a.pos).toEqual([440, 200])
    expect(b.pos).toEqual([440, 520])
    expect(src.connect).toHaveBeenCalledWith(0, a, 1)
    expect(src.connect).toHaveBeenCalledWith(0, b, 1)
  })
})

describe('spawnFollowUpStage panorama handlers', () => {
  it('view-current spawns a current-view stage', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'panorama', 'view-current')
    expect(created[0].comfyClass).toBe('ComfyTV.PanoramaCurrentViewStage')
    expect(src.connect).toHaveBeenCalledWith(0, created[0], 2)
  })

  it('view-four spawns a multi-view stage with view_count 4', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'panorama', 'view-four')
    expect(created[0].comfyClass).toBe('ComfyTV.PanoramaMultiViewStage')
    expect(widgetValue(created[0], 'view_count')).toBe(4)
  })

  it('view-twelve sets view_count 12', () => {
    const src = makeNode()
    spawnFollowUpStage(src, 'panorama', 'view-twelve')
    expect(widgetValue(created[0], 'view_count')).toBe(12)
  })
})

describe('relight handler', () => {
  it('spawns relight plus image stage and wires slots when present', () => {
    const src = makeNode()
    inputsByClass['ComfyTV.ImageStage'] = ['images.image0', 'images.image1']
    spawnFollowUpStage(src, 'image', 'relight')
    const [relight, img] = created
    expect(relight.comfyClass).toBe('ComfyTV.RelightStage')
    expect(img.comfyClass).toBe('ComfyTV.ImageStage')
    expect(widgetValue(img, 'workflow')).toBe('Flux2 Klein Relight')
    expect(src.connect).toHaveBeenCalledWith(0, img, 0)
    expect(relight.connect).toHaveBeenCalledWith(0, img, 1)
  })

  it('retries until the second autogrow slot appears', () => {
    vi.useFakeTimers()
    const src = makeNode()
    inputsByClass['ComfyTV.ImageStage'] = ['images.image0']
    spawnFollowUpStage(src, 'image', 'relight')
    const [relight, img] = created
    expect(relight.connect).not.toHaveBeenCalled()
    img.inputs.push({ name: 'images.image1', link: null })
    vi.advanceTimersByTime(50)
    expect(relight.connect).toHaveBeenCalledWith(0, img, 1)
  })

  it('gives up after repeated retries and warns', () => {
    vi.useFakeTimers()
    const src = makeNode()
    inputsByClass['ComfyTV.ImageStage'] = ['images.image0']
    spawnFollowUpStage(src, 'image', 'relight')
    const [relight] = created
    vi.runAllTimers()
    expect(relight.connect).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      '[ComfyTV/relight] images.image1 never appeared on new ImageStage')
  })

  it('warns when the image stage lacks the images autogrow group', () => {
    vi.useFakeTimers()
    const src = makeNode()
    inputsByClass['ComfyTV.ImageStage'] = ['foo']
    spawnFollowUpStage(src, 'image', 'relight')
    expect(src.connect).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      '[ComfyTV/relight] new ImageStage has no images autogrow slot')
  })
})

describe('spawnAssetImageLoader', () => {
  it('reuses an existing library asset by payload url', async () => {
    const asset = { id: 1, media_type: 'image', payload_url: 'http://x/a.png', category_ids: [] }
    assetStoreMock.byPayloadUrl.mockReturnValue(asset)
    const src = makeNode()
    await spawnAssetImageLoader(src, 'http://x/a.png', 'label')
    expect(assetStoreMock.hydrate).toHaveBeenCalled()
    expect(assetStoreMock.create).not.toHaveBeenCalled()
    expect(loaderMock.createAssetLoaderNode)
      .toHaveBeenCalledWith(asset, [440, 200])
  })

  it('creates a new asset when none matches', async () => {
    const asset = { id: 2, media_type: 'video', payload_url: 'http://x/b.mp4', category_ids: [] }
    assetStoreMock.create.mockResolvedValue(asset)
    const src = makeNode()
    await spawnAssetImageLoader(src, 'http://x/b.mp4', 'My clip', 'video')
    expect(assetStoreMock.create).toHaveBeenCalledWith({
      name: 'My clip',
      payload_url: 'http://x/b.mp4',
      media_type: 'video',
      category_ids: [],
    })
    expect(loaderMock.createAssetLoaderNode)
      .toHaveBeenCalledWith(asset, [440, 200])
  })

  it('falls back to the media type as name when label omitted', async () => {
    const asset = { id: 3, media_type: 'image', payload_url: 'u', category_ids: [] }
    assetStoreMock.create.mockResolvedValue(asset)
    await spawnAssetImageLoader(makeNode(), 'u')
    expect(assetStoreMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'image' }))
  })

  it('logs an error when the asset cannot be created', async () => {
    assetStoreMock.create.mockResolvedValue(null)
    await spawnAssetImageLoader(makeNode(), 'http://x/c.png')
    expect(console.error).toHaveBeenCalled()
    expect(loaderMock.createAssetLoaderNode).not.toHaveBeenCalled()
  })

  it('stops silently when the loader node cannot be created', async () => {
    const asset = { id: 4, media_type: 'image', payload_url: 'v', category_ids: [] }
    assetStoreMock.byPayloadUrl.mockReturnValue(asset)
    loaderMock.createAssetLoaderNode.mockReturnValue(null)
    await expect(spawnAssetImageLoader(makeNode(), 'v')).resolves.toBeUndefined()
  })
})
