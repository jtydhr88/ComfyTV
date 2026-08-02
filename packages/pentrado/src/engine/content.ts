export interface ContentEntry {
  id: string

  canvas: HTMLCanvasElement
  width: number
  height: number
  uploadedUrl: string | null

  isBlank?: boolean
}

export interface ContentEdit {
  x: number
  y: number
  w: number
  h: number
  pixels: Uint8ClampedArray
}

export interface ContentStore {
  register(
    canvas: HTMLCanvasElement,
    opts?: {
      id?: string
      uploadedUrl?: string

      uniform?: [number, number, number, number]

      pixels?: Uint8ClampedArray

      transient?: boolean
    }
  ): string
  get(id: string): ContentEntry | undefined
  has(id: string): boolean

  derive?(baseId: string, edits: ContentEdit[], opts?: { uploadedUrl?: string }): string | null

  thumbnailCanvas?(id: string, maxDim: number): HTMLCanvasElement | null

  exportCanvas?(id: string): HTMLCanvasElement | null

  registerUniform?(width: number, height: number, rgba: [number, number, number, number]): string

  tileGridOf?(id: string): import('./tile/tileBuffer').TileGrid | null

  alphaAt?(id: string, x: number, y: number): number | null

  dirtyIds(): string[]
  markUploaded(id: string, url: string): void

  collectGarbage(liveIds: Set<string>): void

  trim?(pinned: Set<string>, keepMaterial?: Set<string>): void
  totalBytes(): number
}
