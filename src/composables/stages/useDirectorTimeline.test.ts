import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import {
  clipStatuses,
  normalizeClip,
  parseTimeline,
  serializeTimeline,
  useDirectorTimeline,
  DURATION_MAX_S,
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
})
