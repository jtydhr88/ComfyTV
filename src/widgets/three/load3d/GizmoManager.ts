import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { GizmoMode, Model3DTransform } from './interfaces'

export class GizmoManager {
  private transformControls: TransformControls | null = null
  private targetObject: THREE.Object3D | null = null
  private initialPosition: THREE.Vector3 = new THREE.Vector3()
  private initialRotation: THREE.Euler = new THREE.Euler()
  private initialScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
  private enabled: boolean = false
  private helperVisibleWanted = true
  private activeCamera: THREE.Camera
  private mode: GizmoMode = 'translate'
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private orbitControls: OrbitControls
  private onTransformChange?: () => void

  private readonly pivotProxy = new THREE.Object3D()
  private readonly pivotOffset = new THREE.Vector3()
  private getPointerNdc?: (
    clientX: number,
    clientY: number
  ) => { x: number; y: number } | null

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    orbitControls: OrbitControls,
    getActiveCamera: () => THREE.Camera,
    onTransformChange?: () => void,
    getPointerNdc?: (
      clientX: number,
      clientY: number
    ) => { x: number; y: number } | null
  ) {
    this.scene = scene
    this.renderer = renderer
    this.orbitControls = orbitControls
    this.activeCamera = getActiveCamera()
    this.onTransformChange = onTransformChange
    this.getPointerNdc = getPointerNdc
  }

  init(): void {
    this.pivotProxy.name = 'GizmoPivotProxy'
    this.scene.add(this.pivotProxy)

    this.transformControls = new TransformControls(
      this.activeCamera,
      this.renderer.domElement
    )

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value
      if (!event.value && this.onTransformChange) {
        this.onTransformChange()
      }
    })

    this.transformControls.addEventListener('objectChange', () => {
      this.applyProxyToTarget()
    })

    if (this.getPointerNdc) {
      const getNdc = this.getPointerNdc
      const controls = this.transformControls as unknown as {
        _getPointer: (event: PointerEvent) => {
          x: number
          y: number
          button: number
        }
      }
      let lastValid: { x: number; y: number } | null = null
      controls._getPointer = (event: PointerEvent) => {
        const ndc = getNdc(event.clientX, event.clientY)
        if (!ndc) {
          if (this.transformControls?.dragging && lastValid) {
            return { ...lastValid, button: event.button }
          }
          return { x: 10, y: 10, button: event.button }
        }
        lastValid = { x: ndc.x, y: ndc.y }
        return { x: ndc.x, y: ndc.y, button: event.button }
      }
    }

    const helper = this.transformControls.getHelper()
    helper.name = 'GizmoTransformControls'
    helper.renderOrder = 999
    this.scene.add(helper)
  }

  private syncProxyFromTarget(model: THREE.Object3D): void {
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const centerWorld = box.isEmpty()
      ? model.position.clone()
      : box.getCenter(new THREE.Vector3())
    const offsetWorld = centerWorld.clone().sub(model.position)
    this.pivotOffset
      .copy(offsetWorld)
      .applyQuaternion(model.quaternion.clone().invert())
      .divide(
        new THREE.Vector3(
          model.scale.x || 1,
          model.scale.y || 1,
          model.scale.z || 1
        )
      )
    this.pivotProxy.position.copy(centerWorld)
    this.pivotProxy.quaternion.copy(model.quaternion)
    this.pivotProxy.scale.copy(model.scale)
  }

  private applyProxyToTarget(): void {
    const model = this.targetObject
    if (!model) return
    model.quaternion.copy(this.pivotProxy.quaternion)
    model.scale.copy(this.pivotProxy.scale)
    const offsetWorld = this.pivotOffset
      .clone()
      .multiply(this.pivotProxy.scale)
      .applyQuaternion(this.pivotProxy.quaternion)
    model.position.copy(this.pivotProxy.position).sub(offsetWorld)
  }

  setupForModel(model: THREE.Object3D): void {
    if (!this.transformControls) return

    this.ensureHelperInScene()

    this.transformControls.detach()
    this.transformControls.enabled = false

    this.targetObject = model
    this.initialPosition.copy(model.position)
    this.initialRotation.copy(model.rotation)
    this.initialScale.copy(model.scale)
    this.syncProxyFromTarget(model)

    if (this.enabled) {
      this.transformControls.attach(this.pivotProxy)
      this.transformControls.setMode(this.mode)
      this.transformControls.enabled = true
    }
    this.syncHelperVisibility()
  }

  followTarget(): void {
    if (!this.enabled || !this.targetObject || !this.transformControls) return
    if (this.isInteracting()) return
    this.syncProxyFromTarget(this.targetObject)
  }

  detach(): void {
    this.enabled = false
    if (this.transformControls) {
      this.transformControls.detach()
      this.transformControls.enabled = false
    }
    this.targetObject = null
    this.syncHelperVisibility()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled

    if (!this.transformControls) return

    this.ensureHelperInScene()

    if (enabled && this.targetObject) {
      this.syncProxyFromTarget(this.targetObject)
      this.transformControls.attach(this.pivotProxy)
      this.transformControls.setMode(this.mode)
      this.transformControls.enabled = true
    } else {
      this.transformControls.detach()
      this.transformControls.enabled = false
    }
    this.syncHelperVisibility()
  }

  ensureHelperInScene(): void {
    if (!this.transformControls) return
    const helper = this.transformControls.getHelper()
    if (!helper.parent) {
      this.scene.add(helper)
    }
  }

  removeFromScene(): void {
    if (!this.transformControls) return
    const helper = this.transformControls.getHelper()
    if (helper.parent) {
      helper.parent.remove(helper)
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  isInteracting(): boolean {
    const controls = this.transformControls as unknown as {
      axis?: string | null
      dragging?: boolean
    } | null
    return !!controls && (controls.axis != null || controls.dragging === true)
  }

  setHelperVisible(visible: boolean): void {
    this.helperVisibleWanted = visible
    this.syncHelperVisibility()
  }

  private syncHelperVisibility(): void {
    if (!this.transformControls) return
    this.transformControls.getHelper().visible =
      this.helperVisibleWanted && this.enabled && this.targetObject !== null
  }

  updateCamera(camera: THREE.Camera): void {
    this.activeCamera = camera
    if (this.transformControls) {
      this.transformControls.camera = camera
    }
  }

  setMode(mode: GizmoMode): void {
    this.mode = mode

    if (this.transformControls) {
      this.transformControls.setMode(mode)
    }
  }

  getMode(): GizmoMode {
    return this.mode
  }

  reset(): void {
    if (!this.targetObject) return

    this.targetObject.position.copy(this.initialPosition)
    this.targetObject.rotation.copy(this.initialRotation)
    this.targetObject.scale.copy(this.initialScale)
    this.syncProxyFromTarget(this.targetObject)
    this.onTransformChange?.()
  }

  applyTransform(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    scale?: { x: number; y: number; z: number }
  ): void {
    if (!this.targetObject) return
    this.targetObject.position.set(position.x, position.y, position.z)
    this.targetObject.rotation.set(rotation.x, rotation.y, rotation.z)
    if (scale) {
      this.targetObject.scale.set(scale.x, scale.y, scale.z)
    }
  }

  applyModelTransform(transform: Model3DTransform): void {
    if (!this.targetObject) return
    this.targetObject.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z
    )
    this.targetObject.quaternion.set(
      transform.quaternion.x,
      transform.quaternion.y,
      transform.quaternion.z,
      transform.quaternion.w
    )
    this.targetObject.scale.set(
      transform.scale.x,
      transform.scale.y,
      transform.scale.z
    )
    this.onTransformChange?.()
  }

  getInitialTransform(): {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: { x: number; y: number; z: number }
  } {
    return {
      position: {
        x: this.initialPosition.x,
        y: this.initialPosition.y,
        z: this.initialPosition.z
      },
      rotation: {
        x: this.initialRotation.x,
        y: this.initialRotation.y,
        z: this.initialRotation.z
      },
      scale: {
        x: this.initialScale.x,
        y: this.initialScale.y,
        z: this.initialScale.z
      }
    }
  }

  getTransform(): {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: { x: number; y: number; z: number }
  } {
    if (!this.targetObject) {
      return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    }

    return {
      position: {
        x: this.targetObject.position.x,
        y: this.targetObject.position.y,
        z: this.targetObject.position.z
      },
      rotation: {
        x: this.targetObject.rotation.x,
        y: this.targetObject.rotation.y,
        z: this.targetObject.rotation.z
      },
      scale: {
        x: this.targetObject.scale.x,
        y: this.targetObject.scale.y,
        z: this.targetObject.scale.z
      }
    }
  }

  getModelInfo(): Model3DTransform | null {
    const object = this.targetObject
    if (!object) return null

    return {
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z
      },
      quaternion: {
        x: object.quaternion.x,
        y: object.quaternion.y,
        z: object.quaternion.z,
        w: object.quaternion.w
      },
      scale: {
        x: object.scale.x,
        y: object.scale.y,
        z: object.scale.z
      }
    }
  }

  dispose(): void {
    if (this.transformControls) {
      const helper = this.transformControls.getHelper()
      this.scene.remove(helper)
      this.transformControls.detach()
      this.transformControls.dispose()
      this.transformControls = null
    }

    this.scene.remove(this.pivotProxy)
    this.targetObject = null
  }
}
