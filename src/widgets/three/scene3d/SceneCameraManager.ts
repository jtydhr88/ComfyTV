import * as THREE from 'three'

import type { SceneCameraEntry } from './types'
import { PresetDriver } from './presetDriver'

const CAMERA_COLOR = 0xe8b84a
const CAMERA_COLOR_SELECTED = 0x4a9eff

const tmpBase = new THREE.Vector3()

interface CameraRuntime {
  entry: SceneCameraEntry
  camera: THREE.PerspectiveCamera
  marker: THREE.Group
  helperCamera: THREE.PerspectiveCamera
  helper: THREE.CameraHelper
  driver: PresetDriver | null
  presetFile: string
  pathLine: THREE.Line | null
  pathKey: string
}

function buildMarker(): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: CAMERA_COLOR })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.3), material)
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.14, 16),
    material
  )
  lens.rotation.x = -Math.PI / 2
  lens.position.z = -0.22
  group.add(body)
  group.add(lens)
  return group
}

export class SceneCameraManager {
  private readonly runtimes = new Map<string, CameraRuntime>()
  private readonly presetCache = new Map<string, Promise<unknown>>()
  private selectedId: string | null = null
  private lookThroughId: string | null = null
  private helpersVisible = true
  private lastTime = 0

  constructor(
    private readonly scene: THREE.Scene,
    private readonly loadPresetData: (file: string) => Promise<unknown>,
    private readonly onPresetLoaded: () => void
  ) {}

  async applyCameras(entries: readonly SceneCameraEntry[]): Promise<void> {
    const wantedIds = new Set(entries.map((entry) => entry.id))
    for (const [id, runtime] of this.runtimes) {
      if (!wantedIds.has(id)) this.removeRuntime(runtime, id)
    }

    const loads: Array<Promise<void>> = []
    for (const entry of entries) {
      let runtime = this.runtimes.get(entry.id)
      if (!runtime) {
        const camera = new THREE.PerspectiveCamera(entry.fov, 1, 0.1, 2000)
        camera.userData.sceneObjectId = entry.id
        const marker = buildMarker()
        camera.add(marker)
        const helperCamera = new THREE.PerspectiveCamera(entry.fov, 1, 0.12, 1)
        camera.add(helperCamera)
        const helper = new THREE.CameraHelper(helperCamera)
        this.scene.add(camera)
        this.scene.add(helper)
        runtime = {
          entry,
          camera,
          marker,
          helperCamera,
          helper,
          driver: null,
          presetFile: '',
          pathLine: null,
          pathKey: ''
        }
        this.runtimes.set(entry.id, runtime)
      }
      runtime.entry = entry
      const load = this.syncRuntime(runtime)
      if (load) loads.push(load)
    }
    this.applyHelperVisibility()
    if (loads.length) await Promise.all(loads)
  }

  setTimelineTime(seconds: number, excludeId: string | null = null): void {
    this.lastTime = seconds
    for (const [id, runtime] of this.runtimes) {
      if (id === excludeId) continue
      const { driver, entry } = runtime
      if (!driver?.isLoaded || !entry.preset) continue
      const duration =
        driver.fps > 0 ? driver.frameCount / driver.fps / entry.preset.speed : 0
      const progress =
        duration > 0 ? Math.min(1, Math.max(0, seconds / duration)) : 0
      driver.applyProgress(progress)
      this.syncHelper(runtime)
    }
  }

  getCamera(id: string): THREE.PerspectiveCamera | null {
    return this.runtimes.get(id)?.camera ?? null
  }

  previewPresetDrag(id: string, worldPos: THREE.Vector3): void {
    const runtime = this.runtimes.get(id)
    if (!runtime?.driver?.isLoaded || !runtime.entry.preset) return
    if (runtime.pathLine && runtime.driver.getBasePosition(tmpBase)) {
      const off = runtime.entry.preset.tuning.positionOffset ?? {
        x: 0,
        y: 0,
        z: 0
      }
      runtime.pathLine.position.set(
        worldPos.x - tmpBase.x - off.x,
        worldPos.y - tmpBase.y - off.y,
        worldPos.z - tmpBase.z - off.z
      )
    }
    this.syncHelper(runtime)
  }

  offsetForWorldPosition(
    id: string,
    world: THREE.Vector3
  ): { x: number; y: number; z: number } | null {
    const runtime = this.runtimes.get(id)
    if (!runtime?.driver?.isLoaded || !runtime.entry.preset) return null
    const base = new THREE.Vector3()
    if (!runtime.driver.getBasePosition(base)) return null
    return { x: world.x - base.x, y: world.y - base.y, z: world.z - base.z }
  }

  getObject(id: string): THREE.Object3D | null {
    return this.runtimes.get(id)?.camera ?? null
  }

  getEntry(id: string): SceneCameraEntry | null {
    return this.runtimes.get(id)?.entry ?? null
  }

  isCamera(id: string): boolean {
    return this.runtimes.has(id)
  }

  getPresetInfo(id: string): { frameCount: number; fps: number } | null {
    const runtime = this.runtimes.get(id)
    if (!runtime?.driver?.isLoaded || !runtime.entry.preset) return null
    return { frameCount: runtime.driver.frameCount, fps: runtime.driver.fps }
  }

  maxPresetDuration(): number {
    let longest = 0
    for (const runtime of this.runtimes.values()) {
      const { driver, entry } = runtime
      if (!driver?.isLoaded || !entry.preset || driver.fps <= 0) continue
      const speed = Math.max(0.1, entry.preset.speed)
      longest = Math.max(longest, driver.frameCount / driver.fps / speed)
    }
    return longest
  }

  pickables(): THREE.Object3D[] {
    return [...this.runtimes.values()].map((runtime) => runtime.camera)
  }

  getPathBounds(): THREE.Box3 | null {
    let bounds: THREE.Box3 | null = null
    for (const runtime of this.runtimes.values()) {
      const box = runtime.driver?.getPathBounds() ?? null
      if (!box) continue
      if (bounds) bounds.union(box)
      else bounds = box
    }
    return bounds
  }

  setSelected(id: string | null): void {
    this.selectedId = id
    for (const [runtimeId, runtime] of this.runtimes) {
      const selected = runtimeId === id
      const color = selected ? CAMERA_COLOR_SELECTED : CAMERA_COLOR
      runtime.marker.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          ;(obj.material as THREE.MeshBasicMaterial).color.set(color)
        }
      })
      if (runtime.pathLine) {
        const material = runtime.pathLine.material as THREE.LineBasicMaterial
        material.color.set(color)
        material.opacity = selected ? 1 : 0.5
      }
    }
  }

  setHelpersVisible(visible: boolean): void {
    this.helpersVisible = visible
    this.applyHelperVisibility()
  }

  setLookThroughId(id: string | null): void {
    this.lookThroughId = id
    this.applyHelperVisibility()
  }

  dispose(): void {
    for (const [id, runtime] of this.runtimes) {
      this.removeRuntime(runtime, id)
    }
    this.presetCache.clear()
  }

  private applyHelperVisibility(): void {
    for (const [id, runtime] of this.runtimes) {
      const visible = this.helpersVisible && id !== this.lookThroughId
      runtime.marker.visible = visible
      runtime.helper.visible = visible
      if (runtime.pathLine) runtime.pathLine.visible = visible
    }
  }

  private syncRuntime(runtime: CameraRuntime): Promise<void> | null {
    const { entry, camera } = runtime

    if (!entry.preset) {
      if (runtime.driver) {
        runtime.driver.dispose()
        runtime.driver = null
        runtime.presetFile = ''
      }
      this.removePathLine(runtime)
      camera.position.set(
        entry.transform.position.x,
        entry.transform.position.y,
        entry.transform.position.z
      )
      camera.quaternion.set(
        entry.transform.quaternion.x,
        entry.transform.quaternion.y,
        entry.transform.quaternion.z,
        entry.transform.quaternion.w
      )
      camera.fov = entry.fov
      camera.updateProjectionMatrix()
      this.syncHelper(runtime)
      return null
    }

    const { file, tuning } = entry.preset
    if (runtime.driver?.isLoaded && runtime.presetFile === file) {
      runtime.driver.replaceTuning(tuning)
      this.refreshPathLine(runtime)
      this.setTimelineCameraPose(runtime)
      return null
    }

    let promise = this.presetCache.get(file)
    if (!promise) {
      promise = this.loadPresetData(file)
      this.presetCache.set(file, promise)
    }
    return promise
      .then((data) => {
        const current = this.runtimes.get(entry.id)
        if (!current || current.entry.preset?.file !== file) return
        if (current.driver?.isLoaded && current.presetFile === file) return
        const driver = new PresetDriver(current.camera)
        driver.load(data)
        driver.replaceTuning(current.entry.preset.tuning)
        current.driver = driver
        current.presetFile = file
        this.refreshPathLine(current)
        this.setTimelineCameraPose(current)
        this.setSelected(this.selectedId)
        this.onPresetLoaded()
      })
      .catch((error) => {
        this.presetCache.delete(file)
        console.error('[ComfyTV/scene3d] failed to load camera preset', error)
      })
  }

  private setTimelineCameraPose(runtime: CameraRuntime): void {
    const { driver, entry } = runtime
    if (!driver?.isLoaded || !entry.preset) return
    const duration =
      driver.fps > 0 ? driver.frameCount / driver.fps / entry.preset.speed : 0
    const progress =
      duration > 0 ? Math.min(1, Math.max(0, this.lastTime / duration)) : 0
    driver.applyProgress(progress)
    this.syncHelper(runtime)
  }

  private syncHelper(runtime: CameraRuntime): void {
    runtime.helperCamera.fov = runtime.camera.fov
    runtime.helperCamera.aspect = runtime.camera.aspect
    runtime.helperCamera.updateProjectionMatrix()
    runtime.helper.update()
  }

  private refreshPathLine(runtime: CameraRuntime): void {
    const { driver, entry } = runtime
    if (!driver?.isLoaded || !entry.preset) {
      this.removePathLine(runtime)
      return
    }
    const key = `${entry.preset.file}|${JSON.stringify(entry.preset.tuning)}`
    if (runtime.pathLine && runtime.pathKey === key) return
    this.removePathLine(runtime)
    const points = driver.samplePath(64)
    if (points.length < 2) return
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: entry.id === this.selectedId ? CAMERA_COLOR_SELECTED : CAMERA_COLOR,
      transparent: true,
      opacity: entry.id === this.selectedId ? 1 : 0.5
    })
    const line = new THREE.Line(geometry, material)
    line.visible = this.helpersVisible
    this.scene.add(line)
    runtime.pathLine = line
    runtime.pathKey = key
  }

  private removePathLine(runtime: CameraRuntime): void {
    if (!runtime.pathLine) return
    this.scene.remove(runtime.pathLine)
    runtime.pathLine.geometry.dispose()
    ;(runtime.pathLine.material as THREE.Material).dispose()
    runtime.pathLine = null
    runtime.pathKey = ''
  }

  private removeRuntime(runtime: CameraRuntime, id: string): void {
    this.removePathLine(runtime)
    this.scene.remove(runtime.helper)
    this.scene.remove(runtime.camera)
    runtime.helper.dispose()
    runtime.marker.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
    })
    runtime.driver?.dispose()
    this.runtimes.delete(id)
  }
}
