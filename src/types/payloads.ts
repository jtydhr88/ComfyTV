export interface BatchImage {
  index?: string
  label?: string
  prompt?: string
  image_url: string
}

export interface ItemClickPayload {
  index: string
  label?: string
  prompt?: string
  imageUrl?: string
}

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
