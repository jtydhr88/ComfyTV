import { IMAGE_VARIANT_PRESETS, type ImagePreset } from '@/composables/stages/imagePresets'
import { IMAGE_EDIT_PRESETS } from '@/composables/stages/imageEditPresets'
import { VIDEO_CHANGE_PRESETS } from '@/composables/stages/videoChangePresets'
import { useStageStore, type StageKind, type ImagePickContext } from '@/stores/stageStore'
import { useAssetStore } from '@/stores/assetStore'
import { createAssetLoaderNode } from '@/composables/stages/assetLoaderNode'
import { app } from '@/lib/comfyApp'

const STAGE_CLASS_BY_KIND: Record<StageKind, string> = {
  text:           'ComfyTV.TextStage',
  image:          'ComfyTV.ImageStage',
  video:          'ComfyTV.VideoStage',
  audio:          'ComfyTV.AudioStage',
  panorama:       'ComfyTV.PanoramaStage',
  storyboard:     'ComfyTV.StoryboardStage',
  'image-batch':  'ComfyTV.ShotImagesStage',
  'image-picker': 'ComfyTV.ImagePickerStage',
  'audio-picker': 'ComfyTV.AudioPickerStage',
  'video-picker': 'ComfyTV.VideoPickerStage',
  timeline:       'ComfyTV.DirectorTimelineStage',
  model:          'ComfyTV.Model3DStage',
  material:       'ComfyTV.MaterialStage',
}

const TARGET_GROUP_BY_KIND: Record<StageKind, 'texts' | 'images' | 'videos' | 'models'> = {
  text:           'texts',
  image:          'images',
  video:          'videos',
  audio:          'videos',
  panorama:       'images',
  storyboard:     'texts',
  'image-batch':  'images',
  'image-picker': 'images',
  'audio-picker': 'videos',
  'video-picker': 'videos',
  timeline:       'images',
  model:          'models',
  material:       'images',
}

export function findFirstAutogrowSlot(node: any, groupPrefix: string): number {
  if (!node.inputs) return -1
  for (let i = 0; i < node.inputs.length; i++) {
    const n = String(node.inputs[i].name || '')
    if (n.startsWith(groupPrefix + '.')) return i
  }
  return -1
}

export function findNamedSlot(node: any, name: string): number {
  if (!node.inputs) return -1
  for (let i = 0; i < node.inputs.length; i++) {
    if (String(node.inputs[i].name || '') === name) return i
  }
  return -1
}

export function outputHasLinks(node: any, idx: number): boolean {
  const out = node?.outputs?.[idx]
  return !!(out?.links && out.links.length > 0)
}

export function createNodeAt(targetClass: string, pos: [number, number]): any | null {
  const win = window as any
  if (!win.LiteGraph?.createNode) {
    console.error('[ComfyTV/action] LiteGraph.createNode not available')
    return null
  }
  const node = win.LiteGraph.createNode(targetClass)
  if (!node) {
    console.error('[ComfyTV/action] createNode returned null for', targetClass)
    return null
  }
  ;(app as any)?.graph?.add(node)
  node.pos = pos
  return node
}

function posRightOf(srcNode: any, dx: number = 60): [number, number] {
  return [
    (srcNode.pos?.[0] || 0) + (srcNode.size?.[0] || 280) + dx,
    srcNode.pos?.[1] || 0,
  ]
}

export function setWidget(node: any, name: string, value: any) {
  const w = node.widgets?.find((wi: any) => wi.name === name)
  if (w) w.value = value
}

function stampLineage(srcNode: any, newNode: any) {
  const store = useStageStore()
  const srcState = store.getStage(srcNode)
  const parentId = srcState?.outputId
  if (parentId != null && parentId > 0) {
    setWidget(newNode, 'parent_output_id', parentId)
  }
}

function wireAndSeed(srcNode: any, newNode: any, preset: ImagePreset, srcSlot: number = 0) {
  const store = useStageStore()

  let slot = -1
  if (preset.inputSocket) {
    slot = findNamedSlot(newNode, preset.inputSocket)
  } else if (preset.inputAutogrowGroup) {
    slot = findFirstAutogrowSlot(newNode, preset.inputAutogrowGroup)
  }
  if (slot < 0) {
    console.warn('[ComfyTV/preset]', preset.id, 'no target slot on',
                 newNode.comfyClass, 'inputs=', newNode.inputs?.map((i: any) => i.name))
  } else {
    srcNode.connect(srcSlot, newNode, slot)
  }

  if (preset.widgets) {
    for (const [name, value] of Object.entries(preset.widgets)) {
      setWidget(newNode, name, value)
    }
    if ('main_prompt' in preset.widgets) {
      const state = store.getStage(newNode)
      if (state) state.mainPrompt = String(preset.widgets.main_prompt ?? '')
    }
  }

  stampLineage(srcNode, newNode)
}

function spawnImagePreset(srcNode: any, preset: ImagePreset, srcSlot: number = 0) {
  const store = useStageStore()

  if (preset.multiTargetClasses && preset.multiTargetClasses.length) {
    const baseX = (srcNode.pos?.[0] || 0) + (srcNode.size?.[0] || 280) + 60
    const baseY = srcNode.pos?.[1] || 0
    const rowGap = 60
    let rowY = baseY
    preset.multiTargetClasses.forEach((cls, i) => {
      const newNode = createNodeAt(cls, [baseX, rowY])
      if (!newNode) return
      wireAndSeed(srcNode, newNode, preset, srcSlot)
      rowY += (newNode.size?.[1] || 260) + rowGap
    })
    store.notifyDownstream()
    return
  }

  const targetClass = preset.targetClass ?? STAGE_CLASS_BY_KIND.image
  const newNode = createNodeAt(targetClass, posRightOf(srcNode))
  if (!newNode) return
  wireAndSeed(srcNode, newNode, preset, srcSlot)
  store.notifyDownstream()
}

export function spawnConsumingNode(srcNode: any, targetClass: string, inputSlotName: string, srcSlot: number = 0) {
  const newNode = createNodeAt(targetClass, posRightOf(srcNode))
  if (!newNode) return null
  const slot = findNamedSlot(newNode, inputSlotName)
  if (slot < 0) {
    console.warn('[ComfyTV/action] target', targetClass, 'has no', inputSlotName, 'slot',
                 'inputs=', newNode.inputs?.map((i: any) => i.name))
    return newNode
  }
  srcNode.connect(srcSlot, newNode, slot)
  stampLineage(srcNode, newNode)
  return newNode
}

const RELIGHT_WORKFLOW_LABEL = 'Flux2 Klein Relight'

function spawnRelightPair(srcNode: any, srcSlot: number) {
  const store = useStageStore()

  const relight = createNodeAt('ComfyTV.RelightStage', posRightOf(srcNode))
  if (!relight) return

  const img = createNodeAt('ComfyTV.ImageStage', posRightOf(relight))
  if (!img) return
  setWidget(img, 'workflow', RELIGHT_WORKFLOW_LABEL)

  const s0 = findFirstAutogrowSlot(img, 'images')
  if (s0 >= 0) {
    srcNode.connect(srcSlot, img, s0)
  } else {
    console.warn('[ComfyTV/relight] new ImageStage has no images autogrow slot')
  }

  const wireSecond = (attempt = 0) => {
    const s1 = findNamedSlot(img, 'images.image1')
    if (s1 >= 0) {
      relight.connect(0, img, s1)
      store.notifyDownstream()
      return
    }
    if (attempt < 10) setTimeout(() => wireSecond(attempt + 1), 50)
    else console.warn('[ComfyTV/relight] images.image1 never appeared on new ImageStage')
  }
  wireSecond()

  stampLineage(srcNode, img)
  store.notifyDownstream()
}

function spawnExtendVideo(srcNode: any) {
  const store = useStageStore()
  const extract = createNodeAt('ComfyTV.VideoExtractFrameStage', posRightOf(srcNode))
  if (!extract) return
  const extractInSlot = findNamedSlot(extract, 'video')
  if (extractInSlot >= 0) srcNode.connect(0, extract, extractInSlot)
  stampLineage(srcNode, extract)

  const newVideo = createNodeAt('ComfyTV.VideoStage', posRightOf(extract))
  if (!newVideo) return
  const imageSlot = findFirstAutogrowSlot(newVideo, 'images')
  if (imageSlot >= 0) extract.connect(0, newVideo, imageSlot)
  stampLineage(srcNode, newVideo)

  store.notifyDownstream()
}


function spawnPanoramaView(srcNode: any, mode: 'current' | 'four' | 'twelve') {
  if (mode === 'current') {
    spawnConsumingNode(srcNode, 'ComfyTV.PanoramaCurrentViewStage', 'panorama')
    return
  }
  const node = spawnConsumingNode(srcNode, 'ComfyTV.PanoramaMultiViewStage', 'panorama')
  if (!node) return
  setWidget(node, 'view_count', mode === 'four' ? 4 : 12)
}

export async function spawnAssetImageLoader(srcNode: any, url: string, label?: string, mediaType: string = 'image') {
  const assetStore = useAssetStore()
  await assetStore.hydrate()
  let asset = assetStore.byPayloadUrl(url) ?? null
  if (!asset) {
    asset = await assetStore.create({
      name: label || mediaType,
      payload_url: url,
      media_type: mediaType,
      category_ids: [],
    })
  }
  if (!asset) {
    console.error('[ComfyTV/action] load-asset: could not add', mediaType, 'to library', url)
    return
  }
  const newNode = createAssetLoaderNode(asset, posRightOf(srcNode))
  if (!newNode) return
  useStageStore().notifyDownstream()
}

type SpawnHandler = (srcNode: any, context?: ImagePickContext) => void

function makeImageActionHandlers(srcSlot: number): Record<string, SpawnHandler> {
  return {
    'panorama':   src => spawnConsumingNode(src, 'ComfyTV.PanoramaStage',   'image', srcSlot),
    'multiangle': src => spawnConsumingNode(src, 'ComfyTV.MultiangleStage', 'image', srcSlot),
    'relight':    src => spawnRelightPair(src, srcSlot),
    'material':   src => spawnConsumingNode(src, 'ComfyTV.MaterialStage',   'image', srcSlot),
    ...Object.fromEntries(
      IMAGE_VARIANT_PRESETS.map(p => [
        `preset:${p.id}`,
        (src: any) => spawnImagePreset(src, p, srcSlot),
      ]),
    ),
    ...Object.fromEntries(
      IMAGE_EDIT_PRESETS.map(p => [
        `edit:${p.id}`,
        (src: any) => spawnImagePreset(src, p, srcSlot),
      ]),
    ),
  }
}

const imageActionHandlers      = makeImageActionHandlers(0)
const imageBatchActionHandlers = makeImageActionHandlers(1)

const PRODUCT_SHOT_PRESET: ImagePreset = {
  id: 'product-shot',
  icon: 'pi pi-camera',
  category: 'imageVariant',
  targetClass: 'ComfyTV.ImageEditStage',
  inputSocket: 'image',
  widgets: {
    workflow: 'Qwen Edit 2511',
    main_prompt: "Turn this 3D viewport render into a professional product "
      + 'photograph on a clean light-gray studio backdrop with soft diffused '
      + "lighting and a subtle ground reflection. Keep the subject's colors, "
      + 'materials and pose exactly as they are.',
  },
}

const SPAWN_HANDLERS: Partial<Record<StageKind, Record<string, SpawnHandler>>> = {
  image: imageActionHandlers,
  'image-picker': imageActionHandlers,
  'image-batch': imageBatchActionHandlers,
  model: {
    'product-shot': src => spawnImagePreset(src, PRODUCT_SHOT_PRESET, 1),
  },
  video: {
    'extend': src => spawnExtendVideo(src),
    ...Object.fromEntries(
      VIDEO_CHANGE_PRESETS.map(p => [
        `change:${p.id}`,
        (src: any) => spawnImagePreset(src, p),
      ]),
    ),
  },
  panorama: {
    'view-current': src => spawnPanoramaView(src, 'current'),
    'view-four':    src => spawnPanoramaView(src, 'four'),
    'view-twelve':  src => spawnPanoramaView(src, 'twelve'),
  },
}

export function spawnFollowUpStage(
  srcNode: any,
  srcKind: StageKind,
  actionId: string,
  context?: ImagePickContext,
) {
  const handler = SPAWN_HANDLERS[srcKind]?.[actionId]
  if (handler) {
    handler(srcNode, context)
    return
  }

  const targetClass = STAGE_CLASS_BY_KIND[srcKind]
  const targetGroup = TARGET_GROUP_BY_KIND[srcKind]

  const newNode = createNodeAt(targetClass, posRightOf(srcNode))
  if (!newNode) return

  const targetSlot = findFirstAutogrowSlot(newNode, targetGroup)
  if (targetSlot < 0) {
    console.warn('[ComfyTV/action] no autogrow slot for', targetGroup,
                 'on new', targetClass,
                 'inputs=', newNode.inputs?.map((i: any) => i.name))
    return
  }
  srcNode.connect(0, newNode, targetSlot)
  stampLineage(srcNode, newNode)
}

