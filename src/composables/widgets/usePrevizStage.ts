import { computed, ref, watch } from 'vue'
import * as THREE from 'three'

import { i18n } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import { app } from '@/lib/comfyApp'
import {
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
import { PREVIZ_ASPECTS, PREVIZ_SHOT_DURATION_MIN } from '@/widgets/three/previz/types'

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
