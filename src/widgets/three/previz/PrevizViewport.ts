import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ScenePathEditor, type CameraAction } from 'dollycurve'

import { RendererView } from '../RendererView'
import { guardOrbitControlsDragEnd } from '../orbitControlsGuard'
import { trackPath } from './dollyTrack'
import type { PrevizActor, PrevizWorld } from './PrevizWorld'

export type PrevizPickTarget =
  | { type: 'actor'; label: string }
  | { type: 'camPoint'; index: number }
  | { type: 'pathPoint'; label: string; index: number }

export interface PrevizViewportEvents {
  onSelect?: (target: PrevizPickTarget | null) => void
  onActorMoved?: (actor: PrevizActor) => void
  onTrackChanged?: (action: CameraAction) => void
  onTrackCommitted?: (action: CameraAction, label: string) => void
  onFrame?: (dt: number) => void
}

export class PrevizViewport {
  readonly view: RendererView
  readonly viewCam = new THREE.PerspectiveCamera(50, 1, 0.1, 500)
  monitorView: RendererView | null = null

  helpersVisible = true

  private readonly world: PrevizWorld
  private readonly container: HTMLElement
  private readonly events: PrevizViewportEvents
  private readonly controls: OrbitControls
  private readonly disposeDragEndGuard: () => void
  private readonly camGizmo = new THREE.Group()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private cameraEditor: ScenePathEditor | null = null
  private cameraEditorAction: CameraAction | null = null
  private actorEditor: ScenePathEditor | null = null
  private actorEditorAction: CameraAction | null = null
  private actorEditorLabel = ''
  private monitorContainer: HTMLElement | null = null
  private rafId = 0
  private lastNow = 0
  private disposed = false
  private drag: {
    actor: PrevizActor
    plane: THREE.Plane
    offset: THREE.Vector3
    moved: boolean
    anchorStart: Array<{ co: THREE.Vector3; h1: THREE.Vector3; h2: THREE.Vector3 }> | null
    actorStart: THREE.Vector3
  } | null = null

  constructor(world: PrevizWorld, container: HTMLElement, events: PrevizViewportEvents = {}) {
    this.world = world
    this.container = container
    this.events = events
    this.view = new RendererView(container)
    this.view.canvas.style.touchAction = 'none'
    this.viewCam.position.set(11, 9, 14)
    this.controls = new OrbitControls(this.viewCam, this.view.canvas)
    this.controls.target.set(0, 1, 0)
    this.controls.enableDamping = false
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03
    this.controls.minDistance = 2
    this.controls.maxDistance = 90
    this.controls.update()
    this.disposeDragEndGuard = guardOrbitControlsDragEnd(this.controls, this.view.canvas)

    this.buildCamGizmo()
    world.scene.add(this.camGizmo)

    this.view.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.view.canvas.addEventListener('pointermove', this.onPointerMove)
    this.view.canvas.addEventListener('pointerup', this.onPointerUp)
    this.view.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.view.observeResize(container, () => this.syncSize())
    this.syncSize()
    this.lastNow = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  attachMonitor(container: HTMLElement): void {
    this.detachMonitor()
    this.monitorContainer = container
    this.monitorView = new RendererView(container)
  }

  detachMonitor(): void {
    this.monitorView?.dispose()
    this.monitorView = null
    this.monitorContainer = null
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.view.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.view.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.view.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.view.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.cameraEditor?.destroy()
    this.cameraEditor = null
    this.actorEditor?.destroy()
    this.actorEditor = null
    this.disposeDragEndGuard()
    this.controls.dispose()
    this.world.scene.remove(this.camGizmo)
    this.detachMonitor()
    this.view.dispose()
  }

  private syncSize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.view.setSize(w, h)
    this.viewCam.aspect = w / h
    this.viewCam.updateProjectionMatrix()
  }

  private buildCamGizmo(): void {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.24, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x222831 })
    )
    const lens = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.28, 12),
      new THREE.MeshBasicMaterial({ color: 0x7bd88f })
    )
    lens.rotation.x = -Math.PI / 2
    lens.position.z = 0.36
    this.camGizmo.add(body, lens)
    this.camGizmo.renderOrder = 50
  }

  private makeEditor(action: CameraAction, kind: 'camera' | 'actor'): ScenePathEditor | null {
    const path = trackPath(action)
    if (!path) return null
    return new ScenePathEditor(path, {
      path,
      scene: this.world.scene,
      camera: this.viewCam,
      dom: this.view.canvas,
      anchorRadius: kind === 'camera' ? 0.14 : 0.11,
      onChanged: () => {
        this.world.invalidateTrack(action)
        this.events.onTrackChanged?.(action)
      },
      onCommit: (label) => {
        this.world.invalidateTrack(action)
        this.events.onTrackCommitted?.(action, label)
      }
    })
  }

  setCameraTrack(action: CameraAction | null): void {
    if (this.cameraEditorAction === action) {
      this.cameraEditor?.refresh()
      return
    }
    this.cameraEditor?.destroy()
    this.cameraEditor = null
    this.cameraEditorAction = action
    if (action) this.cameraEditor = this.makeEditor(action, 'camera')
  }

  setActorTrack(action: CameraAction | null, label = ''): void {
    if (this.actorEditorAction === action) {
      this.actorEditorLabel = label
      this.actorEditor?.refresh()
      return
    }
    this.actorEditor?.destroy()
    this.actorEditor = null
    this.actorEditorAction = action
    this.actorEditorLabel = label
    if (action) this.actorEditor = this.makeEditor(action, 'actor')
  }

  refreshTracks(): void {
    this.cameraEditor?.refresh()
    this.actorEditor?.refresh()
  }

  activeCameraAnchor(): number | null {
    const hit = this.cameraEditor?.getActive()
    return hit && hit.kind === 'anchor' ? hit.pointIdx : null
  }

  private setPointerFromEvent(e: PointerEvent): void {
    const rect = this.view.canvas.getBoundingClientRect()
    this.pointer.set(
      ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    )
    this.raycaster.setFromCamera(this.pointer, this.viewCam)
  }

  private pickActor(): PrevizActor | null {
    const hits = this.raycaster.intersectObjects(
      this.world.actors.map((a) => a.obj),
      true
    )
    for (const hit of hits) {
      if ((hit.object as THREE.Sprite).isSprite) continue
      let node: THREE.Object3D | null = hit.object
      while (node) {
        const actor = this.world.actors.find((a) => a.obj === node)
        if (actor) return actor
        node = node.parent
      }
    }
    return null
  }

  private groundPoint(plane: THREE.Plane): THREE.Vector3 | null {
    const out = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(plane, out) ? out : null
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return
    const camHit = this.cameraEditor?.pick(e.clientX, e.clientY) ?? null
    if (camHit) {
      this.controls.enabled = false
      if (camHit.kind === 'anchor') {
        this.events.onSelect?.({ type: 'camPoint', index: camHit.pointIdx })
      }
      return
    }
    const actorHit = this.actorEditor?.pick(e.clientX, e.clientY) ?? null
    if (actorHit) {
      this.controls.enabled = false
      if (actorHit.kind === 'anchor') {
        this.events.onSelect?.({
          type: 'pathPoint',
          label: this.actorEditorLabel,
          index: actorHit.pointIdx
        })
      }
      return
    }
    this.setPointerFromEvent(e)
    const actor = this.pickActor()
    if (!actor) {
      this.events.onSelect?.(null)
      return
    }
    this.controls.enabled = false
    this.view.canvas.setPointerCapture(e.pointerId)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const offset = new THREE.Vector3()
    const hit = this.groundPoint(plane)
    if (hit) offset.copy(actor.obj.position.clone().setY(0).sub(hit.clone().setY(0)))
    const path = actor.track ? trackPath(actor.track) : null
    this.drag = {
      actor,
      plane,
      offset,
      moved: false,
      actorStart: actor.obj.position.clone(),
      anchorStart:
        path?.points.map((p) => ({
          co: new THREE.Vector3(...p.co),
          h1: new THREE.Vector3(...p.h1),
          h2: new THREE.Vector3(...p.h2)
        })) ?? null
    }
    this.events.onSelect?.({ type: 'actor', label: actor.label })
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.drag) return
    this.setPointerFromEvent(e)
    const hit = this.groundPoint(this.drag.plane)
    if (!hit) return
    const { actor } = this.drag
    this.drag.moved = true
    const tx = hit.x + this.drag.offset.x
    const tz = hit.z + this.drag.offset.z
    const path = actor.track ? trackPath(actor.track) : null
    if (path && this.drag.anchorStart && path.points.length === this.drag.anchorStart.length) {
      const dx = tx - this.drag.actorStart.x
      const dz = tz - this.drag.actorStart.z
      path.points.forEach((p, i) => {
        const s = this.drag!.anchorStart![i]
        p.co[0] = s.co.x + dx
        p.co[2] = s.co.z + dz
        p.h1[0] = s.h1.x + dx
        p.h1[2] = s.h1.z + dz
        p.h2[0] = s.h2.x + dx
        p.h2[2] = s.h2.z + dz
      })
      this.world.invalidateTrack(actor.track)
      this.world.moveActorSafely(actor, tx, tz)
      this.actorEditor?.refresh()
      if (actor.track) this.events.onTrackChanged?.(actor.track)
    } else {
      this.world.moveActorSafely(actor, tx, tz)
      actor.data.pos = [actor.obj.position.x, actor.obj.position.z]
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    this.controls.enabled = true
    const drag = this.drag
    this.drag = null
    if (this.view.canvas.hasPointerCapture(e.pointerId)) {
      this.view.canvas.releasePointerCapture(e.pointerId)
    }
    if (!drag?.moved) return
    const { actor } = drag
    if (actor.track && trackPath(actor.track)?.points.length) {
      const first = trackPath(actor.track)!.points[0]
      actor.data.pos = [first.co[0], first.co[2]]
    }
    this.events.onActorMoved?.(actor)
  }

  private onPointerLeave = (): void => {
    if (!this.drag) this.controls.enabled = true
  }

  private loop = (now: number): void => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.loop)
    const dt = Math.min(0.25, (now - this.lastNow) / 1000)
    this.lastNow = now
    this.events.onFrame?.(dt)
    this.camGizmo.position.copy(this.world.shotCam.position)
    this.camGizmo.quaternion.copy(this.world.shotCam.quaternion)
    this.camGizmo.visible = this.helpersVisible
    this.setPathEditorsVisible(this.helpersVisible)
    this.world.updateLabelScales(this.viewCam, this.container.clientHeight || 600)
    this.view.renderScene(this.world.scene, this.viewCam)
    if (this.monitorView && this.monitorContainer) {
      const w = Math.max(1, this.monitorContainer.clientWidth)
      const h = Math.max(1, this.monitorContainer.clientHeight)
      this.monitorView.setSize(w, h)
      this.world.setExportLook(true)
      this.setPathEditorsVisible(false)
      this.camGizmo.visible = false
      this.world.shotCam.aspect = w / h
      this.world.shotCam.updateProjectionMatrix()
      this.monitorView.renderScene(this.world.scene, this.world.shotCam)
      this.world.setExportLook(false)
      this.setPathEditorsVisible(this.helpersVisible)
      this.camGizmo.visible = this.helpersVisible
    }
  }

  private setPathEditorsVisible(visible: boolean): void {
    type EditorInternals = { root?: THREE.Object3D }
    const camRoot = (this.cameraEditor as EditorInternals | null)?.root
    if (camRoot) camRoot.visible = visible
    const actorRoot = (this.actorEditor as EditorInternals | null)?.root
    if (actorRoot) actorRoot.visible = visible
  }

  renderShotFrame(width: number, height: number): HTMLCanvasElement {
    this.world.setExportLook(true)
    this.setPathEditorsVisible(false)
    this.camGizmo.visible = false
    const prevAspect = this.world.shotCam.aspect
    this.world.shotCam.aspect = width / height
    this.world.shotCam.updateProjectionMatrix()
    try {
      return this.view.renderToCanvas(this.world.scene, this.world.shotCam, width, height)
    } finally {
      this.world.shotCam.aspect = prevAspect
      this.world.shotCam.updateProjectionMatrix()
      this.world.setExportLook(false)
      this.setPathEditorsVisible(this.helpersVisible)
      this.camGizmo.visible = this.helpersVisible
    }
  }

  frameStage(): void {
    this.controls.target.copy(this.world.globalLockTarget())
    this.controls.update()
  }
}
