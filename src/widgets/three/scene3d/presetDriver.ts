import * as THREE from 'three'
import { CameraTrackBinding, importCameraActionFromJson } from 'dollycurve'
import type { CameraAction } from 'dollycurve'

import type { CameraPresetTuning } from '@/widgets/three/load3d/interfaces'

const yawQuat = new THREE.Quaternion()
const rollQuat = new THREE.Quaternion()
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const ZERO = new THREE.Vector3(0, 0, 0)

export class PresetDriver {
  private action: CameraAction | null = null
  private binding: CameraTrackBinding | null = null
  private tuning: CameraPresetTuning = {}
  private subjectTarget: THREE.Vector3 | null = null
  private presetFps = 24
  private cachedFrameCount = 0
  private lastFrameIndex = 0

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  load(data: unknown): void {
    const action = importCameraActionFromJson(data)
    this.action = action
    this.presetFps = action.fps

    const target = action.metadata?.subjectTarget
    this.subjectTarget = target
      ? new THREE.Vector3(target[0], target[1], target[2])
      : null

    const sensorFc = action.fcurves.find(
      (f) => f.rnaPath === 'sensor_height' && f.arrayIndex === 0
    )
    const sensorHeight = sensorFc?.bezt[0]?.vec[1][1] ?? 24

    const locX = action.fcurves.find(
      (f) => f.rnaPath === 'location' && f.arrayIndex === 0
    )
    this.cachedFrameCount =
      locX && locX.bezt.length > 0
        ? Math.round(locX.bezt[locX.bezt.length - 1].vec[1][0]) + 1
        : 0

    this.binding = new CameraTrackBinding(this.camera, action, {
      sensorHeight,
      eulerOrder: 'XYZ'
    })
    this.applyFrame(0)
  }

  get isLoaded(): boolean {
    return this.action !== null
  }

  get frameCount(): number {
    return this.cachedFrameCount
  }

  get fps(): number {
    return this.presetFps
  }

  applyProgress(progress: number): void {
    if (this.tuning.reverse) progress = 1 - progress
    this.lastFrameIndex = progress * Math.max(0, this.cachedFrameCount - 1)
    this.applyFrame(this.lastFrameIndex)
  }

  getBasePosition(out: THREE.Vector3): boolean {
    if (!this.binding) return false
    const camera = this.camera
    const savedPosition = camera.position.clone()
    const savedQuaternion = camera.quaternion.clone()
    const savedFov = camera.fov
    try {
      this.binding.evaluate(this.lastFrameIndex / this.presetFps)
      this.applyPositionScaleYaw(camera.position)
      out.copy(camera.position)
    } finally {
      camera.position.copy(savedPosition)
      camera.quaternion.copy(savedQuaternion)
      camera.fov = savedFov
      camera.updateProjectionMatrix()
    }
    return true
  }

  setTuning(tuning: Partial<CameraPresetTuning>): void {
    this.tuning = { ...this.tuning, ...tuning }
  }

  replaceTuning(tuning: CameraPresetTuning): void {
    this.tuning = { ...tuning }
  }

  samplePath(samples = 64): THREE.Vector3[] {
    if (!this.binding || this.cachedFrameCount <= 0) return []
    const camera = this.camera
    const savedPosition = camera.position.clone()
    const savedQuaternion = camera.quaternion.clone()
    const savedFov = camera.fov
    const points: THREE.Vector3[] = []
    const lastFrame = Math.max(0, this.cachedFrameCount - 1)
    try {
      for (let i = 0; i <= samples; i++) {
        this.applyFrame((i / samples) * lastFrame)
        points.push(camera.position.clone())
      }
    } finally {
      camera.position.copy(savedPosition)
      camera.quaternion.copy(savedQuaternion)
      camera.fov = savedFov
      camera.updateProjectionMatrix()
    }
    return points
  }

  getPathBounds(samples = 32): THREE.Box3 | null {
    const points = this.samplePath(samples)
    if (!points.length) return null
    const bounds = new THREE.Box3()
    for (const point of points) bounds.expandByPoint(point)
    return bounds
  }

  dispose(): void {
    this.action = null
    this.binding = null
    this.subjectTarget = null
    this.cachedFrameCount = 0
    this.tuning = {}
  }

  private applyFrame(frameIndex: number): void {
    if (!this.binding) return
    const camera = this.camera

    this.binding.evaluate(frameIndex / this.presetFps)

    this.applyPositionTuning(camera.position)

    const yawRad = ((this.tuning.yawDegrees ?? 0) * Math.PI) / 180
    if (yawRad !== 0) {
      yawQuat.setFromAxisAngle(Y_AXIS, yawRad)
      camera.quaternion.premultiply(yawQuat)
    }

    const rollRad = ((this.tuning.rollDegrees ?? 0) * Math.PI) / 180
    if (rollRad !== 0) {
      rollQuat.setFromAxisAngle(Z_AXIS, rollRad)
      camera.quaternion.multiply(rollQuat)
    }

    const fovScale = this.tuning.fovScale ?? 1
    if (fovScale !== 1) {
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf / fovScale))
      camera.updateProjectionMatrix()
    }
  }

  private applyPositionTuning(pos: THREE.Vector3): void {
    this.applyPositionScaleYaw(pos)
    const off = this.tuning.positionOffset
    if (off) {
      pos.x += off.x
      pos.y += off.y
      pos.z += off.z
    }
  }

  private applyPositionScaleYaw(pos: THREE.Vector3): void {
    const pathScale = this.tuning.pathScale ?? 1
    const yawRad = ((this.tuning.yawDegrees ?? 0) * Math.PI) / 180
    if (pathScale === 1 && yawRad === 0) return
    const center = this.subjectTarget ?? ZERO
    let dx = pos.x - center.x
    let dy = pos.y - center.y
    let dz = pos.z - center.z
    if (pathScale !== 1) {
      dx *= pathScale
      dy *= pathScale
      dz *= pathScale
    }
    if (yawRad !== 0) {
      const c = Math.cos(yawRad)
      const s = Math.sin(yawRad)
      const nx = dx * c + dz * s
      const nz = -dx * s + dz * c
      dx = nx
      dz = nz
    }
    pos.x = center.x + dx
    pos.y = center.y + dy
    pos.z = center.z + dz
  }
}
