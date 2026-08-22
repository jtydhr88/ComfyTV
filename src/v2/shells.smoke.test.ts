import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'

vi.mock('@/components/stages/ModelPreview.vue', () => ({
  default: defineComponent({ name: 'ModelPreviewStub', render: () => null }),
}))
vi.mock('@/components/stages/VideoColorStageCard.vue', () => ({
  default: defineComponent({ name: 'VideoColorStub', render: () => null }),
}))
vi.mock('@/components/stages/VideoCurvesStageCard.vue', () => ({
  default: defineComponent({ name: 'VideoCurvesStub', render: () => null }),
}))
vi.mock('@/components/stages/RelightStageCard.vue', () => ({
  default: defineComponent({ name: 'RelightStub', render: () => null }),
}))
vi.mock('@/components/stages/Scene3DStageCard.vue', () => ({
  default: defineComponent({ name: 'Scene3DStub', render: () => null }),
}))
vi.mock('@/components/ExecutionStatusBar.vue', () => ({
  default: defineComponent({ name: 'StatusBarStub', render: () => null }),
}))
vi.mock('@/components/dialog/ComfyTVDialog.vue', () => ({
  default: defineComponent({ name: 'DialogStub', render: () => null }),
}))
vi.mock('@/components/LightboxHost.vue', () => ({
  default: defineComponent({ name: 'LightboxStub', render: () => null }),
}))
vi.mock('@/components/widgets/VideoPlayerLite.vue', () => ({
  default: defineComponent({
    name: 'VideoPlayerLiteStub',
    setup(_, { expose }) {
      expose({ videoEl: null })
      return () => null
    },
  }),
}))
vi.mock('@/components/widgets/ProxiedVideo.vue', () => ({
  default: defineComponent({ name: 'ProxiedVideoStub', render: () => null }),
}))

import ComfyTVMountHost from '@/components/ComfyTVMountHost.vue'
import { mounts } from '@/composables/stages/widgetMounts'
import { i18n } from '@/i18n'
import { app } from '@/lib/comfyApp'
import type { StageKind, StageVariant } from '@/stores/stageStore'
import { V2_SHELLS } from '@/v2/registry'
import '@/v2/imageBatchShell'
import '@/v2/poolPickersV2'
import '@/v2/cropV2'
import '@/v2/transformV2'
import '@/v2/videoFxChainConfigs'
import '@/v2/videoFxToolConfigs'
import '@/v2/audioFxV2'
import '@/v2/richV2'
import '@/v2/scene3dV2'
import '@/v2/relightV2'
import '@/v2/loadersV2'
import '@/v2/generatorV2'

interface Meta {
  kind: StageKind
  variant?: StageVariant
}

const SHELL_META: Record<string, Meta> = {
  'ComfyTV.ImageStage': { kind: 'image-batch' },
  'ComfyTV.ShotImagesStage': { kind: 'image-batch' },
  'ComfyTV.ImageVariationsStage': { kind: 'image-batch' },
  'ComfyTV.ImagePickerStage': { kind: 'image-picker' },
  'ComfyTV.VideoPickerStage': { kind: 'video-picker' },
  'ComfyTV.AudioPickerStage': { kind: 'audio-picker' },
  'ComfyTV.CropStage': { kind: 'image', variant: 'transform' },
  'ComfyTV.RotateStage': { kind: 'image', variant: 'transform' },
  'ComfyTV.MirrorStage': { kind: 'image', variant: 'transform' },
  'ComfyTV.ColorGradeStage': { kind: 'image', variant: 'transform' },
  'ComfyTV.CompareStage': { kind: 'image', variant: 'transform' },
  'ComfyTV.GridSplitStage': { kind: 'image-batch', variant: 'transform' },
  'ComfyTV.VideoColorStage': { kind: 'video' },
  'ComfyTV.VideoCurvesStage': { kind: 'video' },
  'ComfyTV.VideoLUTStage': { kind: 'video' },
  'ComfyTV.SelectiveColorStage': { kind: 'video' },
  'ComfyTV.CDLStage': { kind: 'video' },
  'ComfyTV.HistogramEqStage': { kind: 'video' },
  'ComfyTV.GrayWorldStage': { kind: 'video' },
  'ComfyTV.PseudocolorStage': { kind: 'video' },
  'ComfyTV.HueCorrectStage': { kind: 'video' },
  'ComfyTV.Select0rStage': { kind: 'video' },
  'ComfyTV.KeyerStage': { kind: 'video' },
  'ComfyTV.PIKStage': { kind: 'video' },
  'ComfyTV.DespillStage': { kind: 'video' },
  'ComfyTV.ColorSuppressStage': { kind: 'video' },
  'ComfyTV.MatteMorphStage': { kind: 'video' },
  'ComfyTV.ShapeMaskStage': { kind: 'video' },
  'ComfyTV.LensDistortStage': { kind: 'video' },
  'ComfyTV.ChromaticAberrationStage': { kind: 'video' },
  'ComfyTV.LensFlareStage': { kind: 'video' },
  'ComfyTV.GlowStage': { kind: 'video' },
  'ComfyTV.GodRaysStage': { kind: 'video' },
  'ComfyTV.VideoBlurSharpenStage': { kind: 'video' },
  'ComfyTV.VideoDenoiseStage': { kind: 'video' },
  'ComfyTV.VideoDeinterlaceStage': { kind: 'video' },
  'ComfyTV.PosterizeStage': { kind: 'video' },
  'ComfyTV.OldFilmStage': { kind: 'video' },
  'ComfyTV.ArtFXStage': { kind: 'video' },
  'ComfyTV.GlitchFXStage': { kind: 'video' },
  'ComfyTV.KaleidoscopeStage': { kind: 'video' },
  'ComfyTV.WaveWarpStage': { kind: 'video' },
  'ComfyTV.StrobeStage': { kind: 'video' },
  'ComfyTV.FeedbackFXStage': { kind: 'video' },
  'ComfyTV.RegrainStage': { kind: 'video' },
  'ComfyTV.VideoStylizeStage': { kind: 'video' },
  'ComfyTV.ChromaShiftStage': { kind: 'video' },
  'ComfyTV.VideoTransformStage': { kind: 'video' },
  'ComfyTV.Video360Stage': { kind: 'video' },
  'ComfyTV.Card3DStage': { kind: 'video' },
  'ComfyTV.ParticlesStage': { kind: 'video' },
  'ComfyTV.WaterStage': { kind: 'video' },
  'ComfyTV.LightGraffitiStage': { kind: 'video' },
  'ComfyTV.VideoClipStage': { kind: 'video' },
  'ComfyTV.VideoCropStage': { kind: 'video' },
  'ComfyTV.VideoSplitStage': { kind: 'video' },
  'ComfyTV.VideoConcatStage': { kind: 'video' },
  'ComfyTV.VideoSpeedStage': { kind: 'video' },
  'ComfyTV.VideoRotateStage': { kind: 'video' },
  'ComfyTV.VideoVolumeStage': { kind: 'video' },
  'ComfyTV.VideoMuxAudioStage': { kind: 'video' },
  'ComfyTV.VideoResizeStage': { kind: 'video' },
  'ComfyTV.VideoFramesStage': { kind: 'image-batch' },
  'ComfyTV.TimeRemapStage': { kind: 'video' },
  'ComfyTV.SequenceStage': { kind: 'video' },
  'ComfyTV.SceneDetectStage': { kind: 'image-batch' },
  'ComfyTV.VideoChromaKeyStage': { kind: 'video' },
  'ComfyTV.VideoCompositeStage': { kind: 'video' },
  'ComfyTV.CornerPinStage': { kind: 'video' },
  'ComfyTV.RotoMaskStage': { kind: 'video' },
  'ComfyTV.KeyMixStage': { kind: 'video' },
  'ComfyTV.MatteMonitorStage': { kind: 'video' },
  'ComfyTV.MaskPropagateStage': { kind: 'video' },
  'ComfyTV.PaintStrokeStage': { kind: 'video' },
  'ComfyTV.STMapStage': { kind: 'video' },
  'ComfyTV.STMapGenStage': { kind: 'image' },
  'ComfyTV.ZDefocusStage': { kind: 'video' },
  'ComfyTV.FrameBlendStage': { kind: 'video' },
  'ComfyTV.VideoTransitionStage': { kind: 'video' },
  'ComfyTV.VideoLumaWipeStage': { kind: 'video' },
  'ComfyTV.VideoStabilizeStage': { kind: 'video' },
  'ComfyTV.VideoStabilizeV2Stage': { kind: 'video' },
  'ComfyTV.Video360StabilizeStage': { kind: 'video' },
  'ComfyTV.VideoInterpolateStage': { kind: 'video' },
  'ComfyTV.FaceBlurStage': { kind: 'video' },
  'ComfyTV.SpotRemoverStage': { kind: 'video' },
  'ComfyTV.VideoScopesStage': { kind: 'image' },
  'ComfyTV.ContactSheetStage': { kind: 'image' },
  'ComfyTV.AudioMeterStage': { kind: 'video' },
  'ComfyTV.TitleStage': { kind: 'video' },
  'ComfyTV.SubtitleStage': { kind: 'video' },
  'ComfyTV.AnnotateStage': { kind: 'video' },
  'ComfyTV.KenBurnsStage': { kind: 'video' },
  'ComfyTV.SlitScanStage': { kind: 'video' },
  'ComfyTV.FXChainStage': { kind: 'video' },
  'ComfyTV.RelightStage': { kind: 'image', variant: 'loader' },
  'ComfyTV.Scene3DStage': { kind: 'image', variant: 'loader' },
  'ComfyTV.TextLoaderStage': { kind: 'text', variant: 'loader' },
  'ComfyTV.ImageLoaderStage': { kind: 'image', variant: 'loader' },
  'ComfyTV.VideoLoaderStage': { kind: 'video', variant: 'loader' },
  'ComfyTV.AudioLoaderStage': { kind: 'audio', variant: 'loader' },
  'ComfyTV.AssetImageLoaderStage': { kind: 'image', variant: 'loader' },
  'ComfyTV.AssetVideoLoaderStage': { kind: 'video', variant: 'loader' },
  'ComfyTV.AssetAudioLoaderStage': { kind: 'audio', variant: 'loader' },
  'ComfyTV.AssetModelLoaderStage': { kind: 'model', variant: 'loader' },
  'ComfyTV.TextStage': { kind: 'text' },
  'ComfyTV.SubtitleGenStage': { kind: 'text' },
  'ComfyTV.VideoStage': { kind: 'video' },
  'ComfyTV.VideoUpscaleStage': { kind: 'video' },
  'ComfyTV.AudioStage': { kind: 'audio' },
  'ComfyTV.SpeechStage': { kind: 'audio' },
  'ComfyTV.AudioExtractVocalStage': { kind: 'audio' },
  'ComfyTV.AudioExtractBgStage': { kind: 'audio' },
  'ComfyTV.AudioDynamicsStage': { kind: 'audio' },
  'ComfyTV.AudioLoudnessStage': { kind: 'audio' },
  'ComfyTV.AudioDuckStage': { kind: 'audio' },
  'ComfyTV.AudioEQStage': { kind: 'audio' },
  'ComfyTV.AudioSaturateStage': { kind: 'audio' },
  'ComfyTV.AudioModulationStage': { kind: 'audio' },
  'ComfyTV.AudioEchoStage': { kind: 'audio' },
  'ComfyTV.AudioStereoStage': { kind: 'audio' },
  'ComfyTV.AudioTimePitchStage': { kind: 'audio' },
  'ComfyTV.AudioDenoiseStage': { kind: 'audio' },
  'ComfyTV.AudioNoiseReductionStage': { kind: 'audio' },
  'ComfyTV.AudioRepairStage': { kind: 'audio' },
  'ComfyTV.AudioConvolveStage': { kind: 'audio' },
  'ComfyTV.AudioDeconvolveStage': { kind: 'audio' },
  'ComfyTV.MuseReverbStage': { kind: 'audio' },
  'ComfyTV.AudioMixStage': { kind: 'audio' },
  'ComfyTV.AudioCrossfadeStage': { kind: 'audio' },
  'ComfyTV.AudioStemSplitStage': { kind: 'audio' },
  'ComfyTV.AudioVideoDemuxAudioStage': { kind: 'audio' },
  'ComfyTV.AudioVideoDemuxVideoStage': { kind: 'video' },
  'ComfyTV.AudioClipStage': { kind: 'audio' },
  'ComfyTV.AudioSplitStage': { kind: 'audio' },
  'ComfyTV.AudioAnalyzeStage': { kind: 'text' },
  'ComfyTV.AudioMIRStage': { kind: 'text' },
  'ComfyTV.AudioVisualizeStage': { kind: 'image' },
  'ComfyTV.AudioSegmentExportStage': { kind: 'text' },
  'ComfyTV.AudioReactiveStage': { kind: 'text' },
  'ComfyTV.AudioSweepStage': { kind: 'audio' },
  'ComfyTV.SF2SynthStage': { kind: 'audio' },
  'ComfyTV.ClickTrackStage': { kind: 'audio' },
  'ComfyTV.ChordAccompStage': { kind: 'text' },
  'ComfyTV.ScoreToMidiStage': { kind: 'text' },
  'ComfyTV.ScoreStage': { kind: 'text' },
  'ComfyTV.ScoreEditorStage': { kind: 'text' },
  'ComfyTV.MidiEditorStage': { kind: 'audio' },
  'ComfyTV.ExpressionStage': { kind: 'text' },
  'ComfyTV.MotionTrackStage': { kind: 'text' },
  'ComfyTV.PatternStage': { kind: 'video' },
  'ComfyTV.PanoramaStage': { kind: 'panorama' },
  'ComfyTV.PanoramaCurrentViewStage': { kind: 'image', variant: 'transform' },
  'ComfyTV.PanoramaMultiViewStage': { kind: 'image-batch', variant: 'transform' },
  'ComfyTV.StoryboardStage': { kind: 'storyboard' },
  'ComfyTV.StoryboardEditorStage': { kind: 'image', variant: 'loader' },
  'ComfyTV.LayerEditorStage': { kind: 'image', variant: 'loader' },
  'ComfyTV.MaterialStage': { kind: 'material' },
  'ComfyTV.ModelLoaderStage': { kind: 'model', variant: 'loader' },
  'ComfyTV.MeshPrimitiveStage': { kind: 'model', variant: 'loader' },
  'ComfyTV.MeshOpStage': { kind: 'model' },
  'ComfyTV.MeshBakeMapsStage': { kind: 'model' },
  'ComfyTV.MeshBooleanStage': { kind: 'model' },
  'ComfyTV.LineArtStage': { kind: 'image' },
  'ComfyTV.PosterStage': { kind: 'image' },
  'ComfyTV.SplitPartStage': { kind: 'image-batch' },
  'ComfyTV.EraseStage': { kind: 'image' },
  'ComfyTV.InpaintStage': { kind: 'image' },
  'ComfyTV.OutpaintStage': { kind: 'image' },
  'ComfyTV.MultiangleStage': { kind: 'image' },
  'ComfyTV.DirectorStage': { kind: 'video' },
  'ComfyTV.Model3DStage': { kind: 'model' },
  'ComfyTV.TimelineVideoStage': { kind: 'video' },
  'ComfyTV.UpscaleStage': { kind: 'image' },
  'ComfyTV.ImageEditStage': { kind: 'image' },
  'ComfyTV.CutoutStage': { kind: 'image' },
}

const EXTRA_WIDGETS: Record<string, Array<[string, string]>> = {
  'ComfyTV.ImageStage': [['resolution', 'combo'], ['aspect_ratio', 'combo'], ['batch_size', 'number'], ['selected_index', 'number']],
  'ComfyTV.ShotImagesStage': [['selected_index', 'number']],
  'ComfyTV.ImageVariationsStage': [['variant_count', 'number'], ['selected_index', 'number']],
  'ComfyTV.ImagePickerStage': [['selected_index', 'number'], ['pool', 'string']],
  'ComfyTV.VideoPickerStage': [['selected_index', 'number'], ['pool', 'string']],
  'ComfyTV.AudioPickerStage': [['selected_index', 'number'], ['pool', 'string']],
  'ComfyTV.VideoStage': [['resolution', 'combo'], ['aspect_ratio', 'combo'], ['duration_s', 'number'], ['generate_audio', 'toggle']],
  'ComfyTV.AudioStage': [['lyrics', 'customtext'], ['duration_s', 'number'], ['bpm', 'number'], ['timesignature', 'combo'], ['keyscale', 'combo'], ['language', 'combo']],
  'ComfyTV.SpeechStage': [['voice', 'string'], ['language', 'combo'], ['speed', 'number'], ['reference_text', 'customtext']],
  'ComfyTV.UpscaleStage': [['scale', 'combo']],
  'ComfyTV.VideoUpscaleStage': [['scale', 'combo']],
  'ComfyTV.ImageLoaderStage': [['image', 'combo']],
  'ComfyTV.VideoLoaderStage': [['video', 'combo']],
  'ComfyTV.AudioLoaderStage': [['audio', 'combo']],
  'ComfyTV.AssetImageLoaderStage': [['asset_id', 'number']],
  'ComfyTV.AssetVideoLoaderStage': [['asset_id', 'number']],
  'ComfyTV.AssetAudioLoaderStage': [['asset_id', 'number']],
  'ComfyTV.AssetModelLoaderStage': [['asset_id', 'number']],
  'ComfyTV.FXChainStage': [['out_colorspace', 'combo'], ['out_size', 'combo'], ['out_fps', 'combo'], ['out_codec', 'combo'], ['out_quality', 'combo']],
}

let nodeSeq = 1

function makeWidget(name: string, type: string) {
  const w: Record<string, unknown> = { name, type, options: { values: [] } }
  if (type === 'customtext') {
    let backing = ''
    Object.defineProperty(w, 'value', {
      configurable: false,
      enumerable: true,
      get: () => backing,
      set: (v: unknown) => { backing = String(v ?? '') },
    })
  } else if (type === 'number') {
    w.value = 1
  } else {
    w.value = ''
  }
  return w
}

function makeNode(cls: string) {
  const short = cls.replace('ComfyTV.', '')
  const widgets: Array<Record<string, unknown>> = [
    makeWidget('workflow', 'combo'),
    makeWidget('main_prompt', 'customtext'),
    makeWidget('custom_params', 'string'),
  ]
  for (const [name, type] of EXTRA_WIDGETS[cls] ?? []) {
    widgets.push(makeWidget(name, type))
  }
  const node: Record<string, any> = {
    id: nodeSeq++,
    comfyClass: cls,
    type: cls,
    title: short,
    constructor: { title: short },
    properties: {},
    widgets,
    inputs: [],
    outputs: [],
    pos: [0, 0],
    size: [420, 460],
    flags: {},
    setSize(v: [number, number]) { this.size = v },
    setDirtyCanvas: () => {},
    addDOMWidget(name: string, type: string, element: HTMLElement, options: Record<string, unknown>) {
      const w = { name, type, element, options, value: undefined }
      widgets.push(w as any)
      return w
    },
    connect: () => {},
  }
  return node
}

const shellEntries = Object.entries(V2_SHELLS)

describe('V2 shell smoke', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mounts.splice(0, mounts.length)
    const anyApp = app as any
    anyApp.api.apiURL = (p: string) => p
    anyApp.extensionManager = { toast: { add: () => {} } }
    anyApp.graph.getNodeById = () => undefined
  })

  afterEach(() => {
    mounts.splice(0, mounts.length)
    document.body.innerHTML = ''
  })

  it('covers every registered shell with meta', () => {
    const missing = shellEntries.map(([cls]) => cls).filter(cls => !SHELL_META[cls])
    expect(missing, `add SHELL_META entries for: ${missing.join(', ')}`).toEqual([])
  })

  const ENV_LIMITED = new Set([
    'ComfyTV.PanoramaStage',
    'ComfyTV.PanoramaCurrentViewStage',
    'ComfyTV.PanoramaMultiViewStage',
    'ComfyTV.MaterialStage',
    'ComfyTV.MeshPrimitiveStage',
    'ComfyTV.MeshOpStage',
    'ComfyTV.MeshBakeMapsStage',
    'ComfyTV.MeshBooleanStage',
    'ComfyTV.MultiangleStage',
    'ComfyTV.LineArtStage',
    'ComfyTV.StoryboardEditorStage',
    'ComfyTV.LayerEditorStage',
    'ComfyTV.PosterStage',
    'ComfyTV.EraseStage',
    'ComfyTV.InpaintStage',
  ])
  const ENV_ERROR_PATTERNS = [
    /Failed to create 2D context/i,
    /getContext/i,
    /localStorage/i,
    /drawImage/,
    /templateDefs\.filter|templates\.value\.map/,
  ]

  for (const [cls, attach] of shellEntries) {
    it(`attaches and renders islands for ${cls}`, async () => {
      const meta = SHELL_META[cls]
      if (!meta) return
      const node = makeNode(cls)

      const api = attach(node as any, meta.kind, meta.variant ?? 'generator')
      expect(api?.state, `${cls}: attach returned no stage api`).toBeTruthy()

      const shellWidget = node.widgets.find((w: any) => w.name === 'v2_shell')
      expect(shellWidget?.element, `${cls}: no v2_shell DOM widget`).toBeTruthy()
      const card = shellWidget.element as HTMLElement
      expect(
        card.classList.contains('v2-card') || !!card.querySelector('.v2-card'),
        `${cls}: shell root missing v2-card`,
      ).toBe(true)

      expect(mounts.length, `${cls}: shell registered no islands`).toBeGreaterThan(0)
      const registered = mounts.length

      const errors: string[] = []
      const host = createApp(ComfyTVMountHost)
      host.config.errorHandler = (err) => { errors.push(String(err)) }
      host.config.warnHandler = () => {}
      host.use(pinia)
      host.use(i18n)
      const rootEl = document.createElement('div')
      document.body.appendChild(rootEl)
      host.mount(rootEl)
      await nextTick()
      await new Promise(r => setTimeout(r, 0))
      await nextTick()

      const realErrors = ENV_LIMITED.has(cls)
        ? errors.filter(e => !ENV_ERROR_PATTERNS.some(p => p.test(e)))
        : errors
      expect(realErrors, `${cls}: island errors -> ${realErrors.join(' | ')}`).toEqual([])

      host.unmount()
      node.onRemoved?.()
      expect(mounts.length, `${cls}: ${registered} islands registered but ${mounts.length} left after onRemoved — leak`).toBe(0)
    })
  }
})
