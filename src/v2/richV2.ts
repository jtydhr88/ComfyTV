import { markRaw } from 'vue'

import DirectorStageCard from '@/components/stages/DirectorStageCard.vue'
import ExpressionStageCard from '@/components/stages/ExpressionStageCard.vue'
import LayerEditorStageCard from '@/components/stages/LayerEditorStageCard.vue'
import LineArtStageCard from '@/components/stages/LineArtStageCard.vue'
import MaterialStageCard from '@/components/stages/MaterialStageCard.vue'
import MeshBooleanStageCard from '@/components/stages/MeshBooleanStageCard.vue'
import MeshOpStageCard from '@/components/stages/MeshOpStageCard.vue'
import MeshPrimitiveStageCard from '@/components/stages/MeshPrimitiveStageCard.vue'
import MidiEditorStageCard from '@/components/stages/MidiEditorStageCard.vue'
import ModelLoaderCard from '@/components/stages/ModelLoaderCard.vue'
import MotionTrackStageCard from '@/components/stages/MotionTrackStageCard.vue'
import MultiangleStageCard from '@/components/stages/MultiangleStageCard.vue'
import OutpaintStageCard from '@/components/stages/OutpaintStageCard.vue'
import PainterStageCard from '@/components/stages/PainterStageCard.vue'
import PanoramaCurrentViewStageCard from '@/components/stages/PanoramaCurrentViewStageCard.vue'
import PanoramaMultiViewStageCard from '@/components/stages/PanoramaMultiViewStageCard.vue'
import PanoramaStageCard from '@/components/stages/PanoramaStageCard.vue'
import PatternStageCard from '@/components/stages/PatternStageCard.vue'
import PosterStageCard from '@/components/stages/PosterStageCard.vue'
import ScoreEditorStageCard from '@/components/stages/ScoreEditorStageCard.vue'
import ScoreStageCard from '@/components/stages/ScoreStageCard.vue'
import SplitPartStageCard from '@/components/stages/SplitPartStageCard.vue'
import StoryboardEditorStageCard from '@/components/stages/StoryboardEditorStageCard.vue'
import StoryboardStageCard from '@/components/stages/StoryboardStageCard.vue'
import { V2_SHELLS } from '@/v2/registry'
import { attachFxShell, type FxShellConfig } from '@/v2/videoFxV2'

const ICON_SCORE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M3 9.5h18M3 13h18M3 16.5h18"/><circle cx="9" cy="13" r="1.8" fill="currentColor" stroke="none"/><path d="M10.8 13V6.8"/><circle cx="16" cy="16.5" r="1.8" fill="currentColor" stroke="none"/><path d="M17.8 16.5V9.8"/></svg>`
const ICON_SCOREEDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6.5 8h5M6.5 12h8M6.5 16h4" stroke-width="2.6" opacity=".85"/><path d="M14 16h3.5" stroke-width="2.6" opacity=".45"/></svg>`
const ICON_MIDIEDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 4v16" opacity="0"/><path d="M7 4v9M11 4v9M15 4v9M5 13h14"/><path d="M8 16.5h4M14 16.5h3" stroke-width="2.4" opacity=".8"/></svg>`
const ICON_EXPR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h6l-4 6.5 4 6.5H4"/><path d="M13 18c2.4 0 3-9 6-9M13 9c3 0 3.6 9 6 9" opacity=".8"/></svg>`
const ICON_TRACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M5 5c2 3.5 2 10.5 0 14" opacity=".45" stroke-dasharray="2.2 2"/></svg>`
const ICON_PATTERN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7.5" height="7.5"/><rect x="13" y="13" width="7.5" height="7.5"/><rect x="13" y="3.5" width="7.5" height="7.5" fill="currentColor" fill-opacity=".22" stroke="none"/><rect x="3.5" y="13" width="7.5" height="7.5" fill="currentColor" fill-opacity=".22" stroke="none"/></svg>`
const ICON_PANO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7c6-2.5 12-2.5 18 0v10c-6-2.5-12-2.5-18 0z"/><circle cx="9" cy="11" r="1.4"/><path d="M5 15.5l3.5-3 3 2.5 3.5-3.5 4 3.5" opacity=".8"/></svg>`
const ICON_PANOVIEW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5c6-2.2 12-2.2 18 0v11c-6-2.2-12-2.2-18 0z" opacity=".4"/><rect x="8" y="8.5" width="8" height="7" rx="1.2"/><circle cx="12" cy="12" r="1.4"/></svg>`
const ICON_PANOMULTI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5c6-2.2 12-2.2 18 0v11c-6-2.2-12-2.2-18 0z" opacity=".4"/><rect x="4.5" y="9" width="4.6" height="6" rx="1"/><rect x="9.7" y="9" width="4.6" height="6" rx="1"/><rect x="14.9" y="9" width="4.6" height="6" rx="1"/></svg>`
const ICON_STORYBOARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="8" height="6.5" rx="1.2"/><rect x="13" y="4.5" width="8" height="6.5" rx="1.2"/><rect x="3" y="13.5" width="8" height="6.5" rx="1.2"/><path d="M13.5 15h7M13.5 18h5"/></svg>`
const ICON_SBEDITOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 20.5h10M12 17v3.5"/><path d="M7.5 13l3-4 2.5 2.5 2-2.5 2.5 4z" opacity=".8"/></svg>`
const ICON_LAYERED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12L12 16.5 20.5 12" opacity=".65"/><path d="M3.5 16L12 20.5 20.5 16" opacity=".35"/></svg>`
const ICON_MATERIAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M7 9a5.5 5.5 0 013.5-2.5" opacity=".8" stroke-width="2.4"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" opacity=".6"/></svg>`
const ICON_MODELLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z"/><path d="M12 3v8.5M4.5 7.3l7.5 4.2 7.5-4.2" opacity=".6"/><path d="M12 20v-8.5" opacity=".6"/></svg>`
const ICON_MESHPRIM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="12" width="8" height="8" rx="1"/><circle cx="16.5" cy="16" r="4"/><path d="M8 9.5L12 3l4 6.5z"/></svg>`
const ICON_MESHOP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z" opacity=".5"/><path d="M14.5 13.5l6 6M18.5 15.5l2-2M16 20l2-2"/></svg>`
const ICON_MESHBAKE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z" opacity=".5"/><rect x="12.5" y="12.5" width="8" height="8" rx="1"/><path d="M12.5 16.5h8M16.5 12.5v8"/></svg>`
const ICON_MESHBOOL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="11" height="11" rx="1.5"/><circle cx="15.5" cy="15.5" r="5.5"/><path d="M11.5 11.5l1.5 1.5" opacity="0"/></svg>`
const ICON_LINEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z" opacity=".35"/><path d="M12 3v8.5M4.5 7.3l7.5 4.2 7.5-4.2M12 20v-8.5"/></svg>`
const ICON_POSTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4.5" y="3" width="15" height="18" rx="1.8"/><path d="M7.5 7h9M7.5 10.5h6" stroke-width="2.2"/><rect x="7.5" y="13.5" width="9" height="4.5" rx=".8" fill="currentColor" fill-opacity=".22" stroke="none"/></svg>`
const ICON_SPLITPART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4.5a7.5 7.5 0 107.4 9" opacity=".8"/><path d="M9 4.5V12h7.4A7.5 7.5 0 009 4.5z" fill="currentColor" fill-opacity=".22"/><circle cx="17.5" cy="6.5" r="2.5"/></svg>`
const ICON_ERASE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 16.5L13.5 7a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8l-7 7H8z"/><path d="M4 20h16" opacity=".5"/><path d="M10.5 10l6 6"/></svg>`
const ICON_INPAINT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 15c1.5-4 3-6 5-6 1.6 0 2.4 1.4 4 1.4" opacity=".8"/><path d="M14.5 14.5l2-2 2.5 2.5-2 2z" fill="currentColor" fill-opacity=".25"/></svg>`
const ICON_OUTPAINT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="8" height="8" rx="1"/><path d="M12 4.5V2M12 22v-2.5M4.5 12H2M22 12h-2.5M5.5 5.5L4 4M20 20l-1.5-1.5M18.5 5.5L20 4M4 20l1.5-1.5" opacity=".8"/></svg>`
const ICON_MULTIANGLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="13.5" r="3"/><path d="M12 5.5a8 8 0 018 8M12 5.5a8 8 0 00-8 8" opacity=".5" stroke-dasharray="2.4 2"/><rect x="9.5" y="2.5" width="5" height="3.5" rx="1"/></svg>`
const ICON_DIRECTOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3.5 9h17l-1.5 11h-14z" opacity=".8"/><path d="M4.5 9l1.6-4.2a1.5 1.5 0 011.9-.9L20 7.5"/><path d="M8 4.8l2.5 3.4M13 5.9l2.5 3.1"/></svg>`

const CONFIGS: Record<string, FxShellConfig> = {
  'ComfyTV.ScoreStage': {
    titleKey: 'v2.rich.score', icon: ICON_SCORE,
    card: markRaw(ScoreStageCard), hasRun: true, plain: true, outputStrip: false, minH: 560,
  },
  'ComfyTV.ScoreEditorStage': {
    titleKey: 'v2.rich.scoreEditor', icon: ICON_SCOREEDIT,
    card: markRaw(ScoreEditorStageCard), hasRun: true, plain: true, outputStrip: false, minW: 480, minH: 560,
  },
  'ComfyTV.MidiEditorStage': {
    titleKey: 'v2.rich.midiEditor', icon: ICON_MIDIEDIT,
    card: markRaw(MidiEditorStageCard), hasRun: true, plain: true, outputKind: 'audio', minW: 480, minH: 560,
  },
  'ComfyTV.ExpressionStage': {
    titleKey: 'v2.rich.expression', icon: ICON_EXPR,
    card: markRaw(ExpressionStageCard), hasRun: true, outputStrip: false,
  },
  'ComfyTV.MotionTrackStage': {
    titleKey: 'v2.rich.motionTrack', icon: ICON_TRACK,
    card: markRaw(MotionTrackStageCard), hasRun: true, plain: true, hostClass: 'v2-fx-seg',
    outputStrip: false, minH: 520,
  },
  'ComfyTV.PatternStage': {
    titleKey: 'v2.rich.pattern', icon: ICON_PATTERN,
    card: markRaw(PatternStageCard), hasRun: true, outputKind: 'video',
  },
  'ComfyTV.PanoramaStage': {
    titleKey: 'v2.rich.panorama', icon: ICON_PANO,
    card: markRaw(PanoramaStageCard), hasRun: true, plain: true, outputStrip: false,
    prompt: true, linkKind: 'panorama', minH: 560,
  },
  'ComfyTV.PanoramaCurrentViewStage': {
    titleKey: 'v2.rich.panoView', icon: ICON_PANOVIEW,
    card: markRaw(PanoramaCurrentViewStageCard), hasRun: true, plain: true, outputKind: 'image', minH: 560,
  },
  'ComfyTV.PanoramaMultiViewStage': {
    titleKey: 'v2.rich.panoMulti', icon: ICON_PANOMULTI,
    card: markRaw(PanoramaMultiViewStageCard), hasRun: true, plain: true, outputKind: 'image', minH: 560,
  },
  'ComfyTV.StoryboardStage': {
    titleKey: 'v2.rich.storyboard', icon: ICON_STORYBOARD,
    card: markRaw(StoryboardStageCard), hasRun: true, plain: true, outputStrip: false,
    prompt: true, linkKind: 'storyboard', minW: 420, minH: 560,
  },
  'ComfyTV.StoryboardEditorStage': {
    titleKey: 'v2.rich.storyboardEditor', icon: ICON_SBEDITOR,
    card: markRaw(StoryboardEditorStageCard), hasRun: false, plain: true, minW: 520, minH: 620,
  },
  'ComfyTV.LayerEditorStage': {
    titleKey: 'v2.rich.layerEditor', icon: ICON_LAYERED,
    card: markRaw(LayerEditorStageCard), hasRun: false, plain: true, minW: 520, minH: 620,
  },
  'ComfyTV.MaterialStage': {
    titleKey: 'v2.rich.material', icon: ICON_MATERIAL,
    card: markRaw(MaterialStageCard), hasRun: true, plain: true, hostClass: 'v2-fx-seg',
    outputStrip: false, linkKind: 'material-estimate', minH: 560,
  },
  'ComfyTV.ModelLoaderStage': {
    titleKey: 'v2.rich.modelLoader', icon: ICON_MODELLOAD,
    card: markRaw(ModelLoaderCard), hasRun: false, plain: true, hostClass: 'v2-fx-modelload', minH: 520,
  },
  'ComfyTV.MeshPrimitiveStage': {
    titleKey: 'v2.rich.meshPrimitive', icon: ICON_MESHPRIM,
    card: markRaw(MeshPrimitiveStageCard), hasRun: false, plain: true, hostClass: 'v2-fx-meshprim', minH: 560,
  },
  'ComfyTV.MeshOpStage': {
    titleKey: 'v2.rich.meshOp', icon: ICON_MESHOP,
    card: markRaw(MeshOpStageCard), hasRun: true, outputStrip: false, minH: 560,
  },
  'ComfyTV.MeshBakeMapsStage': {
    titleKey: 'v2.rich.meshBake', icon: ICON_MESHBAKE,
    card: markRaw(MeshOpStageCard), hasRun: true, outputStrip: false, minH: 560,
  },
  'ComfyTV.MeshBooleanStage': {
    titleKey: 'v2.rich.meshBoolean', icon: ICON_MESHBOOL,
    card: markRaw(MeshBooleanStageCard), hasRun: true, outputStrip: false, minH: 560,
  },
  'ComfyTV.LineArtStage': {
    titleKey: 'v2.rich.lineArt', icon: ICON_LINEART,
    card: markRaw(LineArtStageCard), hasRun: true, outputStrip: false, minH: 560,
  },
  'ComfyTV.PosterStage': {
    titleKey: 'v2.rich.poster', icon: ICON_POSTER,
    card: markRaw(PosterStageCard), hasRun: true, plain: true, outputStrip: false, minW: 460, minH: 620,
  },
  'ComfyTV.SplitPartStage': {
    titleKey: 'v2.rich.splitPart', icon: ICON_SPLITPART,
    card: markRaw(SplitPartStageCard), hasRun: true, plain: true, outputStrip: false,
    prompt: true, linkKind: 'split-part', minH: 560,
  },
  'ComfyTV.EraseStage': {
    titleKey: 'v2.rich.erase', icon: ICON_ERASE,
    card: markRaw(PainterStageCard), hasRun: true, plain: true, outputKind: 'image',
    linkKind: 'erase', minH: 560,
  },
  'ComfyTV.InpaintStage': {
    titleKey: 'v2.rich.inpaint', icon: ICON_INPAINT,
    card: markRaw(PainterStageCard), hasRun: true, plain: true, outputKind: 'image',
    prompt: true, linkKind: 'inpaint', minH: 620,
  },
  'ComfyTV.OutpaintStage': {
    titleKey: 'v2.rich.outpaint', icon: ICON_OUTPAINT,
    card: markRaw(OutpaintStageCard), hasRun: true, plain: true, outputKind: 'image',
    prompt: true, linkKind: 'outpaint', minH: 620,
  },
  'ComfyTV.MultiangleStage': {
    titleKey: 'v2.rich.multiangle', icon: ICON_MULTIANGLE,
    card: markRaw(MultiangleStageCard), hasRun: true, plain: true, outputKind: 'image',
    prompt: true, linkKind: 'multiangle', minH: 620,
  },
  'ComfyTV.DirectorStage': {
    titleKey: 'v2.rich.director', icon: ICON_DIRECTOR,
    card: markRaw(DirectorStageCard), hasRun: true, plain: true, outputStrip: false, minW: 560, minH: 680,
  },
}

for (const [cls, config] of Object.entries(CONFIGS)) {
  V2_SHELLS[cls] = (node, kind, variant) => attachFxShell(node, kind, variant, config)
}
