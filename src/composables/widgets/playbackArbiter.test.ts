import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CTV_MEDIA_ATTR,
  installPlaybackArbiter,
  uninstallPlaybackArbiter,
} from './playbackArbiter'

function makeVideo(opts: { nodeId?: string; marked?: boolean } = {}): HTMLVideoElement {
  const host = document.createElement('div')
  if (opts.nodeId) host.setAttribute('data-node-id', opts.nodeId)
  const v = document.createElement('video')
  if (opts.marked !== false) v.setAttribute(CTV_MEDIA_ATTR, '')
  Object.defineProperty(v, 'paused', { value: false, writable: true })
  ;(v as any).pause = function () { (this as any).paused = true }
  host.appendChild(v)
  document.body.appendChild(host)
  return v
}

function firePlay(v: HTMLVideoElement): void {
  v.dispatchEvent(new Event('play', { bubbles: false }))
}

describe('playbackArbiter', () => {
  beforeEach(() => {
    installPlaybackArbiter()
  })

  afterEach(() => {
    uninstallPlaybackArbiter()
    document.body.innerHTML = ''
  })

  it('pauses playing videos in other cards when one starts', () => {
    const a = makeVideo({ nodeId: '1' })
    const b = makeVideo({ nodeId: '2' })
    firePlay(a)
    expect(a.paused).toBe(false)
    expect(b.paused).toBe(true)
  })

  it('leaves videos of the same card group alone', () => {
    const host = document.createElement('div')
    host.setAttribute('data-node-id', '9')
    const mk = () => {
      const v = document.createElement('video')
      v.setAttribute(CTV_MEDIA_ATTR, '')
      Object.defineProperty(v, 'paused', { value: false, writable: true })
      ;(v as any).pause = function () { (this as any).paused = true }
      host.appendChild(v)
      return v
    }
    const a = mk()
    const b = mk()
    document.body.appendChild(host)
    firePlay(a)
    expect(b.paused).toBe(false)
  })

  it('never touches unmarked (core / other-plugin) videos', () => {
    const core = makeVideo({ nodeId: '3', marked: false })
    const ours = makeVideo({ nodeId: '4' })
    firePlay(ours)
    expect(core.paused).toBe(false)
  })

  it('unmarked videos do not trigger arbitration', () => {
    const core = makeVideo({ nodeId: '5', marked: false })
    const ours = makeVideo({ nodeId: '6' })
    firePlay(core)
    expect(ours.paused).toBe(false)
  })

  it('videos outside any card each form their own group', () => {
    const a = makeVideo({})
    const b = makeVideo({})
    firePlay(a)
    expect(b.paused).toBe(true)
  })

  it('a play event from an already-paused video does not fire back', () => {
    const a = makeVideo({ nodeId: 'p1' })
    const b = makeVideo({ nodeId: 'p2' })
    ;(a as any).paused = true
    firePlay(a)
    expect(b.paused).toBe(false)
  })

  it('uninstall stops arbitration', () => {
    const a = makeVideo({ nodeId: '7' })
    const b = makeVideo({ nodeId: '8' })
    uninstallPlaybackArbiter()
    firePlay(a)
    expect(b.paused).toBe(false)
  })
})
