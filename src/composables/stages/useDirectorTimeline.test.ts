import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  clipStatuses,
  normalizeClip,
  parseTimeline,
  serializeTimeline,
  useDirectorTimeline,
  CLIP_MIN_W,
  DURATION_MAX_S,
  DURATION_MIN_S,
  PPS,
} from './useDirectorTimeline'

function fakeNode(timeline = '', workflows: string[] = ['WF A', 'WF B']): any {
  return {
    widgets: [
      { name: 'timeline_data', value: timeline },
      { name: 'workflow', value: workflows[0] ?? '', options: { values: workflows } },
    ],
  }
}

function widgetValue(node: any): string {
  return node.widgets.find((w: any) => w.name === 'timeline_data').value
}

function make(node: any, state: any = {}) {
  return useDirectorTimeline(node, state, ref(null))
}

function makeRoot(): HTMLElement {
  const el = document.createElement('div')
  ;(el as any).setPointerCapture = vi.fn()
  ;(el as any).releasePointerCapture = vi.fn()
  return el
}

function pe(type: string, clientX: number): PointerEvent {
  return new MouseEvent(type, { clientX }) as unknown as PointerEvent
}

function twoClipNode(): any {
  return fakeNode(serializeTimeline([
    normalizeClip({ id: 'a', duration_s: 5 }),
    normalizeClip({ id: 'b', duration_s: 5 }),
  ], { chain: 'off' }))
}

function makeWithRoot(node: any) {
  const root = makeRoot()
  const t = useDirectorTimeline(node, {} as any, ref(root))
  return { t, root }
}

describe('normalizeClip', () => {
  it('fills defaults and clamps duration', () => {
    const c = normalizeClip({ duration_s: 9999 })
    expect(c.id).toBeTruthy()
    expect(c.enabled).toBe(true)
    expect(c.duration_s).toBe(DURATION_MAX_S)
    expect(Number.isFinite(c.seed)).toBe(true)
    expect(c.images).toEqual([])
  })

  it('keeps provided fields and drops junk ref entries', () => {
    const c = normalizeClip({
      id: 'x', enabled: false, workflow: 'W', prompt: 'p', duration_s: 3,
      seed: 42, images: ['/a', '', 7], videos: 'junk',
    })
    expect(c).toMatchObject({
      id: 'x', enabled: false, workflow: 'W', prompt: 'p',
      duration_s: 3, seed: 42, images: ['/a'], videos: [],
    })
  })
})

describe('parse/serialize round trip', () => {
  it('round-trips clips and settings', () => {
    const clips = [normalizeClip({ id: 'a', prompt: 'p1', transition: 'fade' }),
                   normalizeClip({ id: 'b', seed: 5 })]
    const raw = serializeTimeline(clips, { chain: 'replace' })
    const parsed = parseTimeline(raw)
    expect(parsed.settings).toEqual({ chain: 'replace' })
    expect(parsed.clips).toEqual(clips)
  })

  it('parses garbage as empty', () => {
    const empty = { clips: [], settings: { chain: 'off' } }
    expect(parseTimeline('{oops')).toEqual(empty)
    expect(parseTimeline('')).toEqual(empty)
  })

  it('upgrades legacy chain_last_frame to prepend', () => {
    const parsed = parseTimeline(JSON.stringify(
      { clips: [], settings: { chain_last_frame: true } }))
    expect(parsed.settings.chain).toBe('prepend')
  })

  it('normalizes unknown transitions to cut', () => {
    const c = normalizeClip({ transition: 'sparkle', transition_s: 99 })
    expect(c.transition).toBe('cut')
    expect(c.transition_s).toBe(5)
  })
})

describe('clipStatuses', () => {
  it('maps rows by id and ignores junk', () => {
    const m = clipStatuses(JSON.stringify([
      { id: 'a', url: '/u', cached: true },
      { id: '', url: '/x' },
      'junk',
    ]))
    expect(m.get('a')).toEqual({ url: '/u', cached: true })
    expect(m.size).toBe(1)
  })

  it('empty for null/garbage', () => {
    expect(clipStatuses(null).size).toBe(0)
    expect(clipStatuses('{').size).toBe(0)
  })
})

describe('useDirectorTimeline model ops', () => {
  it('restores from widget and exposes workflow options', () => {
    const node = fakeNode(serializeTimeline(
      [normalizeClip({ id: 'a', prompt: 'hello' })],
      { chain: 'prepend' }))
    const t = make(node)
    expect(t.clips.value).toHaveLength(1)
    expect(t.settings.value).toEqual({ chain: 'prepend' })
    expect(t.workflowOptions.value).toEqual(['WF A', 'WF B'])
  })

  it('setChainMode commits settings', () => {
    const node = fakeNode()
    const t = make(node)
    t.setChainMode('replace')
    expect(parseTimeline(widgetValue(node)).settings)
      .toEqual({ chain: 'replace' })
  })

  it('addClip selects and commits to the widget', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    expect(t.clips.value).toHaveLength(1)
    expect(t.selectedId.value).toBe(t.clips.value[0].id)
    expect(parseTimeline(widgetValue(node)).clips).toHaveLength(1)
  })

  it('removeClip clears selection and commits', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    const id = t.clips.value[0].id
    t.removeClip(id)
    expect(t.clips.value).toHaveLength(0)
    expect(t.selectedId.value).toBeNull()
    expect(parseTimeline(widgetValue(node)).clips).toHaveLength(0)
  })

  it('duplicateClip copies content but rerolls id and seed', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    const orig = t.clips.value[0]
    t.updateClip(orig.id, { prompt: 'zed', seed: 7 })
    t.duplicateClip(orig.id)
    expect(t.clips.value).toHaveLength(2)
    const copy = t.clips.value[1]
    expect(copy.prompt).toBe('zed')
    expect(copy.id).not.toBe(orig.id)
    expect(copy.seed).not.toBe(7)
  })

  it('updateClip clamps duration', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    t.updateClip(t.clips.value[0].id, { duration_s: 0 })
    expect(t.clips.value[0].duration_s).toBe(1)
  })

  it('rerollSeed changes the seed', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    t.updateClip(t.clips.value[0].id, { seed: 1 })
    t.rerollSeed(t.clips.value[0].id)
    expect(t.clips.value[0].seed).not.toBe(1)
  })

  it('rerollAllSeeds rerolls every clip and commits', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    t.addClip()
    t.updateClip(t.clips.value[0].id, { seed: 1 })
    t.updateClip(t.clips.value[1].id, { seed: 2 })
    t.rerollAllSeeds()
    expect(t.clips.value[0].seed).not.toBe(1)
    expect(t.clips.value[1].seed).not.toBe(2)
    const stored = parseTimeline(widgetValue(node)).clips
    expect(stored.map(c => c.seed)).toEqual(t.clips.value.map(c => c.seed))
  })

  it('addRef dedupes and removeRef removes', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    const id = t.clips.value[0].id
    t.addRef(id, 'images', '/a.png')
    t.addRef(id, 'images', '/a.png')
    t.addRef(id, 'videos', '/v.mp4')
    expect(t.clips.value[0].images).toEqual(['/a.png'])
    expect(t.clips.value[0].videos).toEqual(['/v.mp4'])
    t.removeRef(id, 'images', '/a.png')
    expect(t.clips.value[0].images).toEqual([])
  })

  it('totalSeconds counts only enabled clips', () => {
    const node = fakeNode(serializeTimeline([
      normalizeClip({ id: 'a', duration_s: 5 }),
      normalizeClip({ id: 'b', duration_s: 7, enabled: false }),
    ], { chain: 'off' }))
    const t = make(node)
    expect(t.totalSeconds.value).toBe(5)
  })

  it('statuses reflect state.directorClips', () => {
    const node = fakeNode(serializeTimeline([normalizeClip({ id: 'a' })],
      { chain: 'off' }))
    const state: any = { directorClips: JSON.stringify([{ id: 'a', url: '/u', cached: true }]) }
    const t = make(node, state)
    expect(t.statuses.value.get('a')?.cached).toBe(true)
  })

  it('updateClip and refs ops ignore unknown ids', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    t.updateClip('nope', { prompt: 'x' })
    t.addRef('nope', 'images', '/a.png')
    t.removeRef('nope', 'images', '/a.png')
    t.moveRefTo('nope', 'images', 0, 1)
    t.duplicateClip('nope')
    expect(t.clips.value).toHaveLength(1)
    expect(t.clips.value[0].prompt).toBe('')
  })

  it('moveRefTo reorders and rejects out-of-range or no-op moves', () => {
    const node = fakeNode()
    const t = make(node)
    t.addClip()
    const id = t.clips.value[0].id
    t.addRef(id, 'images', '/a')
    t.addRef(id, 'images', '/b')
    t.addRef(id, 'images', '/c')
    t.moveRefTo(id, 'images', 0, 2)
    expect(t.clips.value[0].images).toEqual(['/b', '/c', '/a'])
    t.moveRefTo(id, 'images', 5, 0)
    t.moveRefTo(id, 'images', 0, 5)
    t.moveRefTo(id, 'images', 1, 1)
    expect(t.clips.value[0].images).toEqual(['/b', '/c', '/a'])
  })

  it('workflowOptions is empty without a workflow widget', () => {
    const t = make({ widgets: [{ name: 'timeline_data', value: '' }] })
    expect(t.workflowOptions.value).toEqual([])
  })

  it('selectedClip and selectedIndex track the selection', () => {
    const t = make(twoClipNode())
    expect(t.selectedClip.value).toBeNull()
    expect(t.selectedIndex.value).toBe(-1)
    t.selectedId.value = 'b'
    expect(t.selectedClip.value?.id).toBe('b')
    expect(t.selectedIndex.value).toBe(1)
  })

  it('onConfigure re-restores state and clears a stale selection', () => {
    const node = twoClipNode()
    const orig = vi.fn()
    node.onConfigure = orig
    const t = make(node)
    t.selectedId.value = 'b'
    node.widgets[0].value = serializeTimeline(
      [normalizeClip({ id: 'a', duration_s: 5 })], { chain: 'replace' })
    node.onConfigure({ some: 'info' })
    expect(orig).toHaveBeenCalledWith({ some: 'info' })
    expect(t.clips.value.map(c => c.id)).toEqual(['a'])
    expect(t.settings.value.chain).toBe('replace')
    expect(t.selectedId.value).toBeNull()
  })
})

describe('useDirectorTimeline geometry', () => {
  it('clipWidthPx floors at the minimum width', () => {
    const t = make(fakeNode(serializeTimeline([
      normalizeClip({ id: 'a', duration_s: 1 }),
      normalizeClip({ id: 'b', duration_s: 10 }),
    ], { chain: 'off' })))
    expect(t.clipWidthPx(t.clips.value[0])).toBe(CLIP_MIN_W)
    expect(t.clipWidthPx(t.clips.value[1])).toBe(10 * PPS)
  })

  it('clipStyle stacks clips left to right with a 4px gap', () => {
    const t = make(twoClipNode())
    expect(t.clipStyle(0)).toEqual({ left: '0px', width: '70px' })
    expect(t.clipStyle(1)).toEqual({ left: '74px', width: '70px' })
  })

  it('trackWidthPx sums widths, gaps and tail padding', () => {
    const t = make(twoClipNode())
    expect(t.trackWidthPx.value).toBe((70 + 4) * 2 + 40)
  })
})

describe('useDirectorTimeline clip drag', () => {
  it('pointer down selects and arms an inactive drag', () => {
    const { t, root } = makeWithRoot(twoClipNode())
    t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0)
    expect(t.selectedId.value).toBe('a')
    expect(t.drag.value).toEqual({
      id: 'a', previewX: 0, baseX: 0, startX: 10, scale: 1, active: false,
    })
    expect((root as any).setPointerCapture).toHaveBeenCalled()
  })

  it('moves under the threshold stay inactive and keep base style', () => {
    const node = twoClipNode()
    const { t, root } = makeWithRoot(node)
    const before = widgetValue(node)
    t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0)
    root.dispatchEvent(pe('pointermove', 13))
    expect(t.drag.value?.active).toBe(false)
    expect(t.clipStyle(0).left).toBe('0px')
    root.dispatchEvent(pe('pointerup', 13))
    expect(t.drag.value).toBeNull()
    expect(widgetValue(node)).toBe(before)
    expect((root as any).releasePointerCapture).toHaveBeenCalled()
  })

  it('an active drag previews position, reorders past the midpoint and commits', () => {
    const node = twoClipNode()
    const { t, root } = makeWithRoot(node)
    t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0)
    root.dispatchEvent(pe('pointermove', 120))
    expect(t.drag.value?.active).toBe(true)
    expect(t.drag.value?.previewX).toBe(110)
    expect(t.clips.value.map(c => c.id)).toEqual(['b', 'a'])
    expect(t.clipStyle(1).left).toBe('110px')
    root.dispatchEvent(pe('pointerup', 120))
    expect(t.drag.value).toBeNull()
    expect(parseTimeline(widgetValue(node)).clips.map(c => c.id)).toEqual(['b', 'a'])
    root.dispatchEvent(pe('pointermove', 10))
    expect(t.clips.value.map(c => c.id)).toEqual(['b', 'a'])
  })

  it('keeps order when the center stays before the neighbor midpoint', () => {
    const { t, root } = makeWithRoot(twoClipNode())
    t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0)
    root.dispatchEvent(pe('pointermove', 2))
    expect(t.drag.value?.active).toBe(true)
    expect(t.clips.value.map(c => c.id)).toEqual(['a', 'b'])
  })

  it('divides pointer deltas by the canvas overlay scale', () => {
    const node = twoClipNode()
    const root = makeRoot()
    Object.defineProperty(root, 'offsetWidth', { value: 100 })
    root.getBoundingClientRect = () => ({ width: 200, left: 0 } as DOMRect)
    const t = useDirectorTimeline(node, {} as any, ref(root))
    t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0)
    expect(t.drag.value?.scale).toBe(2)
    root.dispatchEvent(pe('pointermove', 230))
    expect(t.drag.value?.active).toBe(true)
    expect(t.drag.value?.previewX).toBe(110)
  })

  it('pointercancel ends the drag without committing', () => {
    const node = twoClipNode()
    const { t, root } = makeWithRoot(node)
    const before = widgetValue(node)
    t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0)
    root.dispatchEvent(pe('pointercancel', 10))
    expect(t.drag.value).toBeNull()
    expect(widgetValue(node)).toBe(before)
  })

  it('drag of a clip removed mid-gesture is inert', () => {
    const { t, root } = makeWithRoot(twoClipNode())
    t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0)
    t.clips.value = t.clips.value.filter(c => c.id !== 'a')
    root.dispatchEvent(pe('pointermove', 120))
    expect(t.clips.value.map(c => c.id)).toEqual(['b'])
  })

  it('pointer down without a root element does not throw', () => {
    const t = make(twoClipNode())
    expect(() =>
      t.onClipPointerDown(pe('pointerdown', 10), t.clips.value[0], 0),
    ).not.toThrow()
    expect(t.selectedId.value).toBe('a')
  })
})

describe('useDirectorTimeline resize drag', () => {
  it('resizes by whole seconds at PPS pixels per second and commits', () => {
    const node = twoClipNode()
    const { t, root } = makeWithRoot(node)
    t.onResizePointerDown(pe('pointerdown', 100), t.clips.value[0])
    expect(t.selectedId.value).toBe('a')
    root.dispatchEvent(pe('pointermove', 100 + PPS * 3))
    expect(t.clips.value[0].duration_s).toBe(8)
    root.dispatchEvent(pe('pointerup', 100 + PPS * 3))
    expect(parseTimeline(widgetValue(node)).clips[0].duration_s).toBe(8)
    root.dispatchEvent(pe('pointermove', 100 + PPS * 50))
    expect(t.clips.value[0].duration_s).toBe(8)
  })

  it('clamps resize to the duration bounds', () => {
    const { t, root } = makeWithRoot(twoClipNode())
    t.onResizePointerDown(pe('pointerdown', 100), t.clips.value[0])
    root.dispatchEvent(pe('pointermove', 100 - PPS * 50))
    expect(t.clips.value[0].duration_s).toBe(DURATION_MIN_S)
    root.dispatchEvent(pe('pointermove', 100 + PPS * 500))
    expect(t.clips.value[0].duration_s).toBe(DURATION_MAX_S)
  })

  it('resize move ignores a vanished clip', () => {
    const { t, root } = makeWithRoot(twoClipNode())
    t.onResizePointerDown(pe('pointerdown', 100), t.clips.value[0])
    t.clips.value = t.clips.value.filter(c => c.id !== 'a')
    expect(() => root.dispatchEvent(pe('pointermove', 200))).not.toThrow()
  })
})

describe('mcp director sub-api', () => {
  function directorOf(node: any, state: any = {}) {
    make(node, state)
    return node.__comfytvStageApi.director
  }

  it('attaches getState with clips, statuses and vocabularies', () => {
    const node = twoClipNode()
    const state = {
      directorClips: JSON.stringify([{ id: 'a', url: '/view?a', cached: true }]),
    }
    const api = directorOf(node, state)
    const out = api.getState()
    expect(out.clips.map((c: any) => c.id)).toEqual(['a', 'b'])
    expect(out.clips[0].status).toEqual({ url: '/view?a', cached: true })
    expect(out.clips[1].status).toBeNull()
    expect(out.total_seconds).toBe(10)
    expect(out.default_workflow).toBe('WF A')
    expect(out.workflow_options).toEqual(['WF A', 'WF B'])
    expect(out.transitions).toContain('dissolve')
    expect(out.chain_modes).toEqual(['off', 'prepend', 'replace'])
  })

  it('add/update/move/remove clips through applyOps', async () => {
    const node = twoClipNode()
    const api = directorOf(node)
    const { results } = await api.applyOps([
      { op: 'add_clip', prompt: 'new scene', duration_s: 7, index: 1 },
      { op: 'update_clip', id: 'a', prompt: 'edited', transition: 'fade' },
      { op: 'move_clip', id: 'b', index: 0 },
    ])
    expect(results[0].op).toBe('add_clip')
    const parsed = parseTimeline(widgetValue(node))
    expect(parsed.clips.map(c => c.prompt)).toEqual(['', 'edited', 'new scene'])
    expect(parsed.clips.find(c => c.id === 'a')?.transition).toBe('fade')
    await api.applyOps([{ op: 'remove_clip', id: 'a' }])
    expect(parseTimeline(widgetValue(node)).clips.some(c => c.id === 'a')).toBe(false)
  })

  it('reroll changes seeds and set_chain persists', async () => {
    const node = twoClipNode()
    const api = directorOf(node)
    const before = parseTimeline(widgetValue(node)).clips.map(c => c.seed)
    await api.applyOps([{ op: 'reroll' }, { op: 'set_chain', chain: 'prepend' }])
    const parsed = parseTimeline(widgetValue(node))
    expect(parsed.clips.map(c => c.seed)).not.toEqual(before)
    expect(parsed.settings.chain).toBe('prepend')
  })

  it('validates transition, chain, refs and unknown ops', async () => {
    const api = directorOf(twoClipNode())
    await expect(api.applyOps([
      { op: 'update_clip', id: 'a', transition: 'explode' },
    ])).rejects.toThrow(/unknown transition/)
    await expect(api.applyOps([
      { op: 'set_chain', chain: 'always' },
    ])).rejects.toThrow(/unknown chain/)
    await expect(api.applyOps([
      { op: 'update_clip', id: 'a', images: 'not-a-list' },
    ])).rejects.toThrow(/array/)
    await expect(api.applyOps([{ op: 'explode' }])).rejects.toThrow(/unknown op/)
    await expect(api.applyOps([
      { op: 'update_clip', id: 'zz' },
    ])).rejects.toThrow(/not found/)
  })

  it('rejects edits while running', async () => {
    const api = directorOf(twoClipNode(), { running: true })
    await expect(api.applyOps([{ op: 'reroll' }])).rejects.toThrow(/running/)
  })
})
