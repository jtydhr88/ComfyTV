const IMAGE_EXT_RE = /\.(png|jpe?g|webp|bmp)$/i
const VIDEO_EXT_RE = /\.(3g2|3gp|avi|m4v|mkv|mov|mp4|mpe?g|ogv|webm)$/i
const ANNOTATION_RE = /\s*\[(output|input|temp)\]$/

export const THUMB_TILE = 256
export const THUMB_CELL = 512
export const THUMB_PREVIEW = 1024

export function thumbUrl(src: string | null | undefined, max: number): string {
  if (!src) return ''
  const q = src.indexOf('?')
  if (q < 0) return src
  const path = src.slice(0, q)
  if (path !== '/view' && path !== '/api/view') return src
  let filename = ''
  try {
    filename = new URLSearchParams(src.slice(q + 1)).get('filename') ?? ''
  } catch {
    return src
  }
  const clean = filename.replace(ANNOTATION_RE, '')
  if (!IMAGE_EXT_RE.test(clean) && !VIDEO_EXT_RE.test(clean)) return src
  return `/comfytv/thumb?url=${encodeURIComponent(src)}&max=${max}`
}
