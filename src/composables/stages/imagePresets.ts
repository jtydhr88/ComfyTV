export interface ImagePreset {
  id: string
  icon: string
  category: 'imageVariant' | 'imageEdit' | 'videoChange'
  targetClass?: string
  inputSocket?: string
  inputAutogrowGroup?: string
  widgets?: Record<string, unknown>
  multiTargetClasses?: string[]
}

const cat = 'imageVariant' as const

export const IMAGE_VARIANT_PRESETS: ImagePreset[] = [
  { id: 'face-3view',      icon: '👤', category: cat, targetClass: 'ComfyTV.ImageVariationsStage', inputSocket: 'image',
    widgets: { workflow: 'Face 3-View',      variant_count: 3 } },
  { id: 'product-3view',   icon: '📦', category: cat, targetClass: 'ComfyTV.ImageVariationsStage', inputSocket: 'image',
    widgets: { workflow: 'Product 3-View',   variant_count: 3 } },
  { id: 'character-3view', icon: '🧍', category: cat, targetClass: 'ComfyTV.ImageVariationsStage', inputSocket: 'image',
    widgets: { workflow: 'Character 3-View', variant_count: 3 } },
  { id: 'multi-cam-9',     icon: '🎬', category: cat, targetClass: 'ComfyTV.ImageVariationsStage', inputSocket: 'image',
    widgets: { workflow: 'Multi-cam 9',      variant_count: 9 } },
  { id: 'story-4',       icon: '📖', category: cat, targetClass: 'ComfyTV.ImageVariationsStage', inputSocket: 'image',
    widgets: { workflow: 'Story 4',        variant_count: 4 } },
  { id: 'storyboard-25', icon: '🎞', category: cat, targetClass: 'ComfyTV.ImageVariationsStage', inputSocket: 'image',
    widgets: { workflow: 'Storyboard 25',  variant_count: 25 } },
  { id: 'cinematic-light', icon: '🎥', category: cat, targetClass: 'ComfyTV.RelightStage', inputSocket: 'image',
    widgets: {
      brightness: 65,
      rim_light: true,
      main_prompt: 'cinematic key light, dramatic mood, color graded look',
    } },
  { id: 'frame-3s', icon: '⏱️', category: cat, targetClass: 'ComfyTV.ImageEditStage', inputSocket: 'image',
    widgets: {
      main_prompt: 'show the scene 3 seconds later, preserving character, environment, and style; continue the action naturally',
    } },
  { id: 'frame-5s', icon: '⏱️', category: cat, targetClass: 'ComfyTV.ImageEditStage', inputSocket: 'image',
    widgets: {
      main_prompt: 'show the scene 5 seconds later, preserving character, environment, and style; continue the action naturally',
    } },
]
