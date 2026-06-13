export const RESOLUTIONS = [
  '480P', '720P', '1K', '1080P', '1440P', '2K', '2160P', '4K',
] as const

export const ASPECT_RATIOS = [
  '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9',
] as const

export const SHORT_SIDE_BY_TIER: Record<string, number> = {
  '480P': 480,
  '720P': 720,
  '1K': 1024,
  '1080P': 1080,
  '1440P': 1440,
  '2K': 2048,
  '2160P': 2160,
  '4K': 4096,
}

export const DEFAULT_SHORT_SIDE = 1024
