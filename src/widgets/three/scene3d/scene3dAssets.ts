import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { app } from '@/lib/comfyApp'
import { decryptAsset, decryptAssetJson } from '@/utils/assetCipher'
import {
  buildPointCloud,
  classifyModelBytes,
  loadSpark,
  type ModelRenderKind
} from '@/widgets/three/modelFormats'
import { buildPrimitiveMesh, parsePrimitiveRecipe } from '@/widgets/three/primitiveGeometry'

export interface Scene3dCharacterManifestEntry {
  id: string
  name: string
  animations: string[]
  preview_model?: string
  model?: string
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
    ) &&
    (candidate.model === undefined ||
      (typeof candidate.model === 'string' && !candidate.model.includes('..')))
  )
}

export function stripNonPelvisTranslations(
  clips: THREE.AnimationClip[]
): THREE.AnimationClip[] {
  return clips.map((clip) => {
    const tracks = clip.tracks.filter((track) => {
      if (!track.name.endsWith('.position')) return true
      const node = track.name.slice(0, -'.position'.length)
      return node === 'pelvis' || node.endsWith('/pelvis')
    })
    const copy = new THREE.AnimationClip(clip.name, clip.duration, tracks)
    return copy
  })
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
  let clips: THREE.AnimationClip[] = []
  const seen = new Set<string>()
  for (const pack of packs) {
    for (const clip of pack.animations) {
      if (seen.has(clip.name)) continue
      seen.add(clip.name)
      clips.push(clip)
    }
  }
  let template = packs[0].scene
  if (entry.model) {
    const body = await loadEncryptedGltf(
      assetUrl(`${ASSETS_ROOT}/${entry.model}`)
    )
    template = body.scene
    clips = stripNonPelvisTranslations(clips)
  }
  return { template, clips }
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
  const prim = parsePrimitiveRecipe(url)
  if (prim) {
    const group = new THREE.Group()
    group.add(buildPrimitiveMesh(prim.kind, prim.params))
    return { template: wrapModelTemplate(group), clips: [] }
  }
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

export interface SceneModelInstance {
  kind: ModelRenderKind
  root: THREE.Object3D
  clips: THREE.AnimationClip[]
  dispose: (() => void) | null
}

function sceneModelFilename(url: string): string {
  try {
    const name = new URL(url, 'http://x').searchParams.get('filename')
    if (name) return name
  } catch {}
  return url.split('/').pop() || 'model'
}

export async function loadSceneModelInstance(
  url: string
): Promise<SceneModelInstance> {
  const meshInstance = async (): Promise<SceneModelInstance> => {
    const assets = await loadCustomModelAssets(url)
    return {
      kind: 'mesh',
      root: cloneSkinned(assets.template),
      clips: assets.clips,
      dispose: null
    }
  }
  if (parsePrimitiveRecipe(url)) return meshInstance()

  let bytes: ArrayBuffer | null = null
  const fetchBytes = async (): Promise<ArrayBuffer> => {
    if (!bytes) {
      const resp = await fetch(assetUrl(url))
      if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`)
      bytes = await resp.arrayBuffer()
    }
    return bytes
  }
  const kind = await classifyModelBytes(url, fetchBytes)

  if (kind === 'splat') {
    const { SplatMesh } = await loadSpark()
    const splat = new SplatMesh({
      fileBytes: await fetchBytes(),
      fileName: sceneModelFilename(url)
    })
    await splat.initialized
    splat.quaternion.set(1, 0, 0, 0)
    const group = new THREE.Group()
    group.userData.comfytvSplat = true
    group.add(splat)
    return { kind, root: group, clips: [], dispose: () => splat.dispose() }
  }

  if (kind === 'pointcloud') {
    const group = buildPointCloud(await fetchBytes())
    return {
      kind,
      root: group,
      clips: [],
      dispose: () => {
        group.traverse((child) => {
          if (child instanceof THREE.Points) {
            child.geometry.dispose()
            const material = child.material
            for (const m of Array.isArray(material) ? material : [material]) {
              m.dispose()
            }
          }
        })
      }
    }
  }

  return meshInstance()
}
