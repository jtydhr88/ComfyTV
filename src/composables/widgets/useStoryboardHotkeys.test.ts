import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { StoryboardEditorController } from '@/composables/widgets/useStoryboardEditor'
import { useStoryboardHotkeys } from './useStoryboardHotkeys'

function makeSb(overrides: Record<string, unknown> = {}) {
  return {
    boards: ref([{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }]),
    currentIndex: ref(1),
    currentBoard: ref({ uid: 'b' }),
    playing: ref(false),
    onionPrev: ref(false),
    onionNext: ref(false),
    captions: ref(false),
    selectBoard: vi.fn(),
    addBoard: vi.fn(),
    duplicateBoard: vi.fn(),
    play: vi.fn(),
    stopPlayback: vi.fn(),
    toggleNewShot: vi.fn(),
    flipBoard: vi.fn(),
    ...overrides,
  }
}

function setup(overrides: Record<string, unknown> = {}) {
  const sb = makeSb(overrides)
  const next = { onKeyDown: vi.fn(), onKeyUp: vi.fn() }
  const hot = useStoryboardHotkeys(sb as unknown as StoryboardEditorController, next)
  return { sb, next, hot }
}

function kd(code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, cancelable: true, ...init })
}

describe('useStoryboardHotkeys navigation', () => {
  it('comma selects the previous board and consumes the event', () => {
    const { sb, next, hot } = setup()
    const e = kd('Comma')
    hot.onKeyDown(e)
    expect(sb.selectBoard).toHaveBeenCalledWith('a')
    expect(e.defaultPrevented).toBe(true)
    expect(next.onKeyDown).not.toHaveBeenCalled()
  })

  it('period selects the next board', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('Period'))
    expect(sb.selectBoard).toHaveBeenCalledWith('c')
  })

  it('navigation clamps at the ends without selecting', () => {
    const first = setup({ currentIndex: ref(0), currentBoard: ref({ uid: 'a' }) })
    first.hot.onKeyDown(kd('Comma'))
    expect(first.sb.selectBoard).not.toHaveBeenCalled()
    const last = setup({ currentIndex: ref(2), currentBoard: ref({ uid: 'c' }) })
    last.hot.onKeyDown(kd('Period'))
    expect(last.sb.selectBoard).not.toHaveBeenCalled()
    expect(last.next.onKeyDown).not.toHaveBeenCalled()
  })
})

describe('useStoryboardHotkeys board actions', () => {
  it('N adds a board', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('KeyN'))
    expect(sb.addBoard).toHaveBeenCalledTimes(1)
  })

  it('D duplicates the current board', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('KeyD'))
    expect(sb.duplicateBoard).toHaveBeenCalledWith('b')
  })

  it('P toggles playback', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('KeyP'))
    expect(sb.play).toHaveBeenCalledTimes(1)
    sb.playing.value = true
    hot.onKeyDown(kd('KeyP'))
    expect(sb.stopPlayback).toHaveBeenCalledTimes(1)
  })

  it('O toggles onion prev and Shift+O onion next', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('KeyO'))
    expect(sb.onionPrev.value).toBe(true)
    expect(sb.onionNext.value).toBe(false)
    hot.onKeyDown(kd('KeyO', { shiftKey: true }))
    expect(sb.onionNext.value).toBe(true)
  })

  it('C toggles captions', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('KeyC'))
    expect(sb.captions.value).toBe(true)
    hot.onKeyDown(kd('KeyC'))
    expect(sb.captions.value).toBe(false)
  })

  it('slash toggles new-shot on the current board', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('Slash'))
    expect(sb.toggleNewShot).toHaveBeenCalledWith('b')
  })

  it('Shift+H and Shift+V flip the board', () => {
    const { sb, hot } = setup()
    hot.onKeyDown(kd('KeyH', { shiftKey: true }))
    expect(sb.flipBoard).toHaveBeenCalledWith('h')
    hot.onKeyDown(kd('KeyV', { shiftKey: true }))
    expect(sb.flipBoard).toHaveBeenCalledWith('v')
  })

  it('plain H and V fall through to the next handler', () => {
    const { sb, next, hot } = setup()
    const e = kd('KeyH')
    hot.onKeyDown(e)
    hot.onKeyDown(kd('KeyV'))
    expect(sb.flipBoard).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
    expect(next.onKeyDown).toHaveBeenCalledTimes(2)
  })

  it('escape stops playback only while playing', () => {
    const { sb, next, hot } = setup({ playing: ref(true) })
    hot.onKeyDown(kd('Escape'))
    expect(sb.stopPlayback).toHaveBeenCalledTimes(1)
    expect(next.onKeyDown).not.toHaveBeenCalled()
    const idle = setup()
    idle.hot.onKeyDown(kd('Escape'))
    expect(idle.sb.stopPlayback).not.toHaveBeenCalled()
    expect(idle.next.onKeyDown).toHaveBeenCalledTimes(1)
  })
})

describe('useStoryboardHotkeys pass-through', () => {
  it('modifier combos are forwarded untouched', () => {
    const { sb, next, hot } = setup()
    hot.onKeyDown(kd('KeyN', { ctrlKey: true }))
    hot.onKeyDown(kd('KeyN', { metaKey: true }))
    hot.onKeyDown(kd('KeyN', { altKey: true }))
    expect(sb.addBoard).not.toHaveBeenCalled()
    expect(next.onKeyDown).toHaveBeenCalledTimes(3)
  })

  it('keys typed into a text input are forwarded', () => {
    const { sb, next, hot } = setup()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.addEventListener('keydown', e => hot.onKeyDown(e))
    input.dispatchEvent(kd('KeyN'))
    expect(sb.addBoard).not.toHaveBeenCalled()
    expect(next.onKeyDown).toHaveBeenCalledTimes(1)
    input.remove()
  })

  it('unhandled codes reach the next handler', () => {
    const { next, hot } = setup()
    hot.onKeyDown(kd('KeyZ'))
    expect(next.onKeyDown).toHaveBeenCalledTimes(1)
  })

  it('onKeyUp always forwards', () => {
    const { next, hot } = setup()
    const e = new KeyboardEvent('keyup', { code: 'KeyN' })
    hot.onKeyUp(e)
    expect(next.onKeyUp).toHaveBeenCalledWith(e)
  })
})
