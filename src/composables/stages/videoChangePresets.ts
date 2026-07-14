import type { ImagePreset } from '@/composables/stages/imagePresets'

const cat = 'videoChange' as const

export const VIDEO_CHANGE_PRESETS: ImagePreset[] = [
  { id: 'clip',            icon: 'lucide:scissors',  category: cat, targetClass: 'ComfyTV.VideoClipStage',                inputSocket: 'video' },
  { id: 'split',           icon: 'pi pi-pause',      category: cat, targetClass: 'ComfyTV.VideoSplitStage',               inputSocket: 'video' },
  { id: 'speed',           icon: 'pi pi-forward',    category: cat, targetClass: 'ComfyTV.VideoSpeedStage',               inputSocket: 'video' },
  { id: 'rotate',          icon: 'pi pi-refresh',    category: cat, targetClass: 'ComfyTV.VideoRotateStage',              inputSocket: 'video' },
  { id: 'crop',            icon: 'lucide:crop',      category: cat, targetClass: 'ComfyTV.VideoCropStage',                inputSocket: 'video' },
  { id: 'resize',          icon: 'pi pi-arrows-h',   category: cat, targetClass: 'ComfyTV.VideoResizeStage',              inputSocket: 'video' },
  { id: 'volume',          icon: 'pi pi-volume-up',  category: cat, targetClass: 'ComfyTV.VideoVolumeStage',              inputSocket: 'video' },
  { id: 'mux-audio',       icon: 'pi pi-headphones', category: cat, targetClass: 'ComfyTV.VideoMuxAudioStage',            inputSocket: 'video' },
  { id: 'concat',          icon: 'pi pi-link',       category: cat, targetClass: 'ComfyTV.VideoConcatStage',              inputAutogrowGroup: 'videos' },
  { id: 'extract-frame',   icon: 'pi pi-image',      category: cat, targetClass: 'ComfyTV.VideoExtractFrameStage',       inputSocket: 'video' },
  { id: 'frames',          icon: 'pi pi-images',     category: cat, targetClass: 'ComfyTV.VideoFramesStage',              inputSocket: 'video' },
  {
    id: 'demux',
    icon: 'pi pi-share-alt',
    category: cat,
    multiTargetClasses: [
      'ComfyTV.AudioVideoDemuxAudioStage',
      'ComfyTV.AudioVideoDemuxVideoStage',
    ],
    inputSocket: 'video',
  }
]
