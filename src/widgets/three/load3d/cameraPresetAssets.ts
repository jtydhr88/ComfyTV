import { app } from '@/lib/comfyApp'
import { decryptAssetJson } from '@/utils/assetCipher'

export interface CameraPresetManifestEntry {
  id: string
  name: string
  category: string
  file: string
}

const MANIFEST_PATH = '/comfytv/camera_presets/manifest.json'

let manifestPromise: Promise<CameraPresetManifestEntry[]> | null = null
const presetDataCache = new Map<string, Promise<unknown>>()

async function fetchJson(path: string): Promise<unknown> {
  const api = (app as any).api
  const url = typeof api?.fileURL === 'function' ? api.fileURL(path) : path
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`)
  return decryptAssetJson(await resp.arrayBuffer())
}

function isValidEntry(entry: unknown): entry is CameraPresetManifestEntry {
  if (typeof entry !== 'object' || entry === null) return false
  const candidate = entry as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.file === 'string' &&
    !candidate.file.includes('..')
  )
}

export async function fetchCameraPresetManifest(): Promise<
  CameraPresetManifestEntry[]
> {
  manifestPromise ??= fetchJson(MANIFEST_PATH)
    .then((data) =>
      Array.isArray(data) ? data.filter(isValidEntry) : []
    )
    .catch(() => {
      manifestPromise = null
      return [] as CameraPresetManifestEntry[]
    })
  return manifestPromise
}

export async function fetchCameraPresetData(file: string): Promise<unknown> {
  if (file.includes('..')) {
    throw new Error(`Invalid camera preset path: ${file}`)
  }
  let cached = presetDataCache.get(file)
  if (!cached) {
    cached = fetchJson(`/comfytv/camera_presets/${file}`).catch(
      (error: unknown) => {
        presetDataCache.delete(file)
        throw error
      }
    )
    presetDataCache.set(file, cached)
  }
  return cached
}
