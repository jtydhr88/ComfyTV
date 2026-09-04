import { beforeAll, describe, expect, it } from 'vitest'

import { registerBuiltinKinds, type LayerFxData } from './engine'
import { fxToPsdEffects, psdEffectsToFx } from './psdEffects'

beforeAll(() => registerBuiltinKinds())

function fx(op: LayerFxData['op'], params: Record<string, number>, enabled = true): LayerFxData {
  return { id: 't', op, params, enabled, opacity: 1 }
}

describe('fx -> PSD -> fx roundtrip', () => {
  it('stroke keeps size, position, opacity and color', () => {
    const eff = fxToPsdEffects([fx('stroke', { size: 6, position: 2, strokeOpacity: 0.8, color: 0x336699 })])!
    expect(eff.stroke![0].position).toBe('center')
    expect(eff.stroke![0].size).toEqual({ units: 'Pixels', value: 6 })
    const back = psdEffectsToFx(eff)!
    expect(back).toHaveLength(1)
    expect(back[0].op).toBe('stroke')
    expect(back[0].params.size).toBe(6)
    expect(back[0].params.position).toBe(2)
    expect(back[0].params.strokeOpacity).toBeCloseTo(0.8)
    expect(back[0].params.color).toBe(0x336699)
  })

  it('drop shadow converts offset to PS angle/distance and back', () => {
    const eff = fxToPsdEffects([fx('drop-shadow', { x: 8, y: 8, stdDev: 5, shadowOpacity: 0.5, color: 0x000000 })])!
    const back = psdEffectsToFx(eff)!
    expect(back[0].op).toBe('drop-shadow')
    expect(back[0].params.x).toBeCloseTo(8, 0)
    expect(back[0].params.y).toBeCloseTo(8, 0)
    expect(back[0].params.stdDev).toBe(5)
  })

  it('inner shadow, glows, overlay and bevel all survive', () => {
    const eff = fxToPsdEffects([
      fx('inner-shadow', { x: -4, y: 6, size: 10, shadowOpacity: 0.7, color: 0x112233 }),
      fx('outer-glow', { size: 20, glowOpacity: 0.9, color: 0xffcc00 }),
      fx('inner-glow', { size: 14, glowOpacity: 0.4, color: 0x00ccff }),
      fx('color-overlay', { overlayOpacity: 0.65, color: 0xabcdef }),
      fx('bevel', { size: 9, depth: 0.75, angle: 45 }),
    ])!
    const back = psdEffectsToFx(eff)!
    const ops = back.map((f) => f.op)
    expect(ops).toEqual(['inner-shadow', 'outer-glow', 'inner-glow', 'color-overlay', 'bevel'])
    const byOp = Object.fromEntries(back.map((f) => [f.op, f.params]))
    expect(byOp['inner-shadow'].x).toBeCloseTo(-4, 0)
    expect(byOp['inner-shadow'].y).toBeCloseTo(6, 0)
    expect(byOp['outer-glow'].size).toBe(20)
    expect(byOp['outer-glow'].color).toBe(0xffcc00)
    expect(byOp['inner-glow'].glowOpacity).toBeCloseTo(0.4)
    expect(byOp['color-overlay'].overlayOpacity).toBeCloseTo(0.65)
    expect(byOp['color-overlay'].color).toBe(0xabcdef)
    expect(byOp.bevel.size).toBe(9)
    expect(byOp.bevel.depth).toBeCloseTo(0.75)
    expect(byOp.bevel.angle).toBe(45)
  })

  it('disabled effects keep their enabled flag', () => {
    const eff = fxToPsdEffects([fx('stroke', { size: 3, position: 0, strokeOpacity: 1, color: 0 }, false)])!
    expect(eff.stroke![0].enabled).toBe(false)
    const back = psdEffectsToFx(eff)!
    expect(back[0].enabled).toBe(false)
  })

  it('non-style fx (blur etc.) export no effects', () => {
    expect(fxToPsdEffects([fx('gaussian-blur', { stdDev: 4 })])).toBeUndefined()
    expect(psdEffectsToFx(undefined)).toBeUndefined()
  })
})

describe('clip flag round-trips node kinds', () => {
  it('rasterKind carries clip through create / normalize / serialize', async () => {
    const { rasterKind } = await import('./engine')
    const node = rasterKind.create({ clip: true, contentId: 'x' })
    expect(node.clip).toBe(true)
    expect((rasterKind.serialize(node) as { clip?: boolean }).clip).toBe(true)
    const back = rasterKind.normalize({ kind: 'raster', clip: true, contentId: 'x' })
    expect(back.clip).toBe(true)
    const off = rasterKind.normalize({ kind: 'raster', contentId: 'x' })
    expect(off.clip).toBeUndefined()
  })
})
