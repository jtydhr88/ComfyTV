import { describe, expect, it } from 'vitest'
import {
  COLOR_GRADE_EFFECTS,
  defaultValues,
  getEffect,
} from '@/widgets/glsl/effects'

describe('color grade effect registry', () => {
  it('has unique effect ids', () => {
    const ids = COLOR_GRADE_EFFECTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const effect of COLOR_GRADE_EFFECTS) {
    describe(effect.id, () => {
      it('embeds a #version 300 es shader', () => {
        expect(effect.frag.startsWith('#version 300 es')).toBe(true)
      })

      it('has unique uniform keys', () => {
        const keys = effect.uniforms.map((u) => u.key)
        expect(new Set(keys).size).toBe(keys.length)
      })

      it('has unique uniform indices per kind', () => {
        for (const kind of ['float', 'int', 'bool', 'curve'] as const) {
          const idx = effect.uniforms.filter((u) => u.kind === kind).map((u) => u.index)
          expect(new Set(idx).size).toBe(idx.length)
        }
      })

      it('numeric defaults fall within declared range', () => {
        for (const u of effect.uniforms) {
          if (typeof u.default !== 'number') continue
          if (u.min !== undefined) expect(u.default).toBeGreaterThanOrEqual(u.min)
          if (u.max !== undefined) expect(u.default).toBeLessThanOrEqual(u.max)
        }
      })

      it('options-backed ints default to a listed option', () => {
        for (const u of effect.uniforms) {
          if (!u.options) continue
          expect(u.options.map((o) => o.value)).toContain(Number(u.default))
        }
      })

      it('defaultValues covers every uniform key', () => {
        const dv = defaultValues(effect)
        expect(Object.keys(dv).sort()).toEqual(effect.uniforms.map((u) => u.key).sort())
      })
    })
  }

  it('getEffect falls back to the first effect for unknown ids', () => {
    expect(getEffect('nope').id).toBe(COLOR_GRADE_EFFECTS[0].id)
    expect(getEffect(undefined).id).toBe(COLOR_GRADE_EFFECTS[0].id)
  })
})
