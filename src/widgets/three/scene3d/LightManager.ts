import * as THREE from 'three'

import type { SceneLightEntry, SceneLightType } from './types'

type EditorLight = THREE.DirectionalLight | THREE.PointLight | THREE.SpotLight

interface LightRuntime {
  entry: SceneLightEntry
  light: EditorLight
  marker: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
}

function createLight(type: SceneLightType): EditorLight {
  const light =
    type === 'directional'
      ? new THREE.DirectionalLight()
      : type === 'point'
        ? new THREE.PointLight()
        : new THREE.SpotLight()
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  light.shadow.bias = -0.0001
  light.shadow.normalBias = 0.02
  if (light instanceof THREE.DirectionalLight) {
    light.shadow.camera.left = -20
    light.shadow.camera.right = 20
    light.shadow.camera.top = 20
    light.shadow.camera.bottom = -20
    light.shadow.camera.far = 100
  }
  return light
}

export class Scene3dLightManager {
  private readonly runtimes = new Map<string, LightRuntime>()

  constructor(private readonly scene: THREE.Scene) {}

  applyLights(entries: readonly SceneLightEntry[]): void {
    const wantedIds = new Set(entries.map((entry) => entry.id))
    for (const [id, runtime] of this.runtimes) {
      if (!wantedIds.has(id)) this.removeRuntime(runtime, id)
    }

    for (const entry of entries) {
      let runtime = this.runtimes.get(entry.id)
      if (runtime && runtime.entry.type !== entry.type) {
        this.removeRuntime(runtime, entry.id)
        runtime = undefined
      }
      if (!runtime) {
        const light = createLight(entry.type)
        light.userData.sceneObjectId = entry.id
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 12, 8),
          new THREE.MeshBasicMaterial()
        )
        light.add(marker)
        this.scene.add(light)
        if ('target' in light && light.target instanceof THREE.Object3D) {
          this.scene.add(light.target)
        }
        runtime = { entry, light, marker }
        this.runtimes.set(entry.id, runtime)
      }

      runtime.entry = entry
      this.syncLight(runtime)
    }
  }

  private syncLight(runtime: LightRuntime): void {
    const { entry, light, marker } = runtime
    light.color.set(entry.color)
    light.intensity = entry.intensity
    light.position.set(entry.position.x, entry.position.y, entry.position.z)
    marker.material.color.set(entry.color)
    if (entry.target && 'target' in light) {
      light.target.position.set(entry.target.x, entry.target.y, entry.target.z)
    }
    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
      light.distance = entry.range ?? 0
      light.decay = 2
    }
    if (light instanceof THREE.SpotLight) {
      const outer = entry.outerConeAngle ?? 45
      const inner = Math.min(entry.innerConeAngle ?? 30, outer)
      light.angle = THREE.MathUtils.degToRad(Math.max(outer, 1))
      light.penumbra = outer > 0 ? 1 - inner / outer : 0
    }
  }

  getObject(id: string): THREE.Object3D | null {
    return this.runtimes.get(id)?.light ?? null
  }

  getEntry(id: string): SceneLightEntry | null {
    return this.runtimes.get(id)?.entry ?? null
  }

  patchEntry(id: string, patch: Partial<SceneLightEntry>): SceneLightEntry | null {
    const runtime = this.runtimes.get(id)
    if (!runtime) return null
    runtime.entry = { ...runtime.entry, ...patch, id }
    this.syncLight(runtime)
    return runtime.entry
  }

  isLight(id: string): boolean {
    return this.runtimes.has(id)
  }

  pickables(): THREE.Object3D[] {
    return [...this.runtimes.values()].map((runtime) => runtime.light)
  }

  setMarkersVisible(visible: boolean): void {
    for (const runtime of this.runtimes.values()) {
      runtime.marker.visible = visible
    }
  }

  private removeRuntime(runtime: LightRuntime, id: string): void {
    this.scene.remove(runtime.light)
    if ('target' in runtime.light) {
      this.scene.remove(runtime.light.target as THREE.Object3D)
    }
    runtime.marker.geometry.dispose()
    runtime.marker.material.dispose()
    runtime.light.dispose()
    this.runtimes.delete(id)
  }

  dispose(): void {
    for (const [id, runtime] of this.runtimes) {
      this.removeRuntime(runtime, id)
    }
  }
}
