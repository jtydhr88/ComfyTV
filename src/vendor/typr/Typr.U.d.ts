// Hand-written declarations for the vendored photopea/Typr.js (MIT).
// Covers only the surface the layer editor uses.

export interface TyprPath {
  cmds: string[]
  crds: number[]
}

export interface TyprShapeItem {
  /** glyph id */
  g: number
  /** cluster (source char index) */
  cl: number
  dx: number
  dy: number
  /** horizontal advance in font units */
  ax: number
  ay: number
}

export interface TyprFont {
  head: {
    unitsPerEm: number
    xMin: number
    yMin: number
    xMax: number
    yMax: number
  }
  hhea: {
    ascender: number
    descender: number
    lineGap: number
  }
  maxp?: { numGlyphs: number }
  name?: Record<string, string | number>
  [table: string]: unknown
}

export interface TyprU {
  shape(font: TyprFont, str: string, ltr?: boolean): TyprShapeItem[]
  shapeToPath(font: TyprFont, shape: TyprShapeItem[]): TyprPath
  codeToGlyph(font: TyprFont, code: number): number
  glyphToPath(font: TyprFont, gid: number): TyprPath
  pathToSVG(path: TyprPath, prec?: number): string
  pathToContext(path: TyprPath, ctx: CanvasRenderingContext2D): void
  initHB(url: string, cb: () => void): void
}

declare const Typr: {
  /** Variable fonts yield one entry per named instance. */
  parse(buffer: ArrayBuffer): TyprFont[]
  U: TyprU
}

export default Typr
