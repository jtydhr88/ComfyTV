import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { actionSampleTime, characterElapsedTime } from './characterTime'
import { bindClipToRoot } from './clipTracks'
import {
  exportParsedPathJson,
  parsePathStrip,
  pathStripDuration,
  rebuildPathTable,
  samplePathPoints,
  samplePathStrip,
  type ParsedPathStrip
} from './pathStrip'
import { loadCharacterAssets } from './scene3dAssets'
import { TRACK_COLORS } from './timelineTracks'
import type { SceneCharacterEntry } from './types'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const PATH_LINE_Y = 0.05

interface CharacterRuntime {
  entry: SceneCharacterEntry
  root: THREE.Object3D
  mixer: THREE.AnimationMixer
  action: THREE.AnimationAction | null
  clips: THREE.AnimationClip[]
  pathParsed: ParsedPathStrip | null
  pathKey: string
  pathLine: THREE.Line | null
  pathLineSuppressed: boolean
  tintApplied: string
}

export class Scene3dCharacterManager {
  private readonly runtimes = new Map<string, CharacterRuntime>()
  private applyGeneration = 0
  private sceneFps = 24
  private helpersVisible = true

  constructor(private readonly scene: THREE.Scene) {}

  setSceneFps(fps: number): void {
    this.sceneFps = fps > 0 ? fps : 24
  }

  async applyCharacters(
    entries: readonly SceneCharacterEntry[]
  ): Promise<void> {
    const generation = ++this.applyGeneration
    const wantedIds = new Set(entries.map((entry) => entry.id))
    for (const [id, runtime] of this.runtimes) {
      if (!wantedIds.has(id)) this.removeRuntime(runtime, id)
    }

    for (const entry of entries) {
      let runtime = this.runtimes.get(entry.id)
      if (runtime && runtime.entry.model !== entry.model) {
        this.removeRuntime(runtime, entry.id)
        runtime = undefined
      }
      if (!runtime) {
        let assets
        try {
          assets = await loadCharacterAssets(entry.model)
        } catch (error) {
          console.error(
            '[ComfyTV/scene3d] failed to load character',
            entry.model,
            error
          )
          if (generation !== this.applyGeneration) return
          continue
        }
        if (generation !== this.applyGeneration) return
        const root = cloneSkinned(assets.template)
        root.userData.sceneObjectId = entry.id
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
            child.material = Array.isArray(child.material)
              ? child.material.map((m) => m.clone())
              : child.material.clone()
          }
        })
        this.scene.add(root)
        runtime = {
          entry,
          root,
          mixer: new THREE.AnimationMixer(root),
          action: null,
          clips: assets.clips,
          pathParsed: null,
          pathKey: '',
          pathLine: null,
          pathLineSuppressed: false,
          tintApplied: ''
        }
        this.runtimes.set(entry.id, runtime)
      }

      runtime.entry = entry
      const { position, quaternion, scale } = entry.transform
      runtime.root.position.set(position.x, position.y, position.z)
      runtime.root.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      )
      runtime.root.scale.set(scale.x, scale.y, scale.z)
      this.syncTint(runtime)
      this.syncPath(runtime, entries.indexOf(entry))
      this.syncAction(runtime)
    }
  }

  private syncTint(runtime: CharacterRuntime): void {
    const color = runtime.entry.color || ''
    if (runtime.tintApplied === color) return
    runtime.tintApplied = color
    runtime.root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]
      for (const material of materials) {
        const std = material as THREE.MeshStandardMaterial
        if (!std.color) continue
        if (!std.userData.baseColor) {
          std.userData.baseColor = std.color.getHex()
        }
        if (color) std.color.set(color)
        else std.color.setHex(std.userData.baseColor as number)
      }
    })
  }

  private syncPath(runtime: CharacterRuntime, index: number): void {
    const strip = runtime.entry.path
    if (!strip) {
      runtime.pathParsed = null
      runtime.pathKey = ''
      this.removePathLine(runtime)
      return
    }
    const key = JSON.stringify(strip.action)
    if (key === runtime.pathKey) return
    runtime.pathParsed = parsePathStrip(strip.action)
    runtime.pathKey = key
    this.removePathLine(runtime)
    if (!runtime.pathParsed) return
    const points = samplePathPoints(runtime.pathParsed).map(
      ([x, y, z]) => new THREE.Vector3(x, Math.max(y, 0) + PATH_LINE_Y, z)
    )
    if (points.length < 2) return
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: TRACK_COLORS[Math.max(0, index) % TRACK_COLORS.length]
    })
    const line = new THREE.Line(geometry, material)
    line.visible = this.helpersVisible && !runtime.pathLineSuppressed
    this.scene.add(line)
    runtime.pathLine = line
  }

  getParsedPath(id: string): ParsedPathStrip | null {
    return this.runtimes.get(id)?.pathParsed ?? null
  }

  exportPathAction(id: string): Record<string, unknown> | null {
    const parsed = this.runtimes.get(id)?.pathParsed
    return parsed ? exportParsedPathJson(parsed) : null
  }

  invalidatePath(id: string): void {
    const runtime = this.runtimes.get(id)
    if (!runtime?.pathParsed) return
    rebuildPathTable(runtime.pathParsed)
    if (runtime.pathLine) {
      const points = samplePathPoints(runtime.pathParsed).map(
        ([x, y, z]) => new THREE.Vector3(x, Math.max(y, 0) + PATH_LINE_Y, z)
      )
      runtime.pathLine.geometry.dispose()
      runtime.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(
        points
      )
    }
  }

  setPathLineSuppressed(id: string, suppressed: boolean): void {
    for (const [runtimeId, runtime] of this.runtimes) {
      const value = runtimeId === id ? suppressed : false
      runtime.pathLineSuppressed = value
      if (runtime.pathLine) {
        runtime.pathLine.visible = this.helpersVisible && !value
      }
    }
  }

  private removePathLine(runtime: CharacterRuntime): void {
    if (!runtime.pathLine) return
    this.scene.remove(runtime.pathLine)
    runtime.pathLine.geometry.dispose()
    ;(runtime.pathLine.material as THREE.Material).dispose()
    runtime.pathLine = null
  }

  setHelpersVisible(visible: boolean): void {
    this.helpersVisible = visible
    for (const runtime of this.runtimes.values()) {
      if (runtime.pathLine) {
        runtime.pathLine.visible = visible && !runtime.pathLineSuppressed
      }
    }
  }

  private syncAction(runtime: CharacterRuntime): void {
    const clipName = runtime.entry.animation.clip
    if (runtime.action?.getClip().name === clipName) return
    if (runtime.action) {
      runtime.action.stop()
      runtime.action = null
    }
    const clip = runtime.clips.find((candidate) => candidate.name === clipName)
    if (!clip) return
    const action = runtime.mixer.clipAction(bindClipToRoot(clip, runtime.root))
    action.loop = THREE.LoopRepeat
    action.play()
    action.paused = true
    runtime.action = action
  }

  setTimelineTime(timelineSeconds: number): void {
    for (const runtime of this.runtimes.values()) {
      const pathSample = this.applyPathAt(runtime, timelineSeconds)
      const action = runtime.action
      if (!action) continue
      const animation = runtime.entry.animation
      const strip = runtime.entry.path
      const elapsed =
        pathSample && strip?.syncSpeed
          ? pathSample.s / strip.syncSpeed
          : characterElapsedTime(timelineSeconds, animation)
      const local = actionSampleTime(
        elapsed,
        action.getClip().duration,
        animation.loop
      )
      action.paused = false
      action.time = local
      runtime.mixer.update(0)
      action.paused = true
    }
  }

  private applyPathAt(
    runtime: CharacterRuntime,
    timelineSeconds: number
  ): { s: number } | null {
    const strip = runtime.entry.path
    const parsed = runtime.pathParsed
    if (!strip || !parsed) return null
    const fps = this.sceneFps
    const startSec = (strip.range?.start ?? 0) / fps
    const duration = pathStripDuration(strip, parsed, fps)
    const sample = samplePathStrip(parsed, timelineSeconds - startSec, duration)
    runtime.root.position.set(sample.x, sample.y, sample.z)
    runtime.root.quaternion.setFromAxisAngle(Y_AXIS, sample.yaw)
    return sample
  }

  sampleWorldPose(
    id: string,
    timelineSeconds: number
  ): { x: number; y: number; z: number; yaw: number; scaleY: number } | null {
    const runtime = this.runtimes.get(id)
    if (!runtime) return null
    const scaleY = runtime.entry.transform.scale.y
    const strip = runtime.entry.path
    const parsed = runtime.pathParsed
    if (strip && parsed) {
      const fps = this.sceneFps
      const startSec = (strip.range?.start ?? 0) / fps
      const duration = pathStripDuration(strip, parsed, fps)
      const sample = samplePathStrip(
        parsed,
        timelineSeconds - startSec,
        duration
      )
      return { x: sample.x, y: sample.y, z: sample.z, yaw: sample.yaw, scaleY }
    }
    const { position, quaternion: q } = runtime.entry.transform
    const yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.x * q.x)
    )
    return { x: position.x, y: position.y, z: position.z, yaw, scaleY }
  }

  sampleWorldPosition(
    id: string,
    timelineSeconds: number,
    out: THREE.Vector3
  ): boolean {
    const pose = this.sampleWorldPose(id, timelineSeconds)
    if (!pose) return false
    out.set(pose.x, pose.y, pose.z)
    return true
  }

  pathEndSeconds(): number {
    let end = 0
    for (const runtime of this.runtimes.values()) {
      const strip = runtime.entry.path
      if (!strip || !runtime.pathParsed) continue
      const startSec = (strip.range?.start ?? 0) / this.sceneFps
      end = Math.max(
        end,
        startSec + pathStripDuration(strip, runtime.pathParsed, this.sceneFps)
      )
    }
    return end
  }

  getObject(id: string): THREE.Object3D | null {
    return this.runtimes.get(id)?.root ?? null
  }

  pickables(): THREE.Object3D[] {
    return [...this.runtimes.values()].map((runtime) => runtime.root)
  }

  getClipDuration(id: string): number {
    return this.runtimes.get(id)?.action?.getClip().duration ?? 0
  }

  clipDurations(): Map<string, number> {
    const durations = new Map<string, number>()
    for (const runtime of this.runtimes.values()) {
      const action = runtime.action
      if (!action) continue
      durations.set(
        `${runtime.entry.model}:${runtime.entry.animation.clip}`,
        action.getClip().duration
      )
    }
    return durations
  }

  private removeRuntime(runtime: CharacterRuntime, id: string): void {
    runtime.mixer.stopAllAction()
    this.removePathLine(runtime)
    this.scene.remove(runtime.root)
    this.runtimes.delete(id)
  }

  dispose(): void {
    for (const [id, runtime] of this.runtimes) {
      this.removeRuntime(runtime, id)
    }
  }
}
