import { markRaw } from 'vue'

import CDLStageCard from '@/components/stages/CDLStageCard.vue'
import ArtFXStageCard from '@/components/stages/ArtFXStageCard.vue'
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
import VideoLUTStageCard from '@/components/stages/VideoLUTStageCard.vue'
import { attachFxShell, type FxShellConfig } from '@/v2/fxShell'
import { V2_SHELLS } from '@/v2/registry'

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

const CONFIGS: Record<string, FxShellConfig> = {
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
}

for (const [cls, config] of Object.entries(CONFIGS)) {
  V2_SHELLS[cls] = (node, kind, variant) => attachFxShell(node, kind, variant, config)
}
