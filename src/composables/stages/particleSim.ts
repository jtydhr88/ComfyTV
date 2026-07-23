export interface ParticleParams {
  emitter?: string
  e_x0?: number
  e_y0?: number
  e_x1?: number
  e_y1?: number
  rate?: number
  lifetime?: number
  speed?: number
  direction?: number
  spread?: number
  gravity?: number
  wind?: number
  turbulence?: number
  turb_scale?: number
  drag?: number
  attract_strength?: number
  attract_x?: number
  attract_y?: number
  attract_radius?: number
  swirl?: number
  collide?: string
  floor_y?: number
  bounce?: number
  sub_mode?: string
  sub_count?: number
  sub_speed?: number
  sub_lifetime?: number
  sub_size_ratio?: number
  sub_color?: string
  size?: number
  size_end_ratio?: number
  opacity_start?: number
  opacity_end?: number
  size_curve?: string
  opacity_curve?: string
  color0?: string
  color1?: string
  sprite?: string
  renderer?: string
  stretch?: number
  trail_len?: number
  blend?: string
  warmup?: number
  seed?: number
}

export const TRAIL_LEN = 5

const MASK64 = (1n << 64n) - 1n
const MASK24 = 0xffffff

export function permTable(seed: number): Int32Array {
  let state = BigInt((Math.trunc(seed) & 0x7fffffff) || 1)
  const p: number[] = []
  for (let i = 0; i < 256; i++) p.push(i)
  for (let i = 255; i > 0; i--) {
    state = (state + 0x9e3779b97f4a7c15n) & MASK64
    let z = state
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64
    z = z ^ (z >> 31n)
    const j = Number(z % BigInt(i + 1))
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  const out = new Int32Array(512)
  for (let i = 0; i < 256; i++) {
    out[i] = p[i]
    out[i + 256] = p[i]
  }
  return out
}

export function hashU(id: number, seed: number, k: number): number {
  let h = (BigInt(id) * 2654435761n) & MASK64
  h ^= (BigInt(Math.trunc(seed) + 1) * 40503n) & MASK64
  h ^= (BigInt(k + 1) * 2246822519n) & MASK64
  h = ((h ^ (h >> 13n)) * 0x5bd1e995n) & MASK64
  h = h ^ (h >> 15n)
  return Number(h & BigInt(MASK24)) / MASK24
}

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
]

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function perlin3(x: number, y: number, z: number,
                        perm: Int32Array): number {
  const xf0 = Math.floor(x)
  const yf0 = Math.floor(y)
  const zf0 = Math.floor(z)
  const xi = xf0 & 255
  const yi = yf0 & 255
  const zi = zf0 & 255
  const xf = x - xf0
  const yf = y - yf0
  const zf = z - zf0
  const u = fade(xf)
  const v = fade(yf)
  const w = fade(zf)

  const corner = (ox: number, oy: number, oz: number): number => {
    const hsh = perm[perm[perm[(xi + ox) & 255] + ((yi + oy) & 255)]
      + ((zi + oz) & 255)] % 12
    const g = GRAD3[hsh]
    return g[0] * (xf - ox) + g[1] * (yf - oy) + g[2] * (zf - oz)
  }
  const lerp = (a: number, b: number, t: number): number => a + t * (b - a)

  const x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), u)
  const x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), u)
  const x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), u)
  const x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w)
}

export function fbm3(x: number, y: number, z: number, perm: Int32Array,
                     octaves = 4, lacunarity = 2.0, gain = 0.5,
                     turbulence = false): number {
  let out = 0
  let amp = 1
  let total = 0
  let px = x
  let py = y
  let pz = z
  for (let o = 0; o < Math.max(1, octaves); o++) {
    const val = perlin3(px, py, pz, perm)
    out += (turbulence ? Math.abs(val) : val) * amp
    total += amp
    amp *= gain
    px = px * lacunarity + 1234
    py = py * lacunarity + 1234
    pz = pz * lacunarity + 1234
  }
  return out / Math.max(1e-6, total)
}

export type CurveKeys = Array<[number, number]>

export function parseCurve(raw: unknown): CurveKeys | null {
  let keys: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return null
    try {
      keys = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!Array.isArray(keys)) return null
  const out: CurveKeys = []
  for (const k of keys) {
    const t = Number((k as { t?: unknown })?.t)
    const v = Number((k as { v?: unknown })?.v)
    if (Number.isFinite(t) && Number.isFinite(v)) out.push([t, v])
  }
  if (out.length < 2) return null
  return out.sort((a, b) => a[0] - b[0])
}

export function sampleCurve(keys: CurveKeys, frac: number): number {
  if (frac <= keys[0][0]) return keys[0][1]
  if (frac >= keys[keys.length - 1][0]) return keys[keys.length - 1][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1] = keys[i + 1]
    if (t0 <= frac && frac <= t1) {
      const u = (frac - t0) / Math.max(1e-9, t1 - t0)
      const s = u * u * (3 - 2 * u)
      return v0 + (v1 - v0) * s
    }
  }
  return keys[keys.length - 1][1]
}

function curveLut(keys: CurveKeys, n = 64): Float64Array {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = sampleCurve(keys, i / (n - 1))
  return out
}

export function hexRgb(s: string | undefined,
                       fallback: string): [number, number, number] {
  const c = (s || fallback).replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size0: number
  size1: number
  hue: number
  kind: number
  hx: number[]
  hy: number[]
}

export interface ParticleSnapshot {
  x: number
  y: number
  vx: number
  vy: number
  hx: number[]
  hy: number[]
  frac: number
  size: number
  opacity: number
  color: [number, number, number]
  kind: number
}

export class ParticleSimTs {
  readonly p: ParticleParams
  readonly w: number
  readonly h: number
  readonly fps: number
  readonly dt: number
  t: number | null = null
  nextId = 0
  emitAcc = 0
  parts: Particle[] = []
  private seed: number
  private perm: Int32Array
  private c0: [number, number, number]
  private c1: [number, number, number]
  private subC: [number, number, number]
  private sizeLut: Float64Array | null
  private opLut: Float64Array | null
  maskPts: Array<[number, number]> | null = null

  constructor(params: ParticleParams, w: number, h: number, fps: number) {
    this.p = params
    this.w = w
    this.h = h
    this.fps = Math.max(1, fps)
    this.dt = 1 / this.fps
    this.seed = Math.trunc(params.seed ?? 7)
    this.perm = permTable(this.seed)
    this.c0 = hexRgb(params.color0, '#FFD27A')
    this.c1 = hexRgb(params.color1, '#FF5A2A')
    this.subC = hexRgb(params.sub_color, '#FFF2B0')
    const sk = parseCurve(params.size_curve)
    this.sizeLut = sk ? curveLut(sk) : null
    const ok = parseCurve(params.opacity_curve)
    this.opLut = ok ? curveLut(ok) : null
  }

  private emit(n: number): void {
    if (n <= 0) return
    const p = this.p
    const emitter = p.emitter || 'point'
    const x0 = (p.e_x0 ?? 0.5) * this.w
    const y0 = (p.e_y0 ?? 0.85) * this.h
    const x1 = (p.e_x1 ?? 0.5) * this.w
    const y1 = (p.e_y1 ?? 0.85) * this.h
    const speedBase = p.speed ?? 120
    const direction = ((p.direction ?? -90) * Math.PI) / 180
    const spread = (Math.max(0, p.spread ?? 30) * Math.PI) / 180
    const lifeBase = Math.max(0.1, p.lifetime ?? 2)
    const sizeBase = Math.max(1, p.size ?? 12)
    const endRatio = p.size_end_ratio ?? 0.4
    for (let i = 0; i < n; i++) {
      const id = this.nextId + i
      const u = [0, 1, 2, 3, 4, 5, 6, 7].map((k) =>
        hashU(id, this.seed, k))
      let x: number
      let y: number
      if (emitter === 'line') {
        x = x0 + (x1 - x0) * u[0]
        y = y0 + (y1 - y0) * u[0]
      } else if (emitter === 'rect') {
        const xa = Math.min(x0, x1)
        const xb = Math.max(x0, x1)
        const ya = Math.min(y0, y1)
        const yb = Math.max(y0, y1)
        x = xa + (xb - xa) * u[0]
        y = ya + (yb - ya) * u[1]
      } else if (emitter === 'circle') {
        const radius = Math.max(1, Math.hypot(x1 - x0, y1 - y0))
        const ang0 = u[0] * 2 * Math.PI
        x = x0 + Math.cos(ang0) * radius
        y = y0 + Math.sin(ang0) * radius
      } else if (emitter === 'mask_edge' && this.maskPts?.length) {
        const idx = Math.min(Math.trunc(u[0] * this.maskPts.length),
          this.maskPts.length - 1)
        x = this.maskPts[idx][0]
        y = this.maskPts[idx][1]
      } else {
        x = x0
        y = y0
      }
      const speed = speedBase * (0.5 + u[2])
      const ang = direction + (u[3] - 0.5) * spread * 2
      const life = lifeBase * (0.6 + 0.8 * u[4])
      const s0 = sizeBase * (0.6 + 0.8 * u[5])
      this.parts.push({
        x, y,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        age: 0, life, size0: s0, size1: s0 * endRatio, hue: u[6], kind: 0,
        hx: new Array(TRAIL_LEN).fill(x),
        hy: new Array(TRAIL_LEN).fill(y),
      })
    }
    this.nextId += n
  }

  private emitSub(points: Array<[number, number]>): void {
    const p = this.p
    const count = Math.max(0, Math.min(30, Math.trunc(p.sub_count ?? 8)))
    if (!points.length || count <= 0) return
    const total = points.length * count
    const speedBase = p.sub_speed ?? 120
    const lifeBase = Math.max(0.1, p.sub_lifetime ?? 0.6)
    const base = Math.max(1, p.size ?? 12) * (p.sub_size_ratio ?? 0.5)
    for (let i = 0; i < total; i++) {
      const id = this.nextId + i
      const u = [0, 1, 2, 3, 4].map((k) => hashU(id, this.seed, k + 20))
      const src = points[Math.floor(i / count)]
      const speed = speedBase * (0.5 + u[0])
      const ang = u[1] * 2 * Math.PI
      const life = lifeBase * (0.6 + 0.8 * u[2])
      const s0 = base * (0.6 + 0.8 * u[3])
      this.parts.push({
        x: src[0], y: src[1],
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        age: 0, life, size0: s0, size1: s0 * 0.3, hue: u[4], kind: 1,
        hx: new Array(TRAIL_LEN).fill(src[0]),
        hy: new Array(TRAIL_LEN).fill(src[1]),
      })
    }
    this.nextId += total
  }

  private step(): void {
    const p = this.p
    const dt = this.dt
    this.emitAcc += (p.rate ?? 120) * dt
    const n = Math.trunc(this.emitAcc)
    this.emitAcc -= n
    this.emit(n)
    const subMode = p.sub_mode || 'none'
    if (this.parts.length) {
      const deaths: Array<[number, number]> = []
      const alive: Particle[] = []
      for (const pt of this.parts) {
        pt.age += dt
        if (pt.age >= pt.life) {
          if (subMode === 'on_death' && pt.kind < 0.5) {
            deaths.push([pt.x, pt.y])
          }
        } else {
          alive.push(pt)
        }
      }
      this.parts = alive
      if (deaths.length) this.emitSub(deaths)
    }
    if (this.parts.length) {
      const turb = p.turbulence ?? 0
      const ts = Math.max(8, p.turb_scale ?? 120)
      const att = p.attract_strength ?? 0
      const swirl = p.swirl ?? 0
      const ax = (p.attract_x ?? 0.5) * this.w
      const ay = (p.attract_y ?? 0.5) * this.h
      const rad = Math.max(1, (p.attract_radius ?? 0.5)
        * Math.min(this.w, this.h))
      const wind = p.wind ?? 0
      const gravity = p.gravity ?? 60
      const drag = Math.min(0.99, Math.max(0, p.drag ?? 0.1))
      const damp = Math.max(0, 1 - drag * dt)
      const t = this.t as number
      for (const pt of this.parts) {
        if (turb > 0) {
          const fx = fbm3(pt.x / ts, pt.y / ts, t * 0.5, this.perm, 2)
          const fy = fbm3(pt.x / ts + 31.7, pt.y / ts + 17.3,
            t * 0.5 + 11.0, this.perm, 2)
          pt.vx += fx * turb * dt
          pt.vy += fy * turb * dt
        }
        if (att || swirl) {
          const dx = ax - pt.x
          const dy = ay - pt.y
          const d = Math.sqrt(dx * dx + dy * dy)
          const safe = Math.max(d, 1e-6)
          const factor = Math.min(1, Math.max(0, 1 - d / rad))
          const ux = dx / safe
          const uy = dy / safe
          pt.vx += ux * att * factor * dt
          pt.vy += uy * att * factor * dt
          if (swirl) {
            pt.vx += -uy * swirl * factor * dt
            pt.vy += ux * swirl * factor * dt
          }
        }
        pt.vx += wind * dt
        pt.vy += gravity * dt
        pt.vx *= damp
        pt.vy *= damp
        for (let i = TRAIL_LEN - 1; i > 0; i--) {
          pt.hx[i] = pt.hx[i - 1]
          pt.hy[i] = pt.hy[i - 1]
        }
        pt.hx[0] = pt.x
        pt.hy[0] = pt.y
        pt.x += pt.vx * dt
        pt.y += pt.vy * dt
      }
      const collide = p.collide || 'none'
      if (collide !== 'none') {
        const floor = (p.floor_y ?? 0.9) * this.h
        const hits: Array<[number, number]> = []
        const kept: Particle[] = []
        for (const pt of this.parts) {
          if (pt.y >= floor && pt.vy > 0) {
            if (pt.kind < 0.5) hits.push([pt.x, floor])
            if (collide === 'bounce') {
              const bounce = Math.min(1, Math.max(0, p.bounce ?? 0.5))
              pt.y = 2 * floor - pt.y
              pt.vy = -pt.vy * bounce
              pt.vx *= 0.8
              kept.push(pt)
            }
          } else {
            kept.push(pt)
          }
        }
        this.parts = kept
        if (subMode === 'on_collide' && hits.length) this.emitSub(hits)
      }
    }
    this.t = (this.t as number) + dt
  }

  advanceTo(t: number): void {
    if (this.t === null) {
      const warmup = Math.min(10, Math.max(0, this.p.warmup ?? 1))
      this.t = t - warmup
      const steps = Math.round(warmup / this.dt)
      for (let i = 0; i < steps; i++) this.step()
    }
    let guard = 0
    while ((this.t as number) < t - this.dt / 2 && guard < 240) {
      this.step()
      guard++
    }
  }

  snapshot(): ParticleSnapshot[] {
    const out: ParticleSnapshot[] = []
    const op0 = this.p.opacity_start ?? 1
    const op1 = this.p.opacity_end ?? 0
    for (const pt of this.parts) {
      const frac = Math.min(1, Math.max(0, pt.age / Math.max(1e-6, pt.life)))
      let size: number
      if (this.sizeLut) {
        const idx = Math.min(Math.trunc(frac * (this.sizeLut.length - 1)),
          this.sizeLut.length - 1)
        size = pt.size0 * this.sizeLut[idx]
      } else {
        size = pt.size0 + (pt.size1 - pt.size0) * frac
      }
      let opacity: number
      if (this.opLut) {
        const idx = Math.min(Math.trunc(frac * (this.opLut.length - 1)),
          this.opLut.length - 1)
        opacity = Math.min(1, Math.max(0, this.opLut[idx]))
      } else {
        opacity = Math.min(1, Math.max(0, op0 + (op1 - op0) * frac))
      }
      const jitter = 0.85 + 0.3 * pt.hue
      const base = pt.kind >= 0.5 ? this.subC
        : [
            this.c0[0] * (1 - frac) + this.c1[0] * frac,
            this.c0[1] * (1 - frac) + this.c1[1] * frac,
            this.c0[2] * (1 - frac) + this.c1[2] * frac,
          ] as [number, number, number]
      out.push({
        x: pt.x, y: pt.y, vx: pt.vx, vy: pt.vy, hx: pt.hx, hy: pt.hy,
        frac, size, opacity,
        color: [
          Math.min(1, base[0] * jitter),
          Math.min(1, base[1] * jitter),
          Math.min(1, base[2] * jitter),
        ],
        kind: pt.kind,
      })
    }
    return out
  }
}
