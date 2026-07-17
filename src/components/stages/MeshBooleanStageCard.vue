<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground"
    @contextmenu.stop.prevent
  >
    <div
      ref="hostEl"
      data-capture-wheel="true"
      tabindex="-1"
      class="ctv:group ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[280px] ctv:rounded-md ctv:overflow-hidden
             ctv:bg-black ctv:touch-none ctv:outline-none"
      @pointerenter="onHostEnter"
    >
      <div v-if="!modelAUrl || !modelBUrl"
           class="ctv:absolute ctv:inset-0 ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5
                  ctv:text-white/50 ctv:pointer-events-none">
        <IconBox class="ctv:size-8 ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('meshOps.needTwoModels') }}</div>
      </div>

      <div class="ctv:absolute ctv:top-1 ctv:left-1 ctv:z-10 ctv:flex ctv:gap-1">
        <template v-if="!viewingResult">
          <button v-for="m in GIZMO_MODES" :key="m" type="button"
                  :class="chipClass(gizmoMode === m)"
                  @click.stop="setGizmoMode(m)">{{ $t(`meshOps.gizmo.${m}`) }}</button>
          <button type="button" :class="chipClass(false)"
                  @click.stop="resetTransform">{{ $t('meshOps.gizmo.reset') }}</button>
        </template>
        <template v-if="resultUrl">
          <button type="button" :class="chipClass(!viewingResult)" @click.stop="showResult = false">
            {{ $t('meshOps.source') }}
          </button>
          <button type="button" :class="chipClass(viewingResult)" @click.stop="showResult = true">
            {{ $t('meshOps.result') }}
          </button>
        </template>
      </div>

      <div class="ctv:absolute ctv:bottom-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1">
        <button v-for="ch in CHANNELS" :key="ch" type="button"
                :class="chipClass(channel === ch)"
                @click.stop="setChannel(ch)">{{ $t(`meshOps.channel.${ch}`) }}</button>
      </div>
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:shrink-0" @pointerdown.stop @mousedown.stop>
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:w-28 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground">
          {{ $t('meshOps.booleanOp') }}</span>
        <button v-for="opt in OPERATIONS" :key="opt" type="button"
                :class="chipClass(operation === opt)"
                @click="setOperation(opt)">{{ $t(`meshOps.opt.${opt}`) }}</button>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:w-28 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground">
          {{ $t('meshOps.voxelResolution') }}</span>
        <input type="range" class="ctv:flex-1 ctv:min-w-0" min="32" max="1024" step="32"
               :value="resolution" @input="setResolution(($event.target as HTMLInputElement).value)" />
        <span class="ctv:w-12 ctv:text-right ctv:text-2xs ctv:font-mono">{{ resolution }}</span>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide ctv:shrink-0">
      <span v-if="!modelAUrl || !modelBUrl" class="ctv:text-muted-foreground">{{ $t('meshOps.needTwoModels') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('meshOps.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('meshOps.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('meshOps.placeThenRun') }}</span>
    </div>

    <div class="ctv:shrink-0">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-output
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import IconBox from '~icons/lucide/box'

import type { LGraphNode } from '@/lib/comfyApp'
import StageCard from '@/components/stages/StageCard.vue'
import type { StageState } from '@/stores/stageStore'
import {
  BOOLEAN_CHANNELS as CHANNELS,
  BOOLEAN_GIZMO_MODES as GIZMO_MODES,
  BOOLEAN_OPERATIONS as OPERATIONS,
  computeFrameFit,
  useMeshBoolean,
  type BooleanGizmoMode as GizmoMode
} from '@/composables/stages/useMeshBoolean'
import {
  MODEL_VIEW_CAPTURE_SIZE,
  useModelViewCapture
} from '@/composables/stages/useModelViewCapture'
import { onNodeConfigure } from '@/utils/widget'
import { applyViewChannel, type ViewChannel } from '@/widgets/three/channelShading'
import { guardOrbitControlsDragEnd } from '@/widgets/three/orbitControlsGuard'
import { RendererView } from '@/widgets/three/RendererView'
import { loadCustomModelAssets } from '@/widgets/three/scene3d/scene3dAssets'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string, context?: { imageUrl?: string }) => void
  node: LGraphNode
}>()

const hostEl = ref<HTMLDivElement | null>(null)
const gizmoMode = ref<GizmoMode>('translate')
const channel = ref<ViewChannel>('material')

const {
  operation,
  resolution,
  setOperation,
  setResolution,
  modelAUrl,
  modelBUrl,
  resultUrl,
  showResult,
  viewingResult,
  readTransformWidget,
  writeTransformWidget,
  clearTransformWidget
} = useMeshBoolean(props.node, props.state)

function setChannel(ch: ViewChannel): void {
  channel.value = ch
  for (const g of [groupA, groupB, groupResult]) applyViewChannel(g, ch)
  scheduleCapture()
}

let view: RendererView | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let disposeDragGuard: (() => void) | null = null
let gizmo: TransformControls | null = null
let gizmoHelper: THREE.Object3D | null = null
let animationId: number | null = null

const groupA = new THREE.Group()
const groupB = new THREE.Group()
const groupResult = new THREE.Group()
let loadSeqA = 0
let loadSeqB = 0
let loadSeqR = 0

function onHostEnter(): void {
  hostEl.value?.focus({ preventScroll: true })
}

function readTransform(): void {
  groupB.position.set(0, 0, 0)
  groupB.quaternion.identity()
  groupB.scale.set(1, 1, 1)
  const t = readTransformWidget()
  if (!t) return
  if (t.position) groupB.position.fromArray(t.position)
  if (t.quaternion) groupB.quaternion.fromArray(t.quaternion)
  if (t.scale) groupB.scale.fromArray(t.scale)
}

function writeTransform(): void {
  writeTransformWidget({
    position: groupB.position.toArray(),
    quaternion: groupB.quaternion.toArray(),
    scale: groupB.scale.toArray(),
  })
}

function resetTransform(): void {
  groupB.position.set(0, 0, 0)
  groupB.quaternion.identity()
  groupB.scale.set(1, 1, 1)
  clearTransformWidget()
  scheduleCapture()
}

function setGizmoMode(m: GizmoMode): void {
  gizmoMode.value = m
  gizmo?.setMode(m)
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) group.remove(child)
}

function tintB(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    child.material = Array.isArray(child.material)
      ? mats.map((m) => m.clone())
      : mats[0].clone()
    const applied = Array.isArray(child.material) ? child.material : [child.material]
    for (const m of applied) {
      if ('emissive' in m) {
        (m as THREE.MeshStandardMaterial).emissive.set(0x2266ff)
        ;(m as THREE.MeshStandardMaterial).emissiveIntensity = 0.22
      }
    }
  })
}

function frameCamera(): void {
  if (!camera || !controls) return
  const bounds = new THREE.Box3()
  const target = viewingResult.value ? groupResult : groupA
  bounds.expandByObject(target)
  if (!viewingResult.value) bounds.expandByObject(groupB)
  if (bounds.isEmpty()) return
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const fit = computeFrameFit(center, size)
  camera.position.set(fit.position.x, fit.position.y, fit.position.z)
  camera.near = fit.near
  camera.far = fit.far
  camera.updateProjectionMatrix()
  controls.target.copy(center)
  controls.update()
}

async function loadInto(group: THREE.Group, url: string | null, seq: () => number, tint = false,
                        frame = false): Promise<void> {
  clearGroup(group)
  if (!url) return
  const mySeq = seq()
  try {
    const assets = await loadCustomModelAssets(url)
    if (mySeq !== seq() || !scene) return
    const root = cloneSkinned(assets.template)
    if (tint) tintB(root)
    group.add(root)
    if (channel.value !== 'material') applyViewChannel(group, channel.value)
    if (frame) frameCamera()
    scheduleCapture()
  } catch (e) {
    console.error('[ComfyTV/mesh-boolean] failed to load model', url, e)
  }
}

function syncVisibility(): void {
  const showSource = !viewingResult.value
  groupA.visible = showSource
  groupB.visible = showSource
  groupResult.visible = !showSource
  if (gizmoHelper) gizmoHelper.visible = showSource && Boolean(modelBUrl.value)
  if (gizmo) gizmo.enabled = showSource
  frameCamera()
}

function syncSize(): void {
  if (!view || !hostEl.value || !camera) return
  const w = hostEl.value.clientWidth || 300
  const h = hostEl.value.clientHeight || 240
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  view.setSize(w * scale, h * scale)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function animate(): void {
  animationId = requestAnimationFrame(animate)
  if (!view || !scene || !camera) return
  controls?.update()
  view.renderScene(scene, camera)
}

function renderCaptureCanvas(): HTMLCanvasElement | null {
  if (!view || !scene || !camera) return null
  const captureCamera = camera.clone()
  captureCamera.aspect = 1
  captureCamera.updateProjectionMatrix()
  const heldGizmo = gizmoHelper?.visible ?? false
  if (gizmoHelper) gizmoHelper.visible = false
  try {
    return view.renderToCanvas(scene, captureCamera, MODEL_VIEW_CAPTURE_SIZE, MODEL_VIEW_CAPTURE_SIZE)
  } finally {
    if (gizmoHelper) gizmoHelper.visible = heldGizmo
  }
}

const { scheduleCapture, cancelCapture } = useModelViewCapture({
  getCanvas: renderCaptureCanvas,
  filenamePrefix: 'comfytv-mesh-boolean-view',
  logTag: 'mesh-boolean',
  onCaptured: (url) => props.onAction('model-capture-view', { imageUrl: url }),
})

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
  scene.add(groupA, groupB, groupResult)

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  camera.position.set(2, 1.5, 2)

  view = new RendererView(hostEl.value)
  view.state.clearColor = new THREE.Color(0x141418)
  view.state.clearAlpha = 1

  controls = new OrbitControls(camera, view.canvas)
  controls.enableDamping = true
  disposeDragGuard = guardOrbitControlsDragEnd(controls, view.canvas)
  controls.addEventListener('end', scheduleCapture)

  gizmo = new TransformControls(camera, view.canvas)
  gizmo.setMode(gizmoMode.value)
  gizmo.addEventListener('dragging-changed', (event: any) => {
    if (controls) controls.enabled = !event.value
    if (!event.value) {
      writeTransform()
      scheduleCapture()
    }
  })
  gizmoHelper = gizmo.getHelper()
  gizmoHelper.renderOrder = 999
  scene.add(gizmoHelper)
  gizmo.attach(groupB)

  readTransform()
  syncSize()
  view.observeResize(hostEl.value, syncSize)
  animate()

  void loadInto(groupA, modelAUrl.value, () => loadSeqA, false, true)
  void loadInto(groupB, modelBUrl.value, () => loadSeqB, true, true)
  void loadInto(groupResult, resultUrl.value, () => loadSeqR)
  syncVisibility()
})

watch(modelAUrl, (url) => { loadSeqA++; void loadInto(groupA, url, () => loadSeqA, false, true); syncVisibility() })
watch(modelBUrl, (url) => { loadSeqB++; void loadInto(groupB, url, () => loadSeqB, true, true); syncVisibility() })
watch(resultUrl, (url) => {
  loadSeqR++
  void loadInto(groupResult, url, () => loadSeqR)
  syncVisibility()
})
watch(viewingResult, syncVisibility)

onNodeConfigure(props.node, () => {
  readTransform()
})

onBeforeUnmount(() => {
  loadSeqA++; loadSeqB++; loadSeqR++
  cancelCapture()
  if (animationId != null) cancelAnimationFrame(animationId)
  animationId = null
  gizmo?.detach()
  gizmo?.dispose()
  gizmo = null
  gizmoHelper = null
  disposeDragGuard?.()
  disposeDragGuard = null
  controls?.dispose()
  controls = null
  view?.dispose()
  view = null
  scene = null
  camera = null
})

function chipClass(active: boolean): string {
  return 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]'
    + ' ctv:rounded-sm ctv:border ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:transition-colors'
    + (active
      ? ' ctv:border-primary-background ctv:bg-primary-background/20 ctv:text-base-foreground'
      : ' ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground'
        + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
}
</script>
