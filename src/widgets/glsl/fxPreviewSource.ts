export type FxPreviewSource = HTMLVideoElement | HTMLCanvasElement

export function fxSourceSize(src: FxPreviewSource): { w: number; h: number } {
  const v = src as HTMLVideoElement
  if (typeof v.videoWidth === 'number' && v.videoWidth > 0) {
    return { w: Math.max(2, v.videoWidth), h: Math.max(2, v.videoHeight) }
  }
  const c = src as HTMLCanvasElement
  return { w: Math.max(2, c.width || 0), h: Math.max(2, c.height || 0) }
}

export function fxSourceReady(src: FxPreviewSource): boolean {
  const v = src as HTMLVideoElement
  if (typeof v.videoWidth === 'number') return v.readyState >= 2
  const c = src as HTMLCanvasElement
  return (c.width || 0) > 0 && (c.height || 0) > 0
}
