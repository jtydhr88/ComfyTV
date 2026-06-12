import type { ImagePickContext } from '@/stores/stageStore'

export interface BatchImage {
  index?: string
  label?: string
  prompt?: string
  image_url: string
}

export type ItemClickPayload = ImagePickContext

export interface StoryboardShot {
  shot_no?: string
  duration?: string | number
  prompt?: string
  scene_purpose?: string
  image_prompt?: string
  [k: string]: unknown
}

export interface TimelineSeg {
  length?: number
  prompt?: string
}
