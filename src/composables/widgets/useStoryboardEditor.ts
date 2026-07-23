import { computed, onBeforeUnmount, ref } from 'vue'

import { app, type LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import {
  boardDurationMs,
  boardImageUrl,
  boardsFromImagesJson,
  boardsFromShotsJson,
  boardsToImagesJson,
  coverImageUrl,
  createBoard,
  createDoc,
  duplicateBoardData,
  parseDoc,
  serializeDoc,
  shotLabels,
  suggestedDurationMs,
  totalDurationMs,
  type StoryBoardData,
  type StoryboardDoc,
} from '@/widgets/storyboard/boardDoc'
import { fountainToBoards } from '@/widgets/storyboard/fountain'
import { buildZip, type ZipEntry } from '@/widgets/storyboard/zipWriter'
import { uploadBlob } from '@/utils/uploadCanvas'
import {
  useLayerEditorStage,
  type LayerEditorStorage,
  type UseLayerEditorStageOptions,
} from '@/composables/widgets/useLayerEditorStage'

const STATE_WIDGET = 'board_state'
const WIDTH_WIDGET = 'width'
const HEIGHT_WIDGET = 'height'
const IMAGE_WIDGET = 'captured_image'
const IMAGES_WIDGET = 'captured_images'
const ANIMATIC_WIDGET = 'animatic_video'
const SUBFOLDER = 'comfytv/storyboard'
const ANIMATIC_FPS = 24

export interface UseStoryboardEditorOptions {
  onCommitted?: (coverUrl: string, batchJson: string) => void
  onAnimatic?: (videoUrl: string) => void
}

function isBlankBoard(b: StoryBoardData): boolean {
  return !b.layerState && !b.compositeUrl && !b.refUrl
    && !b.dialogue && !b.action && !b.notes && !b.scenePurpose && !b.imagePrompt
}

export type StoryboardEditorController = ReturnType<typeof useStoryboardEditor>

export function useStoryboardEditor(node: LGraphNode, state: StageState, opts?: UseStoryboardEditorOptions) {
  const doc = ref<StoryboardDoc>(createDoc())
  const currentUid = ref<string>('')
  const playing = ref(false)
  const playIndex = ref(0)
  const loop = ref(false)
  const captions = ref(true)
  const onionPrev = ref(false)
  const onionNext = ref(false)
  const guideCenter = ref(false)
  const guideThirds = ref(false)
  const guideGrid = ref(false)

  const captureTokens = new Map<string, number>()
  let playTimer: number | null = null
  let lastWritten = ''

  function ensureBoards(): void {
    if (doc.value.boards.length === 0) doc.value.boards.push(createBoard())
    if (!doc.value.boards.some((b) => b.uid === currentUid.value)) {
      currentUid.value = doc.value.boards[0].uid
    }
  }

  const boards = computed(() => doc.value.boards)
  const labels = computed(() => shotLabels(doc.value))
  const currentIndex = computed(() => Math.max(0, doc.value.boards.findIndex((b) => b.uid === currentUid.value)))
  const currentBoard = computed<StoryBoardData>(() => doc.value.boards[currentIndex.value])
  const totalMs = computed(() => totalDurationMs(doc.value))
  const playingBoard = computed<StoryBoardData | null>(() =>
    playing.value ? (doc.value.boards[playIndex.value] ?? null) : null)

  const onionPrevUrl = computed<string | null>(() => {
    if (!onionPrev.value || playing.value) return null
    const b = doc.value.boards[currentIndex.value - 1]
    return b ? boardImageUrl(b) : null
  })
  const onionNextUrl = computed<string | null>(() => {
    if (!onionNext.value || playing.value) return null
    const b = doc.value.boards[currentIndex.value + 1]
    return b ? boardImageUrl(b) : null
  })

  function commit(): void {
    ensureBoards()
    const json = serializeDoc(doc.value)
    lastWritten = json
    writeWidget(node, STATE_WIDGET, json, { fireCallback: false })
    const cover = coverImageUrl(doc.value)
    const batch = boardsToImagesJson(doc.value)
    writeWidget(node, IMAGE_WIDGET, cover, { fireCallback: false })
    writeWidget(node, IMAGES_WIDGET, batch, { fireCallback: false })
    opts?.onCommitted?.(cover, batch)
  }

  function restore(): void {
    const raw = readWidgetStr(node, STATE_WIDGET, '')
    if (raw && raw !== lastWritten) {
      const parsed = parseDoc(raw)
      if (parsed) {
        doc.value = parsed
        lastWritten = raw
      }
    }
    ensureBoards()
  }

  restore()
  onNodeConfigure(node, () => {
    restore()
    stopPlayback()
  })

  const storage: LayerEditorStorage = {
    subfolder: SUBFOLDER,
    readState: () => {
      const b = currentBoard.value
      if (b.layerState) return JSON.stringify(b.layerState)
      return JSON.stringify({ width: doc.value.width, height: doc.value.height, root: { kind: 'group', children: [] } })
    },
    writeState: (json, width, height) => {
      try {
        currentBoard.value.layerState = JSON.parse(json)
      } catch {
        return
      }
      doc.value.width = width
      doc.value.height = height
      writeWidget(node, WIDTH_WIDGET, width, { fireCallback: false })
      writeWidget(node, HEIGHT_WIDGET, height, { fireCallback: false })
      commit()
    },
    readCapturedImage: () => currentBoard.value.compositeUrl ?? '',
    beginCapture: () => {
      const uid = currentBoard.value.uid
      const token = (captureTokens.get(uid) ?? 0) + 1
      captureTokens.set(uid, token)
      return (url) => {
        if (captureTokens.get(uid) !== token) return
        const b = doc.value.boards.find((x) => x.uid === uid)
        if (!b) return
        b.compositeUrl = url
        commit()
      }
    },
    commitBatch: () => {},
  }

  const editorOpts: UseLayerEditorStageOptions = { storage }
  const editor = useLayerEditorStage(node, editorOpts)

  function seedReference(): void {
    const b = currentBoard.value
    if (b.refUrl && editor.documentIsEmpty()) {
      void editor.addImageFromUrl(b.refUrl, 'reference')
    }
  }
  seedReference()

  function selectBoard(uid: string): void {
    if (uid === currentUid.value) return
    if (!doc.value.boards.some((b) => b.uid === uid)) return
    stopPlayback()
    editor.flushCapture()
    currentUid.value = uid
    editor.reload()
    seedReference()
  }

  function addBoard(afterCurrent = true): StoryBoardData {
    const b = createBoard()
    const at = afterCurrent ? currentIndex.value + 1 : doc.value.boards.length
    doc.value.boards.splice(at, 0, b)
    commit()
    selectBoard(b.uid)
    return b
  }

  function removeBoard(uid: string): void {
    const idx = doc.value.boards.findIndex((b) => b.uid === uid)
    if (idx < 0) return
    const wasCurrent = uid === currentUid.value
    if (wasCurrent) editor.cancelPendingCapture()
    doc.value.boards.splice(idx, 1)
    ensureBoards()
    if (wasCurrent) {
      currentUid.value = doc.value.boards[Math.min(idx, doc.value.boards.length - 1)].uid
      editor.reload()
      seedReference()
    }
    commit()
  }

  function moveBoard(uid: string, dir: -1 | 1): void {
    const arr = doc.value.boards
    const i = arr.findIndex((b) => b.uid === uid)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    commit()
  }

  /** Drag-and-drop reorder: move a board so it lands at `toIndex`. */
  function moveBoardTo(uid: string, toIndex: number): void {
    const arr = doc.value.boards
    const i = arr.findIndex((b) => b.uid === uid)
    if (i < 0) return
    const j = Math.max(0, Math.min(arr.length - 1, toIndex))
    if (i === j) return
    const [b] = arr.splice(i, 1)
    arr.splice(j, 0, b)
    commit()
  }

  function duplicateBoard(uid: string): StoryBoardData | null {
    const idx = doc.value.boards.findIndex((b) => b.uid === uid)
    if (idx < 0) return null
    const copy = duplicateBoardData(doc.value.boards[idx])
    doc.value.boards.splice(idx + 1, 0, copy)
    commit()
    selectBoard(copy.uid)
    return copy
  }

  /** Reading-speed estimate from the board's dialogue; returns true if applied. */
  function applySuggestedDuration(uid: string): boolean {
    const b = doc.value.boards.find((x) => x.uid === uid)
    if (!b) return false
    const ms = suggestedDurationMs(b)
    if (ms == null) return false
    b.durationMs = ms
    commit()
    return true
  }

  function flipBoard(axis: 'h' | 'v'): void {
    editor.flipImage(axis)
  }

  type TextField = 'dialogue' | 'action' | 'notes' | 'scenePurpose' | 'character' | 'shotSize' | 'imagePrompt' | 'motionPrompt'
  function setBoardField(uid: string, key: TextField, value: string): void {
    const b = doc.value.boards.find((x) => x.uid === uid)
    if (!b) return
    b[key] = value
    commit()
  }

  function setBoardDurationS(uid: string, seconds: number | null): void {
    const b = doc.value.boards.find((x) => x.uid === uid)
    if (!b) return
    b.durationMs = seconds != null && Number.isFinite(seconds) && seconds > 0
      ? Math.max(100, Math.round(seconds * 1000))
      : null
    commit()
  }

  function toggleNewShot(uid: string): void {
    const b = doc.value.boards.find((x) => x.uid === uid)
    if (!b) return
    b.newShot = !b.newShot
    commit()
  }

  function setDefaultTimingS(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    doc.value.defaultBoardTimingMs = Math.max(100, Math.round(seconds * 1000))
    commit()
  }

  function setBoardRefUrl(uid: string, url: string | null): void {
    const b = doc.value.boards.find((x) => x.uid === uid)
    if (!b) return
    b.refUrl = url
    commit()
    if (uid === currentUid.value) seedReference()
  }

  function appendBoards(incoming: StoryBoardData[]): number {
    if (!incoming.length) return 0
    const replacing = doc.value.boards.length === 1 && isBlankBoard(doc.value.boards[0])
    if (replacing) {
      editor.cancelPendingCapture()
      doc.value.boards = incoming
      currentUid.value = incoming[0].uid
      ensureBoards()
      commit()
      editor.reload()
      seedReference()
    } else {
      doc.value.boards.push(...incoming)
      ensureBoards()
      commit()
      selectBoard(incoming[0].uid)
    }
    return incoming.length
  }

  /** Pull shots from the connected StoryboardStage output. Returns imported count. */
  function importFromUpstream(): number {
    const inp = state.inputs.find((i) => i.slot === 'storyboard')
    if (!inp || inp.source !== 'upstream' || !inp.content) return 0
    return appendBoards(boardsFromShotsJson(inp.content))
  }

  /** Parse a Fountain screenplay: one newShot board per scene. Returns count. */
  function importFountainText(text: string): number {
    return appendBoards(fountainToBoards(text))
  }

  /** Pull a connected images batch: one reference board per image. Returns count. */
  function importFromUpstreamImages(): number {
    const inp = state.inputs.find((i) => i.slot === 'images')
    if (!inp || inp.source !== 'upstream' || !inp.content) return 0
    return appendBoards(boardsFromImagesJson(inp.content))
  }

  const importingImages = ref(false)

  /** Storyboarder's "Import Images to New Boards": one board per file. */
  async function importImageFiles(files: File[]): Promise<number> {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length || importingImages.value) return 0
    importingImages.value = true
    try {
      const incoming: StoryBoardData[] = []
      for (const file of images) {
        const url = await uploadBlob(file, { subfolder: SUBFOLDER, filename: file.name })
        incoming.push(createBoard({ newShot: true, refUrl: url, notes: file.name.replace(/\.[^.]+$/, '') }))
      }
      return appendBoards(incoming)
    } finally {
      importingImages.value = false
    }
  }

  const exportingAnimatic = ref(false)
  const animaticUrl = ref<string>(readWidgetStr(node, ANIMATIC_WIDGET, ''))

  /** Render the boards into an MP4 animatic on the backend (PyAV). */
  async function exportAnimatic(): Promise<string> {
    if (exportingAnimatic.value) return ''
    editor.flushCapture()
    exportingAnimatic.value = true
    try {
      const data = await postAnimatic('mp4') as { video_url?: string }
      const url = String(data?.video_url || '')
      if (!url) throw new Error('no video_url in response')
      animaticUrl.value = url
      writeWidget(node, ANIMATIC_WIDGET, url, { fireCallback: false })
      opts?.onAnimatic?.(url)
      return url
    } finally {
      exportingAnimatic.value = false
    }
  }

  async function postAnimatic(format: 'mp4' | 'gif'): Promise<unknown> {
    const body = {
      boards: doc.value.boards.map((b) => ({
        image_url: boardImageUrl(b) ?? '',
        duration_ms: boardDurationMs(doc.value, b),
        caption: b.dialogue || '',
      })),
      width: format === 'gif' ? Math.min(doc.value.width, 640) : doc.value.width,
      height: format === 'gif'
        ? Math.max(2, Math.round(Math.min(doc.value.width, 640) * doc.value.height / Math.max(1, doc.value.width)))
        : doc.value.height,
      fps: ANIMATIC_FPS,
      format,
      burn_captions: captions.value,
    }
    const resp = await (app as any).api.fetchApi('/comfytv/storyboard_editor/animatic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (resp.status !== 200) {
      const text = await resp.text()
      throw new Error(`${resp.status} ${text.slice(0, 200)}`)
    }
    return resp.json()
  }

  const exportingGif = ref(false)

  /** Render the boards into an animated GIF; returns its /view URL. */
  async function exportGif(): Promise<string> {
    if (exportingGif.value) return ''
    editor.flushCapture()
    exportingGif.value = true
    try {
      const data = await postAnimatic('gif') as { gif_url?: string }
      const url = String(data?.gif_url || '')
      if (!url) throw new Error('no gif_url in response')
      return url
    } finally {
      exportingGif.value = false
    }
  }

  const exportingZip = ref(false)

  /** Bundle every board image into a STORE zip for local download. */
  async function exportBoardsZip(): Promise<Blob | null> {
    if (exportingZip.value) return null
    exportingZip.value = true
    try {
      const labels = shotLabels(doc.value)
      const entries: ZipEntry[] = []
      for (let i = 0; i < doc.value.boards.length; i++) {
        const b = doc.value.boards[i]
        const url = boardImageUrl(b)
        if (!url) continue
        const resp = await fetch(url)
        if (!resp.ok) continue
        const buf = new Uint8Array(await resp.arrayBuffer())
        entries.push({ name: `board-${String(i + 1).padStart(3, '0')}-${labels[i]}-${b.uid}.png`, data: buf })
      }
      if (!entries.length) return null
      const bytes = buildZip(entries)
      return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' })
    } finally {
      exportingZip.value = false
    }
  }

  function stopPlayback(): void {
    playing.value = false
    if (playTimer != null) {
      window.clearTimeout(playTimer)
      playTimer = null
    }
  }

  function stepPlayback(): void {
    if (!playing.value) return
    const b = doc.value.boards[playIndex.value]
    if (!b) {
      stopPlayback()
      return
    }
    playTimer = window.setTimeout(() => {
      if (playIndex.value + 1 >= doc.value.boards.length) {
        if (!loop.value) {
          stopPlayback()
          return
        }
        playIndex.value = 0
        stepPlayback()
        return
      }
      playIndex.value += 1
      stepPlayback()
    }, Math.max(100, boardDurationMs(doc.value, b)))
  }

  function play(): void {
    if (playing.value || doc.value.boards.length === 0) return
    editor.flushCapture()
    playIndex.value = currentIndex.value
    playing.value = true
    stepPlayback()
  }

  onBeforeUnmount(stopPlayback)

  return {
    editor,
    doc, boards, labels, currentBoard, currentIndex, currentUid, totalMs,
    playing, playIndex, playingBoard, play, stopPlayback, loop, captions,
    onionPrev, onionNext, onionPrevUrl, onionNextUrl,
    guideCenter, guideThirds, guideGrid,
    selectBoard, addBoard, removeBoard, moveBoard, moveBoardTo,
    duplicateBoard, applySuggestedDuration, flipBoard,
    setBoardField, setBoardDurationS, toggleNewShot, setDefaultTimingS, setBoardRefUrl,
    importFromUpstream, importFromUpstreamImages, importFountainText,
    importImageFiles, importingImages,
    exportAnimatic, exportingAnimatic, animaticUrl,
    exportGif, exportingGif,
    exportBoardsZip, exportingZip,
    commit, restore,
  }
}
