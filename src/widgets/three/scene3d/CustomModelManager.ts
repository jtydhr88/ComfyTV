import * as THREE from 'three'

import { actionSampleTime, characterElapsedTime } from './characterTime'
import { bindClipToRoot } from './clipTracks'
import { loadSceneModelInstance } from './scene3dAssets'
import type { SceneModelEntry } from './types'

interface ModelRuntime {
  entry: SceneModelEntry
  root: THREE.Object3D
  mixer: THREE.AnimationMixer
  action: THREE.AnimationAction | null
  clips: THREE.AnimationClip[]
  dispose: (() => void) | null
}

export class Scene3dCustomModelManager {
  private readonly runtimes = new Map<string, ModelRuntime>()
  private applyGeneration = 0

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ensureSparkRenderer?: () => Promise<void>
  ) {}

  async applyModels(entries: readonly SceneModelEntry[]): Promise<void> {
    const generation = ++this.applyGeneration
    const wantedIds = new Set(entries.map((entry) => entry.id))
    for (const [id, runtime] of this.runtimes) {
      if (!wantedIds.has(id)) this.removeRuntime(runtime, id)
    }

    for (const entry of entries) {
      let runtime = this.runtimes.get(entry.id)
      if (runtime && runtime.entry.url !== entry.url) {
        this.removeRuntime(runtime, entry.id)
        runtime = undefined
      }
      if (!runtime) {
        let instance
        try {
          instance = await loadSceneModelInstance(entry.url)
          if (instance.kind === 'splat') await this.ensureSparkRenderer?.()
        } catch (error) {
          console.error(
            '[ComfyTV/scene3d] failed to load custom model',
            entry.url,
            error
          )
          if (generation !== this.applyGeneration) return
          continue
        }
        if (generation !== this.applyGeneration) {
          instance.dispose?.()
          return
        }
        const root = instance.root
        root.userData.sceneObjectId = entry.id
        if (instance.kind === 'mesh') {
          root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
        }
        this.scene.add(root)
        runtime = {
          entry,
          root,
          mixer: new THREE.AnimationMixer(root),
          action: null,
          clips: instance.clips,
          dispose: instance.dispose
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
      this.syncAction(runtime)
    }
  }

  private syncAction(runtime: ModelRuntime): void {
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
      const action = runtime.action
      if (!action) continue
      const animation = runtime.entry.animation
      const local = actionSampleTime(
        characterElapsedTime(timelineSeconds, animation),
        action.getClip().duration,
        animation.loop
      )
      action.paused = false
      action.time = local
      runtime.mixer.update(0)
      action.paused = true
    }
  }

  getObject(id: string): THREE.Object3D | null {
    return this.runtimes.get(id)?.root ?? null
  }

  isModel(id: string): boolean {
    return this.runtimes.has(id)
  }

  pickables(): THREE.Object3D[] {
    return [...this.runtimes.values()].map((runtime) => runtime.root)
  }

  splatRoots(): THREE.Object3D[] {
    return [...this.runtimes.values()]
      .filter((runtime) => runtime.root.userData.comfytvSplat === true)
      .map((runtime) => runtime.root)
  }

  getClipNames(id: string): string[] {
    return (this.runtimes.get(id)?.clips ?? []).map((clip) => clip.name)
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
        `${runtime.entry.url}:${runtime.entry.animation.clip}`,
        action.getClip().duration
      )
    }
    return durations
  }

  private removeRuntime(runtime: ModelRuntime, id: string): void {
    runtime.mixer.stopAllAction()
    this.scene.remove(runtime.root)
    runtime.dispose?.()
    this.runtimes.delete(id)
  }

  dispose(): void {
    for (const [id, runtime] of this.runtimes) {
      this.removeRuntime(runtime, id)
    }
  }
}
