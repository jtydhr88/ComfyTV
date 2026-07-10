import * as THREE from 'three'

import type { PrimitiveShape, ScenePrimitiveEntry } from './types'

const GEOMETRY_BUILDERS: Record<PrimitiveShape, () => THREE.BufferGeometry> = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 32, 16),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  plane: () =>
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2) as THREE.BufferGeometry
}

interface PrimitiveRuntime {
  entry: ScenePrimitiveEntry
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
}

export class Scene3dPrimitiveManager {
  private readonly runtimes = new Map<string, PrimitiveRuntime>()

  constructor(private readonly scene: THREE.Scene) {}

  applyPrimitives(entries: readonly ScenePrimitiveEntry[]): void {
    const wantedIds = new Set(entries.map((entry) => entry.id))
    for (const [id, runtime] of this.runtimes) {
      if (!wantedIds.has(id)) this.removeRuntime(runtime, id)
    }

    for (const entry of entries) {
      let runtime = this.runtimes.get(entry.id)
      if (runtime && runtime.entry.shape !== entry.shape) {
        this.removeRuntime(runtime, entry.id)
        runtime = undefined
      }
      if (!runtime) {
        const mesh = new THREE.Mesh(
          GEOMETRY_BUILDERS[entry.shape](),
          new THREE.MeshStandardMaterial({
            color: entry.color,
            side: entry.shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide
          })
        )
        mesh.userData.sceneObjectId = entry.id
        this.scene.add(mesh)
        runtime = { entry, mesh }
        this.runtimes.set(entry.id, runtime)
      }

      runtime.entry = entry
      runtime.mesh.material.color.set(entry.color)
      const { position, quaternion, scale } = entry.transform
      runtime.mesh.position.set(position.x, position.y, position.z)
      runtime.mesh.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      )
      runtime.mesh.scale.set(scale.x, scale.y, scale.z)
    }
  }

  getObject(id: string): THREE.Object3D | null {
    return this.runtimes.get(id)?.mesh ?? null
  }

  pickables(): THREE.Object3D[] {
    return [...this.runtimes.values()].map((runtime) => runtime.mesh)
  }

  private removeRuntime(runtime: PrimitiveRuntime, id: string): void {
    this.scene.remove(runtime.mesh)
    runtime.mesh.geometry.dispose()
    runtime.mesh.material.dispose()
    this.runtimes.delete(id)
  }

  dispose(): void {
    for (const [id, runtime] of this.runtimes) {
      this.removeRuntime(runtime, id)
    }
  }
}
