import { ref, watch } from 'vue'
import * as THREE from 'three'

import { app } from '@/lib/comfyApp'
import { persistModelThumbnail } from '@/api/nativeAssets'
import { applyMaterialParams } from '@/widgets/material/three'
import type { MaterialParams } from '@/widgets/material/types'
import { OVERLAY_FLAG, type ViewChannel } from '@/widgets/three/channelShading'

export const THUMBNAIL_SIZE = 256
export const THUMBNAIL_DELAY_MS = 600
export const PICK_DRAG_PX = 5

export interface ModelStats {
  vertices: number
  triangles: number
}

export function modelAssetUrl(path: string): string {
  const api = (app as any).api
  return typeof api?.fileURL === 'function' ? api.fileURL(path) : path
}

export function urlFilename(url: string): string {
  try {
    const params = new URL(url, window.location.origin).searchParams
    return params.get('filename') ?? url.split('/').pop() ?? 'model'
  } catch {
    return 'model'
  }
}

export async function fetchModelBytes(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(modelAssetUrl(url))
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`)
  return resp.arrayBuffer()
}

export function collectPartMeshes(root: THREE.Object3D): Map<string, THREE.Mesh> {
  const meshes = new Map<string, THREE.Mesh>()
  const counts = new Map<string, number>()
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const base = child.name || 'mesh'
    const n = (counts.get(base) ?? 0) + 1
    counts.set(base, n)
    const key = n === 1 ? base : `${base}#${n}`
    meshes.set(key, child)
    child.userData.comfytvPartKey = key
  })
  return meshes
}

export function computeModelStats(meshes: Iterable<THREE.Mesh>): ModelStats {
  let vertices = 0
  let triangles = 0
  for (const mesh of meshes) {
    const geo = mesh.geometry
    if (!(geo instanceof THREE.BufferGeometry)) continue
    vertices += geo.attributes.position?.count ?? 0
    triangles += Math.floor((geo.index ? geo.index.count : geo.attributes.position?.count ?? 0) / 3)
  }
  return { vertices, triangles }
}

export function pickNdc(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): THREE.Vector2 | null {
  if (!rect.width || !rect.height) return null
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  )
}

export interface ModelPreviewPartProps {
  pickable?: boolean
  partMaterials?: Record<string, MaterialParams | null>
  selectedPart?: string | null
  channel?: ViewChannel
}

export type ModelPreviewEmit = {
  (e: 'view-changed'): void
  (e: 'parts-changed', keys: string[]): void
  (e: 'part-pick', key: string | null): void
  (e: 'model-stats', stats: ModelStats): void
}

export interface ModelPreviewHost {
  getCamera(): THREE.Camera | null
  getModelRoot(): THREE.Object3D | null
  getCanvasRect(): { left: number; top: number; width: number; height: number } | null
  renderThumbnail(size: number): HTMLCanvasElement | null
}

export function useModelPreview(
  props: ModelPreviewPartProps,
  emit: ModelPreviewEmit,
  host: ModelPreviewHost,
) {
  const loading = ref(true)
  const loadError = ref(false)

  let loadSeq = 0
  let thumbnailTimer: number | null = null

  const partMeshes = new Map<string, THREE.Mesh>()
  const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>()
  const boundMaterials = new Map<string, THREE.MeshPhysicalMaterial>()
  let highlightKey: string | null = null
  let highlightClone: THREE.Material | null = null
  let appliedMaterialsSig = ''

  function beginLoad(): number {
    return ++loadSeq
  }

  function isStale(seq: number): boolean {
    return seq !== loadSeq
  }

  function disposeParts(): void {
    clearHighlight()
    partMeshes.clear()
    originalMaterials.clear()
    for (const mat of boundMaterials.values()) mat.dispose()
    boundMaterials.clear()
    emit('parts-changed', [])
  }

  function registerParts(root: THREE.Object3D): void {
    partMeshes.clear()
    originalMaterials.clear()
    for (const [key, mesh] of collectPartMeshes(root)) {
      partMeshes.set(key, mesh)
      originalMaterials.set(key, mesh.material)
    }
    emit('parts-changed', [...partMeshes.keys()])
    emit('model-stats', computeModelStats(partMeshes.values()))
  }

  function activeMaterialFor(key: string): THREE.Material | THREE.Material[] | undefined {
    const bound = boundMaterials.get(key)
    if (bound && props.partMaterials?.[key]) return bound
    return originalMaterials.get(key)
  }

  function applyPartMaterials(force = false): void {
    if (!partMeshes.size) return
    if ((props.channel ?? 'material') !== 'material') return
    const sig = JSON.stringify(props.partMaterials ?? {})
    if (!force && sig === appliedMaterialsSig) return
    appliedMaterialsSig = sig
    for (const [key, mesh] of partMeshes) {
      const params = props.partMaterials?.[key]
      if (params) {
        let mat = boundMaterials.get(key)
        if (!mat) {
          mat = new THREE.MeshPhysicalMaterial()
          boundMaterials.set(key, mat)
        }
        applyMaterialParams(mat, params)
        if (highlightKey !== key) mesh.material = mat
      } else if (highlightKey !== key) {
        const original = originalMaterials.get(key)
        if (original) mesh.material = original
      }
    }
    if (highlightKey) setHighlight(highlightKey)
    emit('view-changed')
  }

  function clearHighlight(): void {
    if (highlightKey) {
      const mesh = partMeshes.get(highlightKey)
      const active = activeMaterialFor(highlightKey)
      if (mesh && active) mesh.material = active
    }
    highlightClone?.dispose()
    highlightClone = null
    highlightKey = null
  }

  function setHighlight(key: string | null): void {
    clearHighlight()
    if (!key || (props.channel ?? 'material') !== 'material') return
    const mesh = partMeshes.get(key)
    if (!mesh) return
    const active = activeMaterialFor(key)
    const base = Array.isArray(active) ? active[0] : active
    if (!base) return
    const clone = base.clone()
    if ('emissive' in clone) {
      (clone as THREE.MeshStandardMaterial).emissive.set(0x4ea8ff)
      ;(clone as THREE.MeshStandardMaterial).emissiveIntensity = 0.45
    } else {
      clone.transparent = true
      clone.opacity = 0.7
    }
    highlightKey = key
    highlightClone = clone
    mesh.material = clone
  }

  function suspendHighlight(): () => void {
    const held = highlightKey
    if (held) clearHighlight()
    return () => {
      if (held) setHighlight(held)
    }
  }

  let pickStart: { x: number; y: number } | null = null

  function onPickDown(e: PointerEvent): void {
    if (!props.pickable || e.button !== 0) return
    pickStart = { x: e.clientX, y: e.clientY }
  }

  function onPickUp(e: PointerEvent): void {
    const start = pickStart
    pickStart = null
    if (!props.pickable || !start) return
    const camera = host.getCamera()
    const modelRoot = host.getModelRoot()
    if (!camera || !modelRoot) return
    if (Math.abs(e.clientX - start.x) >= PICK_DRAG_PX
      || Math.abs(e.clientY - start.y) >= PICK_DRAG_PX) return
    const rect = host.getCanvasRect()
    if (!rect) return
    const ndc = pickNdc(e.clientX, e.clientY, rect)
    if (!ndc) return
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObject(modelRoot, true)
    const hit = hits.find((h) => h.object instanceof THREE.Mesh && !h.object.userData[OVERLAY_FLAG])
    emit('part-pick', (hit?.object?.userData?.comfytvPartKey as string) ?? null)
  }

  function scheduleThumbnailPersist(url: string): void {
    if (thumbnailTimer != null) window.clearTimeout(thumbnailTimer)
    const mySeq = loadSeq
    thumbnailTimer = window.setTimeout(() => {
      thumbnailTimer = null
      if (mySeq !== loadSeq) return
      try {
        const canvas = host.renderThumbnail(THUMBNAIL_SIZE)
        if (!canvas) return
        canvas.toBlob((blob) => {
          if (blob) void persistModelThumbnail(url, blob)
        }, 'image/png')
      } catch (e) {
        console.warn('[ComfyTV/ModelPreview] thumbnail capture failed', e)
      }
    }, THUMBNAIL_DELAY_MS)
  }

  function teardown(): void {
    loadSeq++
    if (thumbnailTimer != null) window.clearTimeout(thumbnailTimer)
    thumbnailTimer = null
  }

  watch(() => props.partMaterials, () => applyPartMaterials(), { deep: true })

  watch(() => props.selectedPart, (key) => setHighlight(key ?? null))

  return {
    loading,
    loadError,
    beginLoad,
    isStale,
    disposeParts,
    registerParts,
    applyPartMaterials,
    clearHighlight,
    setHighlight,
    suspendHighlight,
    onPickDown,
    onPickUp,
    scheduleThumbnailPersist,
    teardown,
  }
}
