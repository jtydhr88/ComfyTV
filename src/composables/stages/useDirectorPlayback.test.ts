import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  buildSegments,
  pxToTime,
  rulerTicks,
  timeToPx,
  totalDurationS,
  useDirectorPlayback,
} from './useDirectorPlayback'
import {
  CLIP_GAP_PX,
  CLIP_MIN_W,
  PPS,
  normalizeClip,
  type DirectorClip,
  type DirectorClipStatus,
} from './useDirectorTimeline'

function clip(over: Partial<DirectorClip> = {}): DirectorClip {
  return { ...normalizeClip({ duration_s: 5 }), ...over }
}

function statusMap(entries: Record<string, string>): Map<string, DirectorClipStatus> {
  const m = new Map<string, DirectorClipStatus>()
  for (const [id, url] of Object.entries(entries)) m.set(id, { url, cached: true })
  return m
}

describe('buildSegments', () => {
  it('skips disabled clips in time but keeps their track pixels', () => {
    const clips = [
      clip({ id: 'a', duration_s: 5 }),
      clip({ id: 'b', duration_s: 5, enabled: false }),
      clip({ id: 'c', duration_s: 5 }),
    ]
    const segs = buildSegments(clips, statusMap({ c: '/view?c' }))
    expect(segs.map(s => s.id)).toEqual(['a', 'c'])
    expect(segs[0]).toMatchObject({ startS: 0, startPx: 0, widthPx: 5 * PPS })
    expect(segs[1].startS).toBe(5)
    expect(segs[1].startPx).toBe(2 * (5 * PPS + CLIP_GAP_PX))
    expect(segs[1].url).toBe('/view?c')
    expect(totalDurationS(segs)).toBe(10)
  })

  it('applies the minimum clip width', () => {
    const segs = buildSegments([clip({ id: 'a', duration_s: 1 })], new Map())
    expect(segs[0].widthPx).toBe(CLIP_MIN_W)
  })
})

describe('timeToPx / pxToTime', () => {
  const clips = [
    clip({ id: 'a', duration_s: 1 }),
    clip({ id: 'b', duration_s: 5, enabled: false }),
    clip({ id: 'c', duration_s: 10 }),
  ]
  const segs = buildSegments(clips, new Map())
  const cStartPx = CLIP_MIN_W + CLIP_GAP_PX + 5 * PPS + CLIP_GAP_PX

  it('maps piecewise across min-width stretched clips', () => {
    expect(timeToPx(segs, 0)).toBe(0)
    expect(timeToPx(segs, 0.5)).toBe(CLIP_MIN_W / 2)
    expect(timeToPx(segs, 1)).toBe(cStartPx)
    expect(timeToPx(segs, 6)).toBe(cStartPx + 5 * PPS)
    expect(timeToPx(segs, 11)).toBe(cStartPx + 10 * PPS)
    expect(timeToPx(segs, 99)).toBe(cStartPx + 10 * PPS)
  })

  it('inverts within segments and snaps over disabled gaps', () => {
    expect(pxToTime(segs, -5)).toBe(0)
    expect(pxToTime(segs, CLIP_MIN_W / 2)).toBe(0.5)
    expect(pxToTime(segs, CLIP_MIN_W + 10)).toBe(1)
    expect(pxToTime(segs, cStartPx + 5 * PPS)).toBe(6)
    expect(pxToTime(segs, 99999)).toBe(11)
  })

  it('handles empty timelines', () => {
    expect(timeToPx([], 3)).toBe(0)
    expect(pxToTime([], 3)).toBe(0)
    expect(totalDurationS([])).toBe(0)
  })
})

describe('rulerTicks', () => {
  it('emits labeled majors at segment starts and the end', () => {
    const segs = buildSegments(
      [clip({ id: 'a', duration_s: 5 }), clip({ id: 'b', duration_s: 3 })],
      new Map(),
    )
    const ticks = rulerTicks(segs)
    const majors = ticks.filter(t => t.major)
    expect(majors.map(t => t.label)).toEqual(['0s', '5s', '8s'])
    expect(ticks.filter(t => !t.major)).toHaveLength(4 + 2)
  })

  it('thins minor ticks on long clips', () => {
    const segs = buildSegments([clip({ id: 'a', duration_s: 120 })], new Map())
    const minors = rulerTicks(segs).filter(t => !t.major)
    expect(minors.length).toBeLessThanOrEqual(30)
    expect(minors.length).toBeGreaterThan(0)
  })
})

function fakeVideo() {
  return {
    currentTime: 0,
    duration: NaN,
    play: vi.fn(),
    pause: vi.fn(),
  }
}

function setup(clipList: DirectorClip[], statuses: Map<string, DirectorClipStatus>, film = '') {
  const el = fakeVideo()
  const pb = useDirectorPlayback({
    clips: ref(clipList),
    statuses: () => statuses,
    filmUrl: () => film,
    video: () => el as unknown as HTMLVideoElement,
  })
  return { pb, el }
}

describe('useDirectorPlayback film mode', () => {
  const clips = [clip({ id: 'a', duration_s: 5 }), clip({ id: 'b', duration_s: 5 })]

  it('maps video time proportionally onto the planned timeline', () => {
    const { pb, el } = setup(clips, new Map(), '/view?film')
    expect(pb.mode.value).toBe('film')
    expect(pb.canPlay.value).toBe(true)
    el.duration = 8
    el.currentTime = 2
    pb.onTimeUpdate()
    expect(pb.playheadS.value).toBeCloseTo(2.5)
  })

  it('seeks proportionally and defers until metadata is known', () => {
    const { pb, el } = setup(clips, new Map(), '/view?film')
    pb.seekTo(5)
    expect(pb.active.value).toBe(true)
    expect(pb.playheadS.value).toBe(5)
    expect(el.currentTime).toBe(0)
    el.duration = 8
    pb.onLoadedMetadata()
    expect(el.currentTime).toBeCloseTo(4)
  })

  it('corrects ruler clicks for the canvas overlay scale', () => {
    const { pb } = setup(clips, new Map(), '/view?film')
    const host = document.createElement('div')
    ;(host as any).setPointerCapture = vi.fn()
    Object.defineProperty(host, 'offsetWidth', { value: 144 })
    host.getBoundingClientRect = () => ({ width: 288, left: 0 } as DOMRect)
    pb.onRulerPointerDown({
      currentTarget: host, clientX: 140, pointerId: 1,
    } as unknown as PointerEvent)
    expect(pb.playheadS.value).toBe(5)
  })

  it('restarts from the beginning when playing at the end', () => {
    const { pb, el } = setup(clips, new Map(), '/view?film')
    el.duration = 8
    pb.seekTo(10)
    pb.play()
    expect(pb.playheadS.value).toBe(0)
    expect(el.play).toHaveBeenCalled()
  })
})

describe('useDirectorPlayback clips mode', () => {
  const clips = [
    clip({ id: 'a', duration_s: 5 }),
    clip({ id: 'b', duration_s: 3, enabled: false }),
    clip({ id: 'c', duration_s: 4 }),
    clip({ id: 'd', duration_s: 2 }),
  ]
  const statuses = statusMap({ a: '/view?a', d: '/view?d' })

  it('plays generated clips in order and jumps over unplayable ones', async () => {
    const { pb } = setup(clips, statuses)
    expect(pb.mode.value).toBe('clips')
    pb.open()
    expect(pb.currentSrc.value).toBe('/view?a')
    pb.onEnded()
    await nextTick()
    expect(pb.currentSrc.value).toBe('/view?d')
    expect(pb.playheadS.value).toBe(9)
    pb.onEnded()
    expect(pb.playheadS.value).toBe(11)
  })

  it('tracks the playhead through actual clip duration', () => {
    const { pb, el } = setup(clips, statuses)
    pb.open()
    el.duration = 6
    el.currentTime = 3
    pb.onTimeUpdate()
    expect(pb.playheadS.value).toBeCloseTo(2.5)
  })

  it('seeking into a clip without a result snaps to the next playable clip', () => {
    const { pb } = setup(clips, statuses)
    pb.seekTo(6)
    expect(pb.currentSrc.value).toBe('/view?d')
    expect(pb.playheadS.value).toBe(9)
  })

  it('seeking inside a playable clip loads it at the right fraction', () => {
    const { pb, el } = setup(clips, statuses)
    pb.seekTo(10)
    expect(pb.currentSrc.value).toBe('/view?d')
    el.duration = 4
    pb.onLoadedMetadata()
    expect(el.currentTime).toBeCloseTo(2)
  })

  it('cannot play with no film and no generated clips', () => {
    const { pb } = setup(clips, new Map())
    expect(pb.canPlay.value).toBe(false)
    pb.open()
    expect(pb.active.value).toBe(false)
  })

  it('close resets playback state', () => {
    const { pb, el } = setup(clips, statuses)
    pb.seekTo(1)
    pb.close()
    expect(pb.active.value).toBe(false)
    expect(pb.playheadS.value).toBe(0)
    expect(el.pause).toHaveBeenCalled()
  })
})
