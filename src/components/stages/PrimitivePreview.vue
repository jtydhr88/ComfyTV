<template>
  <div
    ref="hostEl"
    data-capture-wheel="true"
    tabindex="-1"
    @pointerenter="onHostEnter"
    class="ctv:relative ctv:w-full ctv:h-full ctv:min-h-[220px] ctv:overflow-hidden ctv:rounded-sm ctv:bg-black ctv:touch-none ctv:outline-none"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { RendererView } from '@/widgets/three/RendererView'
import { guardOrbitControlsDragEnd } from '@/widgets/three/orbitControlsGuard'
import { applyViewChannel, type ViewChannel } from '@/widgets/three/channelShading'
import { buildPrimitiveGeometry, type PrimKind } from '@/composables/stages/useMeshPrimitive'

const props = defineProps<{
  kind: PrimKind
  params: Record<string, number | boolean>
  channel?: ViewChannel
}>()
const emit = defineEmits<{ (e: 'view-changed'): void }>()

const hostEl = ref<HTMLDivElement | null>(null)

let view: RendererView | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let mesh: THREE.Mesh | null = null
let disposeDragGuard: (() => void) | null = null
let animationId: number | null = null

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

function rebuild(): void {
  if (!scene) return
  const geom = buildPrimitiveGeometry(props.kind, props.params)
  if (mesh) {
    mesh.geometry.dispose()
    mesh.geometry = geom
  } else {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9aa4b2,
      metalness: 0.05,
      roughness: 0.75,
      side: THREE.DoubleSide,
    })
    mesh = new THREE.Mesh(geom, mat)
    scene.add(mesh)
  }
  if ((props.channel ?? 'material') !== 'material') {
    applyViewChannel(mesh, props.channel as ViewChannel)
  }
  emit('view-changed')
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

  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
  camera.position.set(2, 1.6, 2)

  view = new RendererView(hostEl.value)
  view.state.clearColor = new THREE.Color(0x141418)
  view.state.clearAlpha = 1

  controls = new OrbitControls(camera, view.canvas)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  disposeDragGuard = guardOrbitControlsDragEnd(controls, view.canvas)
  controls.addEventListener('end', () => emit('view-changed'))

  syncSize()
  view.observeResize(hostEl.value, syncSize)
  rebuild()
  animate()
})

watch(() => props.kind, () => rebuild())
watch(() => props.params, () => rebuild(), { deep: true })

watch(() => props.channel, (ch) => {
  if (!mesh) return
  applyViewChannel(mesh, (ch ?? 'material') as ViewChannel)
  emit('view-changed')
})

onBeforeUnmount(() => {
  if (animationId != null) cancelAnimationFrame(animationId)
  animationId = null
  disposeDragGuard?.()
  disposeDragGuard = null
  controls?.dispose()
  controls = null
  if (mesh) {
    applyViewChannel(mesh, 'material')
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
    scene?.remove(mesh)
    mesh = null
  }
  view?.dispose()
  view = null
  scene = null
  camera = null
})

defineExpose({
  captureCanvas(width = 1024, height = 1024): HTMLCanvasElement | null {
    if (!view || !scene || !camera) return null
    const cam = camera.clone()
    cam.aspect = width / height
    cam.updateProjectionMatrix()
    return view.renderToCanvas(scene, cam, width, height)
  },
})
</script>
