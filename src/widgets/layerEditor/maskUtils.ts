
export function createOpaqueMask(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  return c
}

export function alphaMaskToLuminance(mask: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = mask.width
  out.height = mask.height
  const ctx = out.getContext('2d')!
  const src = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height)
  const dst = ctx.createImageData(mask.width, mask.height)
  const s = src.data
  const d = dst.data
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3]
    d[i] = a
    d[i + 1] = a
    d[i + 2] = a
    d[i + 3] = 255
  }
  ctx.putImageData(dst, 0, 0)
  return out
}

export function luminanceToAlphaMask(img: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const tmp = document.createElement('canvas')
  tmp.width = width
  tmp.height = height
  const tctx = tmp.getContext('2d')!
  tctx.drawImage(img, 0, 0, width, height)
  const src = tctx.getImageData(0, 0, width, height)

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const octx = out.getContext('2d')!
  const dst = octx.createImageData(width, height)
  const s = src.data
  const d = dst.data
  for (let i = 0; i < s.length; i += 4) {
    d[i] = 255
    d[i + 1] = 255
    d[i + 2] = 255
    d[i + 3] = s[i]
  }
  octx.putImageData(dst, 0, 0)
  return out
}
