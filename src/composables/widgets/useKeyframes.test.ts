import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  parseKeys,
  roundTime,
  serializeKeys,
  useKeyframes,
  type TimedKey,
} from './useKeyframes'

interface DemoKey extends TimedKey {
  x: number
}

describe('parseKeys / serializeKeys', () => {
  it('parses a JSON array', () => {
    expect(parseKeys<DemoKey>('[{"t":1,"x":2}]')).toEqual([{ t: 1, x: 2 }])
  })

  it('returns [] for empty, invalid JSON, or non-arrays', () => {
    expect(parseKeys('')).toEqual([])
    expect(parseKeys('not json')).toEqual([])
    expect(parseKeys('{"t":1}')).toEqual([])
  })

  it('serializes sorted by t and empty list as empty string', () => {
    expect(serializeKeys<DemoKey>([{ t: 5, x: 1 }, { t: 1, x: 2 }]))
      .toBe('[{"t":1,"x":2},{"t":5,"x":1}]')
    expect(serializeKeys([])).toBe('')
  })

  it('does not mutate the input when sorting', () => {
    const keys: DemoKey[] = [{ t: 5, x: 1 }, { t: 1, x: 2 }]
    serializeKeys(keys)
    expect(keys[0].t).toBe(5)
  })
})

describe('roundTime', () => {
  it('rounds to centiseconds', () => {
    expect(roundTime(1.234567)).toBe(1.23)
    expect(roundTime(1.235)).toBe(1.24)
  })
})

describe('useKeyframes', () => {
  function setup(initial = '') {
    const raw = ref(initial)
    const applied: DemoKey[] = []
    const state = { x: 10 }
    const kf = useKeyframes<DemoKey>({
      raw,
      snapshot: (t) => ({ t, x: state.x }),
      apply: (k) => { applied.push(k) },
    })
    return { raw, kf, state, applied }
  }

  it('adds a snapshot key at rounded t and selects it', () => {
    const { kf, raw } = setup()
    kf.addAt(1.567)
    expect(kf.keys.value).toEqual([{ t: 1.57, x: 10 }])
    expect(kf.selected.value).toBe(0)
    expect(raw.value).toBe('[{"t":1.57,"x":10}]')
  })

  it('keeps keys sorted after adding earlier key', () => {
    const { kf } = setup()
    kf.addAt(5)
    kf.addAt(1)
    expect(kf.keys.value.map((k) => k.t)).toEqual([1, 5])
    expect(kf.selected.value).toBe(0)
  })

  it('moveAt changes t and ignores bad indices', () => {
    const { kf } = setup('[{"t":1,"x":1},{"t":2,"x":2}]')
    kf.moveAt(0, 3.005)
    expect(kf.keys.value.map((k) => k.t)).toEqual([2, 3.01])
    kf.moveAt(99, 4)
    expect(kf.keys.value).toHaveLength(2)
  })

  it('removeAt deletes the key and clears selection', () => {
    const { kf } = setup('[{"t":1,"x":1},{"t":2,"x":2}]')
    kf.select(1)
    kf.removeAt(1)
    expect(kf.keys.value).toEqual([{ t: 1, x: 1 }])
    expect(kf.selected.value).toBe(-1)
    kf.removeAt(-1)
    kf.removeAt(5)
    expect(kf.keys.value).toHaveLength(1)
  })

  it('select applies the key values via the callback', () => {
    const { kf, applied } = setup('[{"t":1,"x":42}]')
    kf.select(0)
    expect(kf.selected.value).toBe(0)
    expect(applied).toEqual([{ t: 1, x: 42 }])
    kf.select(7)
    expect(applied).toHaveLength(1)
  })

  it('updateSelected re-snapshots current values at the same t', () => {
    const { kf, state } = setup('[{"t":1,"x":1}]')
    kf.select(0)
    state.x = 99
    kf.updateSelected()
    expect(kf.keys.value).toEqual([{ t: 1, x: 99 }])
  })

  it('updateSelected is a no-op with no selection', () => {
    const { kf } = setup('[{"t":1,"x":1}]')
    kf.updateSelected()
    expect(kf.keys.value).toEqual([{ t: 1, x: 1 }])
  })

  it('clears the raw widget when the last key is removed', () => {
    const { kf, raw } = setup('[{"t":1,"x":1}]')
    kf.removeAt(0)
    expect(raw.value).toBe('')
  })
})

describe('useKeyframes options', () => {
  interface RichKey extends TimedKey {
    x: number
    interp: string
  }

  function setup(initial = '') {
    const raw = ref(initial)
    const state = { x: 10 }
    const kf = useKeyframes<RichKey>({
      raw,
      snapshot: (t) => ({ t, x: state.x, interp: 'smooth' }),
      update: (k) => ({ ...k, x: state.x }),
      followMove: true,
    })
    return { raw, kf, state }
  }

  it('followMove re-sorts and keeps selection on the moved key', () => {
    const { kf } = setup('[{"t":1,"x":1,"interp":"a"},{"t":5,"x":5,"interp":"b"}]')
    kf.select(0)
    kf.moveAt(0, 6)
    expect(kf.keys.value.map((k) => k.t)).toEqual([5, 6])
    expect(kf.selected.value).toBe(1)
    expect(kf.keys.value[1]).toEqual({ t: 6, x: 1, interp: 'a' })
  })

  it('followMove ignores out-of-range indices', () => {
    const { kf } = setup('[{"t":1,"x":1,"interp":"a"}]')
    kf.moveAt(4, 2)
    expect(kf.keys.value.map((k) => k.t)).toEqual([1])
  })

  it('update overrides updateSelected and preserves untouched fields', () => {
    const { kf, state } = setup('[{"t":1,"x":1,"interp":"linear"}]')
    kf.select(0)
    state.x = 99
    kf.updateSelected()
    expect(kf.keys.value).toEqual([{ t: 1, x: 99, interp: 'linear' }])
  })
})
