export interface ChromaShiftParams {
  shiftRh: number
  shiftRv: number
  shiftBh: number
  shiftBv: number
  shiftEdge: string
}

function lumaOf(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function cbOf(r: number, g: number, b: number): number {
  return -0.168736 * r - 0.331264 * g + 0.5 * b + 128
}

function crOf(r: number, g: number, b: number): number {
  return 0.5 * r - 0.418688 * g - 0.081312 * b + 128
}

function samplePos(v: number, off: number, size: number,
                   wrap: boolean): number {
  let s = v - off
  if (wrap) {
    s = ((s % size) + size) % size
  } else {
    s = Math.max(0, Math.min(size - 1, s))
  }
  return s
}

export function applyChromaShiftImage(
  pixels: readonly number[][], w: number, h: number, p: ChromaShiftParams,
): number[][] {
  const wrap = p.shiftEdge === 'wrap'
  const oxB = 2 * p.shiftBh
  const oyB = 2 * p.shiftBv
  const oxR = 2 * p.shiftRh
  const oyR = 2 * p.shiftRv
  const out: number[][] = new Array(pixels.length)
  for (let y = 0; y < h; y++) {
    const byRow = samplePos(y, oyB, h, wrap)
    const ryRow = samplePos(y, oyR, h, wrap)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const [r, g, b] = pixels[i]
      const bi = byRow * w + samplePos(x, oxB, w, wrap)
      const ri = ryRow * w + samplePos(x, oxR, w, wrap)
      const yv = lumaOf(r, g, b)
      const cb = cbOf(pixels[bi][0], pixels[bi][1], pixels[bi][2])
      const cr = crOf(pixels[ri][0], pixels[ri][1], pixels[ri][2])
      const clamp = (v: number) =>
        Math.max(0, Math.min(255, Math.round(v)))
      out[i] = [
        clamp(yv + 1.402 * (cr - 128)),
        clamp(yv - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)),
        clamp(yv + 1.772 * (cb - 128)),
      ]
    }
  }
  return out
}
