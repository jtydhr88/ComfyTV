import { MODEL_FILE_EXTENSIONS } from '@/widgets/three/modelFormats'

export type AssetMediaType = 'image' | 'video' | 'audio' | 'model'

export function isModelFile(name: string): boolean {
  const lower = name.toLowerCase()
  return MODEL_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function mediaTypeOf(file: File): AssetMediaType | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (isModelFile(file.name)) return 'model'
  return null
}

export function dragMayMatchKind(e: DragEvent, kind: AssetMediaType): boolean {
  const items = e.dataTransfer?.items
  if (!items || items.length === 0) return true
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    if (kind === 'model') {
      if (!item.type || item.type.startsWith('model/')) return true
    } else if (item.type.startsWith(`${kind}/`)) {
      return true
    }
  }
  return false
}
