import type { EffectiveMode } from './mode'
import type { Rect } from './node'

export interface NodeTexture {
  source: WebGLTexture | HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  rect: Rect
  linear: boolean
}

export interface CompositeInput {
  texture: NodeTexture
  mode: EffectiveMode
  opacity: number
  mask?: NodeTexture
}

export interface CompositorInit {
  width: number
  height: number
}

export interface Compositor {
  init(opts: CompositorInit): boolean
  resize(width: number, height: number): void

  composite(inputs: CompositeInput[], target?: FBOHandle | null, region?: Rect): void

  allocTarget(width: number, height: number): FBOHandle
  freeTarget(handle: FBOHandle): void

  targetTexture(handle: FBOHandle): WebGLTexture

  upload(source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture

  readback(region?: Rect): ImageData
  toBlob(): Promise<Blob>
  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null
  dispose(): void
}

export interface FBOHandle {
  readonly id: number
  readonly width: number
  readonly height: number
}
