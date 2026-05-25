import type { ImagePreset } from '@/composables/stages/imagePresets'

const cat = 'imageEdit' as const

export const IMAGE_EDIT_PRESETS: ImagePreset[] = [
  { id: 'hd',       icon: '✨', category: cat, targetClass: 'ComfyTV.UpscaleStage',  inputSocket: 'image' },
  { id: 'outpaint', icon: '🪟', category: cat, targetClass: 'ComfyTV.OutpaintStage', inputSocket: 'image' },
  { id: 'inpaint',  icon: '🖌', category: cat, targetClass: 'ComfyTV.InpaintStage',  inputSocket: 'image' },
  { id: 'erase',    icon: '🧽', category: cat, targetClass: 'ComfyTV.EraseStage',    inputSocket: 'image' },
  { id: 'cutout',   icon: '✂️', category: cat, targetClass: 'ComfyTV.CutoutStage',   inputSocket: 'image' },
  { id: 'crop',     icon: '🔲', category: cat, targetClass: 'ComfyTV.CropStage',     inputSocket: 'image' },
  { id: 'rotate',   icon: '↻',  category: cat, targetClass: 'ComfyTV.RotateStage',   inputSocket: 'image' },
  { id: 'mirror',   icon: '⇋',  category: cat, targetClass: 'ComfyTV.MirrorStage',   inputSocket: 'image' },
  { id: 'grid',     icon: '▦',  category: cat, targetClass: 'ComfyTV.GridSplitStage', inputSocket: 'image' },
]
