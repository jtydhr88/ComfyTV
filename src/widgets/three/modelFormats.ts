import * as THREE from 'three'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

let sparkPromise: Promise<typeof import('@sparkjsdev/spark')> | null = null
export function loadSpark(): Promise<typeof import('@sparkjsdev/spark')> {
  return (sparkPromise ??= import('@sparkjsdev/spark'))
}

export const MESH_MODEL_EXTENSIONS = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae'] as const
export const SPLAT_MODEL_EXTENSIONS = ['.spz', '.splat', '.ksplat'] as const
export const POINTCLOUD_MODEL_EXTENSIONS = ['.ply'] as const

export const MODEL_FILE_EXTENSIONS = [
  ...MESH_MODEL_EXTENSIONS,
  ...SPLAT_MODEL_EXTENSIONS,
  ...POINTCLOUD_MODEL_EXTENSIONS,
] as const

export type ModelRenderKind = 'mesh' | 'splat' | 'pointcloud'

export function modelUrlExtension(url: string): string {
  try {
    const params = new URL(url, 'http://x').searchParams
    const filename = params.get('filename') ?? url
    const dot = filename.lastIndexOf('.')
    return dot >= 0 ? filename.slice(dot).toLowerCase() : ''
  } catch {
    return ''
  }
}

export function isMeshModelUrl(url: string): boolean {
  return (MESH_MODEL_EXTENSIONS as readonly string[]).includes(modelUrlExtension(url))
}

export async function isGaussianSplatPLY(bytes: ArrayBuffer): Promise<boolean> {
  try {
    const { PlyReader } = await loadSpark()
    const reader = new PlyReader({ fileBytes: bytes })
    await reader.parseHeader()
    const props = (reader.elements as any)?.vertex?.properties
    if (!props) return false
    const hasScales = !!(props.scale_0 && props.scale_1 && props.scale_2)
    const hasRots = !!(props.rot_0 && props.rot_1 && props.rot_2 && props.rot_3)
    return hasScales && hasRots
  } catch {
    return false
  }
}

export async function classifyModelBytes(
  url: string,
  fetchBytes: () => Promise<ArrayBuffer>,
): Promise<ModelRenderKind> {
  const ext = modelUrlExtension(url)
  if ((MESH_MODEL_EXTENSIONS as readonly string[]).includes(ext)) return 'mesh'
  if ((SPLAT_MODEL_EXTENSIONS as readonly string[]).includes(ext)) return 'splat'
  if (ext === '.ply') {
    return (await isGaussianSplatPLY(await fetchBytes())) ? 'splat' : 'pointcloud'
  }
  return 'mesh'
}

export function buildPointCloud(bytes: ArrayBuffer): THREE.Group {
  const geometry = new PLYLoader().parse(bytes)
  geometry.computeBoundingSphere()
  if (geometry.boundingSphere) {
    const { center, radius } = geometry.boundingSphere
    geometry.translate(-center.x, -center.y, -center.z)
    if (radius > 0) {
      const scale = 1.0 / radius
      geometry.scale(scale, scale, scale)
    }
  }
  const hasVertexColors = !!geometry.getAttribute('color')
  const material = new THREE.PointsMaterial({
    size: 0.005,
    sizeAttenuation: true,
    ...(hasVertexColors ? { vertexColors: true } : { color: 0xcccccc }),
  })
  const group = new THREE.Group()
  group.add(new THREE.Points(geometry, material))
  return group
}
