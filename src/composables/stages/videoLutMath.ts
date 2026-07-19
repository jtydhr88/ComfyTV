export type LutInterp = 'nearest' | 'trilinear' | 'tetrahedral' | 'pyramid' | 'prism'

export interface ParsedLut {
  size: number
  data: Float32Array
  scale: [number, number, number]
}

export const PREVIEWABLE_LUT_EXTENSIONS = ['.cube', '.3dl'] as const

const MAX_LEVEL = 256
const THREEDL_SIZE = 17
const THREEDL_SCALE = 16 * 16 * 16

function clipf(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function isSkipLine(line: string): boolean {
  const t = line.trimStart()
  return t === '' || t.startsWith('#')
}

function parseTriple(line: string): [number, number, number] | null {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 3) return null
  const r = Number(parts[0])
  const g = Number(parts[1])
  const b = Number(parts[2])
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  return [r, g, b]
}

function domainScale(min: number[], max: number[]): [number, number, number] {
  return [
    Math.fround(clipf(1 / (max[0] - min[0]), 0, 1)),
    Math.fround(clipf(1 / (max[1] - min[1]), 0, 1)),
    Math.fround(clipf(1 / (max[2] - min[2]), 0, 1)),
  ]
}

export function parseCubeLut(text: string): ParsedLut | null {
  const lines = text.split(/\r?\n/)
  let pos = 0
  let size = 0
  while (pos < lines.length) {
    const line = lines[pos++]
    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.slice(11), 10)
      break
    }
  }
  if (!Number.isFinite(size) || size < 2 || size > MAX_LEVEL) return null

  const size2 = size * size
  const data = new Float32Array(size * size2 * 3)
  const min = [0, 0, 0]
  const max = [1, 1, 1]

  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        let line: string | null = null
        while (pos < lines.length) {
          const candidate = lines[pos++]
          if (candidate.startsWith('DOMAIN_')) {
            const target = candidate.startsWith('DOMAIN_MIN ')
              ? min
              : candidate.startsWith('DOMAIN_MAX ') ? max : null
            if (!target) return null
            const vals = parseTriple(candidate.slice(11))
            if (!vals) return null
            target[0] = vals[0]
            target[1] = vals[1]
            target[2] = vals[2]
            continue
          }
          if (candidate.startsWith('TITLE')) continue
          if (isSkipLine(candidate)) continue
          line = candidate
          break
        }
        if (line == null) return null
        const vals = parseTriple(line)
        if (!vals) return null
        const base = (i * size2 + j * size + k) * 3
        data[base] = vals[0]
        data[base + 1] = vals[1]
        data[base + 2] = vals[2]
      }
    }
  }

  return { size, data, scale: domainScale(min, max) }
}

export function parse3dlLut(text: string): ParsedLut | null {
  const lines = text.split(/\r?\n/).filter((l) => !isSkipLine(l))
  const size = THREEDL_SIZE
  const size2 = size * size
  if (lines.length < 1 + size * size2) return null
  const data = new Float32Array(size * size2 * 3)
  let pos = 1
  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const vals = parseTriple(lines[pos++])
        if (!vals || !vals.every(Number.isInteger)) return null
        const base = (k * size2 + j * size + i) * 3
        data[base] = vals[0] / THREEDL_SCALE
        data[base + 1] = vals[1] / THREEDL_SCALE
        data[base + 2] = vals[2] / THREEDL_SCALE
      }
    }
  }
  return { size, data, scale: [1, 1, 1] }
}

export function lutFileExtension(filename: string): string {
  const m = /\.[^.]+$/.exec(filename.trim().toLowerCase())
  return m ? m[0] : ''
}

export function isPreviewableLutFile(filename: string): boolean {
  return (PREVIEWABLE_LUT_EXTENSIONS as readonly string[])
    .includes(lutFileExtension(filename))
}

export function parseLutText(filename: string, text: string): ParsedLut | null {
  const ext = lutFileExtension(filename)
  if (ext === '.cube') return parseCubeLut(text)
  if (ext === '.3dl') return parse3dlLut(text)
  return null
}

type Vec3 = [number, number, number]

function fetchVec(lut: ParsedLut, r: number, g: number, b: number): Vec3 {
  const base = (r * lut.size * lut.size + g * lut.size + b) * 3
  return [lut.data[base], lut.data[base + 1], lut.data[base + 2]]
}

function near(x: number): number {
  return Math.trunc(x + 0.5)
}

function prev(x: number): number {
  return Math.trunc(x)
}

function next(x: number, size: number): number {
  return Math.min(Math.trunc(x) + 1, size - 1)
}

function lerpVec(a: Vec3, b: Vec3, f: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ]
}

function interpNearest(lut: ParsedLut, s: Vec3): Vec3 {
  return fetchVec(lut, near(s[0]), near(s[1]), near(s[2]))
}

function interpTrilinear(lut: ParsedLut, s: Vec3): Vec3 {
  const p = [prev(s[0]), prev(s[1]), prev(s[2])]
  const n = [next(s[0], lut.size), next(s[1], lut.size), next(s[2], lut.size)]
  const d: Vec3 = [s[0] - p[0], s[1] - p[1], s[2] - p[2]]
  const c000 = fetchVec(lut, p[0], p[1], p[2])
  const c001 = fetchVec(lut, p[0], p[1], n[2])
  const c010 = fetchVec(lut, p[0], n[1], p[2])
  const c011 = fetchVec(lut, p[0], n[1], n[2])
  const c100 = fetchVec(lut, n[0], p[1], p[2])
  const c101 = fetchVec(lut, n[0], p[1], n[2])
  const c110 = fetchVec(lut, n[0], n[1], p[2])
  const c111 = fetchVec(lut, n[0], n[1], n[2])
  const c00 = lerpVec(c000, c100, d[0])
  const c10 = lerpVec(c010, c110, d[0])
  const c01 = lerpVec(c001, c101, d[0])
  const c11 = lerpVec(c011, c111, d[0])
  const c0 = lerpVec(c00, c10, d[1])
  const c1 = lerpVec(c01, c11, d[1])
  return lerpVec(c0, c1, d[2])
}

function tetraMix(c000: Vec3, cA: Vec3, cB: Vec3, c111: Vec3, w: Vec3, last: number): Vec3 {
  const w0 = 1 - w[0]
  const w1 = w[0] - w[1]
  const w2 = w[1] - w[2]
  const out: Vec3 = [0, 0, 0]
  for (let ch = 0; ch < 3; ch++) {
    out[ch] = w0 * c000[ch] + w1 * cA[ch] + w2 * cB[ch] + last * c111[ch]
  }
  return out
}

function interpTetrahedral(lut: ParsedLut, s: Vec3): Vec3 {
  const p = [prev(s[0]), prev(s[1]), prev(s[2])]
  const n = [next(s[0], lut.size), next(s[1], lut.size), next(s[2], lut.size)]
  const d: Vec3 = [s[0] - p[0], s[1] - p[1], s[2] - p[2]]
  const c000 = fetchVec(lut, p[0], p[1], p[2])
  const c111 = fetchVec(lut, n[0], n[1], n[2])
  if (d[0] > d[1]) {
    if (d[1] > d[2]) {
      const c100 = fetchVec(lut, n[0], p[1], p[2])
      const c110 = fetchVec(lut, n[0], n[1], p[2])
      return tetraMix(c000, c100, c110, c111, [d[0], d[1], d[2]], d[2])
    }
    if (d[0] > d[2]) {
      const c100 = fetchVec(lut, n[0], p[1], p[2])
      const c101 = fetchVec(lut, n[0], p[1], n[2])
      return tetraMix(c000, c100, c101, c111, [d[0], d[2], d[1]], d[1])
    }
    const c001 = fetchVec(lut, p[0], p[1], n[2])
    const c101 = fetchVec(lut, n[0], p[1], n[2])
    return tetraMix(c000, c001, c101, c111, [d[2], d[0], d[1]], d[1])
  }
  if (d[2] > d[1]) {
    const c001 = fetchVec(lut, p[0], p[1], n[2])
    const c011 = fetchVec(lut, p[0], n[1], n[2])
    return tetraMix(c000, c001, c011, c111, [d[2], d[1], d[0]], d[0])
  }
  if (d[2] > d[0]) {
    const c010 = fetchVec(lut, p[0], n[1], p[2])
    const c011 = fetchVec(lut, p[0], n[1], n[2])
    return tetraMix(c000, c010, c011, c111, [d[1], d[2], d[0]], d[0])
  }
  const c010 = fetchVec(lut, p[0], n[1], p[2])
  const c110 = fetchVec(lut, n[0], n[1], p[2])
  return tetraMix(c000, c010, c110, c111, [d[1], d[0], d[2]], d[2])
}

export function resolvePreviewInterp(interp: string): 'nearest' | 'trilinear' | 'tetrahedral' {
  if (interp === 'nearest' || interp === 'trilinear') return interp
  return 'tetrahedral'
}

export function applyLut(
  rgb: [number, number, number],
  lut: ParsedLut,
  interp: string,
): [number, number, number] {
  const lutMax = lut.size - 1
  const s: Vec3 = [
    clipf((rgb[0] / 255) * lut.scale[0] * lutMax, 0, lutMax),
    clipf((rgb[1] / 255) * lut.scale[1] * lutMax, 0, lutMax),
    clipf((rgb[2] / 255) * lut.scale[2] * lutMax, 0, lutMax),
  ]
  const mode = resolvePreviewInterp(interp)
  const vec = mode === 'nearest'
    ? interpNearest(lut, s)
    : mode === 'trilinear' ? interpTrilinear(lut, s) : interpTetrahedral(lut, s)
  return [
    clipf(Math.trunc(vec[0] * 255), 0, 255),
    clipf(Math.trunc(vec[1] * 255), 0, 255),
    clipf(Math.trunc(vec[2] * 255), 0, 255),
  ]
}
