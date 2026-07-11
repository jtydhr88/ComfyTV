import * as THREE from 'three'

import { exceedsClickThreshold } from '@/composables/useClickDragGuard'
import type { GizmoManager } from '@/widgets/three/load3d/GizmoManager'
import type { TimelineController } from '@/widgets/three/load3d/TimelineController'
import {
  Viewport3d,
  type Viewport3dDeps
} from '@/widgets/three/load3d/Viewport3d'
import type { GizmoMode, Load3DOptions } from '@/widgets/three/load3d/interfaces'
import {
  computeLetterboxedViewport,
  isLoad3dActive
} from '@/widgets/three/load3d/load3dViewport'

import {
  LightOrbitHandles,
  type LightOrbitHandleType
} from '@/widgets/three/light/LightOrbitHandles'
import { PositionHandle } from '@/widgets/three/light/PositionHandle'
import { pickHandleAtPointer } from '@/widgets/three/light/handlePicking'
import {
  pointToDistance,
  pointToPitchAngle,
  pointToYawAngle
} from '@/widgets/three/light/orbitDragMath'
import {
  orbitAnglesFor,
  orbitPosition
} from '@/widgets/three/light/lightTransform'
import { lightTarget } from '@/widgets/three/light/types'

import { CheckerRoom } from './CheckerRoom'
import type { Scene3dCharacterManager } from './CharacterManager'
import type { Scene3dCustomModelManager } from './CustomModelManager'
import type { Scene3dLightManager } from './LightManager'
import type { SceneCameraManager } from './SceneCameraManager'
import type { Scene3dPrimitiveManager } from './PrimitiveManager'
import type { SceneChannel } from './capture/channelRender'
import { sceneFallbackDuration } from './characterTime'
import {
  PosePreview,
  createDepthPreviewMaterial,
  updateDepthPreviewRange
} from './livePreview'
import type {
  CharacterTransform,
  Quat,
  Scene3DState,
  SceneEnvironmentConfig,
  SceneLightEntry,
  Vec3
} from './types'
import { createDefaultEnvironment } from './types'

export type Scene3dGizmoMode = GizmoMode | 'none'

const CLICK_DRAG_THRESHOLD = 5
const HOVER_COLOR = 0x4a9eff

export type Scene3dViewportDeps = Viewport3dDeps & {
  timelineController: TimelineController
  sceneCameraManager: SceneCameraManager
  characterManager: Scene3dCharacterManager
  primitiveManager: Scene3dPrimitiveManager
  customModelManager: Scene3dCustomModelManager
  lightManager: Scene3dLightManager
  gizmoManager: GizmoManager
}

export interface Scene3dViewportEvents {
  onTransformCommit(id: string, transform: CharacterTransform): void
  onSelectCharacter(id: string | null): void
  onLightChange(id: string, patch: Partial<SceneLightEntry>): void
  onCameraOffsetCommit(id: string, offset: Vec3): void
}

export class Scene3dViewport extends Viewport3d {
  readonly timelineController: TimelineController
  readonly sceneCameraManager: SceneCameraManager
  readonly characterManager: Scene3dCharacterManager
  readonly primitiveManager: Scene3dPrimitiveManager
  readonly customModelManager: Scene3dCustomModelManager
  readonly lightManager: Scene3dLightManager
  readonly gizmoManager: GizmoManager

  capturing = false

  private selectedId: string | null = null
  private gizmoMode: Scene3dGizmoMode = 'none'
  private readonly events: Scene3dViewportEvents
  private readonly raycaster = new THREE.Raycaster()

  private pointerDownAt: { x: number; y: number } | null = null
  private pointerDownOnGizmo = false

  private hoveredId: string | null = null
  private readonly hoverBox = new THREE.BoxHelper(
    new THREE.Object3D(),
    HOVER_COLOR
  )

  private readonly lightOrbitHandles = new LightOrbitHandles()
  private lightPositionHandle!: PositionHandle
  private lightTargetHandle!: PositionHandle
  private hoveredRing: LightOrbitHandleType | null = null
  private ringDrag: {
    type: LightOrbitHandleType
    pointerId: number
  } | null = null

  private environment: SceneEnvironmentConfig = createDefaultEnvironment()
  private readonly checkerRoom = new CheckerRoom()
  private outputCameraId = ''
  private captureCameraOverride: THREE.PerspectiveCamera | null = null
  private lookThroughCameraId: string | null = null
  private animationDuration = 0
  private timelineHadContent = false
  private timelinePlayIntent = true
  private applyStateEpoch = 0
  private selectionEpoch = 0
  private pipCameraId: string | null = null

  private previewChannel: SceneChannel = 'color'
  private readonly posePreview = new PosePreview()
  private readonly depthPreviewMaterial = createDepthPreviewMaterial()
  private readonly normalPreviewMaterial = new THREE.MeshNormalMaterial({
    side: THREE.DoubleSide
  })

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    if (this.capturing) return

    const ring = this.pickRingHandle(event)
    if (ring) {
      this.ringDrag = { type: ring, pointerId: event.pointerId }
      this.domElement.setPointerCapture(event.pointerId)
      this.domElement.style.cursor = 'grabbing'
      this.controlsManager.controls.enabled = false
      this.pointerDownOnGizmo = true
      this.pointerDownAt = null
      return
    }

    this.pointerDownAt = { x: event.clientX, y: event.clientY }
    this.pointerDownOnGizmo =
      this.gizmoManager.isInteracting() || this.isLightHandleInteracting()
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0) return
    if (this.capturing) return

    if (this.ringDrag && event.pointerId === this.ringDrag.pointerId) {
      const canvas = this.domElement
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      this.ringDrag = null
      canvas.style.cursor = ''
      this.controlsManager.controls.enabled = true
      const entry = this.selectedLightEntry()
      if (entry) {
        this.events.onLightChange(entry.id, {
          position: { ...entry.position }
        })
      }
      return
    }

    const downAt = this.pointerDownAt
    this.pointerDownAt = null
    if (!downAt || this.pointerDownOnGizmo) return
    if (
      exceedsClickThreshold(
        downAt,
        { x: event.clientX, y: event.clientY },
        CLICK_DRAG_THRESHOLD
      )
    ) {
      return
    }
    const id = this.pickSceneObject(event)
    if (id === null && this.effectiveGizmoMode() !== 'none') return
    if (id === this.selectedId) return
    this.events.onSelectCharacter(id)
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.capturing) return
    if (this.ringDrag && event.pointerId === this.ringDrag.pointerId) {
      this.updateRingDrag(event)
      return
    }
    if (
      event.buttons !== 0 ||
      this.gizmoManager.isInteracting() ||
      this.isLightHandleInteracting()
    ) {
      this.setHovered(null)
      this.setRingHovered(null)
      return
    }
    const ring = this.pickRingHandle(event)
    if (ring) {
      this.setRingHovered(ring)
      this.setHovered(null)
      this.domElement.style.cursor = 'grab'
      return
    }
    this.setRingHovered(null)
    this.setHovered(this.pickSceneObject(event))
  }

  private readonly handlePointerLeave = (): void => {
    this.setHovered(null)
    this.setRingHovered(null)
  }

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (!this.ringDrag || event.pointerId !== this.ringDrag.pointerId) return
    const canvas = this.domElement
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
    this.ringDrag = null
    canvas.style.cursor = ''
    this.controlsManager.controls.enabled = true
  }

  constructor(
    container: HTMLElement,
    deps: Scene3dViewportDeps,
    events: Scene3dViewportEvents,
    options: Load3DOptions = {}
  ) {
    super(container, deps, options)
    this.timelineController = deps.timelineController
    this.sceneCameraManager = deps.sceneCameraManager
    this.characterManager = deps.characterManager
    this.customModelManager = deps.customModelManager
    this.primitiveManager = deps.primitiveManager
    this.lightManager = deps.lightManager
    this.gizmoManager = deps.gizmoManager
    this.events = events

    this.gizmoManager.init()
    const canvas = this.domElement
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
    canvas.addEventListener('pointercancel', this.handlePointerCancel)

    this.hoverBox.visible = false
    this.sceneManager.scene.add(this.hoverBox)

    this.checkerRoom.attach(this.sceneManager.scene)

    const getPointerNdc = (clientX: number, clientY: number) =>
      this.clientPointToNdc(clientX, clientY)
    this.lightOrbitHandles.attach(this.sceneManager.scene)
    this.lightPositionHandle = new PositionHandle(
      'Scene3dLightPositionHandle',
      this.cameraManager.activeCamera,
      canvas,
      (dragging) => {
        this.controlsManager.controls.enabled = !dragging
        if (dragging) return
        const entry = this.selectedLightEntry()
        if (entry) {
          this.events.onLightChange(entry.id, {
            position: { ...entry.position }
          })
        }
      },
      (position) => this.patchSelectedLight({ position }),
      { getPointerNdc }
    )
    this.lightPositionHandle.attach(this.sceneManager.scene)
    this.lightTargetHandle = new PositionHandle(
      'Scene3dLightTargetHandle',
      this.cameraManager.activeCamera,
      canvas,
      (dragging) => {
        this.controlsManager.controls.enabled = !dragging
        if (dragging) return
        const entry = this.selectedLightEntry()
        if (entry?.target) {
          this.events.onLightChange(entry.id, { target: { ...entry.target } })
        }
      },
      (target) => this.patchSelectedLight({ target }),
      { getPointerNdc }
    )
    this.lightTargetHandle.attach(this.sceneManager.scene)

    this.eventManager.addEventListener('timelineTimeUpdate', () => {
      if (this.timelineController.isPlayingNow()) return
      if (this.capturing) return
      this.syncSceneToTimeline()
      this.forceRender()
    })

    this.start()
  }

  protected override tickPerFrame(delta: number): void {
    super.tickPerFrame(delta)
    this.timelineController.update(delta)
    this.syncSceneToTimeline()
    this.updateLivePresetDrag()
    this.updateGizmoFollow()
    this.updateHoverBox()
  }

  private updateGizmoFollow(): void {
    const id = this.selectedId
    if (!id || !this.sceneCameraManager.isCamera(id)) return
    this.gizmoManager.followTarget()
  }

  private updateLivePresetDrag(): void {
    if (!this.gizmoManager.isInteracting()) return
    const id = this.selectedId
    if (!id || this.effectiveGizmoMode() !== 'translate') return
    if (!this.sceneCameraManager.getEntry(id)?.preset) return
    const object = this.sceneCameraManager.getObject(id)
    if (object) this.sceneCameraManager.previewPresetDrag(id, object.position)
  }

  syncSceneToTimeline(): void {
    const time = this.timelineController.getCurrentTime()
    this.sceneCameraManager.setTimelineTime(time, this.gizmoFrozenCameraId())
    this.characterManager.setTimelineTime(time)
    this.customModelManager.setTimelineTime(time)
  }

  private gizmoFrozenCameraId(): string | null {
    if (!this.gizmoManager.isInteracting()) return null
    const mode = this.effectiveGizmoMode()
    if (mode !== 'translate' && mode !== 'rotate') return null
    return this.selectedId &&
      this.sceneCameraManager.isCamera(this.selectedId)
      ? this.selectedId
      : null
  }

  applyCaptureTime(seconds: number): void {
    this.sceneCameraManager.setTimelineTime(seconds)
    this.characterManager.setTimelineTime(seconds)
    this.customModelManager.setTimelineTime(seconds)
  }

  override isActive(): boolean {
    if (this.capturing) return false
    return isLoad3dActive({
      mouseOnNode: this.STATUS_MOUSE_ON_NODE,
      mouseOnScene: this.STATUS_MOUSE_ON_SCENE,
      mouseOnViewer: this.STATUS_MOUSE_ON_VIEWER,
      recording: false,
      initialRenderDone: this.INITIAL_RENDER_DONE,
      animationPlaying: this.timelineController.isPlayingNow()
    })
  }

  async applyState(
    state: Scene3DState,
    selectedId: string | null
  ): Promise<void> {
    const epoch = ++this.applyStateEpoch
    const selectionEpoch = this.selectionEpoch
    this.primitiveManager.applyPrimitives(state.primitives)
    this.lightManager.applyLights(state.lights)
    this.outputCameraId = state.output.cameraId
    await Promise.all([
      this.characterManager.applyCharacters(state.characters),
      this.customModelManager.applyModels(state.models),
      this.sceneCameraManager.applyCameras(state.cameras)
    ])
    if (epoch !== this.applyStateEpoch) return
    this.applyEnvironment(state.environment)
    this.applyVisibility(state)
    this.posePreview.invalidateCache()
    if (
      this.pipCameraId &&
      !this.sceneCameraManager.isCamera(this.pipCameraId)
    ) {
      this.pipCameraId = null
    }
    if (
      this.lookThroughCameraId &&
      !this.sceneCameraManager.isCamera(this.lookThroughCameraId)
    ) {
      this.setLookThroughCamera(null)
    }
    if (selectionEpoch === this.selectionEpoch) {
      this.selectedId = selectedId
      this.sceneCameraManager.setSelected(selectedId)
    }
    if (this.hoveredId && !this.getSceneObject(this.hoveredId)) {
      this.setHovered(null)
    }
    this.animationDuration =
      state.characters.length || state.models.length
        ? Math.max(
            sceneFallbackDuration(
              state.characters,
              this.characterManager.clipDurations()
            ),
            sceneFallbackDuration(
              state.models.map((model) => ({
                model: model.url,
                animation: model.animation
              })),
              this.customModelManager.clipDurations()
            )
          )
        : 0
    this.refreshTimelineDuration()
    this.attachGizmo()
    this.syncSceneToTimeline()
    this.forceRender()
  }

  setSelected(id: string | null): void {
    this.selectionEpoch += 1
    this.selectedId = id
    this.sceneCameraManager.setSelected(id)
    this.attachGizmo()
    this.forceRender()
  }


  refreshTimelineDuration(): void {
    this.timelineController.setTimelineDuration(
      Math.max(this.animationDuration, this.sceneCameraManager.maxPresetDuration())
    )
    const hasContent = this.timelineController.hasContent()
    if (
      hasContent &&
      !this.timelineHadContent &&
      this.timelinePlayIntent &&
      !this.timelineController.isPlayingNow()
    ) {
      this.timelineController.play()
    }
    this.timelineHadContent = hasContent
  }

  setTimelinePlayIntent(playing: boolean): void {
    this.timelinePlayIntent = playing
  }

  handleCameraPresetLoaded(): void {
    this.refreshTimelineDuration()
    this.refreshCheckerRoom()
    this.syncSceneToTimeline()
    this.forceRender()
  }

  setPipCamera(id: string | null): void {
    if (this.pipCameraId === id) return
    this.pipCameraId = id
    this.forceRender()
  }

  setLookThroughCamera(id: string | null): void {
    const camera = id ? this.sceneCameraManager.getCamera(id) : null
    this.lookThroughCameraId = camera ? id : null
    this.sceneCameraManager.setLookThroughId(this.lookThroughCameraId)
    this.setExternalActiveCamera(camera)
    this.attachGizmo()
    this.handleResize()
  }

  protected override shouldMaintainAspectRatio(): boolean {
    if (this.getRenderCamera() !== this.cameraManager.activeCamera) {
      return super.shouldMaintainAspectRatio()
    }
    return false
  }

  getCaptureCamera(): THREE.Camera {
    if (this.captureCameraOverride) return this.captureCameraOverride
    const camera = this.outputCameraId
      ? this.sceneCameraManager.getCamera(this.outputCameraId)
      : null
    return camera ?? this.getRenderCamera()
  }

  setCaptureCameraOverride(id: string | null): void {
    this.captureCameraOverride = id
      ? this.sceneCameraManager.getCamera(id)
      : null
  }

  getEditorCameraPose(): { position: Vec3; quaternion: Quat; fov: number } {
    const camera = this.cameraManager.activeCamera
    return {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      },
      quaternion: {
        x: camera.quaternion.x,
        y: camera.quaternion.y,
        z: camera.quaternion.z,
        w: camera.quaternion.w
      },
      fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : 50
    }
  }

  openposeRoots(): THREE.Object3D[] {
    return [
      ...this.characterManager.pickables(),
      ...this.customModelManager.pickables()
    ]
  }


  applyEnvironment(environment: SceneEnvironmentConfig): void {
    this.environment = { ...environment }
    this.sceneManager.gridHelper.visible = environment.showGrid
    this.sceneManager.scene.background = environment.background
      ? new THREE.Color(environment.background)
      : null
    this.refreshCheckerRoom()
  }

  private refreshCheckerRoom(): void {
    this.checkerRoom.update(
      this.environment.showRoom,
      this.computeRoomBounds()
    )
  }

  private computeRoomBounds(): THREE.Box3 {
    const bounds = new THREE.Box3(
      new THREE.Vector3(-8, -0.01, -8),
      new THREE.Vector3(8, 8, 8)
    )
    const content = new THREE.Box3()
    for (const object of [
      ...this.characterManager.pickables(),
      ...this.primitiveManager.pickables(),
      ...this.customModelManager.pickables()
    ]) {
      content.expandByObject(object)
    }
    if (!content.isEmpty()) {
      content.expandByScalar(2)
      bounds.union(content)
    }
    const path = this.sceneCameraManager.getPathBounds()
    if (path && !path.isEmpty()) {
      path.expandByScalar(5)
      bounds.union(path)
    }
    bounds.min.y = Math.min(bounds.min.y, -0.01)
    return bounds
  }

  setGizmoMode(mode: Scene3dGizmoMode): void {
    this.gizmoMode = mode
    this.attachGizmo()
    this.forceRender()
  }

  setPreviewChannel(channel: SceneChannel): void {
    if (this.previewChannel === channel) return
    this.previewChannel = channel
    this.forceRender()
  }

  private applyVisibility(state: Scene3DState): void {
    const entries = [
      ...state.characters,
      ...state.primitives,
      ...state.models,
      ...state.lights,
      ...state.cameras
    ]
    for (const entry of entries) {
      const object = this.getSceneObject(entry.id)
      if (object) object.visible = !entry.hidden
    }
  }

  private getSceneObject(id: string): THREE.Object3D | null {
    return (
      this.characterManager.getObject(id) ??
      this.primitiveManager.getObject(id) ??
      this.customModelManager.getObject(id) ??
      this.lightManager.getObject(id) ??
      this.sceneCameraManager.getObject(id)
    )
  }

  effectiveGizmoMode(): Scene3dGizmoMode {
    const id = this.selectedId
    const mode = this.gizmoMode
    if (!id || mode === 'none') return 'none'
    if (this.lightManager.isLight(id)) return 'none'
    if (this.sceneCameraManager.isCamera(id)) {
      if (this.lookThroughCameraId === id) return 'none'
      if (mode === 'scale') return 'none'
      if (mode === 'rotate' && this.sceneCameraManager.getEntry(id)?.preset) {
        return 'none'
      }
    }
    return mode
  }

  private attachGizmo(): void {
    const mode = this.effectiveGizmoMode()
    const target = this.selectedId ? this.getSceneObject(this.selectedId) : null
    if (target && target.visible && mode !== 'none') {
      this.gizmoManager.setupForModel(target)
      this.gizmoManager.setMode(mode)
      this.gizmoManager.setEnabled(true)
    } else {
      this.gizmoManager.detach()
    }
    this.syncLightHandles()
  }


  private selectedLightEntry(): SceneLightEntry | null {
    if (!this.selectedId) return null
    return this.lightManager.getEntry(this.selectedId)
  }

  private syncLightHandles(): void {
    const entry = this.selectedLightEntry()
    this.lightOrbitHandles.update(entry)
    const showPosition = !!entry && entry.type !== 'directional'
    this.lightPositionHandle.setVisible(showPosition)
    const showTarget = !!entry && entry.type !== 'point'
    this.lightTargetHandle.setVisible(showTarget)
    if (entry) {
      this.lightPositionHandle.setPosition(entry.position)
      this.lightTargetHandle.setPosition(lightTarget(entry))
    }
    if (!entry) this.setRingHovered(null)
  }

  private isLightHandleInteracting(): boolean {
    return (
      this.lightPositionHandle.isInteracting() ||
      this.lightTargetHandle.isInteracting()
    )
  }

  private patchSelectedLight(patch: Partial<SceneLightEntry>): void {
    const entry = this.selectedLightEntry()
    if (!entry) return
    const patched = this.lightManager.patchEntry(entry.id, patch)
    if (patched) this.lightOrbitHandles.update(patched)
  }

  private pickRingHandle(event: PointerEvent): LightOrbitHandleType | null {
    const entry = this.selectedLightEntry()
    if (!entry || entry.type !== 'directional') return null
    if (!this.lightOrbitHandles.isVisible()) return null
    const ndc = this.clientPointToNdc(event.clientX, event.clientY)
    if (!ndc) return null
    return pickHandleAtPointer<LightOrbitHandleType>(
      this.raycaster,
      new THREE.Vector2(ndc.x, ndc.y),
      this.getRenderCamera(),
      this.lightOrbitHandles.pickableMeshes(),
      this.renderRegionSize()
    )
  }

  private renderRegionSize(): { clientWidth: number; clientHeight: number } {
    const canvas = this.domElement
    if (!this.shouldMaintainAspectRatio()) {
      return { clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight }
    }
    const { width, height } = computeLetterboxedViewport(
      { width: canvas.clientWidth, height: canvas.clientHeight },
      this.targetAspectRatio
    )
    return { clientWidth: width, clientHeight: height }
  }

  private setRingHovered(type: LightOrbitHandleType | null): void {
    if (this.hoveredRing === type) return
    this.hoveredRing = type
    this.lightOrbitHandles.setHovered(type)
    if (!type && !this.ringDrag) {
      this.domElement.style.cursor = ''
    }
  }

  private updateRingDrag(event: PointerEvent): void {
    const drag = this.ringDrag
    const entry = this.selectedLightEntry()
    if (!drag || !entry) return
    const ndc = this.clientPointToNdc(event.clientX, event.clientY)
    if (!ndc) return
    this.raycaster.setFromCamera(
      new THREE.Vector2(ndc.x, ndc.y),
      this.getRenderCamera()
    )
    const plane = this.lightOrbitHandles.dragPlaneFor(drag.type, entry)
    const point = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(plane, point)) return
    const target = lightTarget(entry)
    const angles = orbitAnglesFor(entry.position, target)
    if (drag.type === 'yaw') {
      angles.yaw = pointToYawAngle(point, target)
    } else if (drag.type === 'pitch') {
      angles.pitch = pointToPitchAngle(point, target, angles.yaw)
    } else {
      angles.distance = pointToDistance(point, target, angles.yaw, angles.pitch)
    }
    const position: Vec3 = orbitPosition(
      target,
      angles.yaw,
      angles.pitch,
      angles.distance
    )
    this.patchSelectedLight({ position })
  }

  refreshGizmo(): void {
    this.attachGizmo()
  }

  commitGizmoTransform(): void {
    if (!this.selectedId) return
    const target = this.getSceneObject(this.selectedId)
    if (!target) return
    const cameraEntry = this.sceneCameraManager.getEntry(this.selectedId)
    if (cameraEntry?.preset && this.effectiveGizmoMode() === 'translate') {
      const offset = this.sceneCameraManager.offsetForWorldPosition(
        this.selectedId,
        target.position
      )
      if (offset) {
        this.events.onCameraOffsetCommit(this.selectedId, offset)
        return
      }
    }
    this.events.onTransformCommit(this.selectedId, {
      position: {
        x: target.position.x,
        y: target.position.y,
        z: target.position.z
      },
      quaternion: {
        x: target.quaternion.x,
        y: target.quaternion.y,
        z: target.quaternion.z,
        w: target.quaternion.w
      },
      scale: { x: target.scale.x, y: target.scale.y, z: target.scale.z }
    })
  }

  private pickSceneObject(event: PointerEvent): string | null {
    const ndc = this.clientPointToNdc(event.clientX, event.clientY)
    if (!ndc) return null
    this.raycaster.setFromCamera(
      new THREE.Vector2(ndc.x, ndc.y),
      this.getRenderCamera()
    )
    const pickables = [
      ...this.characterManager.pickables(),
      ...this.primitiveManager.pickables(),
      ...this.customModelManager.pickables(),
      ...this.lightManager.pickables(),
      ...this.sceneCameraManager.pickables()
    ]
    const hit = this.raycaster.intersectObjects(pickables, true)[0]
    if (!hit) return null
    let object: THREE.Object3D | null = hit.object
    while (object) {
      const id = object.userData.sceneObjectId
      if (typeof id === 'string') return id
      object = object.parent
    }
    return null
  }


  private setHovered(id: string | null): void {
    if (this.hoveredId === id) return
    this.hoveredId = id
    this.domElement.style.cursor = id ? 'pointer' : ''
    this.updateHoverBox()
  }

  private updateHoverBox(): void {
    const target = this.hoveredId
      ? this.getSceneObject(this.hoveredId)
      : null
    if (target) {
      this.hoverBox.setFromObject(target)
      this.hoverBox.visible = true
    } else {
      this.hoverBox.visible = false
    }
  }


  setEditorHelpersVisible(visible: boolean): void {
    this.sceneManager.gridHelper.visible = visible && this.environment.showGrid
    this.lightManager.setMarkersVisible(visible)
    this.sceneCameraManager.setHelpersVisible(visible)
    this.gizmoManager.setHelperVisible(visible)
    this.hoverBox.visible = visible && this.hoveredId !== null
    if (visible) {
      this.syncLightHandles()
    } else {
      this.lightOrbitHandles.setVisible(false)
      this.lightPositionHandle.setVisible(false)
      this.lightTargetHandle.setVisible(false)
    }
  }

  override renderMainScene(): void {
    this.renderMainChannel()
    if (!this.capturing) this.renderCameraPip()
  }

  private renderMainChannel(): void {
    const channel = this.previewChannel
    if (channel === 'color' || this.capturing) {
      super.renderMainScene()
      return
    }

    this.prepareMainViewport()
    const renderer = this.renderer
    const camera = this.getRenderCamera()
    const previousClearColor = renderer.getClearColor(new THREE.Color())
    const previousClearAlpha = renderer.getClearAlpha()
    this.setEditorHelpersVisible(false)
    try {
      this.renderChannelPass(camera, channel)
    } finally {
      this.setEditorHelpersVisible(true)
      renderer.setClearColor(previousClearColor, previousClearAlpha)
    }
  }

  private renderChannelPass(camera: THREE.Camera, channel: SceneChannel): void {
    const renderer = this.renderer
    const scene = this.sceneManager.scene
    if (channel === 'openpose') {
      this.posePreview.update(this.openposeRoots())
      renderer.setClearColor(0x000000, 1)
      renderer.clear()
      renderer.render(this.posePreview.scene, camera)
      return
    }
    const previousOverride = scene.overrideMaterial
    try {
      if (channel === 'normal') {
        scene.overrideMaterial = this.normalPreviewMaterial
        renderer.setClearColor(new THREE.Color(0.5, 0.5, 1.0), 1)
      } else {
        updateDepthPreviewRange(this.depthPreviewMaterial, camera, [
          ...this.characterManager.pickables(),
          ...this.primitiveManager.pickables(),
          ...this.customModelManager.pickables()
        ])
        scene.overrideMaterial = this.depthPreviewMaterial
        renderer.setClearColor(0x000000, 1)
      }
      renderer.clear()
      renderer.render(scene, camera)
    } finally {
      scene.overrideMaterial = previousOverride
    }
  }


  private renderCameraPip(): void {
    const id = this.pipCameraId
    if (!id) return
    const camera = this.sceneCameraManager.getCamera(id)
    if (!camera) return
    if (this.getRenderCamera() === camera) return

    const renderer = this.renderer
    const cw = this.view.width
    const ch = this.view.height
    if (cw < 120 || ch < 90) return
    const aspect = this.targetAspectRatio ?? cw / ch
    let pipWidth = Math.round(cw * 0.32)
    let pipHeight = Math.round(pipWidth / aspect)
    const maxHeight = Math.round(ch * 0.38)
    if (pipHeight > maxHeight) {
      pipHeight = maxHeight
      pipWidth = Math.round(pipHeight * aspect)
    }
    if (pipWidth < 48 || pipHeight < 32) return
    const margin = 10
    const x = cw - pipWidth - margin
    const y = margin

    if (Math.abs(camera.aspect - aspect) > 1e-6) {
      camera.aspect = aspect
      camera.updateProjectionMatrix()
    }

    const previousClearColor = renderer.getClearColor(new THREE.Color())
    const previousClearAlpha = renderer.getClearAlpha()
    this.setEditorHelpersVisible(false)
    try {
      renderer.setViewport(x, y, pipWidth, pipHeight)
      renderer.setScissor(x, y, pipWidth, pipHeight)
      renderer.setScissorTest(true)
      if (this.previewChannel === 'color') {
        renderer.setClearColor(0x111118, 1)
        renderer.clear()
        renderer.render(this.sceneManager.scene, camera)
      } else {
        this.renderChannelPass(camera, this.previewChannel)
      }
    } finally {
      this.setEditorHelpersVisible(true)
      renderer.setClearColor(previousClearColor, previousClearAlpha)
    }
  }

  protected override onActiveCameraChanged(): void {
    this.gizmoManager.updateCamera(this.cameraManager.activeCamera)
    this.lightPositionHandle.updateCamera(this.cameraManager.activeCamera)
    this.lightTargetHandle.updateCamera(this.cameraManager.activeCamera)
  }

  override remove(): void {
    const canvas = this.domElement
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    canvas.removeEventListener('pointercancel', this.handlePointerCancel)
    super.remove()
  }

  protected override disposeManagers(): void {
    super.disposeManagers()
    this.customModelManager.dispose()
    this.checkerRoom.dispose()
    this.lightOrbitHandles.dispose()
    this.lightPositionHandle.dispose()
    this.lightTargetHandle.dispose()
    this.hoverBox.geometry.dispose()
    ;(this.hoverBox.material as THREE.Material).dispose()
    this.posePreview.dispose()
    this.depthPreviewMaterial.dispose()
    this.normalPreviewMaterial.dispose()
    this.characterManager.dispose()
    this.primitiveManager.dispose()
    this.lightManager.dispose()
    this.sceneCameraManager.dispose()
    this.gizmoManager.dispose()
  }

  protected override prepareMainViewport(): void {
    super.prepareMainViewport()
    const render = this.getRenderCamera()
    if (
      render !== this.cameraManager.activeCamera &&
      render instanceof THREE.PerspectiveCamera
    ) {
      const aspect =
        this.targetAspectRatio ??
        this.view.width / Math.max(1, this.view.height)
      if (Math.abs(render.aspect - aspect) > 1e-6) {
        render.aspect = aspect
        render.updateProjectionMatrix()
      }
    }
  }
}
