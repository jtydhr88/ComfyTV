import type { Cue } from '@/composables/stages/useSubtitleCues'

export interface OverlayText {
  text: string
  opacity: number
}

export interface TitleTiming {
  text: string
  tStart: number
  tEnd: number
  fadeS: number
  typewriter: string
  typeStep: number
}

const TOKEN_RE = /#(timecode|frame|shorttimecode)#/g

export function hasTimeTokens(text: string): boolean {
  return text.search(TOKEN_RE) >= 0
}

export function placeBlock(
  anchor: string, fw: number, fh: number, tw: number, th: number, margin = 0.05,
): [number, number] {
  const mx = Math.floor(fw * margin)
  const my = Math.floor(fh * margin)
  const ax = ['top', 'center', 'bottom'].includes(anchor)
    ? 'center'
    : anchor.includes('left') ? 'left' : 'right'
  const ay = anchor.includes('top') ? 'top' : anchor.includes('bottom') ? 'bottom' : 'middle'
  const x = ax === 'left' ? mx : ax === 'right' ? fw - tw - mx : Math.floor((fw - tw) / 2)
  const y = ay === 'top' ? my : ay === 'bottom' ? fh - th - my : Math.floor((fh - th) / 2)
  return [x, y]
}

const NO_LINE_START = new Set('，。、；：！？）》」』】〉〕］｝”’…—～%,.;:!?)]}')
const NO_LINE_END = new Set('（《「『【〈〔［｛“‘([{')

export type WrapText = (text: string) => string

function isCjk(ch: string): boolean {
  const code = ch.codePointAt(0)!
  return (code >= 0x2E80 && code <= 0x9FFF) || (code >= 0xF900 && code <= 0xFAFF)
    || (code >= 0xFF00 && code <= 0xFFEF) || (code >= 0x20000 && code <= 0x2FFFF)
}

function breakUnits(line: string): string[] {
  const units: string[] = []
  for (const ch of line) {
    const last = units.length ? Array.from(units[units.length - 1]).pop()! : ''
    if (last && (/\s/.test(ch) || NO_LINE_START.has(ch) || NO_LINE_END.has(last)
        || !(isCjk(ch) || isCjk(last) || /\s/.test(last)))) {
      units[units.length - 1] += ch
    } else {
      units.push(ch)
    }
  }
  return units
}

function wrapLine(line: string, measure: (s: string) => number, maxWidth: number): string[] {
  if (measure(line.trimEnd()) <= maxWidth) return [line]
  const units = breakUnits(line).flatMap(
    (u) => (measure(u.trimEnd()) <= maxWidth ? [u] : Array.from(u)))
  const full = units.map(measure)
  const ink = units.map((u) => measure(u.trimEnd()))

  const lineStarts = (limit: number): number[] => {
    const starts: number[] = []
    let end = units.length
    let width = 0
    for (let i = units.length - 1; i >= 0; i--) {
      const add = i === end - 1 ? ink[i] : full[i]
      if (i < end - 1 && width + add > limit) {
        starts.unshift(i + 1)
        end = i + 1
        width = ink[i]
      } else {
        width += add
      }
    }
    return starts
  }

  const target = lineStarts(maxWidth).length
  let low = Math.min(Math.max(...ink), maxWidth)
  let high = maxWidth
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (lineStarts(mid).length === target) high = mid
    else low = mid
  }
  const bounds = [0, ...lineStarts(high), units.length]
  return bounds.slice(1).map((b, i) => units.slice(bounds[i], b).join('').trimEnd())
}

export function wrapText(text: string, measure: (s: string) => number, maxWidth: number): string {
  return text.split('\n').flatMap((line) => wrapLine(line, measure, maxWidth)).join('\n')
}

export function resolveTokens(text: string, t: number, fps: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return text.replace(TOKEN_RE, (_, name: string) => {
    const total = Math.round(t * fps)
    if (name === 'frame') return String(total)
    const hh = Math.floor(t / 3600)
    const mm = Math.floor((t % 3600) / 60)
    const ss = Math.floor(t % 60)
    const ff = Math.round((t - Math.floor(t)) * fps) % Math.max(1, Math.round(fps))
    if (name === 'shorttimecode') return `${pad(mm)}:${pad(ss)}`
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`
  })
}

export function typewriterSlice(
  text: string, t: number, tStart: number, mode: string, stepS: number,
): string {
  if (!['char', 'word', 'line'].includes(mode) || stepS <= 0) return text
  const steps = Math.max(0, Math.floor((t - tStart) / stepS))
  if (mode === 'char') return Array.from(text).slice(0, steps).join('')
  if (mode === 'word') {
    const parts = text.split(/(\s+)/)
    const shown = Math.min(steps, parts.filter((p) => p.trim()).length)
    let count = 0
    const out: string[] = []
    for (const p of parts) {
      if (p.trim() && ++count > shown) break
      out.push(p)
    }
    return out.join('')
  }
  return text.split('\n').slice(0, steps).join('\n')
}

export function titleTextAt(
  title: TitleTiming, t: number, fps: number, wrap: WrapText = (s) => s,
): OverlayText | null {
  if (!title.text.trim()) return null
  const end = title.tEnd > 0 ? title.tEnd : 1e12
  if (t < title.tStart || t > end) return null
  let opacity = 1
  if (title.fadeS > 0) {
    opacity = Math.min(opacity, (t - title.tStart) / title.fadeS)
    if (end < 1e11) opacity = Math.min(opacity, (end - t) / title.fadeS)
    opacity = Math.max(0, Math.min(1, opacity))
  }
  const text = typewriterSlice(
    wrap(resolveTokens(title.text, t, fps)), t, title.tStart, title.typewriter, title.typeStep)
  return text.trim() ? { text, opacity } : null
}

function sfntTables(buf: ArrayBuffer) {
  const dv = new DataView(buf)
  const tag = (o: number) => String.fromCharCode(
    dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))
  const base = tag(0) === 'ttcf' ? dv.getUint32(12) : 0
  const tables = new Map<string, number>()
  for (let i = 0; i < dv.getUint16(base + 4); i++) {
    const rec = base + 12 + i * 16
    tables.set(tag(rec), dv.getUint32(rec + 8))
  }
  return { dv, tag, tables }
}

export function opszDefault(buf: ArrayBuffer): number | null {
  const { dv, tag, tables } = sfntTables(buf)
  const fvar = tables.get('fvar')
  if (fvar == null) return null
  const axes = fvar + dv.getUint16(fvar + 4)
  const size = dv.getUint16(fvar + 10)
  for (let a = 0; a < dv.getUint16(fvar + 8); a++) {
    if (tag(axes + a * size) === 'opsz') return dv.getInt32(axes + a * size + 8) / 65536
  }
  return null
}

export function cmapCoverage(buf: ArrayBuffer): Set<number> {
  const { dv, tables } = sfntTables(buf)
  const cmap = tables.get('cmap')
  const out = new Set<number>()
  if (cmap == null) return out
  let sub = -1
  for (let i = 0; i < dv.getUint16(cmap + 2); i++) {
    const rec = cmap + 4 + i * 8
    const at = cmap + dv.getUint32(rec + 4)
    const format = dv.getUint16(at)
    if ((format === 4 && sub < 0) || format === 12) sub = at
    if (format === 12) break
  }
  if (sub < 0) return out
  if (dv.getUint16(sub) === 12) {
    for (let g = 0; g < dv.getUint32(sub + 12); g++) {
      const rec = sub + 16 + g * 12
      for (let c = dv.getUint32(rec); c <= dv.getUint32(rec + 4); c++) out.add(c)
    }
    return out
  }
  const segs = dv.getUint16(sub + 6) / 2
  const ends = sub + 14
  const starts = ends + segs * 2 + 2
  const deltas = starts + segs * 2
  const offsets = deltas + segs * 2
  for (let s = 0; s < segs; s++) {
    const end = dv.getUint16(ends + s * 2)
    const delta = dv.getInt16(deltas + s * 2)
    const rangeOff = dv.getUint16(offsets + s * 2)
    for (let c = dv.getUint16(starts + s * 2); c <= end && c !== 0xffff; c++) {
      const glyph = rangeOff === 0
        ? (c + delta) & 0xffff
        : dv.getUint16(offsets + s * 2 + rangeOff + (c - dv.getUint16(starts + s * 2)) * 2)
      if (glyph !== 0) out.add(c)
    }
  }
  return out
}

export function cueTextAt(cues: Cue[], t: number, wrap: WrapText = (s) => s): OverlayText | null {
  const cue = cues.find((c) => c.start <= t && t <= c.end && c.text)
  return cue ? { text: wrap(cue.text.replace(/<[^>]+>/g, '')), opacity: 1 } : null
}
