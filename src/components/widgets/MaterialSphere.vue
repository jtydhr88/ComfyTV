<template>
  <div
    ref="hostEl"
    class="ctv:relative ctv:size-full ctv:min-h-[180px] ctv:overflow-hidden ctv:rounded-sm ctv:bg-black"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { RendererView } from '@/widgets/three/RendererView'
import { applyMaterialParams } from '@/widgets/material/three'
import type { MaterialParams } from '@/widgets/material/types'

const props = defineProps<{
  params: MaterialParams
}>()

const emit = defineEmits<{
  (e: 'rendered'): void
}>()

const hostEl = ref<HTMLDivElement | null>(null)

let view: RendererView | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let material: THREE.MeshPhysicalMaterial | null = null
let sphere: THREE.Mesh | null = null
let renderQueued = false

let envTexture: THREE.Texture | null = null
function ensureEnvTexture(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (!envTexture) {
    const pmrem = new THREE.PMREMGenerator(renderer)
    envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
  }
  return envTexture
}

function applyParams(): void {
  if (!material) return
  applyMaterialParams(material, props.params)
}

function renderNow(): void {
  if (!view || !scene || !camera) return
  view.renderScene(scene, camera)
  emit('rendered')
}

function scheduleRender(): void {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    renderNow()
  })
}

function syncSize(): void {
  if (!view || !hostEl.value || !camera) return
  const w = hostEl.value.clientWidth || 260
  const h = hostEl.value.clientHeight || 200
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  view.setSize(w * scale, h * scale)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  scheduleRender()
}

onMounted(() => {
  if (!hostEl.value) return

  view = new RendererView(hostEl.value)
  view.state.clearColor = new THREE.Color(0x1c1c22)
  view.state.clearAlpha = 1

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1c1c22)
  scene.environment = ensureEnvTexture(view.renderer)

  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20)
  camera.position.set(0, 0.35, 3.6)
  camera.lookAt(0, 0, 0)

  material = new THREE.MeshPhysicalMaterial({ thickness: 1 })
  sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material)
  scene.add(sphere)

  applyParams()
  syncSize()
  view.observeResize(hostEl.value, syncSize)
})

watch(() => ({ ...props.params }), () => {
  applyParams()
  scheduleRender()
}, { deep: true })

onBeforeUnmount(() => {
  sphere?.geometry.dispose()
  material?.dispose()
  sphere = null
  material = null
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
    return view.renderToCanvas(scene, captureCamera, width, height)
  },
})
</script>
