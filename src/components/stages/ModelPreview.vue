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

import {
  fetchModelBytes,
  urlFilename,
  useModelPreview,
  type ModelStats,
} from '@/composables/stages/useModelPreview'
import { buildPointCloud, classifyModelBytes, loadSpark } from '@/widgets/three/modelFormats'
import { guardOrbitControlsDragEnd } from '@/widgets/three/orbitControlsGuard'
import { RendererView } from '@/widgets/three/RendererView'
import { buildPrimitiveMesh, parsePrimitiveRecipe } from '@/widgets/three/primitiveGeometry'
import { loadCustomModelAssets } from '@/widgets/three/scene3d/scene3dAssets'
import { applyViewChannel, type ViewChannel } from '@/widgets/three/channelShading'
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
  (e: 'model-stats', stats: ModelStats): void
}>()

const hostEl = ref<HTMLDivElement | null>(null)

let view: RendererView | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let disposeDragGuard: (() => void) | null = null
let modelRoot: THREE.Object3D | null = null
let modelDispose: (() => void) | null = null
let sparkRenderer: THREE.Object3D | null = null
let animationId: number | null = null

const mp = useModelPreview(props, emit, {
  getCamera: () => camera,
  getModelRoot: () => modelRoot,
  getCanvasRect: () => view?.canvas.getBoundingClientRect() ?? null,
  renderThumbnail: (size) => {
    if (!view || !scene || !camera) return null
    const captureCamera = camera.clone()
    captureCamera.aspect = 1
    captureCamera.updateProjectionMatrix()
    return view.renderToCanvas(scene, captureCamera, size, size)
  },
})

const { loading, loadError } = mp

async function ensureSparkRenderer(): Promise<void> {
  if (sparkRenderer || !scene || !view) return
  const { SparkRenderer } = await loadSpark()
  if (sparkRenderer || !scene || !view) return
  sparkRenderer = new SparkRenderer({ renderer: view.renderer })
  scene.add(sparkRenderer)
}

function disposeModelRoot(): void {
  if (modelRoot && scene) scene.remove(modelRoot)
  modelRoot = null
  modelDispose?.()
  modelDispose = null
  mp.disposeParts()
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
  const prim = parsePrimitiveRecipe(url)
  if (prim) {
    const group = new THREE.Group()
    group.add(buildPrimitiveMesh(prim.kind, prim.params))
    return { root: group, dispose: null }
  }

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
  const mySeq = mp.beginLoad()
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
    if (mp.isStale(mySeq) || !scene) {
      loaded.dispose?.()
      return
    }
    modelRoot = loaded.root
    modelDispose = loaded.dispose
    scene.add(loaded.root)
    mp.registerParts(loaded.root)
    mp.applyPartMaterials(true)
    if (props.selectedPart) mp.setHighlight(props.selectedPart)
    if ((props.channel ?? 'material') !== 'material') {
      applyViewChannel(loaded.root, props.channel as ViewChannel)
    }
    frameModel(loaded.root)
    loading.value = false
    emit('view-changed')
    mp.scheduleThumbnailPersist(url)
  } catch (e) {
    console.error('[ComfyTV/ModelPreview] failed to load model', url, e)
    if (mp.isStale(mySeq)) return
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

  view.canvas.addEventListener('pointerdown', mp.onPickDown)
  view.canvas.addEventListener('pointerup', mp.onPickUp)

  syncSize()
  view.observeResize(hostEl.value, syncSize)
  animate()

  void loadModel(props.src)
})

watch(() => props.src, (url) => { void loadModel(url || '') })

watch(() => props.channel, (ch) => {
  if (!modelRoot) return
  mp.clearHighlight()
  applyViewChannel(modelRoot, (ch ?? 'material') as ViewChannel)
  if ((ch ?? 'material') === 'material') {
    mp.applyPartMaterials(true)
    if (props.selectedPart) mp.setHighlight(props.selectedPart)
  }
  emit('view-changed')
})

onBeforeUnmount(() => {
  mp.teardown()
  if (animationId != null) cancelAnimationFrame(animationId)
  animationId = null
  view?.canvas.removeEventListener('pointerdown', mp.onPickDown)
  view?.canvas.removeEventListener('pointerup', mp.onPickUp)
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
  cameraState(): { position: number[]; target: number[]; fov: number } | null {
    if (!camera || !controls) return null
    return {
      position: camera.position.toArray(),
      target: controls.target.toArray(),
      fov: camera.fov,
    }
  },
  captureCanvas(width: number, height: number): HTMLCanvasElement | null {
    if (!view || !scene || !camera) return null
    const captureCamera = camera.clone()
    captureCamera.aspect = width / height
    captureCamera.updateProjectionMatrix()
    const restoreHighlight = mp.suspendHighlight()
    try {
      return view.renderToCanvas(scene, captureCamera, width, height)
    } finally {
      restoreHighlight()
    }
  },
})
</script>
