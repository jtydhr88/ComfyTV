import * as THREE from 'three'
import type { ArcTable, CameraAction } from 'dollycurve'

import {
  applyJointsToRig,
  CHAR_COLORS,
  labelHeight,
  makeActorObject,
  makeLabelSprite,
  poseJoints,
  type CharacterRig
} from './actorFactory'
import {
  anchorCount,
  anchorPositions,
  makeTrackAction,
  trackArcTable,
  trackFromJson,
  trackToJson
} from './dollyTrack'
import type {
  PrevizActorData,
  PrevizGround,
  PrevizSceneData,
  PrevizShotData,
  PrevizSun
} from './types'
import { PREVIZ_DEFAULT_SUN, PREVIZ_STAGE_LIMIT } from './types'
import { normalizeGround, normalizeSun } from './projectData'

const COLLISION_EPS = 0.025

export interface PrevizActor {
  data: PrevizActorData
  obj: THREE.Group
  label: string
  track: CameraAction | null
  elev: number
  authoredRotY: number
  authoredScale: number
  labelSprite: THREE.Sprite
}

export interface RuntimeShot {
  data: PrevizShotData
  name: string
  desc: string
  dur: number
  lock: string
  fov: number
  timingMode: PrevizShotData['timingMode']
  syncActor: string
  yaw: number
  pitch: number
  action: CameraAction
}

export function stageCoord(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n)
    ? Math.max(-PREVIZ_STAGE_LIMIT, Math.min(PREVIZ_STAGE_LIMIT, n))
    : fallback
}

function kelvinColor(k: number): THREE.Color {
  const t = k / 100
  let r: number, g: number, b: number
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  const c = (v: number) => Math.max(0, Math.min(255, v)) / 255
  return new THREE.Color(c(r), c(g), c(b))
}

function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!(object as THREE.Sprite).isSprite && mesh.geometry) geometries.add(mesh.geometry)
    const mats = ([] as THREE.Material[]).concat(mesh.material || [])
    for (const material of mats) {
      materials.add(material)
      const map = (material as THREE.MeshStandardMaterial).map
      if (map) textures.add(map)
    }
  })
  textures.forEach((t) => t.dispose())
  materials.forEach((m) => m.dispose())
  geometries.forEach((g) => g.dispose())
}

export class PrevizWorld {
  readonly scene = new THREE.Scene()
  readonly shotCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 500)
  readonly actors: PrevizActor[] = []
  shots: RuntimeShot[] = []
  collisionEnabled = true
  labelsEnabled = true

  private readonly ambient = new THREE.AmbientLight(0xffffff, 0.28)
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 0.9)
  private readonly sunTarget = new THREE.Object3D()
  private readonly ground: THREE.Mesh
  private readonly groundMat: THREE.MeshStandardMaterial
  private readonly groundTex: THREE.CanvasTexture
  private readonly grid: THREE.GridHelper
  private readonly groundBorder: THREE.LineLoop
  private readonly tables = new Map<CameraAction, ArcTable | null>()
  private sun: PrevizSun = { ...PREVIZ_DEFAULT_SUN, pos: [...PREVIZ_DEFAULT_SUN.pos] }
  private groundStyle: PrevizGround = { style: 'checker' }
  private exportLook = false

  constructor() {
    this.scene.background = new THREE.Color(0x0a0a0a)
    this.scene.fog = new THREE.Fog(0x0a0a0a, 75, 220)
    this.scene.add(this.ambient)
    this.sunLight.position.set(8, 14, 6)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(2048, 2048)
    const sc = this.sunLight.shadow.camera
    sc.left = -25
    sc.right = 25
    sc.top = 25
    sc.bottom = -25
    sc.near = 0.1
    sc.far = 140
    this.sunLight.shadow.bias = -0.00015
    this.sunLight.shadow.normalBias = 0.025
    this.sunLight.shadow.radius = 2
    this.scene.add(this.sunTarget)
    this.sunLight.target = this.sunTarget
    this.scene.add(this.sunLight)

    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const c = cv.getContext('2d')
    if (c) {
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          c.fillStyle = (x + y) % 2 ? '#3a3e48' : '#292c34'
          c.fillRect(x * 32, y * 32, 32, 32)
        }
    }
    this.groundTex = new THREE.CanvasTexture(cv)
    this.groundTex.wrapS = this.groundTex.wrapT = THREE.RepeatWrapping
    this.groundTex.repeat.set(2.5, 2.5)
    this.groundMat = new THREE.MeshStandardMaterial({
      map: this.groundTex,
      roughness: 0.95,
      fog: false
    })
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), this.groundMat)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.scene.add(this.ground)
    this.grid = new THREE.GridHelper(60, 30, 0x666d7a, 0x444a55)
    this.grid.position.y = 0.01
    ;([] as THREE.Material[]).concat(this.grid.material).forEach((m) => {
      ;(m as THREE.LineBasicMaterial).fog = false
      m.transparent = true
      m.opacity = 0.82
    })
    this.scene.add(this.grid)
    const pts = [
      [-30, -30],
      [30, -30],
      [30, 30],
      [-30, 30]
    ].map((p) => new THREE.Vector3(p[0], 0.018, p[1]))
    this.groundBorder = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x737b89, transparent: true, opacity: 0.8, fog: false })
    )
    this.scene.add(this.groundBorder)
  }

  dispose(): void {
    this.clearStage()
    disposeObject3D(this.ground)
    disposeObject3D(this.grid)
    disposeObject3D(this.groundBorder)
    this.groundTex.dispose()
  }

  trackTable(action: CameraAction): ArcTable | null {
    if (!this.tables.has(action)) this.tables.set(action, trackArcTable(action))
    return this.tables.get(action) ?? null
  }

  invalidateTrack(action: CameraAction | null): void {
    if (action) this.tables.delete(action)
  }

  loadScene(scene: PrevizSceneData): void {
    this.clearStage()
    this.sun = normalizeSun(scene.sun)
    this.groundStyle = normalizeGround(scene.ground)
    for (const actor of scene.actors) this.buildActor(actor)
    this.shots = scene.shots.map((s) => this.buildShot(s))
    this.applyGroundAppearance()
    this.applySunSettings()
    this.alignAllActors()
  }

  private buildShot(data: PrevizShotData): RuntimeShot {
    const action =
      trackFromJson(data.camera) ?? makeTrackAction([new THREE.Vector3(6, 3, 6)])
    return {
      data,
      name: data.name,
      desc: data.desc,
      dur: data.dur,
      lock: data.lock,
      fov: data.fov,
      timingMode: data.timingMode,
      syncActor: data.syncActor,
      yaw: data.yaw,
      pitch: data.pitch,
      action
    }
  }

  buildActor(data: PrevizActorData): PrevizActor {
    const charColor =
      CHAR_COLORS[this.actors.filter((a) => a.data.kind === 'char').length % CHAR_COLORS.length]
    const obj = makeActorObject(data.kind, charColor)
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !o.userData.collisionExempt) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    const elev = Math.max(0, Math.min(20, data.height))
    obj.position.set(stageCoord(data.pos[0]), elev, stageCoord(data.pos[1]))
    obj.rotation.y = data.rotY
    obj.scale.setScalar(data.scale)
    const labelSprite = makeLabelSprite(data.label)
    labelSprite.position.set(0, labelHeight(obj), 0)
    obj.add(labelSprite)
    this.scene.add(obj)
    const actor: PrevizActor = {
      data,
      obj,
      label: data.label,
      track: data.track ? trackFromJson(data.track) : null,
      elev,
      authoredRotY: data.rotY,
      authoredScale: data.scale,
      labelSprite
    }
    if (data.kind === 'char') this.applyPose(actor)
    this.actors.push(actor)
    this.alignActor(actor)
    return actor
  }

  removeActor(actor: PrevizActor): void {
    const idx = this.actors.indexOf(actor)
    if (idx < 0) return
    this.scene.remove(actor.obj)
    disposeObject3D(actor.obj)
    this.invalidateTrack(actor.track)
    this.actors.splice(idx, 1)
    for (const other of this.actors) {
      if (other.data.mount === actor.label) delete other.data.mount
    }
  }

  clearStage(): void {
    for (const actor of this.actors.slice()) {
      this.scene.remove(actor.obj)
      disposeObject3D(actor.obj)
    }
    this.actors.length = 0
    this.shots = []
    this.tables.clear()
  }

  toSceneData(name: string, desc: string): PrevizSceneData {
    const round = (v: number, digits: number) => Number(v.toFixed(digits))
    return {
      name,
      desc,
      ground: { ...this.groundStyle },
      sun: { ...this.sun, pos: [...this.sun.pos] },
      actors: this.actors.map((a) => {
        const anchors = a.track ? anchorPositions(a.track) : []
        const origin = anchors.length ? anchors[0] : a.obj.position
        return {
          ...a.data,
          pos: [round(origin.x, 2), round(origin.z, 2)] as [number, number],
          rotY: round(a.authoredRotY, 3),
          height: round(a.elev, 2),
          scale: round(a.authoredScale, 2),
          joints: a.data.kind === 'char' ? { ...(a.data.joints || {}) } : undefined,
          track: a.track ? trackToJson(a.track) : null
        }
      }),
      shots: this.shots.map((s) => ({
        ...s.data,
        name: s.name,
        desc: s.desc,
        dur: s.dur,
        lock: s.lock,
        fov: s.fov,
        timingMode: s.timingMode,
        syncActor: s.syncActor,
        yaw: s.yaw,
        pitch: s.pitch,
        camera: trackToJson(s.action)
      }))
    }
  }

  sceneDuration(): number {
    return Math.max(0.1, this.shots.reduce((sum, s) => sum + s.dur, 0))
  }

  setSun(sun: Partial<PrevizSun>): PrevizSun {
    this.sun = normalizeSun({ ...this.sun, ...sun })
    this.applySunSettings()
    return this.sun
  }

  getSun(): PrevizSun {
    return { ...this.sun, pos: [...this.sun.pos] }
  }

  setGround(ground: PrevizGround): void {
    this.groundStyle = normalizeGround(ground)
    this.applyGroundAppearance()
  }

  getGround(): PrevizGround {
    return { ...this.groundStyle }
  }

  private applyGroundAppearance(): void {
    const g = this.groundStyle
    this.groundMat.map = g.style === 'checker' ? this.groundTex : null
    this.groundMat.color.set(
      g.style === 'white'
        ? 0xffffff
        : g.style === 'black'
          ? 0x000000
          : g.style === 'color'
            ? (g.color ?? '#707781')
            : 0xffffff
    )
    this.groundMat.needsUpdate = true
    const helpers = g.style === 'checker' && !this.exportLook
    this.grid.visible = helpers
    this.groundBorder.visible = helpers
  }

  applySunSettings(): void {
    const box = new THREE.Box3()
    box.makeEmpty()
    for (const a of this.actors) {
      const b = this.actorWorldBox(a)
      if (Number.isFinite(b.min.x) && Number.isFinite(b.max.x)) box.union(b)
      if (a.track) {
        for (const p of anchorPositions(a.track)) {
          box.expandByPoint(new THREE.Vector3(p.x, a.elev || 0, p.z))
        }
      }
    }
    const center = new THREE.Vector3(0, 1, 0)
    const size = new THREE.Vector3(8, 4, 8)
    if (!box.isEmpty()) {
      box.getCenter(center)
      box.getSize(size)
      center.y = Math.max(1, center.y)
    }
    const extent = Math.max(12, Math.min(35, Math.max(size.x, size.z) * 0.65 + 8))
    this.sunTarget.position.copy(center)
    const sc = this.sunLight.shadow.camera
    sc.left = -extent
    sc.right = extent
    sc.top = extent
    sc.bottom = -extent
    sc.near = 0.1
    sc.far = Math.max(80, size.y + 70)
    sc.updateProjectionMatrix()

    const s = this.sun
    const off = new THREE.Vector3(...s.pos)
    if (off.lengthSq() < 4) off.set(...PREVIZ_DEFAULT_SUN.pos)
    this.sunLight.position.copy(center).add(off)
    this.sunLight.visible = s.enabled
    this.sunLight.intensity = s.intensity
    this.sunLight.color.copy(kelvinColor(s.temp))
    this.sunLight.shadow.radius = s.softness
    this.ambient.intensity = s.ambient
    const q = { performance: 1024, standard: 2048, high: 4096 }[s.quality]
    if (this.sunLight.userData.shadowSize !== q) {
      this.sunLight.userData.shadowSize = q
      this.sunLight.shadow.mapSize.set(q, q)
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose()
        this.sunLight.shadow.map = null
      }
    }
    this.sunLight.updateMatrixWorld(true)
    this.sunTarget.updateMatrixWorld(true)
  }

  setExportLook(on: boolean): void {
    this.exportLook = on
    this.applyGroundAppearance()
    this.updateLabelVisibility()
  }

  updateLabelVisibility(): void {
    for (const a of this.actors) {
      const hostWithRider = this.actors.some((r) => r.data.mount === a.label)
      a.labelSprite.visible = !this.exportLook && this.labelsEnabled && !hostWithRider
    }
  }

  updateLabelScales(cam: THREE.PerspectiveCamera, viewportHeight: number): void {
    const h = Math.max(240, viewportHeight)
    const tan = Math.tan((cam.fov * Math.PI) / 360)
    const worldPos = new THREE.Vector3()
    for (const a of this.actors) {
      const s = a.labelSprite
      if (!s.visible) continue
      s.getWorldPosition(worldPos)
      const dist = Math.max(0.5, cam.position.distanceTo(worldPos))
      const worldPerPx = (2 * dist * tan) / h
      const px = (s.userData.textLen || 2) > 3 ? 78 : 56
      const sy = Math.max(0.001, a.obj.scale.x)
      s.scale.set((px * worldPerPx) / sy, (24 * worldPerPx) / sy, 1)
    }
  }

  actorByLabel(label: string): PrevizActor | undefined {
    return this.actors.find((a) => a.label === label)
  }

  pathOwner(a: PrevizActor): PrevizActor {
    return a.data.mount ? (this.actorByLabel(a.data.mount) ?? a) : a
  }

  syncTargetForShot(s: RuntimeShot): PrevizActor | null {
    if (s.timingMode !== 'pointSync' || !s.syncActor) return null
    const src = this.actorByLabel(s.syncActor)
    if (!src) return null
    const a = this.pathOwner(src)
    if (!a.track) return null
    return anchorCount(a.track) === anchorCount(s.action) ? a : null
  }

  applyJoints(a: PrevizActor): void {
    const rig = a.obj.userData.rig as CharacterRig | undefined
    if (a.data.kind !== 'char' || !rig) return
    applyJointsToRig(rig, a.data.joints || {})
  }

  applyPose(a: PrevizActor): void {
    if (a.data.kind !== 'char') return
    const mountKind = a.data.mount ? this.actorByLabel(a.data.mount)?.data.kind : undefined
    if (a.data.pose !== 'custom') a.data.joints = poseJoints(a.data.pose, mountKind)
    this.applyJoints(a)
  }

  syncMountedTransform(a: PrevizActor, host: PrevizActor): void {
    const hp = host.obj.position
    const sx = (host.obj.userData.seatX || 0) * host.obj.scale.x
    const sz = (host.obj.userData.seatZ || 0) * host.obj.scale.x
    const ca = Math.cos(host.obj.rotation.y)
    const sa = Math.sin(host.obj.rotation.y)
    a.obj.position.set(
      hp.x + sx * ca + sz * sa,
      hp.y + (host.obj.userData.seatY || 1.3) * host.obj.scale.x + (a.elev || 0),
      hp.z - sx * sa + sz * ca
    )
    a.obj.rotation.y = host.obj.rotation.y + (host.data.kind === 'car' ? Math.PI / 2 : 0)
    a.obj.updateMatrixWorld(true)
  }

  alignActor(a: PrevizActor): void {
    if (a.data.mount) {
      const host = this.actorByLabel(a.data.mount)
      if (host) this.syncMountedTransform(a, host)
      return
    }
    a.obj.position.y = Math.max(0, Number(a.elev) || 0)
    a.obj.updateMatrixWorld(true)
  }

  alignAllActors(): void {
    for (const a of this.actors) if (!a.data.mount) this.alignActor(a)
    for (const a of this.actors) if (a.data.mount) this.alignActor(a)
  }

  private collisionExempt(a: PrevizActor): boolean {
    return a.data.kind === 'road' || !!a.obj.userData.collisionExempt
  }

  private actorOwnWorldBox(a: PrevizActor): THREE.Box3 {
    const box = new THREE.Box3()
    let found = false
    a.obj.updateMatrixWorld(true)
    a.obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || o.visible === false || !mesh.geometry) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      if (!mesh.geometry.boundingBox) return
      const b = mesh.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)
      if (!found) {
        box.copy(b)
        found = true
      } else box.union(b)
    })
    if (!found) box.setFromCenterAndSize(a.obj.position, new THREE.Vector3(0.1, 0.1, 0.1))
    return box
  }

  actorWorldBox(a: PrevizActor): THREE.Box3 {
    const box = this.actorOwnWorldBox(a)
    if (!a.data.mount) {
      for (const rider of this.actors) {
        if (rider.data.mount !== a.label) continue
        this.syncMountedTransform(rider, a)
        box.union(this.actorOwnWorldBox(rider))
      }
    }
    return box
  }

  private boxesPenetrate(a: THREE.Box3, b: THREE.Box3, eps = COLLISION_EPS): boolean {
    return (
      Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > eps &&
      Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > eps &&
      Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > eps
    )
  }

  private collisionPairIgnored(a: PrevizActor, b: PrevizActor): boolean {
    if (a === b || this.collisionExempt(a) || this.collisionExempt(b)) return true
    if (a.data.mount === b.label || b.data.mount === a.label) return true
    if (a.data.mount && b.data.mount && a.data.mount === b.data.mount) return true
    return false
  }

  actorPenetrates(a: PrevizActor): boolean {
    if (this.collisionExempt(a)) return false
    return this.actors.some(
      (b) =>
        !b.data.mount &&
        !this.collisionPairIgnored(a, b) &&
        this.boxesPenetrate(this.actorWorldBox(a), this.actorWorldBox(b))
    )
  }

  moveActorSafely(a: PrevizActor, targetX: number, targetZ: number): THREE.Vector3 {
    targetX = stageCoord(targetX, a.obj.position.x)
    targetZ = stageCoord(targetZ, a.obj.position.z)
    const sx = a.obj.position.x
    const sz = a.obj.position.z
    const setXZ = (x: number, z: number) => {
      a.obj.position.x = x
      a.obj.position.z = z
      this.alignActor(a)
    }
    if (!this.collisionEnabled || this.collisionExempt(a) || a.data.mount) {
      setXZ(targetX, targetZ)
      return a.obj.position.clone()
    }
    this.alignActor(a)
    const wasBad = this.actorPenetrates(a)
    const dx = targetX - sx
    const dz = targetZ - sz
    const dist = Math.hypot(dx, dz)
    if (dist < 1e-5) return a.obj.position.clone()
    const size = this.actorWorldBox(a).getSize(new THREE.Vector3())
    const stride = Math.max(
      0.06,
      Math.min(0.35, Math.min(Math.max(size.x, 0.15), Math.max(size.z, 0.15)) * 0.35)
    )
    const steps = Math.min(400, Math.max(1, Math.ceil(dist / stride)))
    let last = 0
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      setXZ(sx + dx * t, sz + dz * t)
      if (this.actorPenetrates(a)) {
        if (wasBad) {
          last = t
          continue
        }
        let lo = last
        let hi = t
        for (let k = 0; k < 10; k++) {
          const m = (lo + hi) / 2
          setXZ(sx + dx * m, sz + dz * m)
          if (this.actorPenetrates(a)) hi = m
          else lo = m
        }
        setXZ(sx + dx * lo, sz + dz * lo)
        return a.obj.position.clone()
      }
      if (wasBad) return this.moveActorSafely(a, targetX, targetZ)
      last = t
    }
    return a.obj.position.clone()
  }

  constrainActorPathPoint(a: PrevizActor, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
    const target = new THREE.Vector3(stageCoord(to.x, from.x), 0, stageCoord(to.z, from.z))
    if (!this.collisionEnabled || this.collisionExempt(a) || a.data.mount) return target
    const save = a.obj.position.clone()
    a.obj.position.x = from.x
    a.obj.position.z = from.z
    this.alignActor(a)
    const p = this.moveActorSafely(a, target.x, target.z)
    a.obj.position.copy(save)
    this.alignActor(a)
    return new THREE.Vector3(p.x, 0, p.z)
  }

  setActorElevation(a: PrevizActor, target: number): number {
    a.elev = Math.max(0, Math.min(20, Number(target) || 0))
    a.data.height = a.elev
    this.alignActor(a)
    return a.elev
  }

  setActorScale(a: PrevizActor, value: number): number {
    const target = Math.max(0.3, Math.min(3, Number(value) || 1))
    const wasBad = this.collisionEnabled && this.actorPenetrates(a)
    const old = a.authoredScale
    a.authoredScale = target
    a.data.scale = target
    a.obj.scale.setScalar(target)
    this.alignActor(a)
    for (const rider of this.actors) {
      if (rider.data.mount === a.label) this.syncMountedTransform(rider, a)
    }
    if (this.collisionEnabled && !wasBad && this.actorPenetrates(a)) {
      a.authoredScale = old
      a.data.scale = old
      a.obj.scale.setScalar(old)
      this.alignActor(a)
      return old
    }
    return target
  }

  setActorRotation(a: PrevizActor, rotY: number): void {
    a.authoredRotY = rotY
    a.data.rotY = rotY
    a.obj.rotation.y = rotY
    a.obj.updateMatrixWorld(true)
  }

  lockTarget(label: string): THREE.Vector3 {
    const a = this.actorByLabel(label)
    if (!a) return new THREE.Vector3(0, 1, 0)
    const explicit = Number.isFinite(a.obj.userData.lockTargetY)
      ? a.obj.userData.lockTargetY * a.obj.scale.y
      : null
    const pose = a.data.pose
    const rel =
      a.data.kind === 'char'
        ? pose === 'lie'
          ? 0.4
          : pose === 'sit'
            ? 0.9
            : pose === 'crouch'
              ? 1
              : pose === 'ride'
                ? 0.9
                : 1.3
        : (a.obj.userData.lockTargetY ?? 0.5)
    return a.obj.position.clone().add(new THREE.Vector3(0, explicit ?? rel, 0))
  }

  globalLockTarget(): THREE.Vector3 {
    if (!this.actors.length) return new THREE.Vector3(0, 1, 0)
    const sum = new THREE.Vector3()
    for (const a of this.actors) sum.add(this.lockTarget(a.label))
    return sum.multiplyScalar(1 / this.actors.length)
  }
}
