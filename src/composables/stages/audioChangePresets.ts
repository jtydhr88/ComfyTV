import type { ImagePreset } from '@/composables/stages/imagePresets'

const cat = 'audioChange' as const

export const AUDIO_CHANGE_PRESETS: ImagePreset[] = [
  { id: 'clip',            icon: 'lucide:scissors',    category: cat, targetClass: 'ComfyTV.AudioClipStage',           inputSocket: 'audio' },
  { id: 'split',           icon: 'pi pi-pause',        category: cat, targetClass: 'ComfyTV.AudioSplitStage',          inputSocket: 'audio' },
  { id: 'dynamics',        icon: 'pi pi-compress',     category: cat, targetClass: 'ComfyTV.AudioDynamicsStage',       inputSocket: 'audio' },
  { id: 'loudness',        icon: 'pi pi-volume-up',    category: cat, targetClass: 'ComfyTV.AudioLoudnessStage',       inputSocket: 'audio' },
  { id: 'duck',            icon: 'pi pi-sort-amount-down', category: cat, targetClass: 'ComfyTV.AudioDuckStage',       inputSocket: 'audio' },
  { id: 'eq',              icon: 'pi pi-sliders-v',    category: cat, targetClass: 'ComfyTV.AudioEQStage',             inputSocket: 'audio' },
  { id: 'saturate',        icon: 'pi pi-sun',          category: cat, targetClass: 'ComfyTV.AudioSaturateStage',       inputSocket: 'audio' },
  { id: 'modulation',      icon: 'pi pi-wave-pulse',   category: cat, targetClass: 'ComfyTV.AudioModulationStage',     inputSocket: 'audio' },
  { id: 'echo',            icon: 'pi pi-replay',       category: cat, targetClass: 'ComfyTV.AudioEchoStage',           inputSocket: 'audio' },
  { id: 'stereo',          icon: 'pi pi-arrows-h',     category: cat, targetClass: 'ComfyTV.AudioStereoStage',         inputSocket: 'audio' },
  { id: 'time-pitch',      icon: 'pi pi-clock',        category: cat, targetClass: 'ComfyTV.AudioTimePitchStage',      inputSocket: 'audio' },
  { id: 'denoise',         icon: 'pi pi-eraser',       category: cat, targetClass: 'ComfyTV.AudioDenoiseStage',        inputSocket: 'audio' },
  { id: 'noise-reduction', icon: 'pi pi-filter',       category: cat, targetClass: 'ComfyTV.AudioNoiseReductionStage', inputSocket: 'audio' },
  { id: 'repair',          icon: 'pi pi-wrench',       category: cat, targetClass: 'ComfyTV.AudioRepairStage',         inputSocket: 'audio' },
  { id: 'convolve',        icon: 'pi pi-building',     category: cat, targetClass: 'ComfyTV.AudioConvolveStage',       inputSocket: 'audio' },
  { id: 'deconvolve',      icon: 'pi pi-undo',         category: cat, targetClass: 'ComfyTV.AudioDeconvolveStage',     inputSocket: 'audio' },
  { id: 'muse-reverb',     icon: 'pi pi-cloud',        category: cat, targetClass: 'ComfyTV.MuseReverbStage',          inputSocket: 'audio' },
  { id: 'mix',             icon: 'pi pi-bars',         category: cat, targetClass: 'ComfyTV.AudioMixStage',            inputSocket: 'audio_a' },
  { id: 'crossfade',       icon: 'pi pi-arrow-right-arrow-left', category: cat, targetClass: 'ComfyTV.AudioCrossfadeStage', inputSocket: 'audio_a' },
  { id: 'stem-split',      icon: 'pi pi-share-alt',    category: cat, targetClass: 'ComfyTV.AudioStemSplitStage',      inputSocket: 'audio' },
  { id: 'analyze',         icon: 'pi pi-search',       category: cat, targetClass: 'ComfyTV.AudioAnalyzeStage',        inputSocket: 'audio' },
  { id: 'mir',             icon: 'pi pi-chart-scatter', category: cat, targetClass: 'ComfyTV.AudioMIRStage',           inputSocket: 'audio' },
  { id: 'visualize',       icon: 'pi pi-chart-bar',    category: cat, targetClass: 'ComfyTV.AudioVisualizeStage',      inputSocket: 'audio' },
  { id: 'segment-export',  icon: 'pi pi-list',         category: cat, targetClass: 'ComfyTV.AudioSegmentExportStage',  inputSocket: 'audio' },
  { id: 'reactive',        icon: 'pi pi-bolt',         category: cat, targetClass: 'ComfyTV.AudioReactiveStage',       inputSocket: 'audio' },
]
