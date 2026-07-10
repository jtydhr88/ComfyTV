import {
  Timeline,
  TimelineKeyframeShape,
  type TimelineModel,
  type TimelineRow
} from 'animation-timeline-js'
import type { TimelineGroup } from 'animation-timeline-js/lib/models/timelineGroup'

export const CAMERA_COLORS = [
  '#4a9eff',
  '#38bd8a',
  '#c77dff',
  '#ffab4a'
] as const

export const TRACK_COLORS = [
  '#e88a3a',
  '#3ac56f',
  '#e84a6f',
  '#9a6ae8',
  '#3ab9c5',
  '#c5b53a'
] as const

function dimColor(color: string): string {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, 0.45)`
  }
  return color
}

export interface TimelineCameraTrack {
  id: string
  color: string
  sourceFrames: number
  speed: number
}

export interface TimelineCharacterTrack {
  id: string
  color: string
  offsetFrames: number
  displayFrames: number
  sourceFrames: number
  loop: boolean
}

export interface TimelineTracksData {
  fps: number
  cameras: TimelineCameraTrack[]
  characters: TimelineCharacterTrack[]
}

export interface TimelineTracksCallbacks {
  onSeek(frame: number): void
  onCameraSpeed(id: string, speed: number): void
  onCharacterPatch(
    id: string,
    patch: { startOffset?: number; speed?: number }
  ): void
  onTrackSelect(id: string): void
}

interface CameraRowRefs {
  track: TimelineCameraTrack
  group: TimelineGroup
  endKf: { val: number }
}

interface CharacterRowRefs {
  track: TimelineCharacterTrack
  group: TimelineGroup
  startKf: { val: number }
  endKf: { val: number }
}

type MutableKeyframe = {
  val: number
  group: TimelineGroup
  draggable?: boolean
  style?: { fillColor: string }
}

const MAX_LOOP_TILES = 64

export class Scene3dTimelineTracks {
  private timeline: Timeline | null = null
  private data: TimelineTracksData = {
    fps: 24,
    cameras: [],
    characters: []
  }
  private cameraRows = new Map<string, CameraRowRefs>()
  private characterRows = new Map<string, CharacterRowRefs>()
  private isSyncing = false
  private zoom = 1
  private maxLifted = false

  private readonly container: HTMLElement

  constructor(
    container: HTMLElement,
    private readonly callbacks: TimelineTracksCallbacks
  ) {
    this.container = container
    ;(
      container as HTMLElement & { __scene3dTimeline?: Scene3dTimelineTracks }
    ).__scene3dTimeline = this
    this.timeline = new Timeline({
      id: container,
      min: 0,
      max: 250,
      stepPx: 50,
      stepVal: 10,
      snapEnabled: true,
      snapStep: 1,
      timelineDraggable: true,
      keyframesDraggable: true,
      groupsDraggable: true,
      headerHeight: 22,
      leftMargin: 0,
      fillColor: '#1e1e2e',
      headerFillColor: '#2a2a3a',
      labelsColor: '#888',
      tickColor: '#444',
      selectionColor: 'rgba(74, 158, 255, 0.2)',
      rowsStyle: { height: 22, marginBottom: 2 },
      font: '10px monospace'
    })

    const canvas = container.querySelector('canvas')
    if (canvas) {
      canvas.style.position = 'relative'
      canvas.style.zIndex = '2'
    }
    const scrollContainer = container.querySelector(
      '.scroll-container'
    ) as HTMLElement | null
    if (scrollContainer) {
      scrollContainer.style.zIndex = '1'
      const scrollContent = scrollContainer.firstElementChild as HTMLElement
      if (scrollContent) scrollContent.style.pointerEvents = 'none'
    }

    ;(
      this.timeline as unknown as {
        _formatUnitsText: (val: number) => string
      }
    )._formatUnitsText = (val: number) => String(Math.round(val))

    setTimeout(() => this.timeline?.rescale(), 200)
    this.bindEvents()
  }

  setData(data: TimelineTracksData): void {
    this.data = data
    this.rebuildModel()
  }

  setTime(frame: number): void {
    if (!this.timeline) return
    this.isSyncing = true
    try {
      this.timeline.setTime(frame)
    } finally {
      this.isSyncing = false
    }
  }

  setZoom(zoom: number): void {
    this.zoom = zoom
    this.timeline?.setZoom(zoom)
  }

  rescale(): void {
    this.timeline?.rescale()
    this.timeline?.setZoom(this.zoom)
    this.timeline?.redraw()
  }

  getDesiredHeight(maxVisibleRows: number): number {
    const vm = (
      this.timeline as unknown as {
        _generateViewModel?: () => {
          rowsViewModels?: Array<{ size: { y: number; height: number } }>
        }
      }
    )._generateViewModel?.()
    const rows = vm?.rowsViewModels ?? []
    if (!rows.length) return 0
    const last = rows[Math.min(rows.length, maxVisibleRows) - 1]
    const contentBottom = last.size.y + last.size.height + 24
    const scroll = this.container.querySelector(
      '.scroll-container'
    ) as HTMLElement | null
    const gutter = scroll ? scroll.offsetHeight - scroll.clientHeight : 17
    return Math.ceil(contentBottom / 0.8) + Math.max(gutter, 0)
  }

  private totalFrames(): number {
    const camEnd = Math.max(
      0,
      ...this.data.cameras.map((c) => c.sourceFrames / Math.max(0.1, c.speed))
    )
    const charEnd = Math.max(
      0,
      ...this.data.characters.map((c) => c.offsetFrames + c.displayFrames)
    )
    return Math.max(camEnd, charEnd)
  }

  private rebuildModel(): void {
    if (!this.timeline) return
    this.maxLifted = false
    const { cameras, characters } = this.data
    const contentFrames = this.totalFrames()

    this.timeline.setOptions({
      min: 0,
      max: contentFrames > 0 ? contentFrames : 100
    })

    this.cameraRows.clear()
    this.characterRows.clear()
    const rows: TimelineRow[] = []

    for (const track of cameras) {
      const displayFrames = track.sourceFrames / Math.max(0.1, track.speed)
      if (displayFrames <= 0) continue
      const group: TimelineGroup = {
        style: { fillColor: track.color, height: 18, radii: 4 },
        keyframesStyle: { shape: TimelineKeyframeShape.Rect },
        draggable: false
      }
      const endKf: MutableKeyframe = {
        val: displayFrames,
        group,
        draggable: true,
        style: { fillColor: track.color }
      }
      const row: TimelineRow = {
        keyframes: [
          {
            val: 0,
            group,
            draggable: false,
            style: { fillColor: dimColor(track.color) }
          },
          endKf
        ]
      }
      rows.push(row)
      this.cameraRows.set(track.id, { track, group, endKf })
    }

    for (const track of characters) {
      if (track.sourceFrames <= 0) continue
      const group: TimelineGroup = {
        style: { fillColor: track.color, height: 18, radii: 4 },
        keyframesStyle: { shape: TimelineKeyframeShape.Rect },
        draggable: true
      }
      const keyframes: MutableKeyframe[] = []

      if (track.loop && contentFrames > 0) {
        const dim = dimColor(track.color)
        let start = track.offsetFrames + track.displayFrames
        let tiles = 1
        while (start < contentFrames && tiles < MAX_LOOP_TILES) {
          const end = Math.min(start + track.displayFrames, contentFrames)
          const tileGroup: TimelineGroup = {
            style: { fillColor: dim, height: 18, radii: 4 },
            keyframesStyle: { shape: TimelineKeyframeShape.None },
            draggable: false
          }
          keyframes.push(
            { val: start, group: tileGroup, draggable: false, style: { fillColor: dim } },
            { val: end, group: tileGroup, draggable: false, style: { fillColor: dim } }
          )
          start = end
          tiles += 1
        }
      }

      const startKf: MutableKeyframe = {
        val: track.offsetFrames,
        group,
        draggable: true
      }
      const endKf: MutableKeyframe = {
        val: track.offsetFrames + track.displayFrames,
        group,
        draggable: true
      }
      keyframes.push(startKf, endKf)

      const row: TimelineRow = { keyframes }
      rows.push(row)
      this.characterRows.set(track.id, { track, group, startKf, endKf })
    }

    const model: TimelineModel = { rows }
    this.timeline.setModel(model)
    this.rescale()
  }

  private bindEvents(): void {
    if (!this.timeline) return

    this.timeline.onTimeChanged((event: { val: number }) => {
      if (!this.isSyncing) this.callbacks.onSeek(event.val)
    })

    this.timeline.onSelected((event: { selected?: unknown[] }) => {
      const selected = event.selected ?? []
      if (!selected.length) return
      const trackId = this.trackIdForSelection(selected)
      if (trackId) this.callbacks.onTrackSelect(trackId)
      const isEndKeyframe =
        [...this.cameraRows.values()].some((refs) =>
          selected.includes(refs.endKf)
        ) ||
        [...this.characterRows.values()].some((refs) =>
          selected.includes(refs.endKf)
        )
      if (!isEndKeyframe) {
        if (this.maxLifted) this.rebuildModel()
        return
      }
      this.maxLifted = true
      this.timeline!.setOptions({ max: Number.MAX_VALUE })
      this.rescale()
    })

    this.timeline.onDragFinished((event: { target?: unknown }) => {
      try {
        this.handleDragFinished(event)
      } finally {
        if (this.maxLifted) this.rebuildModel()
      }
    })
  }

  private trackIdForSelection(selected: unknown[]): string | null {
    for (const refs of this.cameraRows.values()) {
      if (selected.includes(refs.endKf)) return refs.track.id
    }
    for (const refs of this.characterRows.values()) {
      if (selected.includes(refs.startKf) || selected.includes(refs.endKf)) {
        return refs.track.id
      }
    }
    return null
  }

  private handleDragFinished(event: { target?: unknown }): void {
    {
      const target = event.target as
        | { keyframe?: { val: number }; group?: TimelineGroup }
        | undefined
      if (!target) return

      for (const refs of this.cameraRows.values()) {
        if (target.keyframe !== refs.endKf) continue
        const newFrames = Math.max(1, Math.round(refs.endKf.val))
        if (refs.track.sourceFrames > 0) {
          this.callbacks.onCameraSpeed(
            refs.track.id,
            clampSpeed(refs.track.sourceFrames / newFrames)
          )
        }
        return
      }

      for (const refs of this.characterRows.values()) {
        const { track, group, startKf, endKf } = refs
        const isKeyframe =
          target.keyframe === startKf || target.keyframe === endKf
        const isGroup = target.group === group
        if (!isKeyframe && !isGroup) continue

        const fps = this.data.fps
        if (isGroup) {
          this.callbacks.onCharacterPatch(track.id, {
            startOffset: Math.max(0, startKf.val) / fps
          })
        } else if (target.keyframe === startKf) {
          const displayFrames = endKf.val - startKf.val
          const patch: { startOffset: number; speed?: number } = {
            startOffset: Math.max(0, startKf.val) / fps
          }
          if (displayFrames > 0 && track.sourceFrames > 0) {
            patch.speed = clampSpeed(track.sourceFrames / displayFrames)
          }
          this.callbacks.onCharacterPatch(track.id, patch)
        } else {
          const displayFrames = endKf.val - startKf.val
          if (displayFrames > 0 && track.sourceFrames > 0) {
            this.callbacks.onCharacterPatch(track.id, {
              speed: clampSpeed(track.sourceFrames / displayFrames)
            })
          }
        }
        return
      }
    }
  }

  dispose(): void {
    this.timeline?.dispose()
    this.timeline = null
  }
}

function clampSpeed(speed: number): number {
  return Math.max(0.1, Math.min(10, Math.round(speed * 100) / 100))
}
