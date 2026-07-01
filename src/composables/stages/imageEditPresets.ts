import type { ImagePreset } from '@/composables/stages/imagePresets'

const cat = 'imageEdit' as const

export const IMAGE_EDIT_PRESETS: ImagePreset[] = [
  { id: 'hd',       icon: 'pi pi-sparkles',               category: cat, targetClass: 'ComfyTV.UpscaleStage',  inputSocket: 'image' },
  { id: 'outpaint', icon: 'pi pi-window-maximize',        category: cat, targetClass: 'ComfyTV.OutpaintStage', inputSocket: 'image' },
  { id: 'inpaint',  icon: 'pi pi-pencil',                 category: cat, targetClass: 'ComfyTV.InpaintStage',  inputSocket: 'image' },
  { id: 'erase',    icon: 'pi pi-eraser',                 category: cat, targetClass: 'ComfyTV.EraseStage',    inputSocket: 'image' },
  { id: 'cutout',   icon: 'lucide:scissors',              category: cat, targetClass: 'ComfyTV.CutoutStage',   inputSocket: 'image' },
  { id: 'crop',     icon: 'lucide:crop',                  category: cat, targetClass: 'ComfyTV.CropStage',     inputSocket: 'image' },
  { id: 'rotate',   icon: 'pi pi-refresh',                category: cat, targetClass: 'ComfyTV.RotateStage',   inputSocket: 'image' },
  { id: 'mirror',   icon: 'pi pi-arrow-right-arrow-left', category: cat, targetClass: 'ComfyTV.MirrorStage',   inputSocket: 'image' },
  { id: 'colorGrade', icon: 'pi pi-palette',              category: cat, targetClass: 'ComfyTV.ColorGradeStage', inputSocket: 'image' },
  { id: 'grid',     icon: 'pi pi-th-large',               category: cat, targetClass: 'ComfyTV.GridSplitStage', inputSocket: 'image' },
]
