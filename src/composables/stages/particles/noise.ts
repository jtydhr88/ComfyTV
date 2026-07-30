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
