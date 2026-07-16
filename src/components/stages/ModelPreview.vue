<template>
  <div
    ref="hostEl"
    data-capture-wheel="true"
    tabindex="-1"
    @pointerenter="onHostEnter"
    class="ctv:relative ctv:w-full ctv:h-full ctv:min-h-[220px] ctv:overflow-hidden ctv:rounded-sm ctv:bg-black ctv:touch-none ctv:outline-none"
  >
    <div
      v-if="loading || loadError"
      class="ctv:absolute ctv:inset-0 ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5
             ctv:text-white/50 ctv:pointer-events-none"
    >
      <i :class="['pi', loadError ? 'pi-exclamation-triangle' : 'pi-box', 'ctv:text-[28px] ctv:opacity-60']" />
      <div class="ctv:text-2xs ctv:text-center ctv:px-3">
        {{ loadError ? $t('modelPreview.loadFailed') : $t('modelPreview.loading') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { app } from '@/lib/comfyApp'
import { persistModelThumbnail } from '@/api/nativeAssets'
import { buildPointCloud, classifyModelBytes, loadSpark } from '@/widgets/three/modelFormats'
import { guardOrbitControlsDragEnd } from '@/widgets/three/orbitControlsGuard'
import { RendererView } from '@/widgets/three/RendererView'
import { loadCustomModelAssets } from '@/widgets/three/scene3d/scene3dAssets'
import { applyViewChannel, OVERLAY_FLAG, type ViewChannel } from '@/widgets/three/channelShading'
import { applyMaterialParams } from '@/widgets/material/three'
import type { MaterialParams } from '@/widgets/material/types'

const props = defineProps<{
  src: string
  pickable?: boolean
  partMaterials?: Record<string, MaterialParams | null>
  selectedPart?: string | null
  channel?: ViewChannel
}>()

const emit = defineEmits<{
  (e: 'view-changed'): void
  (e: 'parts-changed', keys: string[]): void
  (e: 'part-pick', key: string | null): void
  (e: 'model-stats', stats: { vertices: number; triangles: number }): void
}>()

const hostEl = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const loadError = ref(false)

let view: RendererView | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let disposeDragGuard: (() => void) | null = null
let modelRoot: THREE.Object3D | null = null
let modelDispose: (() => void) | null = null
let sparkRenderer: THREE.Object3D | null = null
let animationId: number | null = null
let loadSeq = 0
let thumbnailTimer: number | null = null

const partMeshes = new Map<string, THREE.Mesh>()
const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>()
const boundMaterials = new Map<string, THREE.MeshPhysicalMaterial>()
let highlightKey: string | null = null
let highlightClone: THREE.Material | null = null

const THUMBNAIL_SIZE = 256
const THUMBNAIL_DELAY_MS = 600

function scheduleThumbnailPersist(url: string): void {
  if (thumbnailTimer != null) window.clearTimeout(thumbnailTimer)
  const mySeq = loadSeq
  thumbnailTimer = window.setTimeout(() => {
    thumbnailTimer = null
    if (mySeq !== loadSeq || !view || !scene || !camera) return
    try {
      const captureCamera = camera.clone()
      captureCamera.aspect = 1
      captureCamera.updateProjectionMatrix()
      const canvas = view.renderToCanvas(scene, captureCamera, THUMBNAIL_SIZE, THUMBNAIL_SIZE)
      canvas.toBlob((blob) => {
        if (blob) void persistModelThumbnail(url, blob)
      }, 'image/png')
    } catch (e) {
      console.warn('[ComfyTV/ModelPreview] thumbnail capture failed', e)
    }
  }, THUMBNAIL_DELAY_MS)
}

function assetUrl(path: string): string {
  const api = (app as any).api
  return typeof api?.fileURL === 'function' ? api.fileURL(path) : path
}

function urlFilename(url: string): string {
  try {
    const params = new URL(url, window.location.origin).searchParams
    return params.get('filename') ?? url.split('/').pop() ?? 'model'
  } catch {
    return 'model'
  }
}

async function fetchModelBytes(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(assetUrl(url))
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`)
  return resp.arrayBuffer()
}

async function ensureSparkRenderer(): Promise<void> {
  if (sparkRenderer || !scene || !view) return
  const { SparkRenderer } = await loadSpark()
  if (sparkRenderer || !scene || !view) return
  sparkRenderer = new SparkRenderer({ renderer: view.renderer })
  scene.add(sparkRenderer)
}

function disposeModelRoot(): void {
  clearHighlight()
  if (modelRoot && scene) scene.remove(modelRoot)
  modelRoot = null
  modelDispose?.()
  modelDispose = null
  partMeshes.clear()
  originalMaterials.clear()
  for (const mat of boundMaterials.values()) mat.dispose()
  boundMaterials.clear()
  emit('parts-changed', [])
}

function collectParts(root: THREE.Object3D): void {
  partMeshes.clear()
  originalMaterials.clear()
  const counts = new Map<string, number>()
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const base = child.name || 'mesh'
    const n = (counts.get(base) ?? 0) + 1
    counts.set(base, n)
    const key = n === 1 ? base : `${base}#${n}`
    partMeshes.set(key, child)
    originalMaterials.set(key, child.material)
    child.userData.comfytvPartKey = key
  })
  emit('parts-changed', [...partMeshes.keys()])

  let vertices = 0
  let triangles = 0
  for (const mesh of partMeshes.values()) {
    const geo = mesh.geometry
    if (!(geo instanceof THREE.BufferGeometry)) continue
    vertices += geo.attributes.position?.count ?? 0
    triangles += Math.floor((geo.index ? geo.index.count : geo.attributes.position?.count ?? 0) / 3)
  }
  emit('model-stats', { vertices, triangles })
}

function activeMaterialFor(key: string): THREE.Material | THREE.Material[] | undefined {
  const bound = boundMaterials.get(key)
  if (bound && props.partMaterials?.[key]) return bound
  return originalMaterials.get(key)
}

let appliedMaterialsSig = ''

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

const PICK_DRAG_PX = 5
let pickStart: { x: number; y: number } | null = null

function onPickDown(e: PointerEvent): void {
  if (!props.pickable || e.button !== 0) return
  pickStart = { x: e.clientX, y: e.clientY }
}

function onPickUp(e: PointerEvent): void {
  const start = pickStart
  pickStart = null
  if (!props.pickable || !start || !view || !camera || !modelRoot) return
  if (Math.abs(e.clientX - start.x) >= PICK_DRAG_PX
    || Math.abs(e.clientY - start.y) >= PICK_DRAG_PX) return
  const rect = view.canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, camera)
  const hits = raycaster.intersectObject(modelRoot, true)
  const hit = hits.find((h) => h.object instanceof THREE.Mesh && !h.object.userData[OVERLAY_FLAG])
  emit('part-pick', (hit?.object?.userData?.comfytvPartKey as string) ?? null)
}

function onHostEnter(): void {
  hostEl.value?.focus({ preventScroll: true })
}

function syncSize(): void {
  if (!view || !hostEl.value || !camera) return
  const w = hostEl.value.clientWidth || 300
  const h = hostEl.value.clientHeight || 220
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  view.setSize(w * scale, h * scale)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function frameModel(root: THREE.Object3D): void {
  if (!camera || !controls) return
  const bounds = new THREE.Box3().setFromObject(root)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bounds.getCenter(center)
  bounds.getSize(size)
  let maxDim = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(maxDim) || maxDim <= 0) {
    center.set(0, 0, 0)
    maxDim = 2
  }
  const dist = maxDim * 1.8
  camera.position.set(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.7)
  camera.near = Math.max(maxDim / 1000, 0.001)
  camera.far = Math.max(maxDim * 100, 100)
  camera.updateProjectionMatrix()
  controls.target.copy(center)
  controls.update()
}

interface LoadedModel {
  root: THREE.Object3D
  dispose: (() => void) | null
}

async function loadModelObject(url: string): Promise<LoadedModel> {
  let bytes: ArrayBuffer | null = null
  const fetchBytes = async () => (bytes ??= await fetchModelBytes(url))
  const kind = await classifyModelBytes(url, fetchBytes)

  if (kind === 'splat') {
    const [{ SplatMesh }] = await Promise.all([loadSpark(), ensureSparkRenderer()])
    const splat = new SplatMesh({
      fileBytes: await fetchBytes(),
      fileName: urlFilename(url),
    })
    await splat.initialized
    splat.quaternion.set(1, 0, 0, 0)
    const group = new THREE.Group()
    group.add(splat)
    return { root: group, dispose: () => splat.dispose() }
  }

  if (kind === 'pointcloud') {
    const group = buildPointCloud(await fetchBytes())
    return {
      root: group,
      dispose: () => {
        group.traverse((child) => {
          if (child instanceof THREE.Points) {
            child.geometry.dispose()
            const mat = child.material
            for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose()
          }
        })
      },
    }
  }

  const assets = await loadCustomModelAssets(url)
  return { root: cloneSkinned(assets.template), dispose: null }
}

async function loadModel(url: string): Promise<void> {
  const mySeq = ++loadSeq
  disposeModelRoot()
  if (!url) {
    loading.value = false
    loadError.value = false
    return
  }
  loading.value = true
  loadError.value = false
  try {
    const loaded = await loadModelObject(url)
    if (mySeq !== loadSeq || !scene) {
      loaded.dispose?.()
      return
    }
    modelRoot = loaded.root
    modelDispose = loaded.dispose
    scene.add(loaded.root)
    collectParts(loaded.root)
    applyPartMaterials(true)
    if (props.selectedPart) setHighlight(props.selectedPart)
    if ((props.channel ?? 'material') !== 'material') {
      applyViewChannel(loaded.root, props.channel as ViewChannel)
    }
    frameModel(loaded.root)
    loading.value = false
    emit('view-changed')
    scheduleThumbnailPersist(url)
  } catch (e) {
    console.error('[ComfyTV/ModelPreview] failed to load model', url, e)
    if (mySeq !== loadSeq) return
    loading.value = false
    loadError.value = true
  }
}

function animate(): void {
  animationId = requestAnimationFrame(animate)
  if (!view || !scene || !camera) return
  controls?.update()
  view.renderScene(scene, camera)
}

onMounted(() => {
  if (!hostEl.value) return

  scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(3, 5, 4)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.5)
  fill.position.set(-4, 2, -3)
  scene.add(fill)

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  camera.position.set(2, 1.5, 2)

  view = new RendererView(hostEl.value)
  view.state.clearColor = new THREE.Color(0x141418)
  view.state.clearAlpha = 1

  controls = new OrbitControls(camera, view.canvas)
  controls.enableDamping = true
  disposeDragGuard = guardOrbitControlsDragEnd(controls, view.canvas)
  controls.addEventListener('end', () => emit('view-changed'))

  view.canvas.addEventListener('pointerdown', onPickDown)
  view.canvas.addEventListener('pointerup', onPickUp)

  syncSize()
  view.observeResize(hostEl.value, syncSize)
  animate()

  void loadModel(props.src)
})

watch(() => props.src, (url) => { void loadModel(url || '') })

watch(() => props.partMaterials, () => applyPartMaterials(), { deep: true })

watch(() => props.selectedPart, (key) => setHighlight(key ?? null))

watch(() => props.channel, (ch) => {
  if (!modelRoot) return
  clearHighlight()
  applyViewChannel(modelRoot, (ch ?? 'material') as ViewChannel)
  if ((ch ?? 'material') === 'material') {
    applyPartMaterials(true)
    if (props.selectedPart) setHighlight(props.selectedPart)
  }
  emit('view-changed')
})

onBeforeUnmount(() => {
  loadSeq++
  if (thumbnailTimer != null) window.clearTimeout(thumbnailTimer)
  thumbnailTimer = null
  if (animationId != null) cancelAnimationFrame(animationId)
  animationId = null
  view?.canvas.removeEventListener('pointerdown', onPickDown)
  view?.canvas.removeEventListener('pointerup', onPickUp)
  disposeDragGuard?.()
  disposeDragGuard = null
  controls?.dispose()
  controls = null
  disposeModelRoot()
  if (sparkRenderer) {
    scene?.remove(sparkRenderer)
    ;(sparkRenderer as unknown as { dispose?: () => void }).dispose?.()
    sparkRenderer = null
  }
  view?.dispose()
  view = null
  scene = null
  camera = null
})

defineExpose({
  captureCanvas(width: number, height: number): HTMLCanvasElement | null {
    if (!view || !scene || !camera) return null
    const captureCamera = camera.clone()
    captureCamera.aspect = width / height
    captureCamera.updateProjectionMatrix()
    const held = highlightKey
    if (held) clearHighlight()
    try {
      return view.renderToCanvas(scene, captureCamera, width, height)
    } finally {
      if (held) setHighlight(held)
    }
  },
})
</script>
