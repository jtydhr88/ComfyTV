import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

const FLOOR_SIZE = 40
const CHECKER_DIVISIONS = 8
const CHECKER_LIGHT = '#3a3a41'
const CHECKER_DARK = '#2d2d33'
const REFLECTION_TINT = 0x2f2f34
const OVERLAY_OPACITY = 0.8

export class ReflectiveGridFloor {
  private readonly group: THREE.Group
  private readonly reflector: Reflector
  private readonly overlay: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial
  >
  private scene: THREE.Scene | null = null

  constructor(anisotropy = 1) {
    this.group = new THREE.Group()
    this.group.name = '__reflective_grid_floor__'

    this.reflector = new Reflector(
      new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
      {
        clipBias: 0.003,
        textureWidth: 1024,
        textureHeight: 1024,
        color: REFLECTION_TINT
      }
    )
    this.reflector.rotation.x = -Math.PI / 2
    this.group.add(this.reflector)

    const texture = this.createCheckerTexture()
    texture.repeat.set(
      FLOOR_SIZE / CHECKER_DIVISIONS,
      FLOOR_SIZE / CHECKER_DIVISIONS
    )
    texture.anisotropy = anisotropy
    this.overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.95,
        metalness: 0,
        transparent: true,
        opacity: OVERLAY_OPACITY,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      })
    )
    this.overlay.rotation.x = -Math.PI / 2
    this.overlay.position.y = 0.002
    this.overlay.receiveShadow = true
    this.group.add(this.overlay)
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene
    scene.add(this.group)
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  get visible(): boolean {
    return this.group.visible
  }

  dispose(): void {
    this.scene?.remove(this.group)
    this.scene = null
    this.reflector.geometry.dispose()
    this.reflector.dispose()
    this.overlay.geometry.dispose()
    this.overlay.material.map?.dispose()
    this.overlay.material.dispose()
  }

  private createCheckerTexture(): THREE.CanvasTexture {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const cell = size / CHECKER_DIVISIONS
      for (let r = 0; r < CHECKER_DIVISIONS; r++) {
        for (let c = 0; c < CHECKER_DIVISIONS; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK
          ctx.fillRect(c * cell, r * cell, cell, cell)
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
}
