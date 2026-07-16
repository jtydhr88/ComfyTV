import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export const CONVERTIBLE_MODEL_EXTENSIONS = ['.fbx', '.obj', '.stl', '.dae'] as const

export function isConvertibleModelFile(name: string): boolean {
  const lower = name.toLowerCase()
  return CONVERTIBLE_MODEL_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function baseNameNoExt(name: string): string {
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  const base = slash >= 0 ? name.slice(slash + 1) : name
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

async function parseToObject(file: File): Promise<THREE.Object3D> {
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.fbx')) {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
    return new FBXLoader().parse(await file.arrayBuffer(), '')
  }
  if (lower.endsWith('.obj')) {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
    return new OBJLoader().parse(await file.text())
  }
  if (lower.endsWith('.stl')) {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
    const geometry = new STLLoader().parse(await file.arrayBuffer())
    const material = new THREE.MeshStandardMaterial({ color: 0xcccccc })
    const group = new THREE.Group()
    group.add(new THREE.Mesh(geometry, material))
    return group
  }
  if (lower.endsWith('.dae')) {
    const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js')
    const collada = new ColladaLoader().parse(await file.text(), '')
    if (!collada?.scene) throw new Error(`failed to parse ${file.name}`)
    return collada.scene
  }
  throw new Error(`unsupported model format: ${file.name}`)
}

export async function convertModelFileToGlb(file: File): Promise<File> {
  const object = await parseToObject(file)
  const result = await new GLTFExporter().parseAsync(object, { binary: true })
  if (!(result instanceof ArrayBuffer)) {
    throw new Error('GLTFExporter did not return binary GLB')
  }
  return new File([result], `${baseNameNoExt(file.name)}.glb`, { type: 'model/gltf-binary' })
}
