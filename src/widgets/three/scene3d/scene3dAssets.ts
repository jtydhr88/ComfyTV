import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

import { app } from '@/lib/comfyApp'
import { decryptAsset, decryptAssetJson } from '@/utils/assetCipher'

export interface Scene3dCharacterManifestEntry {
  id: string
  name: string
  animations: string[]
  preview_model?: string
}

export interface CharacterAssets {
  template: THREE.Group
  clips: THREE.AnimationClip[]
}

const ASSETS_ROOT = '/comfytv/scene3d'

let manifestPromise: Promise<unknown> | null = null
const assetsCache = new Map<string, Promise<CharacterAssets>>()

function assetUrl(path: string): string {
  const api = (app as any).api
  return typeof api?.fileURL === 'function' ? api.fileURL(path) : path
}

function isValidEntry(entry: unknown): entry is Scene3dCharacterManifestEntry {
  if (typeof entry !== 'object' || entry === null) return false
  const candidate = entry as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.animations) &&
    candidate.animations.length > 0 &&
    candidate.animations.every(
      (file) => typeof file === 'string' && !file.includes('..')
    )
  )
}

async function fetchRawManifest(): Promise<unknown> {
  manifestPromise ??= fetch(assetUrl(`${ASSETS_ROOT}/manifest.json`))
    .then(async (resp: Response) => {
      if (!resp.ok) throw new Error(`manifest: HTTP ${resp.status}`)
      return decryptAssetJson(await resp.arrayBuffer())
    })
    .catch(() => {
      manifestPromise = null
      return null
    })
  return manifestPromise
}

async function loadEncryptedGltf(url: string): Promise<GLTF> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`)
  const buffer = await decryptAsset(await resp.arrayBuffer())
  const loader = new GLTFLoader()
  return new Promise<GLTF>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject)
  })
}

export async function fetchScene3dManifest(): Promise<
  Scene3dCharacterManifestEntry[]
> {
  const data = await fetchRawManifest()
  const characters =
    typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>).characters
      : null
  return Array.isArray(characters) ? characters.filter(isValidEntry) : []
}

async function loadPacks(
  entry: Scene3dCharacterManifestEntry
): Promise<CharacterAssets> {
  const packs = await Promise.all(
    entry.animations.map((file) =>
      loadEncryptedGltf(assetUrl(`${ASSETS_ROOT}/${file}`))
    )
  )
  const clips: THREE.AnimationClip[] = []
  const seen = new Set<string>()
  for (const pack of packs) {
    for (const clip of pack.animations) {
      if (seen.has(clip.name)) continue
      seen.add(clip.name)
      clips.push(clip)
    }
  }
  return { template: packs[0].scene, clips }
}

export async function loadCharacterAssets(
  model: string
): Promise<CharacterAssets> {
  let cached = assetsCache.get(model)
  if (!cached) {
    cached = fetchScene3dManifest().then((entries) => {
      const entry = entries.find((candidate) => candidate.id === model)
      if (!entry) {
        throw new Error(`Unknown scene3d character model: ${model}`)
      }
      return loadPacks(entry)
    })
    cached.catch(() => assetsCache.delete(model))
    assetsCache.set(model, cached)
  }
  return cached
}

export async function getCharacterClipNames(model: string): Promise<string[]> {
  const assets = await loadCharacterAssets(model)
  return assets.clips.map((clip) => clip.name)
}


const customModelCache = new Map<string, Promise<CharacterAssets>>()

function modelUrlExtension(url: string): string {
  try {
    const params = new URL(url, 'http://x').searchParams
    const filename = params.get('filename') ?? url
    const dot = filename.lastIndexOf('.')
    return dot >= 0 ? filename.slice(dot).toLowerCase() : ''
  } catch {
    return ''
  }
}

function wrapModelTemplate(root: THREE.Group): THREE.Group {
  const wrapper = new THREE.Group()
  wrapper.name = '__model_template_root__'
  wrapper.add(root)
  return wrapper
}

export async function loadCustomModelAssets(
  url: string
): Promise<CharacterAssets> {
  let cached = customModelCache.get(url)
  if (!cached) {
    cached = (async () => {
      const ext = modelUrlExtension(url)
      if (ext === '.fbx') {
        const fbx = await new FBXLoader().loadAsync(assetUrl(url))
        return {
          template: wrapModelTemplate(fbx),
          clips: fbx.animations ?? []
        }
      }
      if (ext === '.obj') {
        const obj = await new OBJLoader().loadAsync(assetUrl(url))
        return {
          template: wrapModelTemplate(obj),
          clips: []
        }
      }
      const gltf = await new GLTFLoader().loadAsync(assetUrl(url))
      return {
        template: wrapModelTemplate(gltf.scene),
        clips: gltf.animations ?? []
      }
    })()
    cached.catch(() => customModelCache.delete(url))
    customModelCache.set(url, cached)
  }
  return cached
}

export async function getCustomModelClipNames(url: string): Promise<string[]> {
  const assets = await loadCustomModelAssets(url)
  return assets.clips.map((clip) => clip.name)
}
