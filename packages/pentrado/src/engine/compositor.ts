import type { EffectiveMode } from './mode'
import type { Rect, Transform } from './node'
import type { TileGrid } from './tile/tileBuffer'

export interface NodeTexture {
  source: WebGLTexture | HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  rect: Rect
  linear: boolean

  quad?: Transform
  key?: string

  stamp?: string
  version?: number

  dirtyRects?: Rect[]
}

export interface LayerInput {
  texture: NodeTexture
  mode: EffectiveMode
  opacity: number
  mask?: NodeTexture
}

export interface AdjustmentInput {
  adjust: { op: number; params: number[]; lut?: Uint8Array }
  opacity: number
  mask?: NodeTexture
}

export interface TileLayerInput {
  tiles: {
    grid: TileGrid
    quad: Transform
    linear: boolean
    drawZero: boolean
  }
  mode: EffectiveMode
  opacity: number
  mask?: NodeTexture
}

export type CompositeInput = LayerInput | AdjustmentInput | TileLayerInput

export interface CompositorInit {
  width: number
  height: number
  onContextRestored?: () => void
}

export interface Compositor {
  init(opts: CompositorInit): boolean
  beginFrame?(): void
  resize(width: number, height: number): void

  composite(inputs: CompositeInput[], target?: FBOHandle | null, region?: Rect): void

  allocTarget(width: number, height: number): FBOHandle
  freeTarget(handle: FBOHandle): void

  targetTexture(handle: FBOHandle): WebGLTexture

  upload(source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture

  readback(region?: Rect): ImageData

  presentCanvas(clip?: Rect | null): HTMLCanvasElement | OffscreenCanvas | null
  toBlob(): Promise<Blob>
  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null

  debugStats?(): { tilePasses: number; atlases: number; atlasSlots: number; atlasVramBytes: number; texCacheEntries: number }
  dispose(): void
}

export interface FBOHandle {
  readonly id: number
  readonly width: number
  readonly height: number
}
