import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

import type { Vec3 } from './types'

type DraggingChangeListener = (dragging: boolean) => void
type ChangeListener = (position: Vec3) => void

export class PositionHandle {
  private readonly proxy: THREE.Object3D
  private readonly controls: TransformControls
  private readonly helper: THREE.Object3D
  private suppressEcho = false
  private scene: THREE.Scene | null = null
  private disposed = false

  constructor(
    name: string,
    camera: THREE.Camera,
    domElement: HTMLElement,
    private readonly onDraggingChange: DraggingChangeListener,
    private readonly onChange: ChangeListener,
    options: {
      getPointerNdc?: (
        clientX: number,
        clientY: number
      ) => { x: number; y: number } | null
    } = {}
  ) {
    this.proxy = new THREE.Object3D()
    this.proxy.name = `${name}Proxy`

    this.controls = new TransformControls(camera, domElement)
    this.controls.setMode('translate')
    this.controls.setSize(0.8)
    this.controls.attach(this.proxy)
    this.helper = this.controls.getHelper()
    this.helper.name = name
    this.helper.visible = false
    this.controls.enabled = false

    if (options.getPointerNdc) {
      const getNdc = options.getPointerNdc
      const controls = this.controls as unknown as {
        _getPointer: (event: PointerEvent) => {
          x: number
          y: number
          button: number
        }
      }
      controls._getPointer = (event: PointerEvent) => {
        const ndc = getNdc(event.clientX, event.clientY)
        if (!ndc) return { x: 10, y: 10, button: event.button }
        return { x: ndc.x, y: ndc.y, button: event.button }
      }
    }

    this.controls.addEventListener('dragging-changed', this.onDragging)
    this.controls.addEventListener('objectChange', this.onObjectChange)
  }

  updateCamera(camera: THREE.Camera): void {
    this.controls.camera = camera
  }

  isInteracting(): boolean {
    const controls = this.controls as unknown as {
      axis?: string | null
      dragging?: boolean
    }
    return (
      this.helper.visible &&
      (controls.axis != null || controls.dragging === true)
    )
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.proxy)
    scene.add(this.helper)
  }

  detach(): void {
    if (!this.scene) return
    this.scene.remove(this.proxy)
    this.scene.remove(this.helper)
    this.scene = null
  }

  setVisible(visible: boolean): void {
    this.helper.visible = visible
    this.controls.enabled = visible
  }

  isVisible(): boolean {
    return this.helper.visible
  }

  setPosition(position: Vec3): void {
    if (
      this.proxy.position.x === position.x &&
      this.proxy.position.y === position.y &&
      this.proxy.position.z === position.z
    ) {
      return
    }
    this.suppressEcho = true
    try {
      this.proxy.position.set(position.x, position.y, position.z)
      this.proxy.updateMatrixWorld(true)
    } finally {
      this.suppressEcho = false
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.controls.removeEventListener('dragging-changed', this.onDragging)
    this.controls.removeEventListener('objectChange', this.onObjectChange)
    this.controls.detach()
    this.detach()
    this.controls.dispose()
  }

  private readonly onDragging = (event: { value: unknown }): void => {
    this.onDraggingChange(event.value === true)
  }

  private readonly onObjectChange = (): void => {
    if (this.suppressEcho) return
    this.onChange({
      x: this.proxy.position.x,
      y: this.proxy.position.y,
      z: this.proxy.position.z
    })
  }
}
