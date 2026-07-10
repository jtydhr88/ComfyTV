import * as THREE from 'three'

export class CheckerRoom {
  private group: THREE.Group | null = null
  private scene: THREE.Scene | null = null
  private lastKey = ''

  attach(scene: THREE.Scene): void {
    this.scene = scene
  }

  update(enabled: boolean, bounds: THREE.Box3): void {
    const key = enabled
      ? [
          bounds.min.x,
          bounds.min.y,
          bounds.min.z,
          bounds.max.x,
          bounds.max.y,
          bounds.max.z
        ]
          .map((v) => Math.round(v * 10) / 10)
          .join(',')
      : ''
    if (key === this.lastKey) return
    this.lastKey = key
    this.remove()
    if (enabled) this.build(bounds)
  }

  isRoomObject(object: THREE.Object3D): boolean {
    if (!this.group) return false
    let current: THREE.Object3D | null = object
    while (current) {
      if (current === this.group) return true
      current = current.parent
    }
    return false
  }

  dispose(): void {
    this.remove()
    this.scene = null
    this.lastKey = ''
  }

  private remove(): void {
    if (!this.group) return
    this.scene?.remove(this.group)
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        const material = obj.material as THREE.MeshStandardMaterial
        material.map?.dispose()
        material.dispose()
      }
    })
    this.group = null
  }

  private createCheckerTexture(): THREE.CanvasTexture {
    const size = 512
    const divisions = 8
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const cell = size / divisions
    for (let r = 0; r < divisions; r++) {
      for (let c = 0; c < divisions; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#a0a0a0' : '#707070'
        ctx.fillRect(c * cell, r * cell, cell, cell)
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    return tex
  }

  private build(bounds: THREE.Box3): void {
    if (!this.scene) return
    const { min, max } = bounds
    const roomW = max.x - min.x
    const roomH = max.y - min.y
    const roomD = max.z - min.z
    if (roomW <= 0 || roomH <= 0 || roomD <= 0) return
    const cx = (min.x + max.x) / 2
    const cy = (min.y + max.y) / 2
    const cz = (min.z + max.z) / 2

    const group = new THREE.Group()
    group.name = '__checker_room__'

    const makePlane = (w: number, h: number): THREE.Mesh => {
      const tex = this.createCheckerTexture()
      tex.repeat.set(w / 8, h / 8)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.0
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      mesh.receiveShadow = true
      return mesh
    }

    const floor = makePlane(roomW, roomD)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, min.y, cz)
    group.add(floor)

    const ceiling = makePlane(roomW, roomD)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(cx, max.y, cz)
    group.add(ceiling)

    const back = makePlane(roomW, roomH)
    back.position.set(cx, cy, min.z)
    group.add(back)

    const front = makePlane(roomW, roomH)
    front.rotation.y = Math.PI
    front.position.set(cx, cy, max.z)
    group.add(front)

    const left = makePlane(roomD, roomH)
    left.rotation.y = Math.PI / 2
    left.position.set(min.x, cy, cz)
    group.add(left)

    const right = makePlane(roomD, roomH)
    right.rotation.y = -Math.PI / 2
    right.position.set(max.x, cy, cz)
    group.add(right)

    this.scene.add(group)
    this.group = group
  }
}
