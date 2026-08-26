import { MODEL_FILE_EXTENSIONS } from '@/widgets/three/modelFormats'

export type AssetMediaType = 'image' | 'video' | 'audio' | 'model'

const IMAGE_FILE_EXTENSIONS = [
  '.avif', '.bmp', '.gif', '.heic', '.heif', '.jpeg', '.jpg', '.jxl',
  '.png', '.tif', '.tiff', '.webp',
]
const VIDEO_FILE_EXTENSIONS = [
  '.3g2', '.3gp', '.avi', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg',
  '.mpg', '.ogv', '.webm',
]
const AUDIO_FILE_EXTENSIONS = [
  '.aac', '.aif', '.aiff', '.flac', '.m4a', '.mp3', '.oga', '.ogg',
  '.opus', '.wav', '.weba', '.wma',
]

function hasExtension(name: string, extensions: string[]): boolean {
  const lower = name.toLowerCase()
  return extensions.some((ext) => lower.endsWith(ext))
}

export function isModelFile(name: string): boolean {
  const lower = name.toLowerCase()
  return MODEL_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function mediaTypeOfExt(ext: string): AssetMediaType | null {
  const name = `f.${ext.replace(/^\./, '')}`
  if (hasExtension(name, IMAGE_FILE_EXTENSIONS)) return 'image'
  if (hasExtension(name, VIDEO_FILE_EXTENSIONS)) return 'video'
  if (hasExtension(name, AUDIO_FILE_EXTENSIONS)) return 'audio'
  if (isModelFile(name)) return 'model'
  return null
}

export function mediaTypeOf(file: File): AssetMediaType | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (isModelFile(file.name)) return 'model'
  if (hasExtension(file.name, IMAGE_FILE_EXTENSIONS)) return 'image'
  if (hasExtension(file.name, VIDEO_FILE_EXTENSIONS)) return 'video'
  if (hasExtension(file.name, AUDIO_FILE_EXTENSIONS)) return 'audio'
  return null
}

export function dragMayMatchKind(e: DragEvent, kind: AssetMediaType): boolean {
  const items = e.dataTransfer?.items
  if (!items || items.length === 0) return true
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    if (!item.type) return true
    if (kind === 'model') {
      if (item.type.startsWith('model/')) return true
    } else if (item.type.startsWith(`${kind}/`)) {
      return true
    }
  }
  return false
}
