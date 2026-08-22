import { markRaw } from 'vue'

import FxChainCardV2 from '@/v2/FxChainCardV2.vue'
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
import VideoColorStageCard from '@/components/stages/VideoColorStageCard.vue'
import VideoCurvesStageCard from '@/components/stages/VideoCurvesStageCard.vue'
import { attachFxShell, type FxShellConfig } from '@/v2/fxShell'
import { V2_SHELLS } from '@/v2/registry'

const ICON_COLOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18c-1.5 0-2-1-1.3-2.2.8-1.4-.2-2.8-1.9-2.8H7a4 4 0 01-4-4"/><circle cx="8" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="11" r="1.2" fill="currentColor" stroke="none"/></svg>`
const ICON_CURVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20C10 20 14 4 20 4"/><path d="M4 20V4M4 20h16"/></svg>`
const ICON_CHAIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="5" height="5" rx="1.2"/><rect x="16" y="6" width="5" height="5" rx="1.2"/><rect x="9.5" y="14" width="5" height="5" rx="1.2"/><path d="M8 8.5h8M5.5 11v3.5a2 2 0 002 2h2M18.5 11v3.5a2 2 0 01-2 2h-2"/></svg>`
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

for (const [cls, config] of Object.entries(CONFIGS)) {
  V2_SHELLS[cls] = (node, kind, variant) => attachFxShell(node, kind, variant, config)
}
