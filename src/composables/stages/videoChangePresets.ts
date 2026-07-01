import type { ImagePreset } from '@/composables/stages/imagePresets'

const cat = 'videoChange' as const

export const VIDEO_CHANGE_PRESETS: ImagePreset[] = [
  { id: 'clip',            icon: 'lucide:scissors',  category: cat, targetClass: 'ComfyTV.VideoClipStage',                inputSocket: 'video' },
  { id: 'crop',            icon: 'lucide:crop',      category: cat, targetClass: 'ComfyTV.VideoCropStage',                inputSocket: 'video' },
  { id: 'resize',          icon: 'pi pi-arrows-h',   category: cat, targetClass: 'ComfyTV.VideoResizeStage',              inputSocket: 'video' },
  { id: 'extract-frame',   icon: 'pi pi-image',      category: cat, targetClass: 'ComfyTV.VideoExtractFrameStage',       inputSocket: 'video' },
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
