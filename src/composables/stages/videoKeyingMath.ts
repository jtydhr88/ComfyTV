export type Rgb = [number, number, number]
export type Rgba = [number, number, number, number]

export const KEYING_LUMA_WEIGHTS: Record<string, Rgb> = {
  rec709: [0.2126, 0.7152, 0.0722],
  rec2020: [0.2627, 0.678, 0.0593],
  ccir601: [0.2989, 0.5866, 0.1145],
}

export function keyingLuma(rgb: Rgb, mathMode = 'rec709'): number {
  if (mathMode === 'average') return (rgb[0] + rgb[1] + rgb[2]) / 3
  if (mathMode === 'max') return Math.max(rgb[0], rgb[1], rgb[2])
  const w = KEYING_LUMA_WEIGHTS[mathMode] ?? KEYING_LUMA_WEIGHTS.rec709
  return rgb[0] * w[0] + rgb[1] * w[1] + rgb[2] * w[2]
}

export function parseKeyColor(s: string | undefined, fallback: Rgb): Rgb {
  const hex = (s ?? '').trim().replace(/^#/, '')
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [...fallback] as Rgb
  }
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ]
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v))

export interface DespillParams {
  screen: string
  spillMix: number
  expand: number
  redScale: number
  greenScale: number
  blueScale: number
  brightness: number
  clampBlack: boolean
  clampWhite: boolean
  outputSpillmap: boolean
}

export function applyDespill(rgb: Rgb, p: Partial<DespillParams>): Rgb {
  const mixv = clamp(p.spillMix ?? 0.5, 0, 1)
  const exp = clamp(p.expand ?? 0, 0, 1)
  const [r, g, b] = rgb
  const spill = p.screen === 'blue'
    ? Math.max(0, b - (r * mixv + g * (1 - mixv)) * (1 - exp))
    : Math.max(0, g - (r * mixv + b * (1 - mixv)) * (1 - exp))
  let out: Rgb = [
    r + spill * (p.redScale ?? 0) + (p.brightness ?? 0) * spill,
    g + spill * (p.greenScale ?? -1) + (p.brightness ?? 0) * spill,
    b + spill * (p.blueScale ?? 0) + (p.brightness ?? 0) * spill,
  ]
  if (p.clampBlack ?? true) out = out.map((v) => Math.max(0, v)) as Rgb
  if (p.clampWhite ?? false) out = out.map((v) => Math.min(1, v)) as Rgb
  if (p.outputSpillmap ?? false) {
    const s = clamp(spill, 0, 1)
    return [s, s, s]
  }
  return out
}

export interface ColorSuppressParams {
  red: number
  green: number
  blue: number
  cyan: number
  magenta: number
  yellow: number
  preserveLuma: boolean
  luminanceMath: string
  output: string
}

export function applyColorSuppress(
  rgb: Rgb,
  p: Partial<ColorSuppressParams>,
): Rgb {
  const red = p.red ?? 0
  const green = p.green ?? 0
  const blue = p.blue ?? 0
  const cyan = p.cyan ?? 0
  const magenta = p.magenta ?? 0
  const yellow = p.yellow ?? 0
  const lumaMath = p.luminanceMath ?? 'rec709'
  let [r, g, b] = rgb
  let modified = 0
  const luma1 = (p.preserveLuma ?? false) ? keyingLuma(rgb, lumaMath) : 0

  if (yellow !== 0 && b < g && b < r) {
    const d = Math.min((g - b) * yellow, (r - b) * yellow)
    g -= d
    r -= d
    modified += Math.abs(d)
  }
  if (magenta !== 0 && g < b && g < r) {
    const d = Math.min((b - g) * magenta, (r - g) * magenta)
    b -= d
    r -= d
    modified += Math.abs(d)
  }
  if (cyan !== 0 && r < g && r < b) {
    const d = Math.min((g - r) * cyan, (b - r) * cyan)
    g -= d
    b -= d
    modified += Math.abs(d)
  }
  if (red !== 0 && r > g && r > b) {
    const d = (r - Math.max(g, b)) * red
    r -= d
    modified += Math.abs(d)
  }
  if (green !== 0 && g > b && g > r) {
    const d = (g - Math.max(b, r)) * green
    g -= d
    modified += Math.abs(d)
  }
  if (blue !== 0 && b > g && b > r) {
    const d = (b - Math.max(g, r)) * blue
    b -= d
    modified += Math.abs(d)
  }

  if (p.output === 'matte') {
    const m = clamp(modified, 0, 1)
    return [m, m, m]
  }
  let out: Rgb = [r, g, b]
  if (p.preserveLuma ?? false) {
    const shift = luma1 - keyingLuma(out, lumaMath)
    out = [r + shift, g + shift, b + shift]
  }
  return out.map((v) => clamp(v, 0, 1)) as Rgb
}

export interface KeyerParams {
  mode: string
  keyColor: string
  luminanceMath: string
  softnessLower: number
  toleranceLower: number
  center: number
  toleranceUpper: number
  softnessUpper: number
  despill: number
  despillAngle: number
}

export interface KeyerDerived {
  mode: string
  lumaMath: string
  kc: Rgb
  kcSum: number
  kcNorm2: number
  tolU: number
  softU: number
  softL: number
  tolL: number
  ctr: number
  desp: number
  closing: number
}

export function deriveKeyer(p: Partial<KeyerParams>): KeyerDerived {
  const mode = p.mode ?? 'luminance'
  const kc = parseKeyColor(p.keyColor, [0, 0, 0])
  return {
    mode,
    lumaMath: p.luminanceMath ?? 'rec709',
    kc,
    kcSum: kc[0] + kc[1] + kc[2],
    kcNorm2: kc[0] * kc[0] + kc[1] * kc[1] + kc[2] * kc[2],
    tolU: mode === 'screen' ? 1 : (p.toleranceUpper ?? 0),
    softU: mode === 'screen' ? 1 : (p.softnessUpper ?? 0.5),
    softL: p.softnessLower ?? -0.5,
    tolL: p.toleranceLower ?? 0,
    ctr: p.center ?? 1,
    desp: mode === 'screen' || mode === 'none'
      ? clamp(p.despill ?? 1, 0, 2)
      : 0,
    closing: Math.tan(
      ((90 - 0.5 * clamp(p.despillAngle ?? 120, 0, 180)) * Math.PI) / 180,
    ),
  }
}

function keyerKeyBg(kfg: number, d: KeyerDerived): number {
  const aPt = d.ctr + d.tolL + d.softL
  const bPt = d.ctr + d.tolL
  const cPt = d.ctr + d.tolU
  const dPt = d.ctr + d.tolU + d.softU
  let out = kfg < aPt ? 0 : 1
  if (d.softL < 0 && kfg >= aPt && kfg < bPt) out = (kfg - aPt) / -d.softL
  if (kfg >= bPt && kfg <= cPt) out = 1
  if (d.softU > 0 && kfg > cPt && kfg < dPt) out = (dPt - kfg) / d.softU
  if (kfg >= dPt) out = 0
  if (bPt <= 0 && kfg <= 0) out = 1
  if (cPt >= 1 && kfg >= 1) out = 1
  return clamp(out, 0, 1)
}

export function applyKeyer(rgb: Rgb, d: KeyerDerived): Rgba {
  const [r, g, b] = rgb
  const scalar = r * d.kc[0] + g * d.kc[1] + b * d.kc[2]
  let kfg: number
  let dist = 0
  if (d.mode === 'luminance') {
    kfg = keyingLuma(rgb, d.lumaMath)
  } else if (d.mode === 'color') {
    kfg = d.kcSum === 0 ? keyingLuma(rgb, d.lumaMath) : scalar / d.kcSum
  } else {
    const norm2 = r * r + g * g + b * b
    const proj2 = d.kcNorm2 > 0 ? (scalar * scalar) / d.kcNorm2 : 0
    dist = Math.sqrt(Math.max(0, norm2 - proj2))
    kfg = (d.kcSum === 0 ? keyingLuma(rgb, d.lumaMath) : scalar / d.kcSum)
      - dist
  }

  const kbg = d.mode === 'none' ? 1 : keyerKeyBg(kfg, d)

  let out: Rgb = [r, g, b]
  if (d.desp > 0 && (d.mode === 'screen' || d.mode === 'none')
      && d.kcNorm2 > 0) {
    const kcNorm = Math.sqrt(d.kcNorm2)
    const along = scalar / kcNorm
    const cone = dist * d.closing
    const maxdesp = kbg * Math.min(d.desp, 1)
      + (1 - kbg) * Math.max(0, d.desp - 1)
    let shift = maxdesp * Math.max(kcNorm, along - cone)
    shift = Math.min(shift, along - cone)
    if (!(along > cone && shift > 0)) shift = 0
    out = [
      out[0] - (shift * d.kc[0]) / kcNorm,
      out[1] - (shift * d.kc[1]) / kcNorm,
      out[2] - (shift * d.kc[2]) / kcNorm,
    ]
  }

  const alpha = clamp(1 - kbg, 0, 1)
  return [
    clamp(out[0] * alpha, 0, 1),
    clamp(out[1] * alpha, 0, 1),
    clamp(out[2] * alpha, 0, 1),
    alpha,
  ]
}

export interface PikParams {
  screen: string
  pickColor: string
  redWeight: number
  blueGreenWeight: number
  alphaBias: string
  despillBias: string
  useAlphaBias: boolean
  screenSubtraction: boolean
  clampAlpha: boolean
  clipBlack: number
  clipWhite: number
  replaceMode: string
  replaceColor: string
}

export interface PikDerived {
  ab: Rgb
  db: Rgb
  constC: Rgb
  screenKind: string
  rw: number
  gbw: number
  screenSubtraction: boolean
  clampAlpha: boolean
  clipMin: number
  clipMax: number
  replaceMode: string
  repCol: Rgb
}

export function derivePik(p: Partial<PikParams>): PikDerived {
  const abRaw = parseKeyColor(p.alphaBias, [0.5, 0.5, 0.5])
    .map((v) => Math.max(1e-4, v)) as Rgb
  const lumAb = keyingLuma(abRaw)
  const ab = abRaw.map((v) => v / lumAb) as Rgb
  const useAb = p.useAlphaBias ?? true
  const db = useAb
    ? ([...ab] as Rgb)
    : (parseKeyColor(p.despillBias, [0.5, 0.5, 0.5])
        .map((v) => Math.max(1e-4, v) / lumAb) as Rgb)

  const pick = parseKeyColor(p.pickColor, [0, 1, 0])
  const screen = p.screen ?? 'green'
  const screenKind = screen === 'pick'
    ? (pick[1] / ab[1] > pick[2] / ab[2] ? 'green' : 'blue')
    : screen

  const clipMin = clamp(p.clipBlack ?? 0, 0, 1)
  return {
    ab,
    db,
    constC: [pick[0] / ab[0], pick[1] / ab[1], pick[2] / ab[2]],
    screenKind,
    rw: p.redWeight ?? 0.5,
    gbw: p.blueGreenWeight ?? 0.5,
    screenSubtraction: p.screenSubtraction ?? true,
    clampAlpha: p.clampAlpha ?? true,
    clipMin,
    clipMax: Math.max(clipMin + 1e-4, Math.min(1, p.clipWhite ?? 1)),
    replaceMode: p.replaceMode ?? 'soft',
    repCol: parseKeyColor(p.replaceColor, [0.5, 0.5, 0.5]),
  }
}

export function applyPik(rgb: Rgb, d: PikDerived): Rgba {
  const fg = rgb
  const c = d.constC
  const pfg: Rgb = [fg[0] / d.ab[0], fg[1] / d.ab[1], fg[2] / d.ab[2]]

  let pfgKey: number
  let cKey: number
  let cPrim: number
  if (d.screenKind === 'green') {
    pfgKey = pfg[1] - pfg[0] * d.rw - pfg[2] * d.gbw
    cKey = c[1] - c[0] * d.rw - c[2] * d.gbw
    cPrim = c[1]
  } else {
    pfgKey = pfg[2] - pfg[0] * d.rw - pfg[1] * d.gbw
    cKey = c[2] - c[0] * d.rw - c[1] * d.gbw
    cPrim = c[2]
  }

  let alpha = 1 - pfgKey / (cKey <= 0 ? 1 : cKey)
  if (cPrim <= 0 || pfgKey <= 0 || cKey <= 0) alpha = 1

  let out: Rgb
  if (d.screenSubtraction) {
    out = alpha >= 1
      ? ([...fg] as Rgb)
      : ([
          Math.max(0, fg[0] + c[0] * d.db[0] * (alpha - 1)),
          Math.max(0, fg[1] + c[1] * d.db[1] * (alpha - 1)),
          Math.max(0, fg[2] + c[2] * d.db[2] * (alpha - 1)),
        ] as Rgb)
  } else {
    out = [...fg] as Rgb
  }

  if (d.clampAlpha) alpha = clamp(alpha, 0, 1)

  let clipped = clamp((alpha - d.clipMin) / (d.clipMax - d.clipMin), 0, 1)
  if (alpha <= d.clipMin) clipped = 0
  if (alpha >= d.clipMax) clipped = 1
  const down = clipped < alpha
  const up = clipped > alpha
  const safe = alpha > 0 ? alpha : 1
  if (down) out = out.map((v) => (v * clipped) / safe) as Rgb
  if (d.replaceMode !== 'none' && up) {
    const diff = clipped - alpha
    if (d.replaceMode === 'source') {
      out = [out[0] + fg[0] * diff, out[1] + fg[1] * diff,
        out[2] + fg[2] * diff]
    } else if (d.replaceMode === 'hard') {
      out = [out[0] + d.repCol[0] * diff, out[1] + d.repCol[1] * diff,
        out[2] + d.repCol[2] * diff]
    } else {
      const w = diff * keyingLuma(fg)
      out = [out[0] + d.repCol[0] * w, out[1] + d.repCol[1] * w,
        out[2] + d.repCol[2] * w]
    }
  }
  alpha = clipped

  if (!d.screenSubtraction) {
    out = out.map((v) => v * alpha) as Rgb
  }

  return [out[0], out[1], out[2], alpha]
}
