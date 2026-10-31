import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  cmapCoverage,
  cueTextAt,
  hasTimeTokens,
  opszDefault,
  placeBlock,
  resolveTokens,
  titleTextAt,
  typewriterSlice,
  wrapText,
} from './textOverlayLayout'

const title = (over: Partial<Parameters<typeof titleTextAt>[0]> = {}) => ({
  text: 'Hello world', tStart: 0, tEnd: -1, fadeS: 0, typewriter: 'off', typeStep: 0.1, ...over,
})

describe('wrapText', () => {
  const cells = (text: string) =>
    Array.from(text).reduce((n, c) => n + (c.codePointAt(0)! > 0x2E7F ? 2 : 1), 0)

  // Same cases as tests/test_text_wrap.py: preview and render must break alike.
  it.each([
    ['fits unchanged', '短句', 10, '短句'],
    ['explicit breaks kept', '一二\n三四', 10, '一二\n三四'],
    ['blank line kept', '一二\n\n三四', 10, '一二\n\n三四'],
    ['cjk breaks between characters, bottom heavy', '一二三四五六七', 10, '一二三\n四五六七'],
    ['latin breaks between words', 'aaa bbb ccc ddd', 8, 'aaa bbb\nccc ddd'],
    ['balances instead of filling', 'aa bb cc dd ee', 10, 'aa bb\ncc dd ee'],
    ['closing punctuation stays on the line', '一二三四，五六七八', 10, '一二三四，\n五六七八'],
    ['opening punctuation stays with its word', '一二三四《五六七》', 10, '一二三四\n《五六七》'],
    ['mixed scripts', '中文 mixed 文字 text', 12, '中文 mixed\n文字 text'],
    ['long word splits by character', 'abcdefghijkl', 5, 'abcd\nefgh\nijkl'],
    ['three lines keep the short one on top', '一二三四五六七八九十一二', 8, '一二三四\n五六七八\n九十一二'],
    ['trailing spaces dropped when broken', 'aaaa   bbbb', 5, 'aaaa\nbbbb'],
  ])('%s', (_name, text, width, expected) => {
    expect(wrapText(text, cells, width)).toBe(expected)
  })

  it('still terminates when one character is wider than the frame', () => {
    expect(wrapText('一二', cells, 1)).toBe('一\n二')
  })

  it('wraps a title before the typewriter slices it, so words never jump lines', () => {
    const wrap = (s: string) => wrapText(s, cells, 8)
    const at = (t: number) => titleTextAt(
      title({ text: 'aaa bbb ccc ddd', typewriter: 'char', typeStep: 1 }), t, 24, wrap)?.text
    expect(at(5)).toBe('aaa b')
    expect(at(9)).toBe('aaa bbb\nc')
  })

  it('wraps subtitle cues', () => {
    const cues = [{ start: 0, end: 1, text: '一二三四五六七' }] as Parameters<typeof cueTextAt>[0]
    expect(cueTextAt(cues, 0.5, (s) => wrapText(s, cells, 10))?.text).toBe('一二三\n四五六七')
  })
})

describe('placeBlock', () => {
  it('honors a custom vertical margin as a fraction of the frame height', () => {
    expect(placeBlock('bottom', 1280, 704, 200, 50, 0.2)).toEqual([540, 514])
    expect(placeBlock('top', 1280, 704, 200, 50, 0)).toEqual([540, 0])
  })

  it('keeps a 5% margin like the burn-in renderer', () => {
    expect(placeBlock('bottom', 1280, 704, 200, 50)).toEqual([540, 619])
    expect(placeBlock('top-left', 1280, 704, 200, 50)).toEqual([64, 35])
    expect(placeBlock('bottom-right', 1280, 704, 200, 50)).toEqual([1016, 619])
    expect(placeBlock('center', 1280, 704, 200, 50)).toEqual([540, 327])
  })
})

describe('resolveTokens', () => {
  it('formats frame and timecode tokens', () => {
    expect(resolveTokens('#frame#', 2.5, 24)).toBe('60')
    expect(resolveTokens('#timecode#', 3725.5, 24)).toBe('01:02:05:12')
    expect(resolveTokens('at #shorttimecode#', 65, 30)).toBe('at 01:05')
    expect(hasTimeTokens('at #frame#')).toBe(true)
    expect(hasTimeTokens('plain')).toBe(false)
  })
})

describe('typewriterSlice', () => {
  it('reveals chars, words and lines step by step', () => {
    expect(typewriterSlice('标题ab', 0.25, 0, 'char', 0.1)).toBe('标题')
    expect(typewriterSlice('one two  three', 0.2, 0, 'word', 0.1)).toBe('one two  ')
    expect(typewriterSlice('a\nb\nc', 0.2, 0, 'line', 0.1)).toBe('a\nb')
    expect(typewriterSlice('abc', 5, 0, 'off', 0.1)).toBe('abc')
  })
})

describe('titleTextAt', () => {
  it('shows the title only inside its window and fades the edges', () => {
    expect(titleTextAt(title({ tStart: 1 }), 0.5, 24)).toBeNull()
    expect(titleTextAt(title({ tEnd: 2 }), 2.5, 24)).toBeNull()
    expect(titleTextAt(title({ tStart: 1, tEnd: 5, fadeS: 2 }), 2, 24)?.opacity).toBe(0.5)
    expect(titleTextAt(title({ tStart: 1, tEnd: 5, fadeS: 2 }), 4.5, 24)?.opacity).toBe(0.25)
    expect(titleTextAt(title(), 99, 24)).toEqual({ text: 'Hello world', opacity: 1 })
  })

  it('hides the title while the typewriter has nothing to show', () => {
    expect(titleTextAt(title({ typewriter: 'char' }), 0.05, 24)).toBeNull()
    expect(titleTextAt(title({ text: '   ' }), 1, 24)).toBeNull()
  })
})

describe('opszDefault', () => {
  const font = (name: string) => {
    const b = readFileSync(`assets/fonts/${name}`)
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  }

  it('reads the default optical size of a variable font', () => {
    expect(opszDefault(font('Inter-Regular.ttf'))).toBe(14)
    expect(opszDefault(font('NotoSansSC-Regular.ttf'))).toBeNull()
  })

  it('reads which characters a font covers', () => {
    const inter = cmapCoverage(font('Inter-Regular.ttf'))
    const noto = cmapCoverage(font('NotoSansSC-Regular.ttf'))
    expect(inter.has('A'.codePointAt(0)!)).toBe(true)
    expect(inter.has('标'.codePointAt(0)!)).toBe(false)
    expect(noto.has('标'.codePointAt(0)!)).toBe(true)
  })
})

describe('cueTextAt', () => {
  it('picks the active cue and strips tags', () => {
    const cues = [
      { start: 0, end: 2, text: '<i>first</i>' },
      { start: 3, end: 5, text: 'second' },
    ]
    expect(cueTextAt(cues, 1)?.text).toBe('first')
    expect(cueTextAt(cues, 2.5)).toBeNull()
    expect(cueTextAt(cues, 5)?.text).toBe('second')
  })
})
