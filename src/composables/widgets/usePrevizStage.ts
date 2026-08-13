import { computed, ref, watch } from 'vue'
import * as THREE from 'three'

import { i18n } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import { app } from '@/lib/comfyApp'
import {
  bindWidgetCallback,
  onNodeConfigure,
  readWidgetNum,
  readWidgetStr,
  writeWidget
} from '@/utils/widget'
import { uploadBlobNamed } from '@/utils/uploadCanvas'
import { Scene3dHistory } from '@/widgets/three/scene3d/Scene3dHistory'
import type { Scene3dHistorySnapshot } from '@/widgets/three/scene3d/Scene3dHistory'
import {
  capturePrevizFrame,
  isPrevizRecordingSupported,
  recordPrevizVideo,
  type PrevizRecordProgress
} from '@/widgets/three/previz/capture'
import {
  addTrackAnchor,
  anchorCount,
  distributeSpeed,
  ensureSpeedCurve,
  isTrackStraight,
  makeTrackAction,
  removeTrackAnchor,
  reconcileSpeed,
  sampleAim,
  sampleFov,
  scaleTrackTimes,
  setAimKey,
  setFovKey,
  setTrackStraight,
  setTrackTime,
  trackPath,
  trackTimes
} from '@/widgets/three/previz/dollyTrack'
import {
  actorOverlapWarnings,
  type ActorBoundsInfo
} from '@/widgets/three/previz/mcpChecks'
import { PrevizClock, evaluateActors, evaluateShotCam } from '@/widgets/three/previz/playback'
import { PrevizViewport, type PrevizPickTarget } from '@/widgets/three/previz/PrevizViewport'
import { PrevizWorld, type PrevizActor, type RuntimeShot } from '@/widgets/three/previz/PrevizWorld'
import {
  normalizeShot,
  parseProjectJson
} from '@/widgets/three/previz/projectData'
import type {
  PrevizActorKind,
  PrevizGround,
  PrevizProjectData,
  PrevizShotData,
  PrevizSun
} from '@/widgets/three/previz/types'
import {
  PREVIZ_ACTOR_KINDS,
  PREVIZ_ASPECTS,
  PREVIZ_GROUND_STYLES,
  PREVIZ_JOINT_KEYS,
  PREVIZ_POSES,
  PREVIZ_SHOT_DURATION_MIN,
  PREVIZ_STAGE_LIMIT,
  PREVIZ_TIME_LINKS,
  PREVIZ_TIMING_MODES
} from '@/widgets/three/previz/types'

const STATE_WIDGET = 'previz_state'
const WIDTH_WIDGET = 'width'
const HEIGHT_WIDGET = 'height'
const IMAGE_WIDGET = 'captured_image'
const IMAGES_WIDGET = 'captured_images'
const VIDEO_WIDGET = 'captured_video'

export interface UsePrevizStageOptions {
  onCaptured?: (url: string) => void
  onRecorded?: (url: string) => void
}

function toastError(detail: string): void {
  ;(app as any)?.extensionManager?.toast?.add?.({
    severity: 'error',
    summary: 'ComfyTV',
    detail,
    life: 5000
  })
}

export function usePrevizStage(node: LGraphNode, opts?: UsePrevizStageOptions) {
  const t = i18n.global.t
  const world = new PrevizWorld()
  const clock = new PrevizClock()
  let viewport: PrevizViewport | null = null

  const project = ref<PrevizProjectData>(
    parseProjectJson(readWidgetStr(node, STATE_WIDGET, '{}'))
  )
  const sceneIdx = 0
  const shotIdx = ref(0)
  const playing = ref(false)
  const playAll = ref(true)
  const speed = ref(1)
  const timeSec = ref(0)
  const selected = ref<PrevizPickTarget | null>(null)
  const capturing = ref(false)
  const recording = ref(false)
  const recordProgress = ref<PrevizRecordProgress | null>(null)
  const capturedImageUrl = ref(readWidgetStr(node, IMAGE_WIDGET, ''))
  const capturedVideoUrl = ref(readWidgetStr(node, VIDEO_WIDGET, ''))
  const uiVersion = ref(0)

  const history = new Scene3dHistory()
  const historyVersion = ref(0)
  const canUndo = computed(() => {
    void historyVersion.value
    return history.canUndo()
  })
  const canRedo = computed(() => {
    void historyVersion.value
    return history.canRedo()
  })

  const recordingSupported = isPrevizRecordingSupported()

  function scene() {
    return project.value.scenes[sceneIdx]
  }

  function snapshot(): Scene3dHistorySnapshot {
    return {
      json: JSON.stringify(project.value),
      selectedId: selected.value ? JSON.stringify(selected.value) : null
    }
  }

  let lastCommitted = snapshot()

  function persist(): void {
    writeWidget(node, STATE_WIDGET, JSON.stringify(project.value), { fireCallback: false })
  }

  function commit(mergeKey?: string): void {
    const data = world.toSceneData(scene().name, scene().desc)
    project.value = {
      ...project.value,
      scenes: project.value.scenes.map((s, i) => (i === sceneIdx ? data : s))
    }
    const next = snapshot()
    if (next.json !== lastCommitted.json) {
      history.record(lastCommitted, mergeKey)
      historyVersion.value++
      lastCommitted = next
    }
    persist()
    uiVersion.value++
  }

  function syncViewportTracks(): void {
    if (!viewport) return
    viewport.setCameraTrack(world.shots[shotIdx.value]?.action ?? null)
    const sel = selected.value
    const label = sel?.type === 'actor' || sel?.type === 'pathPoint' ? sel.label : null
    const actor = label ? world.actorByLabel(label) : null
    viewport.setActorTrack(actor?.track ?? null, actor?.label ?? '')
  }

  function reloadWorld(): void {
    world.collisionEnabled = project.value.settings.collision
    world.labelsEnabled = project.value.settings.labels
    world.loadScene(scene())
    world.updateLabelVisibility()
    shotIdx.value = Math.max(0, Math.min(shotIdx.value, world.shots.length - 1))
    syncViewportTracks()
    uiVersion.value++
  }

  function restore(snap: Scene3dHistorySnapshot): void {
    project.value = parseProjectJson(snap.json)
    selected.value = snap.selectedId ? JSON.parse(snap.selectedId) : null
    lastCommitted = snapshot()
    persist()
    reloadWorld()
  }

  function undo(): void {
    const snap = history.undo(snapshot())
    if (snap) {
      restore(snap)
      historyVersion.value++
    }
  }

  function redo(): void {
    const snap = history.redo(snapshot())
    if (snap) {
      restore(snap)
      historyVersion.value++
    }
  }

  const duration = computed(() => {
    void uiVersion.value
    return scene().shots.reduce((sum, s) => sum + s.dur, 0)
  })

  const globalTime = computed(() => {
    void uiVersion.value
    return (
      scene()
        .shots.slice(0, shotIdx.value)
        .reduce((sum, s) => sum + s.dur, 0) + timeSec.value
    )
  })

  function currentShot(): RuntimeShot | undefined {
    return world.shots[shotIdx.value]
  }

  function setShot(i: number, keepTime = false): void {
    shotIdx.value = Math.max(0, Math.min(i, world.shots.length - 1))
    if (!keepTime) {
      clock.seek(0)
      timeSec.value = 0
    }
    syncViewportTracks()
  }

  function togglePlay(): void {
    if (clock.playing) {
      clock.pause()
    } else {
      const s = currentShot()
      if (s && clock.time >= s.dur - 1e-3) {
        if (playAll.value) setShot(0)
        else clock.seek(0)
      }
      clock.play()
    }
    playing.value = clock.playing
  }

  function seekGlobal(target: number): void {
    let remaining = Math.max(0, Math.min(target, duration.value))
    let idx = 0
    while (idx < world.shots.length - 1 && remaining > world.shots[idx].dur) {
      remaining -= world.shots[idx].dur
      idx++
    }
    setShot(idx, true)
    clock.seek(Math.min(remaining, world.shots[idx]?.dur ?? 0))
    timeSec.value = clock.time
  }

  function onFrame(dt: number): void {
    const s = currentShot()
    if (!s) return
    if (clock.playing) {
      clock.tick(dt * speed.value)
      if (clock.time >= s.dur) {
        if (playAll.value && shotIdx.value < world.shots.length - 1) {
          setShot(shotIdx.value + 1)
          clock.play()
        } else {
          clock.pause()
          clock.seek(s.dur)
        }
      }
      timeSec.value = clock.time
      playing.value = clock.playing
    }
    evaluateActors(world, shotIdx.value, clock.time)
    evaluateShotCam(world, currentShot(), clock.time)
  }

  function initViewport(container: HTMLElement): void {
    cleanupViewport()
    container.tabIndex = -1
    container.style.outline = 'none'
    container.addEventListener('pointerenter', () =>
      container.focus({ preventScroll: true })
    )
    viewport = new PrevizViewport(world, container, {
      onFrame,
      onSelect: (target) => {
        selected.value = target
      },
      onActorMoved: (actor) => {
        if (actor.track) reconcileSpeed(actor.track, world.sceneDuration())
        commit('drag-actor')
      },
      onTrackChanged: () => {
        uiVersion.value++
      },
      onTrackCommitted: (action, label) => {
        const shot = world.shots.find((s) => s.action === action)
        reconcileSpeed(action, shot ? shot.dur : world.sceneDuration())
        world.invalidateTrack(action)
        viewport?.refreshTracks()
        commit(`path:${label}`)
      }
    })
    reloadWorld()
    viewport.frameStage()
  }

  function attachMonitor(container: HTMLElement): void {
    viewport?.attachMonitor(container)
  }

  function cleanupViewport(): void {
    viewport?.dispose()
    viewport = null
  }

  function cleanup(): void {
    cleanupViewport()
    world.dispose()
    const api = (node as any).__comfytvStageApi
    if (api?.previz) delete api.previz
  }

  watch(selected, () => syncViewportTracks())

  function uniqueLabel(base: string): string {
    const labels = new Set(world.actors.map((a) => a.label))
    if (!labels.has(base)) return base
    let n = 2
    while (labels.has(`${base} ${n}`)) n++
    return `${base} ${n}`
  }

  function addActor(kind: PrevizActorKind): void {
    const label = uniqueLabel(t(`previz.kind.${kind}`))
    const actor = world.buildActor({
      kind,
      label,
      pose: 'stand',
      pos: [
        Math.round((Math.random() * 6 - 3) * 10) / 10,
        Math.round((Math.random() * 6 - 3) * 10) / 10
      ],
      rotY: 0,
      height: 0,
      scale: 1,
      timeLink: 'independent',
      timeOffset: 0,
      timeLinkShot: 0,
      track: null
    })
    selected.value = { type: 'actor', label: actor.label }
    commit()
  }

  function removeActor(label: string): void {
    const actor = world.actorByLabel(label)
    if (!actor) return
    world.removeActor(actor)
    for (const s of world.shots) {
      if (s.lock === label) s.lock = ''
      if (s.syncActor === label) s.syncActor = ''
    }
    if (selected.value?.type === 'actor' && selected.value.label === label) {
      selected.value = null
    }
    syncViewportTracks()
    commit()
  }

  function selectActor(label: string): void {
    selected.value = { type: 'actor', label }
  }

  const selectedActor = computed<PrevizActor | null>(() => {
    void uiVersion.value
    const sel = selected.value
    if (!sel) return null
    const label = sel.type === 'actor' || sel.type === 'pathPoint' ? sel.label : null
    return label ? (world.actorByLabel(label) ?? null) : null
  })

  function updateActor(label: string, patch: Partial<PrevizActor['data']>): void {
    const a = world.actorByLabel(label)
    if (!a) return
    Object.assign(a.data, patch)
    if (patch.pose !== undefined) world.applyPose(a)
    if (patch.mount !== undefined) {
      if (!patch.mount) delete a.data.mount
      world.applyPose(a)
      world.alignAllActors()
    }
    if (patch.rotY !== undefined) world.setActorRotation(a, Number(patch.rotY))
    if (patch.scale !== undefined) world.setActorScale(a, Number(patch.scale))
    if (patch.height !== undefined) world.setActorElevation(a, Number(patch.height))
    commit(`actor:${label}`)
  }

  function setActorJoint(label: string, key: string, value: number): void {
    const a = world.actorByLabel(label)
    if (!a || a.data.kind !== 'char') return
    a.data.joints = { ...(a.data.joints || {}), [key]: value }
    a.data.pose = 'custom'
    world.applyJoints(a)
    commit(`joint:${label}:${key}`)
  }

  function setActorStraight(label: string, straight: boolean): void {
    const a = world.actorByLabel(label)
    if (!a?.track) return
    setTrackStraight(a.track, straight)
    reconcileSpeed(a.track, world.sceneDuration())
    world.invalidateTrack(a.track)
    viewport?.refreshTracks()
    commit(`straight:${label}`)
  }

  function addPathPoint(label: string): void {
    const src = world.actorByLabel(label)
    if (!src) return
    const a = world.pathOwner(src)
    if (!a.track) {
      a.track = makeTrackAction([
        new THREE.Vector3(a.obj.position.x, 0, a.obj.position.z)
      ])
      a.data.track = null
    }
    const path = trackPath(a.track)!
    const last = path.points[path.points.length - 1]
    const lastCo = new THREE.Vector3(...last.co)
    let dir: THREE.Vector3
    if (path.points.length > 1) {
      dir = lastCo.clone().sub(new THREE.Vector3(...path.points[path.points.length - 2].co))
      if (dir.lengthSq() < 0.001) {
        dir = new THREE.Vector3(Math.sin(a.obj.rotation.y), 0, Math.cos(a.obj.rotation.y))
      }
    } else {
      dir = new THREE.Vector3(Math.sin(a.obj.rotation.y), 0, Math.cos(a.obj.rotation.y))
    }
    const point = lastCo.clone().add(dir.setLength(2))
    const safe = world.constrainActorPathPoint(a, lastCo, point)
    if (safe.distanceToSquared(lastCo) < 0.0025) return
    addTrackAnchor(a.track, safe, world.sceneDuration())
    if (anchorCount(a.track) >= 2 && !a.track.pathFollow?.speedCurve) {
      distributeSpeed(a.track, 0, world.sceneDuration())
    }
    world.invalidateTrack(a.track)
    syncViewportTracks()
    viewport?.refreshTracks()
    commit()
  }

  function removePathPoint(label: string, idx: number): void {
    const src = world.actorByLabel(label)
    if (!src) return
    const a = world.pathOwner(src)
    if (!a.track) return
    removeTrackAnchor(a.track, idx, world.sceneDuration())
    if (anchorCount(a.track) < 1) a.track = null
    world.invalidateTrack(a.track)
    if (selected.value?.type === 'pathPoint' && selected.value.label === a.label) {
      selected.value = { type: 'actor', label: a.label }
    }
    syncViewportTracks()
    viewport?.refreshTracks()
    commit()
  }

  function setActorPathTime(label: string, idx: number, time: number): void {
    const a = world.actorByLabel(label)
    if (!a?.track) return
    setTrackTime(a.track, idx, time, world.sceneDuration())
    commit(`pathtime:${label}:${idx}`)
  }

  const selectedShot = computed<RuntimeShot | undefined>(() => {
    void uiVersion.value
    return world.shots[shotIdx.value]
  })

  function addShot(): void {
    const data: PrevizShotData = normalizeShot({
      name: `${t('previz.shot')} ${world.shots.length + 1}`,
      dur: 5
    })
    const sceneData = world.toSceneData(scene().name, scene().desc)
    sceneData.shots.push(data)
    world.loadScene(sceneData)
    setShot(world.shots.length - 1)
    commit()
  }

  function removeShot(i: number): void {
    if (world.shots.length <= 1) return
    const sceneData = world.toSceneData(scene().name, scene().desc)
    sceneData.shots.splice(i, 1)
    world.loadScene(sceneData)
    setShot(Math.min(i, world.shots.length - 1))
    commit()
  }

  function updateShot(i: number, patch: Partial<PrevizShotData>): void {
    const s = world.shots[i]
    if (!s) return
    if (patch.dur !== undefined) {
      const next = Math.max(PREVIZ_SHOT_DURATION_MIN, Math.round(Number(patch.dur) * 10) / 10)
      scaleTrackTimes(s.action, next / s.dur)
      s.dur = next
      s.data.dur = next
    }
    if (patch.name !== undefined) s.name = patch.name
    if (patch.desc !== undefined) s.desc = patch.desc
    if (patch.lock !== undefined) s.lock = patch.lock
    if (patch.fov !== undefined) {
      s.fov = Math.max(10, Math.min(110, Number(patch.fov)))
      s.action.fcurves = s.action.fcurves.filter((f) => f.rnaPath !== 'lens')
    }
    if (patch.timingMode !== undefined) {
      s.timingMode = patch.timingMode
      if (patch.timingMode === 'custom') ensureSpeedCurve(s.action, s.dur)
    }
    if (patch.syncActor !== undefined) s.syncActor = patch.syncActor
    if (patch.yaw !== undefined) s.yaw = Number(patch.yaw)
    if (patch.pitch !== undefined) s.pitch = Number(patch.pitch)
    viewport?.refreshTracks()
    commit(`shot:${i}`)
  }

  function setShotStraight(straight: boolean): void {
    const s = world.shots[shotIdx.value]
    if (!s) return
    setTrackStraight(s.action, straight)
    reconcileSpeed(s.action, s.dur)
    world.invalidateTrack(s.action)
    viewport?.refreshTracks()
    commit('shot-straight')
  }

  function addCamPoint(i: number): void {
    const s = world.shots[i]
    if (!s) return
    const path = trackPath(s.action)
    if (!path) return
    const last = path.points[path.points.length - 1]
    const lastCo = new THREE.Vector3(...last.co)
    let dir: THREE.Vector3
    if (path.points.length > 1) {
      dir = lastCo.clone().sub(new THREE.Vector3(...path.points[path.points.length - 2].co))
      if (dir.lengthSq() < 0.001) dir = new THREE.Vector3(0, 0, 2)
    } else {
      dir = new THREE.Vector3(-1.5, 0, -1.5)
    }
    const p = lastCo.clone().add(dir.setLength(2))
    p.y = lastCo.y
    addTrackAnchor(s.action, p, s.dur)
    if (s.timingMode === 'custom') ensureSpeedCurve(s.action, s.dur)
    world.invalidateTrack(s.action)
    viewport?.refreshTracks()
    commit()
  }

  function removeCamPoint(i: number, ptIdx: number): void {
    const s = world.shots[i]
    if (!s || anchorCount(s.action) <= 1) return
    removeTrackAnchor(s.action, ptIdx, s.dur)
    world.invalidateTrack(s.action)
    if (selected.value?.type === 'camPoint') selected.value = null
    viewport?.refreshTracks()
    commit()
  }

  function setCamPoint(i: number, ptIdx: number, patch: { y?: number }): void {
    const s = world.shots[i]
    const path = trackPath(s?.action ?? null)
    const point = path?.points[ptIdx]
    if (!s || !point || patch.y === undefined) return
    const y = Math.max(0.2, Math.min(30, Number(patch.y)))
    const dy = y - point.co[1]
    point.co[1] = y
    point.h1[1] += dy
    point.h2[1] += dy
    world.invalidateTrack(s.action)
    viewport?.refreshTracks()
    commit(`campt:${i}:${ptIdx}`)
  }

  function anchorTime(s: RuntimeShot, ptIdx: number): number {
    const times = trackTimes(s.action, s.dur)
    return times[Math.max(0, Math.min(ptIdx, times.length - 1))] ?? 0
  }

  function setCamKey(
    i: number,
    ptIdx: number,
    patch: { yaw?: number; pitch?: number; fov?: number }
  ): void {
    const s = world.shots[i]
    if (!s) return
    const at = anchorTime(s, ptIdx)
    if (patch.fov !== undefined) setFovKey(s.action, at, Number(patch.fov))
    if (patch.yaw !== undefined || patch.pitch !== undefined) {
      const current = sampleAim(s.action, at, { yawDeg: s.yaw, pitchDeg: s.pitch })
      setAimKey(
        s.action,
        at,
        patch.yaw !== undefined ? Number(patch.yaw) : current.yawDeg,
        patch.pitch !== undefined ? Number(patch.pitch) : current.pitchDeg
      )
    }
    commit(`camkey:${i}:${ptIdx}`)
  }

  function setCamTime(i: number, ptIdx: number, time: number): void {
    const s = world.shots[i]
    if (!s) return
    if (s.timingMode !== 'custom') {
      ensureSpeedCurve(s.action, s.dur)
      s.timingMode = 'custom'
      s.data.timingMode = 'custom'
    }
    setTrackTime(s.action, ptIdx, time, s.dur)
    commit(`camtime:${i}:${ptIdx}`)
  }

  function updateSun(patch: Partial<PrevizSun>): void {
    world.setSun(patch)
    commit('sun')
  }

  function updateGround(ground: PrevizGround): void {
    world.setGround(ground)
    commit('ground')
  }

  function setAspect(aspect: string): void {
    if (!(aspect in PREVIZ_ASPECTS)) return
    project.value = { ...project.value, aspect }
    const [w, h] = PREVIZ_ASPECTS[aspect]
    writeWidget(node, WIDTH_WIDGET, w, { fireCallback: false })
    writeWidget(node, HEIGHT_WIDGET, h, { fireCallback: false })
    persist()
    uiVersion.value++
  }

  function setCollision(on: boolean): void {
    project.value = {
      ...project.value,
      settings: { ...project.value.settings, collision: on }
    }
    world.collisionEnabled = on
    persist()
    uiVersion.value++
  }

  function setLabels(on: boolean): void {
    project.value = {
      ...project.value,
      settings: { ...project.value.settings, labels: on }
    }
    world.labelsEnabled = on
    world.updateLabelVisibility()
    persist()
    uiVersion.value++
  }

  function outputSize(): { width: number; height: number } {
    return {
      width: Math.max(64, readWidgetNum(node, WIDTH_WIDGET, 1280)),
      height: Math.max(64, readWidgetNum(node, HEIGHT_WIDGET, 720))
    }
  }

  function applyGlobalTime(globalSeconds: number): void {
    let remaining = globalSeconds
    let idx = 0
    while (idx < world.shots.length - 1 && remaining > world.shots[idx].dur) {
      remaining -= world.shots[idx].dur
      idx++
    }
    evaluateActors(world, idx, remaining)
    evaluateShotCam(world, world.shots[idx], remaining)
  }

  async function capture(): Promise<void> {
    if (!viewport || capturing.value || recording.value) return
    capturing.value = true
    try {
      const { width, height } = outputSize()
      const wasTime = globalTime.value
      applyGlobalTime(wasTime)
      const blob = await capturePrevizFrame(viewport, width, height)
      const uploaded = await uploadBlobNamed(blob, {
        subfolder: 'comfytv/previz',
        filenamePrefix: 'previz'
      })
      capturedImageUrl.value = uploaded.url
      writeWidget(node, IMAGE_WIDGET, uploaded.url, { fireCallback: false })
      if (world.shots.length > 1) {
        const uploads: Array<{ label: string; url: string }> = []
        for (let i = 0; i < world.shots.length; i++) {
          const start = world.shots.slice(0, i).reduce((sum, s) => sum + s.dur, 0)
          applyGlobalTime(start + 1e-3)
          const shotBlob = await capturePrevizFrame(viewport, width, height)
          const up = await uploadBlobNamed(shotBlob, {
            subfolder: 'comfytv/previz',
            filenamePrefix: `previz-shot${i + 1}`
          })
          uploads.push({ label: world.shots[i].name, url: up.url })
        }
        writeWidget(
          node,
          IMAGES_WIDGET,
          JSON.stringify({
            images: uploads.map((u, index) => ({
              index: String(index + 1),
              label: u.label,
              image_url: u.url
            }))
          }),
          { fireCallback: false }
        )
      } else {
        writeWidget(node, IMAGES_WIDGET, '', { fireCallback: false })
      }
      applyGlobalTime(wasTime)
      opts?.onCaptured?.(uploaded.url)
    } catch (error) {
      toastError(`${t('previz.captureFailed')}: ${String(error)}`)
    } finally {
      capturing.value = false
    }
  }

  async function record(): Promise<void> {
    if (!viewport || capturing.value || recording.value) return
    recording.value = true
    recordProgress.value = null
    const wasTime = globalTime.value
    clock.pause()
    playing.value = false
    try {
      const { width, height } = outputSize()
      const blob = await recordPrevizVideo(viewport, {
        width,
        height,
        duration: duration.value,
        applyTime: applyGlobalTime,
        onProgress: (p) => {
          recordProgress.value = p
        }
      })
      const uploaded = await uploadBlobNamed(blob, {
        subfolder: 'comfytv/previz',
        filename: `previz-${Date.now()}.webm`
      })
      capturedVideoUrl.value = uploaded.url
      writeWidget(node, VIDEO_WIDGET, uploaded.url, { fireCallback: false })
      opts?.onRecorded?.(uploaded.url)
    } catch (error) {
      toastError(`${t('previz.recordFailed')}: ${String(error)}`)
    } finally {
      applyGlobalTime(wasTime)
      recording.value = false
      recordProgress.value = null
    }
  }

  const timelineData = computed(() => {
    void uiVersion.value
    const shots = world.shots.map((s, i) => ({
      name: s.name,
      dur: s.dur,
      start: world.shots.slice(0, i).reduce((sum, x) => sum + x.dur, 0),
      camTimes: anchorCount(s.action) >= 2 ? trackTimes(s.action, s.dur) : []
    }))
    const sceneDur = world.sceneDuration()
    const tracks = world.actors
      .filter((a) => a.track && anchorCount(a.track) >= 2)
      .map((a, i) => ({
        label: a.label,
        colorIndex: i,
        times: trackTimes(a.track!, sceneDur)
      }))
    return { duration: duration.value, shots, tracks }
  })

  const shotStraight = computed(() => {
    void uiVersion.value
    const s = world.shots[shotIdx.value]
    return s ? isTrackStraight(s.action) : false
  })

  const actorStraight = computed(() => {
    void uiVersion.value
    const a = selectedActor.value
    return a?.track ? isTrackStraight(a.track) : false
  })

  function shotBaseFov(): number {
    const s = world.shots[shotIdx.value]
    return s ? sampleFov(s.action, timeSec.value, s.fov) : 40
  }

  onNodeConfigure(node, () => {
    project.value = parseProjectJson(readWidgetStr(node, STATE_WIDGET, '{}'))
    capturedImageUrl.value = readWidgetStr(node, IMAGE_WIDGET, '')
    capturedVideoUrl.value = readWidgetStr(node, VIDEO_WIDGET, '')
    lastCommitted = snapshot()
    history.clear()
    historyVersion.value++
    reloadWorld()
  })

  bindWidgetCallback(node, STATE_WIDGET, (value) => {
    project.value = parseProjectJson(String(value ?? '{}'))
    lastCommitted = snapshot()
    history.clear()
    historyVersion.value++
    reloadWorld()
  })

  function mcpVec2(value: any): [number, number] | null {
    if (!Array.isArray(value) || value.length < 2) return null
    return [Number(value[0]), Number(value[value.length - 1])]
  }

  function mcpActor(label: unknown): PrevizActor {
    const actor = world.actorByLabel(String(label ?? ''))
    if (!actor) {
      throw new Error(
        `no actor '${label}'; actors: `
        + (world.actors.map((a) => a.label).join(', ') || '(none)'))
    }
    return actor
  }

  function mcpActorBounds(): ActorBoundsInfo[] {
    return world.actors.map((actor) => {
      const box = new THREE.Box3()
      actor.obj.traverse((child) => {
        if (child !== actor.labelSprite && (child as THREE.Mesh).isMesh) {
          box.expandByObject(child)
        }
      })
      return {
        label: actor.label,
        kind: actor.data.kind,
        mounted: !!actor.data.mount,
        min: [box.min.x, box.min.y, box.min.z] as [number, number, number],
        max: [box.max.x, box.max.y, box.max.z] as [number, number, number],
      }
    })
  }

  function mcpPlaceActor(actor: PrevizActor, pos: [number, number]): void {
    const lim = PREVIZ_STAGE_LIMIT
    actor.obj.position.x = Math.max(-lim, Math.min(lim, pos[0]))
    actor.obj.position.z = Math.max(-lim, Math.min(lim, pos[1]))
    world.alignActor(actor)
    commit(`actor:${actor.label}`)
  }

  function mcpShot(index: unknown): { shot: RuntimeShot; index: number } {
    const i = Number(index)
    const shot = world.shots[i]
    if (!shot) {
      throw new Error(
        `no shot ${index}; shots: 0..${world.shots.length - 1}`)
    }
    return { shot, index: i }
  }

  function mcpActorPatch(op: any): Partial<PrevizActor['data']> {
    const patch: Record<string, unknown> = {}
    const pos = mcpVec2(op.pos)
    if (pos) patch.pos = pos
    if (op.rot_y !== undefined || op.rotY !== undefined) {
      patch.rotY = Number(op.rot_y ?? op.rotY)
    }
    for (const key of ['height', 'scale', 'timeOffset'] as const) {
      const snake = key === 'timeOffset' ? op.time_offset : op[key]
      if (snake !== undefined) patch[key] = Number(snake)
    }
    if (op.pose !== undefined) {
      if (!PREVIZ_POSES.has(String(op.pose))) {
        throw new Error(`pose must be one of ${[...PREVIZ_POSES].join(', ')}`)
      }
      patch.pose = op.pose
    }
    if (op.time_link !== undefined) {
      if (!PREVIZ_TIME_LINKS.has(String(op.time_link))) {
        throw new Error(
          `time_link must be one of ${[...PREVIZ_TIME_LINKS].join(', ')}`)
      }
      patch.timeLink = op.time_link
    }
    if (op.time_link_shot !== undefined) patch.timeLinkShot = Number(op.time_link_shot)
    if (op.mount !== undefined) patch.mount = op.mount ? String(op.mount) : ''
    return patch as Partial<PrevizActor['data']>
  }

  function mcpShotPatch(op: any): Partial<PrevizShotData> {
    const patch: Record<string, unknown> = {}
    for (const key of ['name', 'desc', 'lock'] as const) {
      if (op[key] !== undefined) patch[key] = String(op[key])
    }
    for (const key of ['dur', 'fov', 'yaw', 'pitch'] as const) {
      if (op[key] !== undefined) patch[key] = Number(op[key])
    }
    if (op.timing_mode !== undefined) {
      if (!PREVIZ_TIMING_MODES.has(String(op.timing_mode))) {
        throw new Error(
          `timing_mode must be one of ${[...PREVIZ_TIMING_MODES].join(', ')}`)
      }
      patch.timingMode = op.timing_mode
    }
    if (op.sync_actor !== undefined) patch.syncActor = String(op.sync_actor ?? '')
    return patch as Partial<PrevizShotData>
  }

  function mcpTrackPoints(value: any, withHeight: boolean): THREE.Vector3[] {
    if (!Array.isArray(value) || value.length < 2) {
      throw new Error('points must be an array of at least 2 positions')
    }
    return value.map((p: any, i: number) => {
      if (!Array.isArray(p) || p.length < 2) {
        throw new Error(`points[${i}] must be [x, z] or [x, y, z]`)
      }
      if (withHeight) {
        const y = p.length > 2 ? Number(p[1]) : 1.6
        const z = p.length > 2 ? Number(p[2]) : Number(p[1])
        return new THREE.Vector3(Number(p[0]), Math.max(0.2, Math.min(30, y)), z)
      }
      return new THREE.Vector3(Number(p[0]), 0, Number(p[p.length - 1]))
    })
  }

  async function mcpApplyOps(ops: any[]): Promise<Array<Record<string, unknown>>> {
    if (!Array.isArray(ops) || ops.length === 0) {
      throw new Error('ops must be a non-empty array')
    }
    const results: Array<Record<string, unknown>> = []
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]
      const where = `ops[${i}] (${op?.op})`
      try {
        switch (op?.op) {
          case 'add_actor': {
            if (!PREVIZ_ACTOR_KINDS.has(String(op.kind))) {
              throw new Error(
                `kind must be one of ${[...PREVIZ_ACTOR_KINDS].join(', ')}`)
            }
            addActor(op.kind)
            const actor = world.actors[world.actors.length - 1]
            const patch = mcpActorPatch(op)
            if (Object.keys(patch).length) updateActor(actor.label, patch)
            if (patch.pos) mcpPlaceActor(actor, patch.pos as [number, number])
            results.push({ op: op.op, label: actor.label })
            break
          }
          case 'update_actor': {
            const actor = mcpActor(op.label)
            const patch = mcpActorPatch(op)
            updateActor(actor.label, patch)
            if (patch.pos) mcpPlaceActor(actor, patch.pos as [number, number])
            results.push({ op: op.op, label: actor.label })
            break
          }
          case 'remove_actor': {
            const actor = mcpActor(op.label)
            removeActor(actor.label)
            results.push({ op: op.op, label: actor.label })
            break
          }
          case 'set_actor_joint': {
            const actor = mcpActor(op.label)
            if (!PREVIZ_JOINT_KEYS.includes(String(op.key))) {
              throw new Error(
                `key must be one of ${PREVIZ_JOINT_KEYS.join(', ')}`)
            }
            setActorJoint(actor.label, String(op.key), Number(op.value))
            results.push({ op: op.op, label: actor.label })
            break
          }
          case 'set_actor_track': {
            const actor = world.pathOwner(mcpActor(op.label))
            const points = mcpTrackPoints(op.points, false)
            actor.track = makeTrackAction(points)
            if (op.straight === true) setTrackStraight(actor.track, true)
            distributeSpeed(actor.track, 0, world.sceneDuration())
            world.invalidateTrack(actor.track)
            syncViewportTracks()
            viewport?.refreshTracks()
            commit()
            results.push({ op: op.op, label: actor.label,
                           anchors: anchorCount(actor.track) })
            break
          }
          case 'clear_actor_track': {
            const actor = world.pathOwner(mcpActor(op.label))
            actor.track = null
            world.invalidateTrack(actor.track)
            syncViewportTracks()
            viewport?.refreshTracks()
            commit()
            results.push({ op: op.op, label: actor.label })
            break
          }
          case 'set_actor_straight': {
            const actor = mcpActor(op.label)
            setActorStraight(actor.label, op.straight !== false)
            results.push({ op: op.op, label: actor.label })
            break
          }
          case 'set_actor_path_time': {
            const actor = mcpActor(op.label)
            setActorPathTime(actor.label, Number(op.index), Number(op.time))
            results.push({ op: op.op, label: actor.label })
            break
          }
          case 'add_shot': {
            addShot()
            const index = world.shots.length - 1
            const patch = mcpShotPatch(op)
            if (Object.keys(patch).length) updateShot(index, patch)
            results.push({ op: op.op, index })
            break
          }
          case 'remove_shot': {
            const { index } = mcpShot(op.index)
            removeShot(index)
            results.push({ op: op.op, index })
            break
          }
          case 'update_shot': {
            const { index } = mcpShot(op.index)
            updateShot(index, mcpShotPatch(op))
            results.push({ op: op.op, index })
            break
          }
          case 'select_shot': {
            const { index } = mcpShot(op.index)
            setShot(index)
            results.push({ op: op.op, index })
            break
          }
          case 'set_shot_track': {
            const { shot, index } = mcpShot(op.index)
            const points = mcpTrackPoints(op.points, true)
            Object.assign(shot.action, makeTrackAction(points))
            if (op.straight === true) setTrackStraight(shot.action, true)
            if (shot.timingMode === 'custom') ensureSpeedCurve(shot.action, shot.dur)
            world.invalidateTrack(shot.action)
            viewport?.refreshTracks()
            commit()
            results.push({ op: op.op, index, anchors: anchorCount(shot.action) })
            break
          }
          case 'set_shot_straight': {
            const { index } = mcpShot(op.index ?? shotIdx.value)
            setShot(index)
            setShotStraight(op.straight !== false)
            results.push({ op: op.op, index })
            break
          }
          case 'set_cam_point_y': {
            const { index } = mcpShot(op.shot)
            setCamPoint(index, Number(op.index), { y: Number(op.y) })
            results.push({ op: op.op, index })
            break
          }
          case 'set_cam_key': {
            const { index } = mcpShot(op.shot)
            setCamKey(index, Number(op.index), {
              yaw: op.yaw !== undefined ? Number(op.yaw) : undefined,
              pitch: op.pitch !== undefined ? Number(op.pitch) : undefined,
              fov: op.fov !== undefined ? Number(op.fov) : undefined
            })
            results.push({ op: op.op, index })
            break
          }
          case 'set_cam_time': {
            const { index } = mcpShot(op.shot)
            setCamTime(index, Number(op.index), Number(op.time))
            results.push({ op: op.op, index })
            break
          }
          case 'set_sun': {
            const patch: Record<string, unknown> = {}
            if (op.enabled !== undefined) patch.enabled = op.enabled !== false
            if (Array.isArray(op.pos) && op.pos.length === 3) {
              patch.pos = op.pos.map(Number)
            }
            for (const key of ['intensity', 'temp', 'ambient', 'softness'] as const) {
              if (op[key] !== undefined) patch[key] = Number(op[key])
            }
            if (op.quality !== undefined) patch.quality = op.quality
            updateSun(patch as Partial<PrevizSun>)
            results.push({ op: op.op })
            break
          }
          case 'set_ground': {
            if (!PREVIZ_GROUND_STYLES.has(String(op.style))) {
              throw new Error(
                `style must be one of ${[...PREVIZ_GROUND_STYLES].join(', ')}`)
            }
            updateGround({ style: op.style,
                           ...(op.color ? { color: String(op.color) } : {}) })
            results.push({ op: op.op })
            break
          }
          case 'set_aspect': {
            if (!(String(op.aspect) in PREVIZ_ASPECTS)) {
              throw new Error(
                `aspect must be one of ${Object.keys(PREVIZ_ASPECTS).join(', ')}`)
            }
            setAspect(String(op.aspect))
            results.push({ op: op.op })
            break
          }
          case 'set_collision': {
            setCollision(op.on !== false)
            results.push({ op: op.op })
            break
          }
          case 'set_labels': {
            setLabels(op.on !== false)
            results.push({ op: op.op })
            break
          }
          default:
            throw new Error(
              `unknown op '${op?.op}'; valid ops: add_actor, update_actor, `
              + 'remove_actor, set_actor_joint, set_actor_track, '
              + 'clear_actor_track, set_actor_straight, set_actor_path_time, '
              + 'add_shot, remove_shot, update_shot, select_shot, '
              + 'set_shot_track, set_shot_straight, set_cam_point_y, '
              + 'set_cam_key, set_cam_time, set_sun, set_ground, set_aspect, '
              + 'set_collision, set_labels')
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(
          `${where}: ${detail} (ops before this one were already applied)`)
      }
    }
    return results
  }

  {
    const hostApi = ((node as any).__comfytvStageApi ??= {})
    hostApi.previz = {
      getState: () => {
        const bounds = mcpActorBounds()
        return {
          ...JSON.parse(JSON.stringify(project.value)),
          duration: duration.value,
          shot_index: shotIdx.value,
          actor_labels: world.actors.map((a) => a.label),
          actor_bounds: bounds,
          overlap_warnings: actorOverlapWarnings(bounds),
        }
      },
      resources: () => ({
        actor_kinds: [...PREVIZ_ACTOR_KINDS],
        poses: [...PREVIZ_POSES],
        time_links: [...PREVIZ_TIME_LINKS],
        timing_modes: [...PREVIZ_TIMING_MODES],
        ground_styles: [...PREVIZ_GROUND_STYLES],
        aspects: Object.keys(PREVIZ_ASPECTS),
        joint_keys: [...PREVIZ_JOINT_KEYS],
        stage_limit: PREVIZ_STAGE_LIMIT,
        shot_duration_min: PREVIZ_SHOT_DURATION_MIN,
      }),
      applyOps: async (ops: any[]) => {
        const results = await mcpApplyOps(ops)
        return {
          results,
          warnings: actorOverlapWarnings(mcpActorBounds()),
        }
      },
      configureOutput: (patch: { width?: number; height?: number }) => {
        if (Number.isFinite(patch.width)) {
          writeWidget(node, WIDTH_WIDGET, Number(patch.width), { fireCallback: false })
        }
        if (Number.isFinite(patch.height)) {
          writeWidget(node, HEIGHT_WIDGET, Number(patch.height), { fireCallback: false })
        }
      },
      isBusy: () => capturing.value || recording.value,
      hasRecordableDuration: () => duration.value > 0,
      capture: async () => {
        const before = capturedImageUrl.value
        await capture()
        if (capturedImageUrl.value === before) {
          throw new Error('capture produced no output — see the ComfyTV tab for details')
        }
        return {
          image: capturedImageUrl.value,
          images: readWidgetStr(node, IMAGES_WIDGET, ''),
        }
      },
      record: async () => {
        if (!recordingSupported) {
          throw new Error('video recording is not supported in this browser tab')
        }
        const before = capturedVideoUrl.value
        await record()
        if (capturedVideoUrl.value === before) {
          throw new Error('record produced no output — see the ComfyTV tab for details')
        }
        return { video: capturedVideoUrl.value }
      },
    }
  }

  return {
    world,
    project,
    shotIdx,
    playing,
    playAll,
    speed,
    timeSec,
    globalTime,
    duration,
    selected,
    selectedActor,
    selectedShot,
    uiVersion,
    canUndo,
    canRedo,
    capturing,
    recording,
    recordProgress,
    recordingSupported,
    capturedImageUrl,
    capturedVideoUrl,
    timelineData,
    shotStraight,
    actorStraight,
    shotBaseFov,
    initViewport,
    attachMonitor,
    cleanup,
    reloadWorld,
    undo,
    redo,
    togglePlay,
    setShot,
    seekGlobal,
    addActor,
    removeActor,
    selectActor,
    updateActor,
    setActorJoint,
    setActorStraight,
    addPathPoint,
    removePathPoint,
    setActorPathTime,
    addShot,
    removeShot,
    updateShot,
    setShotStraight,
    addCamPoint,
    removeCamPoint,
    setCamPoint,
    setCamKey,
    setCamTime,
    updateSun,
    updateGround,
    setAspect,
    setCollision,
    setLabels,
    capture,
    record
  }
}
