import {
  ParticleSimTs,
  TRAIL_LEN,
  type ParticleParams,
} from '@/composables/stages/particleSim'
import {
  fxSourceSize,
  type FxPreviewSource,
} from '@/widgets/glsl/fxPreviewSource'

const PYRAMID = [3, 5, 7, 9, 13, 17, 23, 31, 41, 55, 73, 97, 129]
const PREVIEW_FPS = 24

function spriteAlpha(kind: string, size: number): Float32Array {
  const r = size / 2
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - r + 0.5) / r
      const dy = (y - r + 0.5) / r
      const d = Math.sqrt(dx * dx + dy * dy)
      let tex: number
      if (kind === 'spark') {
        tex = Math.exp(-((d * 3.2) ** 2)) + Math.exp(-((d * 1.4) ** 2)) * 0.25
      } else if (kind === 'star') {
        const ang = Math.atan2(dy, dx)
        const spikes = Math.abs(Math.cos(ang * 2)) ** 6
        tex = Math.exp(-((d * 2.0) ** 2)) * (0.35 + 0.65 * spikes)
      } else {
        tex = Math.exp(-((d * 1.8) ** 2))
      }
      out[y * size + x] = d > 1 ? 0 : Math.min(1, tex)
    }
  }
  return out
}

export class ParticlesPreviewRenderer {
  private sim: ParticleSimTs | null = null
  private simKey = ''
  private lastT = -1
  private alphaCache = new Map<string, Float32Array>()
  private tintCache = new Map<string, HTMLCanvasElement>()

  private sprite(kind: string, sizePx: number,
                 color: [number, number, number]): HTMLCanvasElement {
    const qr = Math.round(color[0] * 15)
    const qg = Math.round(color[1] * 15)
    const qb = Math.round(color[2] * 15)
    const key = `${kind}|${sizePx}|${qr},${qg},${qb}`
    let c = this.tintCache.get(key)
    if (c) return c
    const aKey = `${kind}|${sizePx}`
    let alpha = this.alphaCache.get(aKey)
    if (!alpha) {
      alpha = spriteAlpha(kind, sizePx)
      this.alphaCache.set(aKey, alpha)
    }
    c = document.createElement('canvas')
    c.width = sizePx
    c.height = sizePx
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(sizePx, sizePx)
    const r255 = Math.round((qr / 15) * 255)
    const g255 = Math.round((qg / 15) * 255)
    const b255 = Math.round((qb / 15) * 255)
    for (let i = 0; i < alpha.length; i++) {
      img.data[i * 4] = r255
      img.data[i * 4 + 1] = g255
      img.data[i * 4 + 2] = b255
      img.data[i * 4 + 3] = Math.round(alpha[i] * 255)
    }
    ctx.putImageData(img, 0, 0)
    if (this.tintCache.size > 256) this.tintCache.clear()
    this.tintCache.set(key, c)
    return c
  }

  renderToCanvas(
    src: FxPreviewSource,
    params: Record<string, unknown>,
    target: HTMLCanvasElement,
    timeSec?: number,
  ): boolean {
    const { w, h } = fxSourceSize(src)
    if (target.width !== w) target.width = w
    if (target.height !== h) target.height = h
    const ctx = target.getContext('2d')
    if (!ctx) return false
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(src as CanvasImageSource, 0, 0, w, h)

    const p = params as ParticleParams
    if ((p.rate ?? 120) <= 0) return true
    const t = timeSec ?? 0
    const key = `${JSON.stringify(params)}|${w}x${h}`
    if (!this.sim || key !== this.simKey || t + 0.05 < this.lastT) {
      this.sim = new ParticleSimTs(p, w, h, PREVIEW_FPS)
      this.simKey = key
    }
    this.lastT = t
    this.sim.advanceTo(t)

    const snap = this.sim.snapshot()
    const kind = p.sprite || 'glow'
    const renderer = p.renderer || 'sprite'
    const stretch = Math.min(3, Math.max(0, p.stretch ?? 1))
    const trailN = Math.max(2, Math.min(TRAIL_LEN,
      Math.trunc(p.trail_len ?? 4)))
    const dt = 1 / PREVIEW_FPS
    ctx.globalCompositeOperation = (p.blend || 'additive') === 'over'
      ? 'source-over'
      : 'lighter'

    const stamp = (x: number, y: number, sizePx: number, opac: number,
                   color: [number, number, number]): void => {
      if (opac <= 0.003) return
      ctx.globalAlpha = Math.min(1, opac)
      const c = this.sprite(kind, sizePx, color)
      ctx.drawImage(c, Math.round(x) - sizePx / 2,
        Math.round(y) - sizePx / 2)
    }

    for (const pt of snap) {
      if (pt.size < 1) continue
      let best = PYRAMID[0]
      let bestD = Infinity
      for (const s of PYRAMID) {
        const d = Math.abs(s - pt.size * 2)
        if (d < bestD) {
          bestD = d
          best = s
        }
      }
      if (renderer === 'stretched') {
        for (let k = 0; k <= 3; k++) {
          const f = k / 3
          stamp(pt.x - pt.vx * dt * stretch * f * 2,
            pt.y - pt.vy * dt * stretch * f * 2,
            best, (pt.opacity / 4) * 1.6, pt.color)
        }
      } else if (renderer === 'trail') {
        stamp(pt.x, pt.y, best, pt.opacity, pt.color)
        for (let k = 1; k <= trailN; k++) {
          const fall = 1 - k / (trailN + 1)
          let tBest = PYRAMID[0]
          let tD = Infinity
          for (const s of PYRAMID) {
            const d = Math.abs(s - pt.size * 2 * (0.4 + 0.6 * fall))
            if (d < tD) {
              tD = d
              tBest = s
            }
          }
          stamp(pt.hx[k - 1], pt.hy[k - 1], tBest,
            pt.opacity * fall * 0.45, pt.color)
        }
      } else {
        stamp(pt.x, pt.y, best, pt.opacity, pt.color)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return true
  }

  isLost(): boolean {
    return false
  }

  dispose(): void {
    this.sim = null
    this.tintCache.clear()
    this.alphaCache.clear()
  }
}
