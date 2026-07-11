import type { Asset } from '@/api/schemas'
import { useAssetStore } from '@/stores/assetStore'
import { type AssetMediaType, mediaTypeOf } from '@/utils/mediaFileTypes'
import { uploadBlobNamed } from '@/utils/uploadCanvas'

function stripExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
}

function probeImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function probeVideoSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({ width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

function probeMediaSize(file: File, kind: AssetMediaType): Promise<{ width: number; height: number } | null> {
  if (kind === 'image') return probeImageSize(file)
  if (kind === 'video') return probeVideoSize(file)
  return Promise.resolve(null)
}

export interface ImportAssetOpts {
  categoryIds?: number[]
  onProgress?: (done: number, total: number) => void
}

export async function importAssetFiles(
  files: File[],
  opts: ImportAssetOpts = {},
): Promise<Asset[]> {
  const store = useAssetStore()
  const media = files
    .map(f => ({ file: f, kind: mediaTypeOf(f) }))
    .filter((m): m is { file: File; kind: AssetMediaType } => m.kind !== null)
  const created: Asset[] = []
  let done = 0
  for (const { file, kind } of media) {
    const dims = await probeMediaSize(file, kind)
    const uploaded = await uploadBlobNamed(file, {
      subfolder: 'comfytv/assets',
      type: 'input',
      filename: file.name,
    })
    const asset = await store.create({
      name: stripExtension(file.name),
      payload_url: uploaded.url,
      media_type: kind,
      category_ids: opts.categoryIds ?? [],
      mime_type: file.type || null,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      size_bytes: file.size,
      source: 'upload',
    })
    if (asset) created.push(asset)
    done += 1
    opts.onProgress?.(done, media.length)
  }
  return created
}
