import type { ImagePreset } from '@/composables/stages/imagePresets'

const cat = 'videoChange' as const

export const VIDEO_CHANGE_PRESETS: ImagePreset[] = [
  { id: 'clip',            icon: '✂️', category: cat, targetClass: 'ComfyTV.VideoClipStage',                inputSocket: 'video' },
  { id: 'crop',            icon: '⛶',  category: cat, targetClass: 'ComfyTV.VideoCropStage',                inputSocket: 'video' },
  { id: 'resize',          icon: '↔',  category: cat, targetClass: 'ComfyTV.VideoResizeStage',              inputSocket: 'video' },
  { id: 'extract-frame',   icon: '🖼',  category: cat, targetClass: 'ComfyTV.VideoExtractFrameStage',       inputSocket: 'video' },
  {
    id: 'demux',
    icon: '🔀',
    category: cat,
    multiTargetClasses: [
      'ComfyTV.AudioVideoDemuxAudioStage',
      'ComfyTV.AudioVideoDemuxVideoStage',
    ],
    inputSocket: 'video',
  }
]
