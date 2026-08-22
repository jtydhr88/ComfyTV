import { markRaw } from 'vue'

import AudioAnalyzeStageCard from '@/components/stages/AudioAnalyzeStageCard.vue'
import AudioClipStageCard from '@/components/stages/AudioClipStageCard.vue'
import AudioConvolveStageCard from '@/components/stages/AudioConvolveStageCard.vue'
import AudioCrossfadeStageCard from '@/components/stages/AudioCrossfadeStageCard.vue'
import AudioDeconvolveStageCard from '@/components/stages/AudioDeconvolveStageCard.vue'
import AudioDenoiseStageCard from '@/components/stages/AudioDenoiseStageCard.vue'
import AudioDuckStageCard from '@/components/stages/AudioDuckStageCard.vue'
import AudioDynamicsStageCard from '@/components/stages/AudioDynamicsStageCard.vue'
import AudioEchoStageCard from '@/components/stages/AudioEchoStageCard.vue'
import AudioEQStageCard from '@/components/stages/AudioEQStageCard.vue'
import AudioLoudnessStageCard from '@/components/stages/AudioLoudnessStageCard.vue'
import AudioMIRStageCard from '@/components/stages/AudioMIRStageCard.vue'
import AudioMixStageCard from '@/components/stages/AudioMixStageCard.vue'
import AudioModulationStageCard from '@/components/stages/AudioModulationStageCard.vue'
import AudioNoiseReductionStageCard from '@/components/stages/AudioNoiseReductionStageCard.vue'
import AudioReactiveStageCard from '@/components/stages/AudioReactiveStageCard.vue'
import AudioRepairStageCard from '@/components/stages/AudioRepairStageCard.vue'
import AudioSaturateStageCard from '@/components/stages/AudioSaturateStageCard.vue'
import AudioSegmentExportStageCard from '@/components/stages/AudioSegmentExportStageCard.vue'
import AudioSplitStageCard from '@/components/stages/AudioSplitStageCard.vue'
import AudioStemSplitStageCard from '@/components/stages/AudioStemSplitStageCard.vue'
import AudioStereoStageCard from '@/components/stages/AudioStereoStageCard.vue'
import AudioSweepStageCard from '@/components/stages/AudioSweepStageCard.vue'
import AudioTimePitchStageCard from '@/components/stages/AudioTimePitchStageCard.vue'
import AudioVisualizeStageCard from '@/components/stages/AudioVisualizeStageCard.vue'
import ChordAccompStageCard from '@/components/stages/ChordAccompStageCard.vue'
import ClickTrackStageCard from '@/components/stages/ClickTrackStageCard.vue'
import MuseReverbStageCard from '@/components/stages/MuseReverbStageCard.vue'
import ScoreToMidiStageCard from '@/components/stages/ScoreToMidiStageCard.vue'
import SF2SynthStageCard from '@/components/stages/SF2SynthStageCard.vue'
import PassthroughCardV2 from '@/v2/PassthroughCardV2.vue'
import { V2_SHELLS } from '@/v2/registry'
import { attachFxShell, type FxShellConfig } from '@/v2/fxShell'

const ICON_DYN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9.5v5M8 6.5v11M12 4v16M16 6.5v11M20 9.5v5"/><path d="M2.5 2.5l3 3M21.5 2.5l-3 3M2.5 21.5l3-3M21.5 21.5l-3-3"/></svg>`
const ICON_LOUDNESS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M14.5 9a4.5 4.5 0 010 6"/><path d="M17.5 6.5a8 8 0 010 11" stroke-dasharray="2 2.4"/></svg>`
const ICON_DUCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 10c2.5 0 3.5 6 6 6s2-9 4.5-9 2 9 4.5 9 3.5-6 4-6" opacity=".45"/><path d="M2.5 16c3 0 4-3 6.5-3M15 13c2.5 0 3.5 3 6.5 3"/><path d="M12 5v4M10 7l2 2 2-2"/></svg>`
const ICON_EQ = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4v16M12 4v16M19 4v16"/><rect x="3" y="8" width="4" height="3" rx="1" fill="#17171b"/><rect x="10" y="13" width="4" height="3" rx="1" fill="#17171b"/><rect x="17" y="6" width="4" height="3" rx="1" fill="#17171b"/></svg>`
const ICON_SATURATE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12c1.5-5.5 3-8 4.7-8 2 0 2 3 4.8 3s2.8-3 4.8-3c1.7 0 3.2 2.5 4.7 8" opacity=".45"/><path d="M2.5 17h5.5M16 17h5.5M8 17c1-2.5 2-4 4-4s3 1.5 4 4"/></svg>`
const ICON_MODULATION = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2.5 12c3-7 6.5-7 9.5 0s6.5 7 9.5 0" opacity=".4"/></svg>`
const ICON_ECHO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7v10M9 9v6"/><path d="M13 10v4" opacity=".7"/><path d="M16.5 10.8v2.4" opacity=".5"/><path d="M19.5 11.4v1.2" opacity=".35"/></svg>`
const ICON_STEREO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 8.5v7" stroke-dasharray="1.8 2"/></svg>`
const ICON_TIMEPITCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8.5" cy="12" r="6"/><path d="M8.5 8.5V12l2.5 2"/><path d="M18 6l3 2-3 2zM18 14l3 2-3 2z" fill="currentColor" fill-opacity=".2"/></svg>`
const ICON_ADENOISE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 14c2-6 4-6 6 0s4 6 6 0 3.5-5 6-2"/><path d="M4.5 5l2 2M8 3.5l1 2.4M18 4l-1.5 2.2M14 3.5l.6 2.4" opacity=".5"/></svg>`
const ICON_SPECGATE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V11M8 20V7M12 20v-9M16 20V9M20 20v-7"/><path d="M2.5 8.5h19" stroke-dasharray="2.4 2"/></svg>`
const ICON_AREPAIR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12c1.8-4 3.6-4 5.4 0M16 12c1.8-4 3.6-4 5.5 0"/><path d="M9.5 14.5l5-5M11 8l5 5-2.5 2.5-5-5z"/></svg>`
const ICON_CONVOLVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 15.5a4.2 4.2 0 006 0" opacity=".8"/><path d="M7.5 13a7 7 0 009 0" opacity=".4"/></svg>`
const ICON_DECONVOLVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 20V9l-8-5-8 5v11" opacity=".5"/><path d="M15 12H5M8 9l-3 3 3 3"/></svg>`
const ICON_MUSEREVERB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 16V6l4-2v10"/><circle cx="6" cy="16.5" r="2.2"/><circle cx="10" cy="14.5" r="2.2"/><path d="M16 8a6 6 0 010 8" opacity=".7"/><path d="M18.8 5.5a10 10 0 010 13" opacity=".4"/></svg>`
const ICON_AMIX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="14" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="12" r="2"/></svg>`
const ICON_ACROSSFADE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6c6 0 12 12 18 12"/><path d="M3 18C9 18 15 6 21 6" opacity=".5"/></svg>`
const ICON_STEMSPLIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h5"/><path d="M8 12c4 0 4-7 8-7h5M8 12c4 0 4-2.4 8-2.4h5M8 12c4 0 4 2.4 8 2.4h5M8 12c4 0 4 7 8 7h5"/></svg>`
const ICON_DEMUXA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="11" height="14" rx="2"/><path d="M3 9h11M3 15h11"/><path d="M18.5 15.5V8l2.5-1"/><circle cx="17" cy="15.8" r="1.8"/></svg>`
const ICON_DEMUXV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="M8 9.5l4 2.5-4 2.5z"/><path d="M19 8l3.5 3.5M22.5 8L19 11.5" opacity=".7"/></svg>`
const ICON_ACLIP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 12c1.5-3.5 3-3.5 4.5 0s3 3.5 4.5 0" opacity=".6"/><circle cx="5.5" cy="7" r="2.2"/><circle cx="5.5" cy="17" r="2.2"/><path d="M7.3 8.4L20 17M7.3 15.6L20 7"/></svg>`
const ICON_ASPLIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12c1.8-4.5 3.6-4.5 5.4 0s3.6 4.5 5.4 0M16 12c1.6-4 3.3-4 5.5-1" opacity=".7"/><path d="M12 3.5v17" stroke-dasharray="2.6 2.2"/></svg>`
const ICON_AANALYZE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M7 10.5c1-2.4 2-2.4 3 0s2 2.4 3 0" /></svg>`
const ICON_AMIR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 17V5l9-2v12"/><circle cx="6.8" cy="17.3" r="2.3"/><circle cx="15.8" cy="15.3" r="2.3"/><path d="M9 8.5l9-2" opacity=".5"/></svg>`
const ICON_AVIZ = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M6.5 16.5V12M10 16.5V8M13.5 16.5v-6M17.5 16.5V9.5"/></svg>`
const ICON_ASEGEXP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 2 2.4 3.5 1"/><path d="M5 15v3M10 15v3M15 15v3M20 15v3"/><path d="M5 16.5h5M15 16.5h5" opacity=".5"/></svg>`
const ICON_AREACTIVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 9c2-4 4-4 6 0s4 4 6 0" opacity=".6"/><path d="M6 17l2-2 2 2-2 2zM13 17l2-2 2 2-2 2zM18.6 15.6l1.4 1.4-1.4 1.4" /></svg>`
const ICON_SWEEP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 18c3.5 0 4-4 6-4s2.2 2.5 3.8 2.5S15 8 17.2 8 20 4.5 21.5 4.5"/><path d="M3 21h18" opacity=".4"/></svg>`
const ICON_SF2 = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7.5 5v9M12 5v9M16.5 5v9"/><path d="M6.2 5v6h2.6M10.7 5v6h2.6M15.2 5v6h2.6" fill="currentColor" fill-opacity=".3" stroke="none"/></svg>`
const ICON_CLICK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4h6l3 15H6z"/><path d="M12 15V8M12 15l4.5-5"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/></svg>`
const ICON_CHORD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 15V4l4 1.2"/><circle cx="13.7" cy="15.4" r="2.3"/><circle cx="7.7" cy="18.4" r="2.3" opacity=".7"/><circle cx="7.7" cy="10.4" r="2.3" opacity=".4"/><path d="M10 18V7l6-1.6" opacity=".5"/></svg>`
const ICON_SCORE2MIDI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h11M3 8.5h11M3 12h11M3 15.5h7"/><circle cx="9.5" cy="8.5" r="1.7" fill="currentColor" stroke="none"/><path d="M11.2 8.5V3.8"/><path d="M17 12v6.5M14.5 15.5l2.5 3 2.5-3" opacity=".8"/></svg>`

const CONFIGS: Record<string, FxShellConfig> = {
  'ComfyTV.AudioDynamicsStage': {
    titleKey: 'v2.afx.dynamics', icon: ICON_DYN,
    card: markRaw(AudioDynamicsStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioLoudnessStage': {
    titleKey: 'v2.afx.loudness', icon: ICON_LOUDNESS,
    card: markRaw(AudioLoudnessStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioDuckStage': {
    titleKey: 'v2.afx.duck', icon: ICON_DUCK,
    card: markRaw(AudioDuckStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioEQStage': {
    titleKey: 'v2.afx.eq', icon: ICON_EQ,
    card: markRaw(AudioEQStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioSaturateStage': {
    titleKey: 'v2.afx.saturate', icon: ICON_SATURATE,
    card: markRaw(AudioSaturateStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioModulationStage': {
    titleKey: 'v2.afx.modulation', icon: ICON_MODULATION,
    card: markRaw(AudioModulationStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioEchoStage': {
    titleKey: 'v2.afx.echo', icon: ICON_ECHO,
    card: markRaw(AudioEchoStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioStereoStage': {
    titleKey: 'v2.afx.stereo', icon: ICON_STEREO,
    card: markRaw(AudioStereoStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioTimePitchStage': {
    titleKey: 'v2.afx.timePitch', icon: ICON_TIMEPITCH,
    card: markRaw(AudioTimePitchStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioDenoiseStage': {
    titleKey: 'v2.afx.denoise', icon: ICON_ADENOISE,
    card: markRaw(AudioDenoiseStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioNoiseReductionStage': {
    titleKey: 'v2.afx.noiseReduction', icon: ICON_SPECGATE,
    card: markRaw(AudioNoiseReductionStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioRepairStage': {
    titleKey: 'v2.afx.repair', icon: ICON_AREPAIR,
    card: markRaw(AudioRepairStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioConvolveStage': {
    titleKey: 'v2.afx.convolve', icon: ICON_CONVOLVE,
    card: markRaw(AudioConvolveStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.AudioDeconvolveStage': {
    titleKey: 'v2.afx.deconvolve', icon: ICON_DECONVOLVE,
    card: markRaw(AudioDeconvolveStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.MuseReverbStage': {
    titleKey: 'v2.afx.museReverb', icon: ICON_MUSEREVERB,
    card: markRaw(MuseReverbStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioMixStage': {
    titleKey: 'v2.afx.mix', icon: ICON_AMIX,
    card: markRaw(AudioMixStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.AudioCrossfadeStage': {
    titleKey: 'v2.afx.crossfade', icon: ICON_ACROSSFADE,
    card: markRaw(AudioCrossfadeStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.AudioStemSplitStage': {
    titleKey: 'v2.afx.stemSplit', icon: ICON_STEMSPLIT,
    card: markRaw(AudioStemSplitStageCard), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioVideoDemuxAudioStage': {
    titleKey: 'v2.afx.demuxAudio', icon: ICON_DEMUXA,
    card: markRaw(PassthroughCardV2), hasRun: true, outputKind: 'audio',
  },
  'ComfyTV.AudioVideoDemuxVideoStage': {
    titleKey: 'v2.afx.demuxVideo', icon: ICON_DEMUXV,
    card: markRaw(PassthroughCardV2), hasRun: true, outputKind: 'video',
  },
  'ComfyTV.AudioClipStage': {
    titleKey: 'v2.afx.clip', icon: ICON_ACLIP,
    card: markRaw(AudioClipStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.AudioSplitStage': {
    titleKey: 'v2.afx.split', icon: ICON_ASPLIT,
    card: markRaw(AudioSplitStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.AudioAnalyzeStage': {
    titleKey: 'v2.afx.analyze', icon: ICON_AANALYZE,
    card: markRaw(AudioAnalyzeStageCard), hasRun: true, plain: true, outputStrip: false,
  },
  'ComfyTV.AudioMIRStage': {
    titleKey: 'v2.afx.mir', icon: ICON_AMIR,
    card: markRaw(AudioMIRStageCard), hasRun: true, outputStrip: false,
  },
  'ComfyTV.AudioVisualizeStage': {
    titleKey: 'v2.afx.visualize', icon: ICON_AVIZ,
    card: markRaw(AudioVisualizeStageCard), hasRun: true, plain: true, outputKind: 'image', outputStrip: false,
  },
  'ComfyTV.AudioSegmentExportStage': {
    titleKey: 'v2.afx.segmentExport', icon: ICON_ASEGEXP,
    card: markRaw(AudioSegmentExportStageCard), hasRun: true, plain: true, outputStrip: false,
  },
  'ComfyTV.AudioReactiveStage': {
    titleKey: 'v2.afx.reactive', icon: ICON_AREACTIVE,
    card: markRaw(AudioReactiveStageCard), hasRun: true, plain: true, outputStrip: false,
  },
  'ComfyTV.AudioSweepStage': {
    titleKey: 'v2.afx.sweep', icon: ICON_SWEEP,
    card: markRaw(AudioSweepStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.SF2SynthStage': {
    titleKey: 'v2.afx.sf2', icon: ICON_SF2,
    card: markRaw(SF2SynthStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.ClickTrackStage': {
    titleKey: 'v2.afx.clickTrack', icon: ICON_CLICK,
    card: markRaw(ClickTrackStageCard), hasRun: true, plain: true, outputKind: 'audio',
  },
  'ComfyTV.ChordAccompStage': {
    titleKey: 'v2.afx.chordAccomp', icon: ICON_CHORD,
    card: markRaw(ChordAccompStageCard), hasRun: true, plain: true, outputStrip: false,
  },
  'ComfyTV.ScoreToMidiStage': {
    titleKey: 'v2.afx.scoreToMidi', icon: ICON_SCORE2MIDI,
    card: markRaw(ScoreToMidiStageCard), hasRun: true, plain: true, outputStrip: false,
  },
}

for (const [cls, config] of Object.entries(CONFIGS)) {
  V2_SHELLS[cls] = (node, kind, variant) => attachFxShell(node, kind, variant, config)
}
