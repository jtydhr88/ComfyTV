export interface QuickPrompt {
  labelKey: string
  prompt: string
}

export interface EnhanceCategory {
  categoryKey: string
  tags: string[]
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  { labelKey: 'promptHelper.quick.portrait',     prompt: 'professional portrait photograph, shallow depth of field, soft studio lighting, 85mm lens' },
  { labelKey: 'promptHelper.quick.landscape',    prompt: 'breathtaking landscape photograph, golden hour, wide angle, dramatic clouds, 4K' },
  { labelKey: 'promptHelper.quick.product',      prompt: 'commercial product photography, clean white background, studio lighting, professional' },
  { labelKey: 'promptHelper.quick.fantasy',      prompt: 'epic fantasy scene, magical atmosphere, volumetric lighting, highly detailed, concept art' },
  { labelKey: 'promptHelper.quick.scifi',        prompt: 'futuristic sci-fi environment, neon lights, cyberpunk city, rain reflections, cinematic' },
  { labelKey: 'promptHelper.quick.food',         prompt: 'professional food photography, appetizing, warm lighting, shallow depth of field, editorial' },
  { labelKey: 'promptHelper.quick.architecture', prompt: 'architectural photography, dramatic angles, clean lines, modern design, professional' },
  { labelKey: 'promptHelper.quick.anime',        prompt: 'anime illustration, vibrant colors, clean lineart, detailed background, studio quality' },
]

export const ENHANCE_TAGS: EnhanceCategory[] = [
  { categoryKey: 'promptHelper.category.quality',  tags: ['ultra-detailed', '8K resolution', 'high dynamic range', 'sharp focus', 'award-winning'] },
  { categoryKey: 'promptHelper.category.lighting', tags: ['cinematic lighting', 'golden hour', 'dramatic studio lighting', 'soft diffused light', 'neon glow', 'volumetric rays'] },
  { categoryKey: 'promptHelper.category.mood',     tags: ['moody atmosphere', 'serene and peaceful', 'epic and dramatic', 'warm and cozy', 'dark and mysterious'] },
  { categoryKey: 'promptHelper.category.style',    tags: ['photorealistic', 'oil painting', 'watercolor', 'digital art', 'concept art', 'cyberpunk aesthetic'] },
]
