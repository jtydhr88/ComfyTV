import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { LightStudioScene } from './LightStudioScene'
import {
  LightOrbitHandles,
  type LightOrbitHandleType
} from './LightOrbitHandles'
import { PositionHandle } from './PositionHandle'
import { pickHandleAtPointer } from './handlePicking'
import {
  pointToDistance,
  pointToPitchAngle,
  pointToYawAngle
} from './orbitDragMath'
import { orbitAnglesFor, orbitPosition } from './lightTransform'
import { lightTarget, type LightInfoEntry, type LightInfoType } from './types'
import { RendererView } from '../RendererView'
import { guardOrbitControlsDragEnd } from '../orbitControlsGuard'

export type LightTransformGizmoMode = 'none' | 'light-position' | 'target'

export const OUTPUT_VIEW = {
  position: { x: 0, y: 6, z: 8 },
  target: { x: 0, y: -0.5, z: 0 },
  fov: 35
} as const

const BACKGROUND_COLOR = 0x282828
const SNAPSHOT_SIZE = 512

export interface LightBallWidgetOptions {
  container: HTMLElement
  initialLights?: LightInfoEntry[]
  onLightsChange?: (lights: LightInfoEntry[]) => void
  onSelectLight?: (index: number) => void
}

interface DragState {
  type: LightOrbitHandleType
  pointerId: number
}

export class LightBallWidget {
  readonly studio: LightStudioScene
  readonly orbitHandles: LightOrbitHandles
  readonly positionHandle: PositionHandle
  readonly targetHandle: PositionHandle

  private readonly container: HTMLElement
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly view: RendererView
  private readonly controls: OrbitControls
  private disposeDragEndGuard?: () => void
  private readonly resizeObserver: ResizeObserver

  private readonly onLightsChange?: (lights: LightInfoEntry[]) => void
  private readonly onSelectLight?: (index: number) => void
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()

  private dragState: DragState | null = null
  private hoveredHandle: LightOrbitHandleType | null = null
  private hoveredMarker = false
  private gizmosOn = true
  private cameraLocked = false
  private transformGizmoMode: LightTransformGizmoMode = 'none'
  private animationId: number | null = null
  private disposed = false

  constructor(options: LightBallWidgetOptions) {
    this.container = options.container
    this.onLightsChange = options.onLightsChange
    this.onSelectLight = options.onSelectLight

    const width = this.container.clientWidth || 300
    const height = this.container.clientHeight || 300

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(BACKGROUND_COLOR)

    this.camera = new THREE.PerspectiveCamera(
      OUTPUT_VIEW.fov,
      width / height,
      0.1,
      200
    )
    this.camera.position.set(
      OUTPUT_VIEW.position.x,
      OUTPUT_VIEW.position.y,
      OUTPUT_VIEW.position.z
    )

    this.view = new RendererView(this.container)
    const scale = Math.min(window.devicePixelRatio, 2)
    this.view.setSize(width * scale, height * scale)
    this.view.state.clearAlpha = 1
    const canvas = this.view.canvas

    this.container.setAttribute('data-capture-wheel', 'true')
    if (!this.container.hasAttribute('tabindex')) {
      this.container.setAttribute('tabindex', '-1')
    }
    this.container.style.outline = 'none'
    this.container.addEventListener('pointerenter', this.onContainerEnter)

    this.controls = new OrbitControls(this.camera, canvas)
    this.disposeDragEndGuard = guardOrbitControlsDragEnd(this.controls, canvas)
    this.controls.target.set(
      OUTPUT_VIEW.target.x,
      OUTPUT_VIEW.target.y,
      OUTPUT_VIEW.target.z
    )
    this.controls.update()

    this.studio = new LightStudioScene(options.initialLights ?? [])
    this.studio.attach(this.scene)

    this.orbitHandles = new LightOrbitHandles()
    this.orbitHandles.attach(this.scene)

    this.positionHandle = new PositionHandle(
      'LightBallPositionHandle',
      this.camera,
      canvas,
      (dragging) => {
        this.controls.enabled = !dragging && !this.cameraLocked
      },
      (position) => {
        this.mutateSelected((light) => ({
          ...light,
          position: { ...position }
        }))
      }
    )
    this.positionHandle.attach(this.scene)

    this.targetHandle = new PositionHandle(
      'LightBallTargetHandle',
      this.camera,
      canvas,
      (dragging) => {
        this.controls.enabled = !dragging && !this.cameraLocked
      },
      (target) => {
        this.mutateSelected((light) => ({ ...light, target: { ...target } }))
      }
    )
    this.targetHandle.attach(this.scene)

    this.syncHandles()
    this.refreshGizmoVisibility()
    this.attachPointerHandlers()

    this.resizeObserver = new ResizeObserver(() => this.onResize())
    this.resizeObserver.observe(this.container)

    this.animate()
  }

  applyLights(lights: LightInfoEntry[], selectedIndex: number): void {
    this.studio.applyLights(lights, selectedIndex)
    this.syncHandles()
    this.refreshGizmoVisibility()
  }

  setGizmosVisible(on: boolean): void {
    if (this.gizmosOn === on) return
    this.gizmosOn = on
    this.studio.setHelpersVisible(on)
    this.refreshGizmoVisibility()
  }

  setTransformGizmoMode(mode: LightTransformGizmoMode): void {
    if (this.transformGizmoMode === mode) return
    this.transformGizmoMode = mode
    this.refreshGizmoVisibility()
  }

  resetViewToOutput(): void {
    this.camera.position.set(
      OUTPUT_VIEW.position.x,
      OUTPUT_VIEW.position.y,
      OUTPUT_VIEW.position.z
    )
    this.camera.fov = OUTPUT_VIEW.fov
    this.camera.updateProjectionMatrix()
    this.controls.target.set(
      OUTPUT_VIEW.target.x,
      OUTPUT_VIEW.target.y,
      OUTPUT_VIEW.target.z
    )
    this.controls.update()
  }

  setCameraLocked(locked: boolean): void {
    if (this.cameraLocked === locked) return
    this.cameraLocked = locked
    this.controls.enabled = !locked
  }

  snapshotOutputView(size = SNAPSHOT_SIZE): HTMLCanvasElement {
    const cam = new THREE.PerspectiveCamera(OUTPUT_VIEW.fov, 1, 0.1, 200)
    cam.position.set(
      OUTPUT_VIEW.position.x,
      OUTPUT_VIEW.position.y,
      OUTPUT_VIEW.position.z
    )
    cam.lookAt(OUTPUT_VIEW.target.x, OUTPUT_VIEW.target.y, OUTPUT_VIEW.target.z)

    const helpersWereOn = this.studio.areHelpersVisible()
    const orbitWasVisible = this.orbitHandles.isVisible()
    const positionWasVisible = this.positionHandle.isVisible()
    const targetWasVisible = this.targetHandle.isVisible()
    this.studio.setHelpersVisible(false)
    this.orbitHandles.setVisible(false)
    this.positionHandle.setVisible(false)
    this.targetHandle.setVisible(false)

    try {
      return this.view.renderToCanvas(this.scene, cam, size, size)
    } finally {
      this.studio.setHelpersVisible(helpersWereOn)
      this.orbitHandles.setVisible(orbitWasVisible)
      this.positionHandle.setVisible(positionWasVisible)
      this.targetHandle.setVisible(targetWasVisible)
      this.refreshGizmoVisibility()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.animationId !== null) {
      try {
        window.cancelAnimationFrame(this.animationId)
      } catch {
      }
      this.animationId = null
    }
    this.resizeObserver.disconnect()
    this.detachPointerHandlers()
    this.container.removeEventListener('pointerenter', this.onContainerEnter)
    this.canvas.style.cursor = ''
    this.orbitHandles.dispose()
    this.positionHandle.dispose()
    this.targetHandle.dispose()
    this.studio.detach()
    this.studio.dispose()
    this.disposeDragEndGuard?.()
    this.controls.dispose()
    this.view.dispose()
  }

  private get selectedLight(): LightInfoEntry | null {
    return this.studio.getSelectedLight()
  }

  private mutateSelected(
    mutate: (light: LightInfoEntry) => LightInfoEntry
  ): void {
    const lights = this.studio.getLights()
    const index = this.studio.getSelectedIndex()
    if (index < 0 || !lights[index]) return
    lights[index] = mutate(lights[index])
    this.applyLights(lights, index)
    this.onLightsChange?.(lights)
  }

  private syncHandles(): void {
    const light = this.selectedLight
    this.orbitHandles.update(light)
    if (!light) return
    this.positionHandle.setPosition(light.position)
    this.targetHandle.setPosition(lightTarget(light))
  }

  private refreshGizmoVisibility(): void {
    const light = this.selectedLight
    const type = light?.type ?? null
    this.orbitHandles.setVisible(this.gizmosOn && type === 'directional')

    const wantPosition =
      light !== null &&
      this.transformGizmoMode === 'light-position' &&
      lightPositionApplies(light.type)
    this.positionHandle.setVisible(wantPosition)

    const wantTarget =
      light !== null &&
      this.transformGizmoMode === 'target' &&
      targetApplies(light.type)
    this.targetHandle.setVisible(wantTarget)
  }

  private get canvas(): HTMLCanvasElement {
    return this.view.canvas
  }

  private onResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const scale = Math.min(window.devicePixelRatio, 2)
    this.view.setSize(w * scale, h * scale)
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate())
    this.studio.updateHelpers()
    this.view.renderScene(this.scene, this.camera)
  }

  private attachPointerHandlers(): void {
    const canvas = this.canvas
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
  }

  private detachPointerHandlers(): void {
    const canvas = this.canvas
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerUp)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
  }

  private readonly onContainerEnter = (): void => {
    ;(this.container as HTMLElement).focus?.({ preventScroll: true })
  }

  private readonly onPointerLeave = (): void => {
    if (this.dragState) return
    this.setHoveredHandle(null)
    this.setHoveredMarker(false)
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private pickHandle(event: PointerEvent): LightOrbitHandleType | null {
    if (!this.gizmosOn) return null
    if (this.selectedLight?.type !== 'directional') return null
    this.updatePointer(event)
    return pickHandleAtPointer<LightOrbitHandleType>(
      this.raycaster,
      this.pointer,
      this.camera,
      this.orbitHandles.pickableMeshes(),
      this.canvas
    )
  }

  private pickMarker(event: PointerEvent): number | null {
    if (!this.gizmosOn) return null
    this.updatePointer(event)
    const picked = pickHandleAtPointer<string>(
      this.raycaster,
      this.pointer,
      this.camera,
      this.studio.markerMeshes(),
      this.canvas
    )
    if (picked === null) return null
    const index = Number(picked)
    return Number.isInteger(index) ? index : null
  }

  private setHoveredHandle(type: LightOrbitHandleType | null): void {
    if (this.hoveredHandle === type) return
    this.hoveredHandle = type
    this.orbitHandles.setHovered(type)
    this.refreshCursor()
  }

  private setHoveredMarker(hovered: boolean): void {
    if (this.hoveredMarker === hovered) return
    this.hoveredMarker = hovered
    this.refreshCursor()
  }

  private refreshCursor(): void {
    this.canvas.style.cursor = this.hoveredHandle
      ? 'grab'
      : this.hoveredMarker
        ? 'pointer'
        : ''
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    const type = this.pickHandle(event)
    if (type) {
      this.setHoveredHandle(type)
      this.dragState = { type, pointerId: event.pointerId }
      this.canvas.setPointerCapture(event.pointerId)
      this.canvas.style.cursor = 'grabbing'
      this.controls.enabled = false
      event.stopPropagation()
      return
    }
    const markerIndex = this.pickMarker(event)
    if (markerIndex === null) return
    if (markerIndex !== this.studio.getSelectedIndex()) {
      this.applyLights(this.studio.getLights(), markerIndex)
      this.onSelectLight?.(markerIndex)
    }
    event.stopPropagation()
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragState) {
      const handle = this.pickHandle(event)
      this.setHoveredHandle(handle)
      this.setHoveredMarker(!handle && this.pickMarker(event) !== null)
      return
    }
    if (event.pointerId !== this.dragState.pointerId) return

    this.updatePointer(event)
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const light = this.selectedLight
    if (!light) return
    const plane = this.orbitHandles.dragPlaneFor(this.dragState.type, light)
    const point = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(plane, point)) return

    const handleType = this.dragState.type
    this.mutateSelected((current) => applyOrbitDrag(handleType, current, point))
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }
    this.dragState = null
    this.controls.enabled = !this.cameraLocked
    this.refreshCursor()
  }
}

function applyOrbitDrag(
  type: LightOrbitHandleType,
  light: LightInfoEntry,
  point: THREE.Vector3
): LightInfoEntry {
  const target = lightTarget(light)
  const angles = orbitAnglesFor(light.position, target)
  if (type === 'yaw') {
    angles.yaw = pointToYawAngle(point, target)
  } else if (type === 'pitch') {
    angles.pitch = pointToPitchAngle(point, target, angles.yaw)
  } else {
    angles.distance = pointToDistance(point, target, angles.yaw, angles.pitch)
  }
  return {
    ...light,
    position: orbitPosition(target, angles.yaw, angles.pitch, angles.distance)
  }
}

export function lightPositionApplies(type: LightInfoType): boolean {
  return type === 'point' || type === 'spot'
}

export function targetApplies(type: LightInfoType): boolean {
  return type === 'directional' || type === 'spot'
}
