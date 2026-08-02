import type { LayerEffectsInfo } from 'ag-psd'

import { createLayerFx, defaultFxParams, type LayerFxData } from './engine'

/**
 * Pentrado layer fx ↔ ag-psd LayerEffectsInfo. PSD effects live in fixed
 * slots, so ordering beyond the PS compositing order is not preserved.
 */

type PsdColor = { r: number; g: number; b: number }

function packColor(c: unknown): number {
  const col = (c ?? {}) as Partial<PsdColor>
  const r = Math.round(col.r ?? 0)
  const g = Math.round(col.g ?? 0)
  const b = Math.round(col.b ?? 0)
  return (r << 16) | (g << 8) | b
}

function toColor(v: number): PsdColor {
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

function px(value: number): { units: 'Pixels'; value: number } {
  return { units: 'Pixels', value }
}

function pxValue(v: unknown, fallback: number): number {
  const u = v as { value?: number } | undefined
  return typeof u?.value === 'number' && isFinite(u.value) ? u.value : fallback
}

/** PS shadow offset: distance along (angle + 180°), y-down. */
function offsetFromAngle(angleDeg: number, distance: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180
  return { x: Math.round(-Math.cos(a) * distance), y: Math.round(Math.sin(a) * distance) }
}

function angleFromOffset(x: number, y: number): { angle: number; distance: number } {
  const distance = Math.round(Math.hypot(x, y))
  let angle = Math.round((Math.atan2(y, -x) * 180) / Math.PI)
  if (angle < 0) angle += 360
  return { angle, distance }
}

const STROKE_POSITIONS = ['outside', 'inside', 'center'] as const

export function fxToPsdEffects(fx: LayerFxData[] | undefined): LayerEffectsInfo | undefined {
  if (!fx?.length) return undefined
  const out: LayerEffectsInfo = {}
  let any = false
  for (const f of fx) {
    const p = f.params
    const base = { present: true, enabled: f.enabled }
    switch (f.op) {
      case 'drop-shadow': {
        const { angle, distance } = angleFromOffset(p.x ?? 0, p.y ?? 0)
        out.dropShadow = [{
          ...base, angle, distance: px(distance), size: px(p.stdDev ?? 0),
          opacity: (p.shadowOpacity ?? 0.6) * f.opacity, color: toColor(p.color ?? 0),
        }]
        any = true
        break
      }
      case 'inner-shadow': {
        const { angle, distance } = angleFromOffset(p.x ?? 0, p.y ?? 0)
        out.innerShadow = [{
          ...base, angle, distance: px(distance), size: px(p.size ?? 8),
          opacity: (p.shadowOpacity ?? 0.6) * f.opacity, color: toColor(p.color ?? 0),
        }]
        any = true
        break
      }
      case 'outer-glow':
        out.outerGlow = {
          ...base, size: px(p.size ?? 12),
          opacity: (p.glowOpacity ?? 0.75) * f.opacity, color: toColor(p.color ?? 0xffe680),
        }
        any = true
        break
      case 'inner-glow':
        out.innerGlow = {
          ...base, size: px(p.size ?? 12),
          opacity: (p.glowOpacity ?? 0.75) * f.opacity, color: toColor(p.color ?? 0xffe680),
        }
        any = true
        break
      case 'stroke':
        out.stroke = [{
          ...base, size: px(p.size ?? 4),
          position: STROKE_POSITIONS[Math.round(p.position ?? 0)] ?? 'outside',
          fillType: 'color',
          opacity: (p.strokeOpacity ?? 1) * f.opacity, color: toColor(p.color ?? 0),
        }]
        any = true
        break
      case 'color-overlay':
        out.solidFill = [{
          ...base, opacity: (p.overlayOpacity ?? 1) * f.opacity, color: toColor(p.color ?? 0),
        }]
        any = true
        break
      case 'bevel':
        out.bevel = {
          ...base, size: px(p.size ?? 6), angle: p.angle ?? 120,
          strength: Math.round((p.depth ?? 0.5) * 200), style: 'inner bevel',
        }
        any = true
        break
      default:
        break
    }
  }
  return any ? out : undefined
}

function makeFx(
  op: LayerFxData['op'],
  enabled: boolean | undefined,
  params: Record<string, number>
): LayerFxData {
  const f = createLayerFx(op)
  f.enabled = enabled !== false
  f.params = { ...defaultFxParams(op), ...params }
  return f
}

export function psdEffectsToFx(effects: LayerEffectsInfo | undefined): LayerFxData[] | undefined {
  if (!effects || effects.disabled) return undefined
  const out: LayerFxData[] = []

  const ds = effects.dropShadow?.[0]
  if (ds?.present !== false && ds) {
    const { x, y } = offsetFromAngle(ds.angle ?? 120, pxValue(ds.distance, 5))
    out.push(makeFx('drop-shadow', ds.enabled, {
      x, y, stdDev: pxValue(ds.size, 5), shadowOpacity: ds.opacity ?? 0.6, color: packColor(ds.color),
    }))
  }
  const is = effects.innerShadow?.[0]
  if (is) {
    const { x, y } = offsetFromAngle(is.angle ?? 120, pxValue(is.distance, 5))
    out.push(makeFx('inner-shadow', is.enabled, {
      x, y, size: pxValue(is.size, 8), shadowOpacity: is.opacity ?? 0.6, color: packColor(is.color),
    }))
  }
  const og = effects.outerGlow
  if (og) {
    out.push(makeFx('outer-glow', og.enabled, {
      size: pxValue(og.size, 12), glowOpacity: og.opacity ?? 0.75, color: packColor(og.color),
    }))
  }
  const ig = effects.innerGlow
  if (ig) {
    out.push(makeFx('inner-glow', ig.enabled, {
      size: pxValue(ig.size, 12), glowOpacity: ig.opacity ?? 0.75, color: packColor(ig.color),
    }))
  }
  const st = effects.stroke?.[0]
  if (st) {
    out.push(makeFx('stroke', st.enabled, {
      size: pxValue(st.size, 4),
      position: Math.max(0, STROKE_POSITIONS.indexOf(st.position ?? 'outside')),
      strokeOpacity: st.opacity ?? 1,
      color: packColor(st.color),
    }))
  }
  const sf = effects.solidFill?.[0]
  if (sf) {
    out.push(makeFx('color-overlay', sf.enabled, {
      overlayOpacity: sf.opacity ?? 1, color: packColor(sf.color),
    }))
  }
  const bv = effects.bevel
  if (bv) {
    out.push(makeFx('bevel', bv.enabled, {
      size: pxValue(bv.size, 6),
      depth: Math.max(0, Math.min(1, (bv.strength ?? 100) / 200)),
      angle: bv.angle ?? 120,
    }))
  }
  return out.length ? out : undefined
}
