import {
  IMAGE_VARIANT_PRESETS,
  type ImagePreset,
} from '@/composables/stages/imagePresets'
import { IMAGE_EDIT_PRESETS } from '@/composables/stages/imageEditPresets'
import { VIDEO_CHANGE_PRESETS } from '@/composables/stages/videoChangePresets'

export interface StageAction {
  id: string
  icon: string
  presets?: ImagePreset[]
}

const imageActions: StageAction[] = [
  { id: 'edit',       icon: '✏️', presets: IMAGE_EDIT_PRESETS },
  { id: 'panorama',   icon: '🌐' },
  { id: 'multiangle', icon: '📐' },
  { id: 'relight',    icon: '💡' },
  { id: 'preset',     icon: '🎴', presets: IMAGE_VARIANT_PRESETS },
]

export const ACTIONS_BY_KIND: Record<string, StageAction[]> = {
  text:  [{ id: 'refine', icon: '✏️' }],
  image: imageActions,
  'image-picker': imageActions,
  'image-batch':  imageActions,
  video: [
    { id: 'extend', icon: '↪' },
    { id: 'change', icon: '✏️', presets: VIDEO_CHANGE_PRESETS },
  ],
  panorama: [
    { id: 'view-current', icon: '📸' },
    { id: 'view-four',    icon: '🎬' },
    { id: 'view-twelve',  icon: '🔭' },
  ],
  storyboard: [
    { id: 'gen-shots', icon: '📸' },
  ],
}
