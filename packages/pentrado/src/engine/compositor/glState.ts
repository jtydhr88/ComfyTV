import type { Rect } from '../node'
import type { NodeTexture } from '../compositor'
import type { TileGrid } from '../tile/tileBuffer'
import type { TileAtlas } from './tileAtlas'
import type { Target } from './glShaders'

export interface TexEntry {
  tex: WebGLTexture
  gen: number
  version?: number
  stamp?: string
  mipDirty: boolean
  hasMips: boolean
}

export interface InstanceBatch {
  atlas: number
  offset: number
  count: number
}

export interface InstanceEntry {
  buffer: WebGLBuffer
  batches: InstanceBatch[]
  epoch: number
  drawZero: boolean
  gen: number
  residency: number
}

export const FLOATS_PER_INSTANCE = 12

export interface GlState {
  canvas: OffscreenCanvas | HTMLCanvasElement | null
  gl: WebGL2RenderingContext | null
  blendProg: WebGLProgram | null
  tileProg: WebGLProgram | null
  presentProg: WebGLProgram | null
  copyProg: WebGLProgram | null
  adjustProg: WebGLProgram | null
  atlas: TileAtlas | null
  ping: Target | null
  pong: Target | null
  result: Target | null
  resultValid: boolean
  scratch2d: HTMLCanvasElement | null
  lastSweepGen: number
  fallback: WebGLTexture | null
  lutTex: WebGLTexture | null
  width: number
  height: number
  nextHandle: number
  generation: number
  contextLost: boolean
  disposed: boolean
  lastRecover: number
  onRestored: (() => void) | undefined
  targets: Map<number, Target>
  texCache: Map<string, TexEntry>
  uniformCache: WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>
  instanceCache: Map<TileGrid, InstanceEntry>
  proxyKeys: WeakMap<TileGrid, Map<number, object>>
  tilePasses: number
}

export function createGlState(): GlState {
  return {
    canvas: null,
    gl: null,
    blendProg: null,
    tileProg: null,
    presentProg: null,
    copyProg: null,
    adjustProg: null,
    atlas: null,
    ping: null,
    pong: null,
    result: null,
    resultValid: false,
    scratch2d: null,
    lastSweepGen: 0,
    fallback: null,
    lutTex: null,
    width: 0,
    height: 0,
    nextHandle: 1,
    generation: 0,
    contextLost: false,
    disposed: false,
    lastRecover: -Infinity,
    onRestored: undefined,
    targets: new Map(),
    texCache: new Map(),
    uniformCache: new WeakMap(),
    instanceCache: new Map(),
    proxyKeys: new WeakMap(),
    tilePasses: 0,
  }
}

export const LAYER_QUAD = { has: 'u_hasQuad', center: 'u_quadCenter', rot: 'u_quadRot', size: 'u_quadSize', src: 'u_srcSize' }
export const MASK_QUAD = {
  has: 'u_maskHasQuad',
  center: 'u_maskQuadCenter',
  rot: 'u_maskQuadRot',
  size: 'u_maskQuadSize',
  src: 'u_maskSrcSize',
}

export function loc(s: GlState, prog: WebGLProgram, name: string): WebGLUniformLocation | null {
  let m = s.uniformCache.get(prog)
  if (!m) {
    m = new Map()
    s.uniformCache.set(prog, m)
  }
  if (!m.has(name)) m.set(name, s.gl!.getUniformLocation(prog, name))
  return m.get(name)!
}

export function makeTarget(s: GlState, w: number, h: number): Target {
  const g = s.gl!
  const tex = g.createTexture()!
  g.bindTexture(g.TEXTURE_2D, tex)
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
  const fbo = g.createFramebuffer()!
  g.bindFramebuffer(g.FRAMEBUFFER, fbo)
  g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0)
  g.bindFramebuffer(g.FRAMEBUFFER, null)
  return { fbo, tex, width: w, height: h }
}

export function freeTargetObj(s: GlState, t: Target): void {
  s.gl?.deleteFramebuffer(t.fbo)
  s.gl?.deleteTexture(t.tex)
}

export function drawFullscreen(s: GlState): void {
  s.gl!.drawArrays(s.gl!.TRIANGLES, 0, 3)
}

export function bindQuadUniforms(
  s: GlState,
  prog: WebGLProgram,
  nt: NodeTexture | undefined,
  names: { has: string; center: string; rot: string; size: string; src: string }
): void {
  const g = s.gl!
  const q = nt?.quad
  if (!nt || !q || nt.source instanceof WebGLTexture) {
    g.uniform1i(loc(s, prog, names.has), 0)
    return
  }
  g.uniform1i(loc(s, prog, names.has), 1)
  g.uniform2f(loc(s, prog, names.center), q.x + q.w / 2, q.y + q.h / 2)
  g.uniform2f(loc(s, prog, names.rot), Math.cos(q.rotation), Math.sin(q.rotation))
  g.uniform2f(loc(s, prog, names.size), Math.max(1e-6, q.w), Math.max(1e-6, q.h))
  g.uniform2f(loc(s, prog, names.src), Math.max(1, nt.source.width), Math.max(1, nt.source.height))
}

export function getFallback(s: GlState): WebGLTexture {
  if (!s.fallback) {
    const g = s.gl!
    s.fallback = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, s.fallback)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
  }
  return s.fallback
}

export function getLutTex(s: GlState, lut?: Uint8Array): WebGLTexture {
  if (!lut) return getFallback(s)
  const g = s.gl!
  if (!s.lutTex) {
    s.lutTex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, s.lutTex)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
  } else {
    g.bindTexture(g.TEXTURE_2D, s.lutTex)
  }
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 256, 1, 0, g.RGBA, g.UNSIGNED_BYTE, lut)
  return s.lutTex
}

export function clearTarget(s: GlState, t: Target): void {
  const g = s.gl!
  g.bindFramebuffer(g.FRAMEBUFFER, t.fbo)
  g.viewport(0, 0, t.width, t.height)
  g.clearColor(0, 0, 0, 0)
  g.clear(g.COLOR_BUFFER_BIT)
}

export function presentToDefault(s: GlState, src: Target, clip?: Rect | null): void {
  const g = s.gl!
  g.disable(g.SCISSOR_TEST)
  if (clip) {
    g.enable(g.SCISSOR_TEST)
    g.scissor(clip.x, s.height - (clip.y + clip.h), clip.w, clip.h)
  }
  g.useProgram(s.presentProg!)
  g.bindFramebuffer(g.FRAMEBUFFER, null)
  g.viewport(0, 0, s.width, s.height)
  g.clearColor(0, 0, 0, 0)
  g.clear(g.COLOR_BUFFER_BIT)
  g.activeTexture(g.TEXTURE0)
  g.bindTexture(g.TEXTURE_2D, src.tex)
  g.uniform1i(loc(s, s.presentProg!, 'u_tex'), 0)
  drawFullscreen(s)
  if (clip) g.disable(g.SCISSOR_TEST)
}

export function blit(s: GlState, src: Target, dst: Target): void {
  const g = s.gl!
  g.useProgram(s.copyProg!)
  g.bindFramebuffer(g.FRAMEBUFFER, dst.fbo)
  g.viewport(0, 0, dst.width, dst.height)
  g.activeTexture(g.TEXTURE0)
  g.bindTexture(g.TEXTURE_2D, src.tex)
  g.uniform1i(loc(s, s.copyProg!, 'u_tex'), 0)
  drawFullscreen(s)
}
