import * as THREE from 'three'

import type { CharacterRig } from './actorFactory'
import {
  sampleAim,
  sampleFov,
  sampleTrack,
  trackSpeed,
  type TrackTimingMode
} from './dollyTrack'
import type { PrevizActor, PrevizWorld, RuntimeShot } from './PrevizWorld'
import { PREVIZ_LOCK_MANUAL } from './types'

export class PrevizClock {
  time = 0
  playing = false

  play(): void {
    this.playing = true
  }

  pause(): void {
    this.playing = false
  }

  seek(t: number): void {
    this.time = Math.max(0, t)
  }

  tick(dt: number): void {
    if (this.playing) this.time += dt
  }
}

function shotTimingMode(world: PrevizWorld, shot: RuntimeShot): TrackTimingMode {
  if (world.syncTargetForShot(shot)) return 'indexed'
  if (shot.timingMode === 'custom' && trackSpeed(shot.action)) return 'speed'
  return 'smoothstep'
}

export function evaluateShotCam(
  world: PrevizWorld,
  shot: RuntimeShot | undefined,
  shotTime: number,
  previewPt: number | null = null
): void {
  if (!shot) return
  const cam = world.shotCam
  const sample = sampleTrack(
    shot.action,
    shotTime,
    shotTimingMode(world, shot),
    shot.dur,
    world.trackTable(shot.action)
  )
  if (!sample) return
  const path = shot.action.pathFollow?.splinePath
  if (previewPt !== null && path?.points.length) {
    const p = path.points[Math.max(0, Math.min(previewPt, path.points.length - 1))]
    cam.position.set(p.co[0], p.co[1], p.co[2])
  } else {
    cam.position.copy(sample.position)
  }
  cam.fov = sampleFov(shot.action, shotTime, shot.fov)
  if (shot.lock === PREVIZ_LOCK_MANUAL) {
    const aim = sampleAim(shot.action, shotTime, { yawDeg: shot.yaw, pitchDeg: shot.pitch })
    cam.rotation.order = 'YXZ'
    cam.rotation.set((aim.pitchDeg * Math.PI) / 180, (aim.yawDeg * Math.PI) / 180, 0)
  } else if (shot.lock) {
    cam.lookAt(world.lockTarget(shot.lock))
  } else {
    cam.lookAt(world.globalLockTarget())
  }
  cam.updateProjectionMatrix()
}

export interface EvaluateActorsOptions {
  draggingActor?: PrevizActor | null
}

export function evaluateActors(
  world: PrevizWorld,
  shotIdx: number,
  shotTime: number,
  opts: EvaluateActorsOptions = {}
): void {
  const shot = world.shots[shotIdx]
  if (!shot) return
  const start = world.shots.slice(0, shotIdx).reduce((sum, s) => sum + s.dur, 0)
  const globalSeconds = start + Math.min(shotTime, shot.dur)
  const syncActor = world.syncTargetForShot(shot)
  const sceneDur = world.sceneDuration()

  for (const a of world.actors) {
    if (a.data.mount) continue
    if (opts.draggingActor === a) continue
    if (!a.track) continue
    const nodeSync = a === syncActor && shot.timingMode !== 'custom'
    const sample = nodeSync
      ? sampleTrack(a.track, shotTime, 'indexed', shot.dur, world.trackTable(a.track))
      : sampleTrack(
          a.track,
          globalSeconds,
          trackSpeed(a.track) ? 'speed' : 'smoothstep',
          sceneDur,
          world.trackTable(a.track)
        )
    if (!sample) continue
    world.moveActorSafely(a, sample.position.x, sample.position.z)
    const tan = sample.tangent.clone().setY(0)
    if (tan.lengthSq() > 1e-4) {
      if (a.data.kind === 'char' || a.data.kind === 'horse') {
        a.obj.rotation.y = Math.atan2(tan.x, tan.z)
      }
      if (a.data.kind === 'car') a.obj.rotation.y = Math.atan2(tan.x, tan.z) - Math.PI / 2
    }
    const walking = sample.active && sample.speed > 0.05
    const rig = a.obj.userData.rig as CharacterRig | undefined
    if (rig && (a.data.pose || 'stand') === 'stand') {
      const ph = (sample.s * Math.PI) / 0.38
      const sw = walking ? Math.min(0.62, 0.28 + sample.speed * 0.3) : 0
      rig.hipL.rotation.x = Math.sin(ph) * sw
      rig.hipR.rotation.x = -Math.sin(ph) * sw
      rig.kneeL.rotation.x = Math.max(0, -Math.sin(ph)) * sw * 1.2
      rig.kneeR.rotation.x = Math.max(0, Math.sin(ph)) * sw * 1.2
      rig.shL.rotation.x = -Math.sin(ph) * sw * 0.6
      rig.shR.rotation.x = Math.sin(ph) * sw * 0.6
      rig.spine.rotation.x = walking ? 0.06 : 0
    }
    const hl = a.obj.userData.horseLegs as
      | { FL: THREE.Group; FR: THREE.Group; BL: THREE.Group; BR: THREE.Group }
      | undefined
    if (hl) {
      const ph2 = (sample.s * Math.PI) / 0.6
      const sw2 = walking ? Math.min(0.5, 0.2 + sample.speed * 0.22) : 0
      hl.FL.rotation.x = Math.sin(ph2) * sw2
      hl.BR.rotation.x = Math.sin(ph2) * sw2
      hl.FR.rotation.x = -Math.sin(ph2) * sw2
      hl.BL.rotation.x = -Math.sin(ph2) * sw2
    }
    world.alignActor(a)
  }

  for (const a of world.actors) {
    if (!a.data.mount) continue
    const host = world.actorByLabel(a.data.mount)
    if (host) world.syncMountedTransform(a, host)
  }
}
