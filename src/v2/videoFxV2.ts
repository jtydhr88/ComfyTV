import { useTimeoutFn } from '@vueuse/core'
import { h, markRaw, watch, type Component } from 'vue'

import FxChainCardV2 from '@/v2/FxChainCardV2.vue'
import CDLStageCard from '@/components/stages/CDLStageCard.vue'
import ArtFXStageCard from '@/components/stages/ArtFXStageCard.vue'
import AnnotateStageCard from '@/components/stages/AnnotateStageCard.vue'
import AudioMeterStageCard from '@/components/stages/AudioMeterStageCard.vue'
import ContactSheetStageCard from '@/components/stages/ContactSheetStageCard.vue'
import CornerPinStageCard from '@/components/stages/CornerPinStageCard.vue'
import KenBurnsStageCard from '@/components/stages/KenBurnsStageCard.vue'
import SlitScanStageCard from '@/components/stages/SlitScanStageCard.vue'
import SpotRemoverStageCard from '@/components/stages/SpotRemoverStageCard.vue'
import SubtitleStageCard from '@/components/stages/SubtitleStageCard.vue'
import TitleStageCard from '@/components/stages/TitleStageCard.vue'
import FaceBlurStageCard from '@/components/stages/FaceBlurStageCard.vue'
import Video360StabilizeStageCard from '@/components/stages/Video360StabilizeStageCard.vue'
import VideoInterpolateStageCard from '@/components/stages/VideoInterpolateStageCard.vue'
import VideoLumaWipeStageCard from '@/components/stages/VideoLumaWipeStageCard.vue'
import VideoScopesStageCard from '@/components/stages/VideoScopesStageCard.vue'
import VideoStabilizeStageCard from '@/components/stages/VideoStabilizeStageCard.vue'
import VideoStabilizeV2StageCard from '@/components/stages/VideoStabilizeV2StageCard.vue'
import VideoTransitionStageCard from '@/components/stages/VideoTransitionStageCard.vue'
import FrameBlendStageCard from '@/components/stages/FrameBlendStageCard.vue'
import KeyMixStageCard from '@/components/stages/KeyMixStageCard.vue'
import MaskPropagateStageCard from '@/components/stages/MaskPropagateStageCard.vue'
import MatteMonitorStageCard from '@/components/stages/MatteMonitorStageCard.vue'
import PaintStrokeStageCard from '@/components/stages/PaintStrokeStageCard.vue'
import RotoMaskStageCard from '@/components/stages/RotoMaskStageCard.vue'
import SceneDetectStageCard from '@/components/stages/SceneDetectStageCard.vue'
import STMapGenStageCard from '@/components/stages/STMapGenStageCard.vue'
import STMapStageCard from '@/components/stages/STMapStageCard.vue'
import VideoChromaKeyStageCard from '@/components/stages/VideoChromaKeyStageCard.vue'
import VideoCompositeStageCard from '@/components/stages/VideoCompositeStageCard.vue'
import ZDefocusStageCard from '@/components/stages/ZDefocusStageCard.vue'
import SequenceStageCard from '@/components/stages/SequenceStageCard.vue'
import TimeRemapStageCard from '@/components/stages/TimeRemapStageCard.vue'
import VideoClipStageCard from '@/components/stages/VideoClipStageCard.vue'
import VideoConcatStageCard from '@/components/stages/VideoConcatStageCard.vue'
import VideoCropStageCard from '@/components/stages/VideoCropStageCard.vue'
import VideoFramesStageCard from '@/components/stages/VideoFramesStageCard.vue'
import VideoMuxAudioStageCard from '@/components/stages/VideoMuxAudioStageCard.vue'
import VideoResizeStageCard from '@/components/stages/VideoResizeStageCard.vue'
import VideoRotateStageCard from '@/components/stages/VideoRotateStageCard.vue'
import VideoSpeedStageCard from '@/components/stages/VideoSpeedStageCard.vue'
import VideoSplitStageCard from '@/components/stages/VideoSplitStageCard.vue'
import VideoVolumeStageCard from '@/components/stages/VideoVolumeStageCard.vue'
import Card3DStageCard from '@/components/stages/Card3DStageCard.vue'
import LightGraffitiStageCard from '@/components/stages/LightGraffitiStageCard.vue'
import ParticlesStageCard from '@/components/stages/ParticlesStageCard.vue'
import Video360StageCard from '@/components/stages/Video360StageCard.vue'
import VideoTransformStageCard from '@/components/stages/VideoTransformStageCard.vue'
import WaterStageCard from '@/components/stages/WaterStageCard.vue'
import ChromaShiftStageCard from '@/components/stages/ChromaShiftStageCard.vue'
import ChromaticAberrationStageCard from '@/components/stages/ChromaticAberrationStageCard.vue'
import FeedbackFXStageCard from '@/components/stages/FeedbackFXStageCard.vue'
import GlitchFXStageCard from '@/components/stages/GlitchFXStageCard.vue'
import KaleidoscopeStageCard from '@/components/stages/KaleidoscopeStageCard.vue'
import OldFilmStageCard from '@/components/stages/OldFilmStageCard.vue'
import PosterizeStageCard from '@/components/stages/PosterizeStageCard.vue'
import RegrainStageCard from '@/components/stages/RegrainStageCard.vue'
import StrobeStageCard from '@/components/stages/StrobeStageCard.vue'
import VideoStylizeStageCard from '@/components/stages/VideoStylizeStageCard.vue'
import WaveWarpStageCard from '@/components/stages/WaveWarpStageCard.vue'
import ColorSuppressStageCard from '@/components/stages/ColorSuppressStageCard.vue'
import GlowStageCard from '@/components/stages/GlowStageCard.vue'
import GodRaysStageCard from '@/components/stages/GodRaysStageCard.vue'
import LensDistortStageCard from '@/components/stages/LensDistortStageCard.vue'
import LensFlareStageCard from '@/components/stages/LensFlareStageCard.vue'
import VideoBlurSharpenStageCard from '@/components/stages/VideoBlurSharpenStageCard.vue'
import VideoDeinterlaceStageCard from '@/components/stages/VideoDeinterlaceStageCard.vue'
import VideoDenoiseStageCard from '@/components/stages/VideoDenoiseStageCard.vue'
import DespillStageCard from '@/components/stages/DespillStageCard.vue'
import KeyerStageCard from '@/components/stages/KeyerStageCard.vue'
import MatteMorphStageCard from '@/components/stages/MatteMorphStageCard.vue'
import PIKStageCard from '@/components/stages/PIKStageCard.vue'
import ShapeMaskStageCard from '@/components/stages/ShapeMaskStageCard.vue'
import GrayWorldStageCard from '@/components/stages/GrayWorldStageCard.vue'
import HistogramEqStageCard from '@/components/stages/HistogramEqStageCard.vue'
import HueCorrectStageCard from '@/components/stages/HueCorrectStageCard.vue'
import PseudocolorStageCard from '@/components/stages/PseudocolorStageCard.vue'
import Select0rStageCard from '@/components/stages/Select0rStageCard.vue'
import SelectiveColorStageCard from '@/components/stages/SelectiveColorStageCard.vue'
import VideoColorStageCard from '@/components/stages/VideoColorStageCard.vue'
import VideoCurvesStageCard from '@/components/stages/VideoCurvesStageCard.vue'
import VideoLUTStageCard from '@/components/stages/VideoLUTStageCard.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import {
  bindNodeDrag,
  bindProgressRing,
  bindPromptResize,
  bindShellChrome,
  createNodeScope,
  ensureMinSize,
  ICON_GRIP,
  installV2ShellCss,
  RUN_BUTTON_HTML,
} from '@/v2/imageStageV2'
import { V2_SHELLS } from '@/v2/registry'
import { createIslandGroup } from '@/v2/islands'
import CardEmbedV2 from '@/v2/CardEmbedV2.vue'
import FooterSelectsV2 from '@/v2/FooterSelectsV2.vue'
import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import StagePresetBar from '@/components/stages/StagePresetBar.vue'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

const ICON_COLOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18c-1.5 0-2-1-1.3-2.2.8-1.4-.2-2.8-1.9-2.8H7a4 4 0 01-4-4"/><circle cx="8" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="11" r="1.2" fill="currentColor" stroke="none"/></svg>`
const ICON_CURVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20C10 20 14 4 20 4"/><path d="M4 20V4M4 20h16"/></svg>`
const ICON_CHAIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="5" height="5" rx="1.2"/><rect x="16" y="6" width="5" height="5" rx="1.2"/><rect x="9.5" y="14" width="5" height="5" rx="1.2"/><path d="M8 8.5h8M5.5 11v3.5a2 2 0 002 2h2M18.5 11v3.5a2 2 0 01-2 2h-2"/></svg>`

export interface FxShellConfig {
  titleKey: string
  icon: string
  card: Component
  hasRun: boolean
  embed?: boolean
  plain?: boolean
  outputKind?: 'video' | 'image' | 'audio'
  outputStrip?: boolean
  prompt?: boolean
  linkKind?: string
  minW?: number
  minH?: number
  hostClass?: string
}

const ICON_LUT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M9.2 5v14M14.8 5v14M3.5 9.7h17M3.5 14.3h17"/></svg>`
const ICON_SELCOLOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5c3 3.6 5.5 6.6 5.5 9.6a5.5 5.5 0 11-11 0c0-3 2.5-6 5.5-9.6z"/><path d="M9.5 13.5a2.5 2.5 0 002.5 2.5"/></svg>`
const ICON_CDL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="9" r="2.2" fill="#17171b"/><circle cx="12" cy="15" r="2.2" fill="#17171b"/><circle cx="19" cy="7" r="2.2" fill="#17171b"/></svg>`
const ICON_HISTEQ = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V13M8 20V8M12 20V4.5M16 20V9M20 20V15"/><path d="M3 20h18"/></svg>`
const ICON_AWB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 3.5a8.5 8.5 0 010 17" fill="currentColor" fill-opacity=".25" stroke="none"/><path d="M12 3.5a8.5 8.5 0 000 17"/></svg>`
const ICON_PSEUDO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="9" width="16" height="6" rx="3"/><path d="M8 9v6M12 9v6M16 9v6"/><path d="M6 4.5l2 2M18 4.5l-2 2M6 19.5l2-2M18 19.5l-2-2"/></svg>`
const ICON_HUECOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 12L18 6M12 12l-2.2 8.2"/><circle cx="12" cy="12" r="2.4"/></svg>`
const ICON_SEL0R = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/><circle cx="18" cy="18" r="2.5"/></svg>`
const ICON_KEYER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8.5" r="4.5"/><circle cx="8" cy="8.5" r="1.6"/><path d="M11.5 12l8 8M16.5 17l2.5-2.5M14 19.5l2-2"/></svg>`
const ICON_PIK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3.5 12L12 7.5l8.5 4.5L12 16.5z"/><path d="M3.5 16L12 20.5 20.5 16"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>`
const ICON_DESPILL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5c3 3.6 5.5 6.6 5.5 9.6a5.5 5.5 0 11-11 0c0-3 2.5-6 5.5-9.6z"/><path d="M4.5 19.5l15-15"/></svg>`
const ICON_COLSUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16l-6 7v6.5l-4 2V12z"/><path d="M15 15l6 6M21 15l-6 6"/></svg>`
const ICON_MATTEMORPH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9" stroke-dasharray="2.5 3"/><path d="M12 8.5v7M8.5 12h7"/></svg>`
const ICON_SHAPEMASK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="10.5" width="10" height="10" rx="1.5"/><circle cx="15.5" cy="8" r="5"/></svg>`
const ICON_LENSDIST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4c5.3 1.6 10.7 1.6 16 0M4 20c5.3-1.6 10.7-1.6 16 0M4 4v16M20 4v16"/><path d="M8.5 8.5c2.3.6 4.7.6 7 0M8.5 15.5c2.3-.6 4.7-.6 7 0"/></svg>`
const ICON_CHROMAB = `<svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="12" r="6.5" stroke="#F87171" stroke-width="1.8"/><circle cx="13.5" cy="12" r="6.5" stroke="#60A5FA" stroke-width="1.8"/></svg>`
const ICON_FLARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9" r="3.5"/><path d="M9 2v3M9 13v3M2 9h3M13 9h3M4 4l2 2M14 4l-2 2M4 14l2-2"/><circle cx="16.5" cy="16.5" r="1.5"/><circle cx="20" cy="20" r="1"/></svg>`
const ICON_GLOW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8" stroke-opacity=".45"/><circle cx="12" cy="12" r="11" stroke-opacity=".2"/></svg>`
const ICON_GODRAYS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="7" r="3"/><path d="M6 21l3.5-9M12 21v-8.5M18 21l-3.5-9"/></svg>`
const ICON_BLURSHARP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18"/><circle cx="7" cy="12" r="3.6" stroke-dasharray="2 2.4"/><path d="M17 8.2l3.2 7.6H13.8z"/></svg>`
const ICON_DENOISE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M7 17l10-10"/><circle cx="8.5" cy="8.5" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="6.8" r=".9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r=".9" fill="currentColor" stroke="none" opacity=".35"/><circle cx="11.5" cy="16.8" r=".9" fill="currentColor" stroke="none" opacity=".35"/></svg>`
const ICON_DEINT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h7M13 6h7M4 10h4M10 10h10M4 14h16M4 18h16"/></svg>`
const ICON_POSTERIZE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V15h4v-4h4V7h4V4h4"/><path d="M4 19h16"/></svg>`
const ICON_OLDFILM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 4v16M17 4v16"/><path d="M3.5 8.5H7M3.5 12H7M3.5 15.5H7M17 8.5h3.5M17 12h3.5M17 15.5h3.5"/><path d="M11 7.5v3M13.5 13v4.5"/></svg>`
const ICON_ARTFX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19.5 4.5c-6 1-11 5.5-12.5 10L4 20l5.5-3C14 15.5 18.5 10.5 19.5 4.5z"/><path d="M7 14.5c1 .3 2.2 1.5 2.5 2.5"/></svg>`
const ICON_GLITCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 6h14M3 10h10M16 10h5M7 14h14M3 18h8M14 18h5"/></svg>`
const ICON_KALEIDO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M4.6 7.8l14.8 8.4M4.6 16.2l14.8-8.4"/></svg>`
const ICON_WAVEWARP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7c3-2.5 6 2.5 9 0s6 2.5 9 0M3 12c3-2.5 6 2.5 9 0s6 2.5 9 0M3 17c3-2.5 6 2.5 9 0s6 2.5 9 0"/></svg>`
const ICON_STROBE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 3L5.5 13.5H11L9.5 21 18 10h-6z"/></svg>`
const ICON_FEEDBACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" stroke-opacity=".55"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke-opacity=".3"/></svg>`
const ICON_REGRAIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="13" cy="6.8" r=".9" fill="currentColor" stroke="none"/><circle cx="17" cy="9.5" r=".9" fill="currentColor" stroke="none"/><circle cx="7" cy="13.5" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="16.5" cy="14.5" r=".9" fill="currentColor" stroke="none"/><circle cx="9.5" cy="17" r=".9" fill="currentColor" stroke="none"/><circle cx="14.5" cy="17.5" r=".9" fill="currentColor" stroke="none"/></svg>`
const ICON_STYLIZE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 4l5 5L8.5 20.5 3 22l1.5-5.5z"/><path d="M13 6l5 5"/><path d="M19 3l.6 1.6L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.4z" fill="currentColor" stroke="none"/></svg>`
const ICON_CHROMASHIFT = `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="13" height="13" rx="2" stroke="#F87171" stroke-width="1.8"/><rect x="7" y="4" width="13" height="13" rx="2" stroke="#60A5FA" stroke-width="1.8"/></svg>`
const ICON_TRANSFORM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/><path d="M10.2 3.8L12 2l1.8 1.8M10.2 20.2L12 22l1.8-1.8M3.8 10.2L2 12l1.8 1.8M20.2 10.2L22 12l-1.8 1.8"/></svg>`
const ICON_360 = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/><path d="M3.8 9.5h16.4M3.8 14.5h16.4"/></svg>`
const ICON_CARD3D = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4.5l12 2.5v12.5L6 17z"/><path d="M6 4.5V17M18 7v12.5"/></svg>`
const ICON_PARTICLES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="18" r="2.4"/><circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none"/><circle cx="16.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="19.5" cy="11.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="20" cy="4" r=".9" fill="currentColor" stroke="none"/></svg>`
const ICON_WATER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 15.5c3-2.2 6 2.2 9 0s6 2.2 9 0"/><path d="M3 19.5c3-2.2 6 2.2 9 0s6 2.2 9 0"/><path d="M12 4.5c1.8 2.2 3.3 4 3.3 5.8a3.3 3.3 0 11-6.6 0c0-1.8 1.5-3.6 3.3-5.8z"/></svg>`
const ICON_LIGHTGRAF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18c2-6 5-9 8-9s4 3 1.5 5S8 15 9.5 11 15 4.5 20 4"/><circle cx="20" cy="4" r="1.6" fill="currentColor" stroke="none"/></svg>`
const ICON_TRIM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.1 7.8L20 19M8.1 16.2L20 5M13 12.1l2-1.9"/></svg>`
const ICON_VCROP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2.5V16a2 2 0 002 2h13.5M2.5 6H16a2 2 0 012 2v13.5"/></svg>`
const ICON_VSPLIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="7.5" height="12" rx="1.5"/><rect x="13.5" y="6" width="7.5" height="12" rx="1.5"/><path d="M12 3v18" stroke-dasharray="2.5 2.5"/></svg>`
const ICON_CONCAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="8" width="8" height="8" rx="1.5"/><rect x="13.5" y="8" width="8" height="8" rx="1.5"/><path d="M10.5 12h3"/></svg>`
const ICON_SPEED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19a9 9 0 0116 0"/><path d="M12 19l4.5-6.5"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/></svg>`
const ICON_ROTATE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M18 2.5V7h-4.5"/></svg>`
const ICON_VOLUME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11"/></svg>`
const ICON_MUXAUDIO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="5" width="13" height="10" rx="2"/><path d="M7 8.5l4 1.5-4 1.5z" fill="currentColor" stroke="none"/><path d="M19.5 8v8.2"/><circle cx="17.8" cy="17.5" r="1.8"/><path d="M19.5 8l2-.6"/></svg>`
const ICON_RESIZE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M7 15l3-3M7 12v3h3M17 9l-3 3M17 12V9h-3"/></svg>`
const ICON_FRAMES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="7" width="5.4" height="10" rx="1"/><rect x="9.3" y="7" width="5.4" height="10" rx="1"/><rect x="16.1" y="7" width="5.4" height="10" rx="1"/></svg>`
const ICON_TIMEREMAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/><path d="M3.5 12c2-1.5 4-2.5 8.5-2.5" stroke-opacity=".4"/></svg>`
const ICON_SEQUENCE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="5" rx="1.5"/><rect x="3" y="12" width="12" height="5" rx="1.5"/><path d="M6 19.5h9"/></svg>`
const ICON_SCENEDETECT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="8.5" height="12" rx="1.5"/><rect x="13" y="6" width="8.5" height="12" rx="1.5"/><path d="M11 3l2 3-2-1-2 1z" fill="currentColor" stroke="none"/></svg>`
const ICON_CHROMAKEY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M3 17.5L9 11l4 4 3-3 5 5.5"/><path d="M8 21h8"/></svg>`
const ICON_COMPOSITE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="12" height="12" rx="2"/><rect x="8.5" y="8.5" width="12" height="12" rx="2"/></svg>`
const ICON_CORNERPIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 5.5L18 7.5l-1 11L5 16z"/><circle cx="6.5" cy="5.5" r="1.8"/><circle cx="18" cy="7.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/><circle cx="5" cy="16" r="1.8"/></svg>`
const ICON_ROTOMASK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17c-2.5-2.5-2-7 .5-9.5S14 5 16.5 7 20 13 17.5 15.5 9.5 19.5 7 17z" stroke-dasharray="3 2.6"/><path d="M14 21l6-6M17.5 21H20v-2.5" /></svg>`
const ICON_KEYMIX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>`
const ICON_MATTEMON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M12 8a4.5 3.2 0 100 6.4A4.5 3.2 0 0012 8z"/><circle cx="12" cy="11.2" r="1.2" fill="currentColor" stroke="none"/><path d="M8 21h8"/></svg>`
const ICON_MASKPROP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="12" r="4.5" stroke-dasharray="2.5 2.2"/><path d="M14.5 12H21M18.5 9.5L21 12l-2.5 2.5"/></svg>`
const ICON_PAINTSTROKE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 16c4 1 5-2 8-5s5.5-4.5 8-6"/><path d="M4 16l-1 5 5-1z" fill="currentColor" stroke="none"/></svg>`
const ICON_STMAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M4 9.3c5.3 1.4 10.7 1.4 16 0M4 14.6c5.3-1.4 10.7-1.4 16 0M9.3 4c1.4 5.3 1.4 10.7 0 16M14.6 4c-1.4 5.3-1.4 10.7 0 16"/></svg>`
const ICON_STMAPGEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="11" height="11" rx="1.5"/><path d="M3.5 9h11M9 3.5v11"/><circle cx="17.5" cy="17.5" r="3.2"/><path d="M17.5 12.8v1.6M17.5 20.6v1.6M12.8 17.5h1.6M20.6 17.5h1.6"/></svg>`
const ICON_ZDEFOCUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5l4.2 6.3M20.2 9.8l-7.4 1.4M18.3 18.3l-5.5-5.2M12 20.5l-4.2-6.3M3.8 14.2l7.4-1.4M5.7 5.7l5.5 5.2"/></svg>`
const ICON_FRAMEBLEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="12" height="12" rx="1.5" stroke-opacity=".45"/><rect x="6" y="6" width="12" height="12" rx="1.5" stroke-opacity=".7"/><rect x="9" y="6" width="12" height="12" rx="1.5"/></svg>`
const ICON_TRANSITION = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="11" height="12" rx="1.5"/><rect x="10.5" y="6" width="11" height="12" rx="1.5" stroke-dasharray="2.5 2.2"/><path d="M9 12h6M13 9.5L15.5 12 13 14.5"/></svg>`
const ICON_LUMAWIPE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M10 5.5c3 4 3 9 0 13M14.5 5.5c2 4 2 9 0 13" stroke-opacity=".6"/></svg>`
const ICON_STAB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13c2.5 0 2.5-4 5-4s2.5 6 5 6 2.5-4 5-4" stroke-opacity=".45"/><path d="M3 12h18"/></svg>`
const ICON_STABPRO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M8.5 12.2l2.3 2.3 4.7-4.7"/></svg>`
const ICON_STAB360 = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4"/><path d="M7 8l-1.5-1.5M17 8l1.5-1.5" stroke-opacity=".55"/><path d="M12 8.5v7M9.5 11l2.5-2.5 2.5 2.5"/></svg>`
const ICON_INTERP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="7" width="5.5" height="10" rx="1"/><rect x="16" y="7" width="5.5" height="10" rx="1"/><rect x="9.2" y="7" width="5.5" height="10" rx="1" stroke-dasharray="2.4 2"/><path d="M12 10.5v3M10.7 12h2.6"/></svg>`
const ICON_FACEBLUR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="9.5" r="4"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/><path d="M8.5 9.5h7" stroke-dasharray="1.6 1.8"/></svg>`
const ICON_SPOTREM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="12" cy="12" r="3.5" stroke-dasharray="2.2 2"/><path d="M9.8 14.2l4.4-4.4"/></svg>`
const ICON_SCOPES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M5 14.5c2-1 3-6 5-6s2.5 4.5 4.5 4.5S17.5 9.5 19 9"/><path d="M8 21h8"/></svg>`
const ICON_CONTACTSHEET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.9h17M9.2 3.5v17M14.9 3.5v17"/></svg>`
const ICON_AUDIOMETER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 20V10M9.5 20V4M14 20v-9M18.5 20V7"/><path d="M3.5 20h17"/><circle cx="9.5" cy="4" r="1" fill="currentColor" stroke="none"/></svg>`
const ICON_TITLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 6h14M12 6v12M8.5 18h7"/></svg>`
const ICON_SUBTITLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M6 13.5h7M15 13.5h3M6 16.5h3M11 16.5h7"/></svg>`
const ICON_ANNOTATE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M7 14l3.5-3.5 2 2L16 9"/><circle cx="16.5" cy="8.5" r="1.8"/><path d="M8 21h8"/></svg>`
const ICON_KENBURNS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="13" height="13" rx="1.5" stroke-opacity=".5"/><rect x="8" y="8" width="13" height="13" rx="1.5"/><path d="M12 12l4 4"/></svg>`
const ICON_SLITSCAN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M10.5 4v16M13.5 4v16"/><path d="M10.5 9c1-1.5 2-1.5 3 0M10.5 15c1 1.5 2 1.5 3 0" stroke-opacity=".6"/></svg>`

const CONFIGS: Record<string, FxShellConfig> = {
  'ComfyTV.VideoColorStage': {
    titleKey: 'v2.videoColorTitle', icon: ICON_COLOR,
    card: markRaw(VideoColorStageCard), hasRun: false,
  },
  'ComfyTV.VideoCurvesStage': {
    titleKey: 'v2.videoCurvesTitle', icon: ICON_CURVE,
    card: markRaw(VideoCurvesStageCard), hasRun: false,
  },
  'ComfyTV.FXChainStage': {
    titleKey: 'v2.fxChainTitle', icon: ICON_CHAIN,
    card: markRaw(FxChainCardV2), hasRun: true, embed: false,
  },
  'ComfyTV.VideoLUTStage': {
    titleKey: 'v2.fx.lut', icon: ICON_LUT,
    card: markRaw(VideoLUTStageCard), hasRun: false,
  },
  'ComfyTV.SelectiveColorStage': {
    titleKey: 'v2.fx.selectiveColor', icon: ICON_SELCOLOR,
    card: markRaw(SelectiveColorStageCard), hasRun: false,
  },
  'ComfyTV.CDLStage': {
    titleKey: 'v2.fx.cdl', icon: ICON_CDL,
    card: markRaw(CDLStageCard), hasRun: false,
  },
  'ComfyTV.HistogramEqStage': {
    titleKey: 'v2.fx.histogramEq', icon: ICON_HISTEQ,
    card: markRaw(HistogramEqStageCard), hasRun: false,
  },
  'ComfyTV.GrayWorldStage': {
    titleKey: 'v2.fx.awb', icon: ICON_AWB,
    card: markRaw(GrayWorldStageCard), hasRun: false,
  },
  'ComfyTV.PseudocolorStage': {
    titleKey: 'v2.fx.pseudocolor', icon: ICON_PSEUDO,
    card: markRaw(PseudocolorStageCard), hasRun: false,
  },
  'ComfyTV.HueCorrectStage': {
    titleKey: 'v2.fx.hueCorrect', icon: ICON_HUECOR,
    card: markRaw(HueCorrectStageCard), hasRun: false,
  },
  'ComfyTV.Select0rStage': {
    titleKey: 'v2.fx.select0r', icon: ICON_SEL0R,
    card: markRaw(Select0rStageCard), hasRun: false,
  },
  'ComfyTV.KeyerStage': {
    titleKey: 'v2.fx.keyer', icon: ICON_KEYER,
    card: markRaw(KeyerStageCard), hasRun: false,
  },
  'ComfyTV.PIKStage': {
    titleKey: 'v2.fx.pik', icon: ICON_PIK,
    card: markRaw(PIKStageCard), hasRun: false,
  },
  'ComfyTV.DespillStage': {
    titleKey: 'v2.fx.despill', icon: ICON_DESPILL,
    card: markRaw(DespillStageCard), hasRun: false,
  },
  'ComfyTV.ColorSuppressStage': {
    titleKey: 'v2.fx.colorSuppress', icon: ICON_COLSUP,
    card: markRaw(ColorSuppressStageCard), hasRun: false,
  },
  'ComfyTV.MatteMorphStage': {
    titleKey: 'v2.fx.matteMorph', icon: ICON_MATTEMORPH,
    card: markRaw(MatteMorphStageCard), hasRun: false,
  },
  'ComfyTV.ShapeMaskStage': {
    titleKey: 'v2.fx.shapeMask', icon: ICON_SHAPEMASK,
    card: markRaw(ShapeMaskStageCard), hasRun: false,
  },
  'ComfyTV.LensDistortStage': {
    titleKey: 'v2.fx.lensDistort', icon: ICON_LENSDIST,
    card: markRaw(LensDistortStageCard), hasRun: false,
  },
  'ComfyTV.ChromaticAberrationStage': {
    titleKey: 'v2.fx.chromaticAberration', icon: ICON_CHROMAB,
    card: markRaw(ChromaticAberrationStageCard), hasRun: false,
  },
  'ComfyTV.LensFlareStage': {
    titleKey: 'v2.fx.lensFlare', icon: ICON_FLARE,
    card: markRaw(LensFlareStageCard), hasRun: false,
  },
  'ComfyTV.GlowStage': {
    titleKey: 'v2.fx.glow', icon: ICON_GLOW,
    card: markRaw(GlowStageCard), hasRun: false,
  },
  'ComfyTV.GodRaysStage': {
    titleKey: 'v2.fx.godRays', icon: ICON_GODRAYS,
    card: markRaw(GodRaysStageCard), hasRun: false,
  },
  'ComfyTV.VideoBlurSharpenStage': {
    titleKey: 'v2.fx.blurSharpen', icon: ICON_BLURSHARP,
    card: markRaw(VideoBlurSharpenStageCard), hasRun: false,
  },
  'ComfyTV.VideoDenoiseStage': {
    titleKey: 'v2.fx.denoise', icon: ICON_DENOISE,
    card: markRaw(VideoDenoiseStageCard), hasRun: false,
  },
  'ComfyTV.VideoDeinterlaceStage': {
    titleKey: 'v2.fx.deinterlace', icon: ICON_DEINT,
    card: markRaw(VideoDeinterlaceStageCard), hasRun: false,
  },
  'ComfyTV.PosterizeStage': {
    titleKey: 'v2.fx.posterize', icon: ICON_POSTERIZE,
    card: markRaw(PosterizeStageCard), hasRun: false,
  },
  'ComfyTV.OldFilmStage': {
    titleKey: 'v2.fx.oldFilm', icon: ICON_OLDFILM,
    card: markRaw(OldFilmStageCard), hasRun: false,
  },
  'ComfyTV.ArtFXStage': {
    titleKey: 'v2.fx.artFx', icon: ICON_ARTFX,
    card: markRaw(ArtFXStageCard), hasRun: false,
  },
  'ComfyTV.GlitchFXStage': {
    titleKey: 'v2.fx.glitch', icon: ICON_GLITCH,
    card: markRaw(GlitchFXStageCard), hasRun: false,
  },
  'ComfyTV.KaleidoscopeStage': {
    titleKey: 'v2.fx.kaleidoscope', icon: ICON_KALEIDO,
    card: markRaw(KaleidoscopeStageCard), hasRun: false,
  },
  'ComfyTV.WaveWarpStage': {
    titleKey: 'v2.fx.waveWarp', icon: ICON_WAVEWARP,
    card: markRaw(WaveWarpStageCard), hasRun: false,
  },
  'ComfyTV.StrobeStage': {
    titleKey: 'v2.fx.strobe', icon: ICON_STROBE,
    card: markRaw(StrobeStageCard), hasRun: false,
  },
  'ComfyTV.FeedbackFXStage': {
    titleKey: 'v2.fx.feedback', icon: ICON_FEEDBACK,
    card: markRaw(FeedbackFXStageCard), hasRun: false,
  },
  'ComfyTV.RegrainStage': {
    titleKey: 'v2.fx.regrain', icon: ICON_REGRAIN,
    card: markRaw(RegrainStageCard), hasRun: false,
  },
  'ComfyTV.VideoStylizeStage': {
    titleKey: 'v2.fx.stylize', icon: ICON_STYLIZE,
    card: markRaw(VideoStylizeStageCard), hasRun: false,
  },
  'ComfyTV.ChromaShiftStage': {
    titleKey: 'v2.fx.chromaShift', icon: ICON_CHROMASHIFT,
    card: markRaw(ChromaShiftStageCard), hasRun: false,
  },
  'ComfyTV.VideoTransformStage': {
    titleKey: 'v2.fx.transform', icon: ICON_TRANSFORM,
    card: markRaw(VideoTransformStageCard), hasRun: false,
  },
  'ComfyTV.Video360Stage': {
    titleKey: 'v2.fx.video360', icon: ICON_360,
    card: markRaw(Video360StageCard), hasRun: false,
  },
  'ComfyTV.Card3DStage': {
    titleKey: 'v2.fx.card3d', icon: ICON_CARD3D,
    card: markRaw(Card3DStageCard), hasRun: false,
  },
  'ComfyTV.ParticlesStage': {
    titleKey: 'v2.fx.particles', icon: ICON_PARTICLES,
    card: markRaw(ParticlesStageCard), hasRun: false,
  },
  'ComfyTV.WaterStage': {
    titleKey: 'v2.fx.water', icon: ICON_WATER,
    card: markRaw(WaterStageCard), hasRun: false,
  },
  'ComfyTV.LightGraffitiStage': {
    titleKey: 'v2.fx.lightGraffiti', icon: ICON_LIGHTGRAF,
    card: markRaw(LightGraffitiStageCard), hasRun: false,
  },
  'ComfyTV.VideoClipStage': {
    titleKey: 'v2.fx.trim', icon: ICON_TRIM,
    card: markRaw(VideoClipStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.VideoCropStage': {
    titleKey: 'v2.fx.vcrop', icon: ICON_VCROP,
    card: markRaw(VideoCropStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.VideoSplitStage': {
    titleKey: 'v2.fx.vsplit', icon: ICON_VSPLIT,
    card: markRaw(VideoSplitStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.VideoConcatStage': {
    titleKey: 'v2.fx.concat', icon: ICON_CONCAT,
    card: markRaw(VideoConcatStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.VideoSpeedStage': {
    titleKey: 'v2.fx.speed', icon: ICON_SPEED,
    card: markRaw(VideoSpeedStageCard), hasRun: true,
  },
  'ComfyTV.VideoRotateStage': {
    titleKey: 'v2.fx.rotate', icon: ICON_ROTATE,
    card: markRaw(VideoRotateStageCard), hasRun: true,
  },
  'ComfyTV.VideoVolumeStage': {
    titleKey: 'v2.fx.volume', icon: ICON_VOLUME,
    card: markRaw(VideoVolumeStageCard), hasRun: true,
  },
  'ComfyTV.VideoMuxAudioStage': {
    titleKey: 'v2.fx.muxAudio', icon: ICON_MUXAUDIO,
    card: markRaw(VideoMuxAudioStageCard), hasRun: true,
  },
  'ComfyTV.VideoResizeStage': {
    titleKey: 'v2.fx.resize', icon: ICON_RESIZE,
    card: markRaw(VideoResizeStageCard), hasRun: true,
  },
  'ComfyTV.VideoFramesStage': {
    titleKey: 'v2.fx.frames', icon: ICON_FRAMES,
    card: markRaw(VideoFramesStageCard), hasRun: true, plain: true, outputStrip: false,
  },
  'ComfyTV.TimeRemapStage': {
    titleKey: 'v2.fx.timeRemap', icon: ICON_TIMEREMAP,
    card: markRaw(TimeRemapStageCard), hasRun: true,
  },
  'ComfyTV.SequenceStage': {
    titleKey: 'v2.fx.sequence', icon: ICON_SEQUENCE,
    card: markRaw(SequenceStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.SceneDetectStage': {
    titleKey: 'v2.fx.sceneDetect', icon: ICON_SCENEDETECT,
    card: markRaw(SceneDetectStageCard), hasRun: true, outputStrip: false,
  },
  'ComfyTV.VideoChromaKeyStage': {
    titleKey: 'v2.fx.chromaKey', icon: ICON_CHROMAKEY,
    card: markRaw(VideoChromaKeyStageCard), hasRun: true,
  },
  'ComfyTV.VideoCompositeStage': {
    titleKey: 'v2.fx.composite', icon: ICON_COMPOSITE,
    card: markRaw(VideoCompositeStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.CornerPinStage': {
    titleKey: 'v2.fx.cornerPin', icon: ICON_CORNERPIN,
    card: markRaw(CornerPinStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.RotoMaskStage': {
    titleKey: 'v2.fx.rotoMask', icon: ICON_ROTOMASK,
    card: markRaw(RotoMaskStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.KeyMixStage': {
    titleKey: 'v2.fx.keyMix', icon: ICON_KEYMIX,
    card: markRaw(KeyMixStageCard), hasRun: true,
  },
  'ComfyTV.MatteMonitorStage': {
    titleKey: 'v2.fx.matteMonitor', icon: ICON_MATTEMON,
    card: markRaw(MatteMonitorStageCard), hasRun: true,
  },
  'ComfyTV.MaskPropagateStage': {
    titleKey: 'v2.fx.maskPropagate', icon: ICON_MASKPROP,
    card: markRaw(MaskPropagateStageCard), hasRun: true,
  },
  'ComfyTV.PaintStrokeStage': {
    titleKey: 'v2.fx.paintStroke', icon: ICON_PAINTSTROKE,
    card: markRaw(PaintStrokeStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.STMapStage': {
    titleKey: 'v2.fx.stmap', icon: ICON_STMAP,
    card: markRaw(STMapStageCard), hasRun: true,
  },
  'ComfyTV.STMapGenStage': {
    titleKey: 'v2.fx.stmapGen', icon: ICON_STMAPGEN,
    card: markRaw(STMapGenStageCard), hasRun: true, plain: true, outputKind: 'image',
  },
  'ComfyTV.ZDefocusStage': {
    titleKey: 'v2.fx.zDefocus', icon: ICON_ZDEFOCUS,
    card: markRaw(ZDefocusStageCard), hasRun: true,
  },
  'ComfyTV.FrameBlendStage': {
    titleKey: 'v2.fx.frameBlend', icon: ICON_FRAMEBLEND,
    card: markRaw(FrameBlendStageCard), hasRun: true,
  },
  'ComfyTV.VideoTransitionStage': {
    titleKey: 'v2.fx.transition', icon: ICON_TRANSITION,
    card: markRaw(VideoTransitionStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.VideoLumaWipeStage': {
    titleKey: 'v2.fx.lumaWipe', icon: ICON_LUMAWIPE,
    card: markRaw(VideoLumaWipeStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.VideoStabilizeStage': {
    titleKey: 'v2.fx.stabilize', icon: ICON_STAB,
    card: markRaw(VideoStabilizeStageCard), hasRun: true,
  },
  'ComfyTV.VideoStabilizeV2Stage': {
    titleKey: 'v2.fx.stabilizePro', icon: ICON_STABPRO,
    card: markRaw(VideoStabilizeV2StageCard), hasRun: true,
  },
  'ComfyTV.Video360StabilizeStage': {
    titleKey: 'v2.fx.stabilize360', icon: ICON_STAB360,
    card: markRaw(Video360StabilizeStageCard), hasRun: true,
  },
  'ComfyTV.VideoInterpolateStage': {
    titleKey: 'v2.fx.interpolate', icon: ICON_INTERP,
    card: markRaw(VideoInterpolateStageCard), hasRun: true,
  },
  'ComfyTV.FaceBlurStage': {
    titleKey: 'v2.fx.faceBlur', icon: ICON_FACEBLUR,
    card: markRaw(FaceBlurStageCard), hasRun: true,
  },
  'ComfyTV.SpotRemoverStage': {
    titleKey: 'v2.fx.spotRemover', icon: ICON_SPOTREM,
    card: markRaw(SpotRemoverStageCard), hasRun: true,
  },
  'ComfyTV.VideoScopesStage': {
    titleKey: 'v2.fx.scopes', icon: ICON_SCOPES,
    card: markRaw(VideoScopesStageCard), hasRun: true, plain: true, outputKind: 'image', outputStrip: false,
  },
  'ComfyTV.ContactSheetStage': {
    titleKey: 'v2.fx.contactSheet', icon: ICON_CONTACTSHEET,
    card: markRaw(ContactSheetStageCard), hasRun: true, plain: true, outputKind: 'image',
  },
  'ComfyTV.AudioMeterStage': {
    titleKey: 'v2.fx.audioMeter', icon: ICON_AUDIOMETER,
    card: markRaw(AudioMeterStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.TitleStage': {
    titleKey: 'v2.fx.title', icon: ICON_TITLE,
    card: markRaw(TitleStageCard), hasRun: true,
  },
  'ComfyTV.SubtitleStage': {
    titleKey: 'v2.fx.subtitle', icon: ICON_SUBTITLE,
    card: markRaw(SubtitleStageCard), hasRun: true,
  },
  'ComfyTV.AnnotateStage': {
    titleKey: 'v2.fx.annotate', icon: ICON_ANNOTATE,
    card: markRaw(AnnotateStageCard), hasRun: true,
  },
  'ComfyTV.KenBurnsStage': {
    titleKey: 'v2.fx.kenBurns', icon: ICON_KENBURNS,
    card: markRaw(KenBurnsStageCard), hasRun: true, plain: true,
  },
  'ComfyTV.SlitScanStage': {
    titleKey: 'v2.fx.slitScan', icon: ICON_SLITSCAN,
    card: markRaw(SlitScanStageCard), hasRun: true,
  },
}

const FX_CSS = `
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :first-child {
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  border: 1px solid rgba(255,255,255,.07);
  min-height: 150px;
}
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :nth-child(2) {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  max-height: 380px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.18) transparent;
}
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :nth-child(2):focus { outline: none; }
.v2-fx-host input[type="range"] { accent-color: #A78BFA; }
.v2-fx-host .ctv-fx-num:focus { border-color: rgba(167,139,250,.6); outline: none; }
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :nth-child(3):not(:last-child) {
  color: #6b6b74;
  font-size: 10px;
  padding-top: 2px;
}
.v2-fx-plain .v2-fx-embed {
  border-radius: 14px;
  padding: 10px 12px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
}
.v2-fx-footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 9px 14px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  color: #8f8f98;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-fx-presets { flex: none; margin-top: 10px; }
.v2-fx-footer__spacer { flex: 1; }
.v2-fx-output {
  display: none;
  flex: none;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.v2-fx-output[data-show="1"] { display: flex; }
.v2-fx-output__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  color: #8f8f98;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-fx-output__spacer { flex: 1; }
.v2-fx-output__btn {
  flex: none;
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,.06);
  color: #b9b9c0;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-fx-output__btn:hover { background: rgba(255,255,255,.12); color: #ececf1; }
.v2-fx-output__btn svg { width: 12px; height: 12px; }
.v2-fx-output__btn[data-done="1"] { background: #a78bfa; color: #17171b; }
.v2-fx-output__box {
  position: relative;
  height: 190px;
  border-radius: 12px;
  overflow: hidden;
}
.v2-fx-output[data-kind="audio"] .v2-fx-output__box { height: 96px; }
.v2-fx-promptpanel {
  flex: none;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
}
.v2-fx-promptpanel .comfytv-prompt-editor { min-height: 40px; font-size: 12px; }
.v2-fx-seg.v2-fx-plain .v2-fx-embed,
.v2-fx-meshprim.v2-fx-plain .v2-fx-embed {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}
.v2-fx-seg .v2-fx-embed > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.v2-fx-seg .v2-fx-embed > div > :first-child {
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  border: 1px solid rgba(255,255,255,.07);
}
.v2-fx-seg .v2-fx-embed > div > :not(:first-child) {
  padding: 10px 12px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
}
.v2-fx-meshprim .v2-fx-embed > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.v2-fx-meshprim .v2-fx-embed > div > :first-child {
  padding: 10px 12px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
}
.v2-fx-meshprim .v2-fx-embed > div > :nth-child(2) {
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  border: 1px solid rgba(255,255,255,.07);
}
.v2-fx-meshprim .v2-fx-embed > div > :nth-child(n+3) {
  padding: 10px 12px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
}
.v2-fx-modelload.v2-fx-plain .v2-fx-embed {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}
.v2-fx-modelload .v2-fx-embed > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 !important;
}
.v2-fx-modelload .v2-fx-embed > div > button:first-child {
  order: 3;
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
  background: #232327;
}
.v2-fx-modelload .v2-fx-embed > div > button:first-child:hover {
  border-color: rgba(167,139,250,.5);
}
.v2-fx-modelload .v2-fx-embed > div > .ctv-hover-host {
  order: 1;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  border: 1px solid rgba(255,255,255,.07);
}
.v2-fx-modelload .v2-fx-embed > div > :not(button):not(.ctv-hover-host) {
  order: 2;
}
.v2-fx-modelload .v2-fx-embed > div > .ctv\\:shrink-0 { display: none; }
.v2-fx-footer__wf {
  flex: none;
  min-width: 0;
  max-width: 60%;
  display: flex;
  align-items: center;
}
`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = FX_CSS
  document.head.appendChild(style)
}

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

export function attachFxShell(node: ComfyNode, kind: StageKind, variant: StageVariant, config: FxShellConfig) {
  return attach(node, kind, variant, config)
}

function attach(node: ComfyNode, kind: StageKind, variant: StageVariant, config: FxShellConfig) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${config.icon}<span>${t(config.titleKey)}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const embedAnchor = el('div',
    (config.plain ? 'v2-fx-host v2-fx-plain' : 'v2-fx-host') + (config.hostClass ? ` ${config.hostClass}` : ''))
  embedAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  card.appendChild(embedAnchor)
  if (!config.plain) {
    embedAnchor.addEventListener('pointerover', (e) => {
      const slab = embedAnchor.querySelector('.v2-fx-embed > div > :nth-child(2)') as HTMLElement | null
      if (!slab || slab.scrollHeight <= slab.clientHeight + 1) return
      const inSlab = slab.contains(e.target as Node)
      if (inSlab) {
        if (slab.dataset.captureWheel !== 'true') {
          slab.dataset.captureWheel = 'true'
          slab.tabIndex = -1
        }
        if (!slab.contains(document.activeElement)) slab.focus({ preventScroll: true })
      } else if (document.activeElement === slab) {
        slab.blur()
      }
    })
    embedAnchor.addEventListener('pointerleave', () => {
      const slab = embedAnchor.querySelector('.v2-fx-embed > div > :nth-child(2)') as HTMLElement | null
      if (slab && document.activeElement === slab) slab.blur()
    })
  }

  let promptAnchor: HTMLElement | null = null
  if (config.prompt) {
    const promptPanel = el('div', 'v2-fx-promptpanel')
    promptAnchor = el('div', 'v2-panel__prompthost')
    promptPanel.appendChild(promptAnchor)
    card.appendChild(promptPanel)
  }

  const presetAnchor = el('div', 'v2-panel__presets v2-fx-presets')
  card.appendChild(presetAnchor)

  let run: HTMLButtonElement | null = null
  let serverAnchor: HTMLElement | null = null
  let outputWrap: HTMLElement | null = null
  let outputMediaAnchor: HTMLElement | null = null
  let saveBtn: HTMLButtonElement | null = null
  if (config.hasRun && config.embed !== false && config.outputStrip !== false) {
    outputWrap = el('div', 'v2-fx-output')
    outputWrap.dataset.kind = config.outputKind ?? 'video'
    const head = el('div', 'v2-fx-output__head')
    const outLabel = el('div', '', t('v2.outputLabel'))
    const outSpacer = el('div', 'v2-fx-output__spacer')
    saveBtn = el('button', 'v2-fx-output__btn',
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 3.5h11a1 1 0 011 1V21l-6.5-4-6.5 4V4.5a1 1 0 011-1z"/></svg>`) as HTMLButtonElement
    saveBtn.title = t('stage.action.loadAsset')
    const dlBtn = el('button', 'v2-fx-output__btn',
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16"/></svg>`) as HTMLButtonElement
    dlBtn.title = t('stage.action.download')
    head.append(outLabel, outSpacer, saveBtn, dlBtn)
    const box = el('div', 'v2-fx-output__box')
    outputMediaAnchor = el('div', 'v2-mp-host')
    outputMediaAnchor.style.cssText = 'position:absolute;inset:0;'
    box.appendChild(outputMediaAnchor)
    outputWrap.append(head, box)
    card.appendChild(outputWrap)

    dlBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const url = String(stageState.output ?? '')
      if (!url) return
      const a = document.createElement('a')
      a.href = (app as any).api.apiURL(url.replace(/^\/api/, ''))
      a.download = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || 'output.mp4')
      a.click()
    })
  }
  let wfAnchor: HTMLElement | null = null
  if (config.hasRun && config.embed !== false) {
    const footer = el('div', 'v2-fx-footer')
    const spacer = el('div', 'v2-fx-footer__spacer')
    serverAnchor = el('div', 'v2-fx-footer__server')
    run = el('button', 'v2-run', RUN_BUTTON_HTML) as HTMLButtonElement
    if (config.linkKind) {
      wfAnchor = el('div', 'v2-fx-footer__wf')
      footer.append(wfAnchor, spacer, serverAnchor, run)
    } else {
      const label = el('div', '', t('stage.run'))
      footer.append(label, spacer, serverAnchor, run)
    }
    card.appendChild(footer)
  }

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 360,
    hideOnZoom: false,
    serialize: false,
  })

  ensureMinSize(node, config.minW ?? 340, config.minH ?? 460)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest, onDisconnect, onAction } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const islands = createIslandGroup()
  const mountApps = () => {
    islands.unmountAll()
    const specs: Array<[unknown, Record<string, unknown>, HTMLElement]> = [
      config.embed === false
        ? [config.card, { node, state: stageState, onAction, onRunRequest, onCancelRequest }, embedAnchor]
        : [CardEmbedV2, {
            card: config.card, node, state: stageState,
            onRunRequest, onCancelRequest, onDisconnect, onAction,
          }, embedAnchor],
    ]
    specs.push([StagePresetBar, { node }, presetAnchor])
    if (promptAnchor) {
      specs.push([MainPromptInput, { node }, promptAnchor])
    }
    if (wfAnchor) {
      specs.push([FooterSelectsV2, {
        getNode: () => node, linkKind: config.linkKind ?? null, extra: [],
      }, wfAnchor])
    }
    if (serverAnchor) {
      specs.push([ServerSelectV2, { getNode: () => node, state: stageState }, serverAnchor])
    }
    if (outputMediaAnchor) {
      specs.push([{
        render: () => h(MediaPreviewV2, {
          kind: config.outputKind ?? 'video',
          url: stageState.output,
          hint: '',
        }),
      }, {}, outputMediaAnchor])
    }
    for (const [comp, props, anchor] of specs) {
      islands.mount(anchor, comp as any, props)
    }
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  if (outputWrap) {
    const wrap = outputWrap
    scope.run(() => {
      watch(
        () => stageState.output,
        (out) => { wrap.dataset.show = out ? '1' : '' },
        { immediate: true },
      )
    })
  }
  if (saveBtn) {
    const btn = saveBtn
    const flash = scope.run(() => useTimeoutFn(() => { btn.dataset.done = '' }, 1200, { immediate: false }))
    btn.addEventListener('pointerdown', (e) => e.stopPropagation())
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const url = String(stageState.output ?? '')
      if (!url) return
      const mediaType = config.outputKind === 'image' ? 'image'
        : config.outputKind === 'audio' ? 'audio' : 'video'
      const label = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || mediaType)
      onAction('load-asset', { imageUrl: url, label, mediaType } as any)
      btn.dataset.done = '1'
      flash?.stop()
      flash?.start()
    })
  }

  if (run) {
    const runBtn = run
    scope.run(() => {
      watch(() => stageState.running, (v) => {
        runBtn.dataset.busy = v ? '1' : ''
      })
    })
    runBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    runBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (stageState.running) void onCancelRequest()
      else void onRunRequest()
    })
  }

  bindShellChrome(node, {
    scope, card, socketAnchor: embedAnchor, socketY: { frac: 0.3, cap: 160 }, state: stageState,
  })

  if (promptAnchor) bindPromptResize(node, promptAnchor, scope)

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  return stageApi
}

for (const [cls, config] of Object.entries(CONFIGS)) {
  V2_SHELLS[cls] = (node, kind, variant) => attach(node, kind, variant, config)
}
