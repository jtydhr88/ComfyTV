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
  { id: 'edit',       icon: 'pi pi-pencil',   presets: IMAGE_EDIT_PRESETS },
  { id: 'panorama',   icon: 'pi pi-globe' },
  { id: 'multiangle', icon: 'pi pi-compass' },
  { id: 'relight',    icon: 'pi pi-lightbulb' },
  { id: 'material',   icon: 'pi pi-palette' },
  { id: 'preset',     icon: 'pi pi-th-large', presets: IMAGE_VARIANT_PRESETS },
]

export const ACTIONS_BY_KIND: Record<string, StageAction[]> = {
  text:  [{ id: 'refine', icon: 'pi pi-pencil' }],
  image: imageActions,
  'image-picker': imageActions,
  'image-batch':  imageActions,
  video: [
    { id: 'extend', icon: 'pi pi-arrow-right' },
    { id: 'change', icon: 'pi pi-pencil', presets: VIDEO_CHANGE_PRESETS },
  ],
  panorama: [
    { id: 'view-current', icon: 'pi pi-camera' },
    { id: 'view-four',    icon: 'pi pi-video' },
    { id: 'view-twelve',  icon: 'pi pi-eye' },
  ],
  storyboard: [
    { id: 'gen-shots', icon: 'pi pi-camera' },
  ],
}
