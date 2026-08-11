import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

class FakeAudio {
  static instances: FakeAudio[] = []
  static rejectPlay = false
  src = ''
  paused = true
  handlers: Record<string, () => void> = {}
  play = vi.fn(() => {
    if (FakeAudio.rejectPlay) return Promise.reject(new Error('blocked'))
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => { this.paused = true })
  addEventListener(event: string, fn: () => void) { this.handlers[event] = fn }
  constructor() { FakeAudio.instances.push(this) }
}

async function freshPreview() {
  vi.resetModules()
  const mod = await import('./useAudioPreview')
  return mod.useAudioPreview()
}

beforeEach(() => {
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAudioPreview', () => {
  it('toggle starts playback and tracks the url', async () => {
    const p = await freshPreview()
    p.toggle('/view?filename=a.wav')
    const a = FakeAudio.instances[0]!
    expect(a.src).toBe('/view?filename=a.wav')
    expect(a.play).toHaveBeenCalledTimes(1)
    expect(p.playingUrl.value).toBe('/view?filename=a.wav')
  })

  it('toggling the same url pauses and clears', async () => {
    const p = await freshPreview()
    p.toggle('/view?filename=a.wav')
    p.toggle('/view?filename=a.wav')
    const a = FakeAudio.instances[0]!
    expect(a.pause).toHaveBeenCalledTimes(1)
    expect(p.playingUrl.value).toBeNull()
  })

  it('toggling another url switches the shared player', async () => {
    const p = await freshPreview()
    p.toggle('/view?filename=a.wav')
    p.toggle('/view?filename=b.wav')
    expect(FakeAudio.instances).toHaveLength(1)
    const a = FakeAudio.instances[0]!
    expect(a.src).toBe('/view?filename=b.wav')
    expect(a.play).toHaveBeenCalledTimes(2)
    expect(p.playingUrl.value).toBe('/view?filename=b.wav')
  })

  it('ended and error events clear the playing url', async () => {
    const p = await freshPreview()
    p.toggle('/view?filename=a.wav')
    const a = FakeAudio.instances[0]!
    a.handlers['ended']!()
    expect(p.playingUrl.value).toBeNull()
    p.toggle('/view?filename=a.wav')
    a.handlers['error']!()
    expect(p.playingUrl.value).toBeNull()
  })

  it('a rejected play() clears the url', async () => {
    const p = await freshPreview()
    FakeAudio.rejectPlay = true
    p.toggle('/view?filename=a.wav')
    await Promise.resolve()
    await Promise.resolve()
    expect(p.playingUrl.value).toBeNull()
    FakeAudio.rejectPlay = false
  })

  it('stop pauses and clears; empty url is a no-op', async () => {
    const p = await freshPreview()
    p.toggle('')
    expect(FakeAudio.instances).toHaveLength(0)
    p.toggle('/view?filename=a.wav')
    p.stop()
    expect(FakeAudio.instances[0]!.pause).toHaveBeenCalled()
    expect(p.playingUrl.value).toBeNull()
  })
})
