import type { Compositor, CompositeInput, FBOHandle } from '../compositor'
import { rasterKind } from '../kinds/raster'

export class FakeCompositor implements Compositor {
  init() {
    return true
  }
  resize() {}
  composite(_inputs: CompositeInput[], _t?: FBOHandle | null) {}
  allocTarget(width: number, height: number): FBOHandle {
    return { id: 1, width, height }
  }
  freeTarget() {}
  targetTexture(): WebGLTexture {
    return {} as WebGLTexture
  }
  upload(): WebGLTexture {
    return {} as WebGLTexture
  }
  readback(): ImageData {
    return new ImageData(1, 1)
  }
  presentCanvas() {
    return null
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return null
  }
  dispose() {}
}

export const ev = { pressure: 0.5, shiftKey: false } as unknown as PointerEvent

export function stub2d(): () => void {
  const orig = HTMLCanvasElement.prototype.getContext
  ;(HTMLCanvasElement.prototype as any).getContext = function (kind: string) {
    if (kind !== '2d') return null
    return {
      canvas: this,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: () => {},
      fillRect: () => {},
      clearRect: () => {},
      putImageData: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
      createImageData: (w: number, h: number) => new ImageData(w, h),
    } as unknown as CanvasRenderingContext2D
  }
  return () => {
    HTMLCanvasElement.prototype.getContext = orig
  }
}
