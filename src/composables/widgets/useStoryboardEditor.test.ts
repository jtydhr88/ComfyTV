import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

const fontState = vi.hoisted(() => ({ readyCbs: new Set<() => void>() }))
vi.mock('@/widgets/layerEditor/fontStore', () => ({
  getFontStore: () => ({
    builtins: () => [],
    getFontSync: () => null,
    getFontSyncWithFallback: () => null,
    hasFailed: () => false,
    onFontReady: (cb: () => void) => {
      fontState.readyCbs.add(cb)
      return () => fontState.readyCbs.delete(cb)
    },
  }),
}))

vi.mock('@/widgets/layerEditor/textRender', () => ({
  measureText: vi.fn(() => ({ w: 200, h: 60 })),
  renderTextToCanvas: vi.fn(() => document.createElement('canvas')),
  TextRenderCache: class {
    get() { return null }
    drop() {}
    clear() {}
  },
}))

import { useStoryboardEditor, type StoryboardEditorController } from './useStoryboardEditor'
import type { StageState } from '@/stores/stageStore'

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  crossOrigin = ''
  naturalWidth = 0
  naturalHeight = 0
  width = 0
  height = 0
  set src(v: string) {
    queueMicrotask(() => {
      if (v.includes('bad')) {
        this.onerror?.()
        return
      }
      this.naturalWidth = this.width = 64
      this.naturalHeight = this.height = 64
      this.onload?.()
    })
  }
}

async function flushMicro(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

function make2dStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    fillStyle: '',
    drawImage: () => {},
    fillRect: () => {},
    fillText: () => {},
    clearRect: () => {},
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
    createImageData: (w: number, h: number) => new ImageData(w, h),
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
  } as unknown as CanvasRenderingContext2D
}

function makeNode(boardState = '{}') {
  return {
    id: 7,
    widgets: [
      { name: 'board_state', value: boardState, callback: undefined },
      { name: 'width', value: 1280, callback: undefined },
      { name: 'height', value: 720, callback: undefined },
      { name: 'captured_image', value: '', callback: undefined },
      { name: 'captured_images', value: '', callback: undefined },
      { name: 'animatic_video', value: '', callback: undefined },
    ],
    onConfigure: undefined as undefined | ((i: unknown) => void),
  } as any
}

function makeState(): StageState {
  return { inputs: [], outputs: [null, null], output: null } as unknown as StageState
}

function widgetVal(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name).value
}
function boardStateOf(node: any) {
  return JSON.parse(widgetVal(node, 'board_state'))
}

let wrappers: VueWrapper[] = []

function setup(boardState = '{}', state = makeState()) {
  const node = makeNode(boardState)
  const committed: Array<{ cover: string; batch: string }> = []
  const animatics: string[] = []
  let sb!: StoryboardEditorController
  const wrapper = mount(
    defineComponent({
      setup() {
        sb = useStoryboardEditor(node, state, {
          onCommitted: (cover, batch) => committed.push({ cover, batch }),
          onAnimatic: (url) => animatics.push(url),
        })
        return () => null
      },
    })
  )
  wrappers.push(wrapper)
  return { node, sb, state, committed, animatics }
}

const origGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage)
  ;(HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? make2dStub(this) : null
  }
  fontState.readyCbs.clear()
})

afterEach(() => {
  for (const w of wrappers) w.unmount()
  wrappers = []
  HTMLCanvasElement.prototype.getContext = origGetContext
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('bootstrap + persistence', () => {
  it('starts with one blank board when board_state is empty', () => {
    const { sb } = setup()
    expect(sb.boards.value).toHaveLength(1)
    expect(sb.currentUid.value).toBe(sb.boards.value[0].uid)
    expect(sb.labels.value).toEqual(['1A'])
  })

  it('restores an existing document and keeps it untouched on load', () => {
    const doc = {
      version: 1, width: 1920, height: 1080, defaultBoardTimingMs: 1000,
      boards: [
        { uid: 'AAAAA', newShot: true, dialogue: 'hi' },
        { uid: 'BBBBB', newShot: true },
      ],
    }
    const raw = JSON.stringify(doc)
    const { sb, node } = setup(raw)
    expect(sb.boards.value.map((b) => b.uid)).toEqual(['AAAAA', 'BBBBB'])
    expect(sb.doc.value.width).toBe(1920)
    expect(widgetVal(node, 'board_state')).toBe(raw)
  })

  it('board field edits persist into the board_state widget', () => {
    const { sb, node } = setup()
    const uid = sb.boards.value[0].uid
    sb.setBoardField(uid, 'dialogue', '走吧')
    sb.setBoardDurationS(uid, 3.5)
    expect(boardStateOf(node).boards[0]).toMatchObject({ dialogue: '走吧', durationMs: 3500 })
  })

  it('reloads from widget on node configure', () => {
    const { sb, node } = setup()
    node.widgets.find((w: any) => w.name === 'board_state').value = JSON.stringify({
      boards: [{ uid: 'ZZZZZ', dialogue: 'from-workflow' }],
    })
    node.onConfigure?.({})
    expect(sb.boards.value).toHaveLength(1)
    expect(sb.boards.value[0]).toMatchObject({ uid: 'ZZZZZ', dialogue: 'from-workflow' })
  })
})

describe('board CRUD + numbering', () => {
  it('addBoard inserts after current and selects it', () => {
    const { sb } = setup()
    const first = sb.boards.value[0].uid
    const b = sb.addBoard()
    expect(sb.boards.value.map((x) => x.uid)).toEqual([first, b.uid])
    expect(sb.currentUid.value).toBe(b.uid)
  })

  it('toggleNewShot drives shot labels', () => {
    const { sb } = setup()
    sb.addBoard()
    const second = sb.boards.value[1].uid
    expect(sb.labels.value).toEqual(['1A', '1A'])
    sb.toggleNewShot(second)
    expect(sb.labels.value).toEqual(['1A', '1B'])
  })

  it('removeBoard never leaves zero boards and reselects a neighbour', () => {
    const { sb } = setup()
    const only = sb.boards.value[0].uid
    sb.removeBoard(only)
    expect(sb.boards.value).toHaveLength(1)
    expect(sb.boards.value[0].uid).not.toBe(only)

    const a = sb.boards.value[0].uid
    const b = sb.addBoard().uid
    sb.selectBoard(a)
    sb.removeBoard(a)
    expect(sb.boards.value.map((x) => x.uid)).toEqual([b])
    expect(sb.currentUid.value).toBe(b)
  })

  it('moveBoard swaps neighbours and clamps at edges', () => {
    const { sb } = setup()
    const a = sb.boards.value[0].uid
    const b = sb.addBoard().uid
    sb.moveBoard(b, -1)
    expect(sb.boards.value.map((x) => x.uid)).toEqual([b, a])
    sb.moveBoard(b, -1)
    expect(sb.boards.value.map((x) => x.uid)).toEqual([b, a])
  })
})

describe('per-board layer documents', () => {
  it('keeps separate layer stacks per board across switches', () => {
    const { sb } = setup()
    const a = sb.boards.value[0].uid
    sb.editor.addTextLayerAt({ x: 10, y: 10 })
    expect(sb.editor.layers.value).toHaveLength(1)

    const b = sb.addBoard().uid
    expect(sb.editor.layers.value).toHaveLength(0)
    sb.editor.addTextLayerAt({ x: 1, y: 1 })
    sb.editor.addTextLayerAt({ x: 2, y: 2 })
    expect(sb.editor.layers.value).toHaveLength(2)

    sb.selectBoard(a)
    expect(sb.editor.layers.value).toHaveLength(1)
    sb.selectBoard(b)
    expect(sb.editor.layers.value).toHaveLength(2)
  })

  it('seeds the reference image as a layer on an empty board', async () => {
    const { sb } = setup()
    const uid = sb.boards.value[0].uid
    sb.setBoardRefUrl(uid, 'http://x/ref.png')
    await flushMicro()
    expect(sb.editor.layers.value).toHaveLength(1)
    expect(sb.editor.layers.value[0].node.name).toBe('reference')
  })
})

describe('outputs + upstream import', () => {
  it('commit publishes cover + batch from composites and refs', () => {
    const { sb, node, committed } = setup()
    const uid = sb.boards.value[0].uid
    sb.setBoardRefUrl(uid, '/view?f=ref.png')
    expect(widgetVal(node, 'captured_image')).toBe('/view?f=ref.png')
    const batch = JSON.parse(widgetVal(node, 'captured_images'))
    expect(batch.images).toHaveLength(1)
    expect(committed.at(-1)).toMatchObject({ cover: '/view?f=ref.png' })
  })

  it('importFromUpstream replaces a single blank board and selects the first shot', () => {
    const state = makeState()
    state.inputs = [{
      slot: 'storyboard', type: 'COMFYTV_STORYBOARD' as any, source: 'upstream',
      content: JSON.stringify({ shots: [
        { duration: 2, dialogue: 'one', image_url: '/s1.png' },
        { duration: 3, dialogue: 'two' },
      ] }),
    }]
    const { sb } = setup('{}', state)
    const count = sb.importFromUpstream()
    expect(count).toBe(2)
    expect(sb.boards.value).toHaveLength(2)
    expect(sb.boards.value[0]).toMatchObject({ dialogue: 'one', refUrl: '/s1.png', newShot: true })
    expect(sb.currentUid.value).toBe(sb.boards.value[0].uid)
    expect(sb.labels.value).toEqual(['1A', '1B'])
  })

  it('importFromUpstream appends when boards already carry content', () => {
    const state = makeState()
    state.inputs = [{
      slot: 'storyboard', type: 'COMFYTV_STORYBOARD' as any, source: 'upstream',
      content: JSON.stringify({ shots: [{ dialogue: 'new' }] }),
    }]
    const { sb } = setup('{}', state)
    sb.setBoardField(sb.boards.value[0].uid, 'dialogue', 'existing')
    expect(sb.importFromUpstream()).toBe(1)
    expect(sb.boards.value.map((b) => b.dialogue)).toEqual(['existing', 'new'])
  })

  it('returns 0 when no upstream storyboard is connected', () => {
    const { sb } = setup()
    expect(sb.importFromUpstream()).toBe(0)
  })
})

describe('board convenience ops', () => {
  it('duplicateBoard clones the current board next to it and selects the copy', () => {
    const { sb } = setup()
    const a = sb.boards.value[0].uid
    sb.setBoardField(a, 'dialogue', '原板')
    sb.editor.addTextLayerAt({ x: 1, y: 1 })
    const copy = sb.duplicateBoard(a)!
    expect(sb.boards.value).toHaveLength(2)
    expect(sb.boards.value[1].uid).toBe(copy.uid)
    expect(copy.dialogue).toBe('原板')
    expect(sb.currentUid.value).toBe(copy.uid)
    expect(sb.editor.layers.value).toHaveLength(1)
  })

  it('moveBoardTo reorders via drag indices', () => {
    const { sb } = setup()
    const a = sb.boards.value[0].uid
    const b = sb.addBoard().uid
    const c = sb.addBoard().uid
    sb.moveBoardTo(a, 2)
    expect(sb.boards.value.map((x) => x.uid)).toEqual([b, c, a])
    sb.moveBoardTo(a, 0)
    expect(sb.boards.value.map((x) => x.uid)).toEqual([a, b, c])
  })

  it('applySuggestedDuration writes the dialogue estimate', () => {
    const { sb } = setup()
    const uid = sb.boards.value[0].uid
    expect(sb.applySuggestedDuration(uid)).toBe(false)
    sb.setBoardField(uid, 'dialogue', '今天必须拿下这场比赛')
    expect(sb.applySuggestedDuration(uid)).toBe(true)
    expect(sb.boards.value[0].durationMs).toBe(2000)
  })

  it('importFromUpstreamImages seeds boards from a connected batch', () => {
    const state = makeState()
    state.inputs = [{
      slot: 'images', type: 'COMFYTV_IMAGES' as any, source: 'upstream',
      content: JSON.stringify({ images: [
        { index: 1, label: 'shot 1', image_url: '/s1.png' },
        { index: 2, label: 'shot 2', image_url: '/s2.png' },
      ] }),
    }]
    const { sb } = setup('{}', state)
    expect(sb.importFromUpstreamImages()).toBe(2)
    expect(sb.boards.value.map((b) => b.refUrl)).toEqual(['/s1.png', '/s2.png'])
  })

  it('loop playback wraps to the first board instead of stopping', () => {
    vi.useFakeTimers()
    const { sb } = setup()
    const a = sb.boards.value[0].uid
    sb.setBoardDurationS(a, 1)
    const b = sb.addBoard().uid
    sb.setBoardDurationS(b, 1)
    sb.selectBoard(a)
    sb.loop.value = true
    sb.play()
    vi.advanceTimersByTime(1000)
    expect(sb.playIndex.value).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(sb.playing.value).toBe(true)
    expect(sb.playIndex.value).toBe(0)
    sb.stopPlayback()
  })
})

describe('script + animatic export', () => {
  it('importFountainText replaces a blank board with per-scene boards', () => {
    const { sb } = setup()
    const count = sb.importFountainText(
      'INT. 车库 - 白天\n\n动作一。\n\n@林岳\n走吧。\n\nEXT. 山路 - 黄昏\n\n引擎轰鸣。\n')
    expect(count).toBe(2)
    expect(sb.boards.value).toHaveLength(2)
    expect(sb.boards.value[0]).toMatchObject({
      scenePurpose: 'INT. 车库 - 白天',
      action: '动作一。',
      dialogue: '林岳: 走吧。',
      newShot: true,
    })
    expect(sb.labels.value).toEqual(['1A', '1B'])
    expect(sb.importFountainText('')).toBe(0)
  })

  it('exportAnimatic posts boards and stores the video url', async () => {
    const { sb, node, animatics } = setup()
    const uid = sb.boards.value[0].uid
    sb.setBoardRefUrl(uid, '/view?f=ref.png')
    sb.setBoardDurationS(uid, 2)

    const { app } = await import('@/lib/comfyApp')
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response(
      JSON.stringify({ video_url: '/view?f=animatic.mp4' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))

    const url = await sb.exportAnimatic()
    expect(url).toBe('/view?f=animatic.mp4')
    expect(widgetVal(node, 'animatic_video')).toBe('/view?f=animatic.mp4')
    expect(sb.animaticUrl.value).toBe('/view?f=animatic.mp4')
    expect(animatics).toEqual(['/view?f=animatic.mp4'])

    const [path, init] = fetchApi.mock.calls.at(-1)!
    expect(path).toBe('/comfytv/storyboard_editor/animatic')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.boards).toEqual([{ image_url: '/view?f=ref.png', duration_ms: 2000, caption: '' }])
    expect(body.width).toBe(1280)
    expect(body.fps).toBe(24)
    expect(body.format).toBe('mp4')
    expect(body.burn_captions).toBe(true)
  })

  it('exportGif posts format=gif at capped size and returns the url', async () => {
    const { sb } = setup()
    sb.captions.value = false
    const { app } = await import('@/lib/comfyApp')
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response(
      JSON.stringify({ gif_url: '/view?f=a.gif' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const url = await sb.exportGif()
    expect(url).toBe('/view?f=a.gif')
    const [, init] = fetchApi.mock.calls.at(-1)!
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.format).toBe('gif')
    expect(body.burn_captions).toBe(false)
    expect(body.width).toBe(640)
    expect(body.height).toBe(360)
  })

  it('exportAnimatic surfaces backend errors and clears the busy flag', async () => {
    const { sb } = setup()
    const { app } = await import('@/lib/comfyApp')
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    await expect(sb.exportAnimatic()).rejects.toThrow('500')
    expect(sb.exportingAnimatic.value).toBe(false)
  })
})

describe('playback', () => {
  it('steps through boards honouring per-board durations, then stops', () => {
    vi.useFakeTimers()
    const { sb } = setup()
    const a = sb.boards.value[0].uid
    sb.setBoardDurationS(a, 1)
    sb.addBoard()
    sb.selectBoard(a)

    sb.play()
    expect(sb.playing.value).toBe(true)
    expect(sb.playIndex.value).toBe(0)

    vi.advanceTimersByTime(1000)
    expect(sb.playIndex.value).toBe(1)
    expect(sb.playing.value).toBe(true)

    vi.advanceTimersByTime(2000)
    expect(sb.playing.value).toBe(false)
  })

  it('selecting a board stops playback', () => {
    vi.useFakeTimers()
    const { sb } = setup()
    const a = sb.boards.value[0].uid
    sb.addBoard()
    sb.selectBoard(a)
    sb.play()
    sb.selectBoard(sb.boards.value[1].uid)
    expect(sb.playing.value).toBe(false)
  })
})
