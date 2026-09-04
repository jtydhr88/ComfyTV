import type { Rect } from '../node'
import { modeUniforms } from './modeCodes'
import type { Compositor, CompositeInput, CompositorInit, FBOHandle } from '../compositor'
import { TileAtlas } from './tileAtlas'
import {
  ADJUST_FRAG,
  BLEND_COMMON,
  COPY_FRAG,
  LAYER_BLEND_FRAG,
  PRESENT_FRAG,
  TILE_MAIN,
  TILE_VERT,
  VERT,
  compile,
  flipRows,
  link,
} from './glShaders'
import {
  LAYER_QUAD,
  MASK_QUAD,
  bindQuadUniforms,
  blit,
  clearTarget,
  createGlState,
  drawFullscreen,
  freeTargetObj,
  getFallback,
  getLutTex,
  loc,
  makeTarget,
  presentToDefault,
} from './glState'
import { resolveTexture, sweepTexCache, uploadSource } from './glTextures'
import { drawTileInput, sweepInstanceCache } from './glTilePass'

export function createWebGLCompositor(): Compositor {
  const s = createGlState()

  function dropContextState(): void {
    s.targets.clear()
    s.texCache.clear()
    s.instanceCache.clear()
    s.uniformCache = new WeakMap()
    s.ping = s.pong = s.result = null
    s.resultValid = false
    s.fallback = null
    s.lutTex = null
    s.blendProg = s.presentProg = s.copyProg = s.adjustProg = s.tileProg = null
    s.atlas = null
    s.gl = null
    s.canvas = null
  }

  function setupContext(): boolean {
    try {
      const c =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(s.width, s.height)
          : document.createElement('canvas')
      if (!(c instanceof OffscreenCanvas)) {
        c.width = s.width
        c.height = s.height
      }
      const ctx = (c as HTMLCanvasElement | OffscreenCanvas).getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      }) as WebGL2RenderingContext | null
      if (!ctx) return false
      if (!ctx.getExtension('EXT_color_buffer_float')) return false
      s.canvas = c
      s.gl = ctx
      s.contextLost = false
      c.addEventListener('webglcontextlost', (e: Event) => {
        e.preventDefault()
        s.contextLost = true
        if (s.disposed) return
        console.warn('[pentrado] WebGL context lost — recreating')
        queueMicrotask(() => {
          if (recover()) s.onRestored?.()
        })
      })
      const gl = s.gl
      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      s.blendProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, LAYER_BLEND_FRAG))
      s.presentProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, PRESENT_FRAG))
      s.copyProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, COPY_FRAG))
      s.adjustProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, ADJUST_FRAG))
      s.tileProg = link(
        gl,
        compile(gl, gl.VERTEX_SHADER, TILE_VERT),
        compile(gl, gl.FRAGMENT_SHADER, BLEND_COMMON + TILE_MAIN)
      )
      s.atlas = new TileAtlas(gl)
      s.ping = makeTarget(s, s.width, s.height)
      s.pong = makeTarget(s, s.width, s.height)
      return true
    } catch {
      dropContextState()
      return false
    }
  }

  function recover(): boolean {
    if (s.disposed) return false
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    if (now - s.lastRecover < 1000) return false
    s.lastRecover = now
    dropContextState()
    return setupContext()
  }

  function ensureHealthy(): boolean {
    if (s.disposed) return false
    if (s.gl && !s.contextLost && !s.gl.isContextLost()) return true
    s.contextLost = true
    if (!recover()) return false
    if (s.onRestored) queueMicrotask(s.onRestored)
    return true
  }

  function clipRect(region: Rect | undefined | null): Rect | null | 'empty' {
    if (!region) return null
    const x = Math.max(0, Math.floor(region.x))
    const y = Math.max(0, Math.floor(region.y))
    const w = Math.min(s.width, Math.ceil(region.x + region.w)) - x
    const h = Math.min(s.height, Math.ceil(region.y + region.h)) - y
    if (w <= 0 || h <= 0) return 'empty'
    return w < s.width || h < s.height ? { x, y, w, h } : null
  }

  return {
    init(opts: CompositorInit): boolean {
      if (s.gl) dropContextState()
      s.width = opts.width
      s.height = opts.height
      s.onRestored = opts.onContextRestored
      s.disposed = false
      if (setupContext()) return true
      dropContextState()
      return false
    },

    beginFrame(): void {
      s.generation += 1
      s.atlas?.beginFrame()
      if (s.generation % 16 === 0) s.atlas?.sweepDead()
    },

    resize(w: number, h: number): void {
      if (w === s.width && h === s.height) return
      s.width = w
      s.height = h
      if (!ensureHealthy() || !s.gl) return
      if (s.canvas) {
        s.canvas.width = w
        s.canvas.height = h
      }
      if (s.ping) freeTargetObj(s, s.ping)
      if (s.pong) freeTargetObj(s, s.pong)
      if (s.result) freeTargetObj(s, s.result)
      s.ping = makeTarget(s, w, h)
      s.pong = makeTarget(s, w, h)
      s.result = null
      s.resultValid = false
    },

    composite(inputs: CompositeInput[], target?: FBOHandle | null, region?: Rect): void {
      if (!ensureHealthy()) return
      if (!s.gl || !s.blendProg || !s.ping || !s.pong) return
      const g = s.gl
      const blendProg = s.blendProg
      g.disable(g.SCISSOR_TEST)

      let clip: Rect | null = null
      if (!target && region && s.resultValid && s.result) {
        const c = clipRect(region)
        if (c === 'empty') return
        clip = c
      }
      if (clip) {
        g.enable(g.SCISSOR_TEST)
        g.scissor(clip.x, s.height - (clip.y + clip.h), clip.w, clip.h)
      }

      let read = s.ping
      let write = s.pong
      clearTarget(s, read)
      const temps: WebGLTexture[] = []

      for (const input of inputs) {
        clearTarget(s, write)
        g.bindFramebuffer(g.FRAMEBUFFER, write.fbo)
        g.viewport(0, 0, write.width, write.height)

        if ('tiles' in input) {
          drawTileInput(s, input, read, write, temps)
          const t = read
          read = write
          write = t
          continue
        }

        if ('adjust' in input) {
          const adjustProg = s.adjustProg
          if (!adjustProg) continue
          g.useProgram(adjustProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(s, adjustProg, 'u_backdrop'), 0)
          g.activeTexture(g.TEXTURE2)
          g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(s, input.mask, temps) : getFallback(s))
          g.uniform1i(loc(s, adjustProg, 'u_mask'), 2)
          g.uniform1i(loc(s, adjustProg, 'u_hasMask'), input.mask ? 1 : 0)
          g.uniform2f(loc(s, adjustProg, 'u_docSize'), s.width, s.height)
          bindQuadUniforms(s, adjustProg, input.mask, MASK_QUAD)
          g.uniform1f(loc(s, adjustProg, 'u_opacity'), input.opacity)
          g.uniform1i(loc(s, adjustProg, 'u_op'), input.adjust.op)
          const p = input.adjust.params
          g.uniform4f(loc(s, adjustProg, 'u_p0'), p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0)
          g.uniform4f(loc(s, adjustProg, 'u_p1'), p[4] ?? 0, p[5] ?? 0, p[6] ?? 0, p[7] ?? 0)
          g.uniform4f(loc(s, adjustProg, 'u_p2'), p[8] ?? 0, p[9] ?? 0, p[10] ?? 0, p[11] ?? 0)
          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, getLutTex(s, input.adjust.lut))
          g.uniform1i(loc(s, adjustProg, 'u_lut'), 1)
        } else {
          g.useProgram(blendProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(s, blendProg, 'u_backdrop'), 0)

          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, resolveTexture(s, input.texture, temps))
          g.uniform1i(loc(s, blendProg, 'u_layer'), 1)

          g.activeTexture(g.TEXTURE2)
          g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(s, input.mask, temps) : getFallback(s))
          g.uniform1i(loc(s, blendProg, 'u_mask'), 2)
          g.uniform1i(loc(s, blendProg, 'u_hasMask'), input.mask ? 1 : 0)

          g.uniform2f(loc(s, blendProg, 'u_docSize'), s.width, s.height)
          bindQuadUniforms(s, blendProg, input.texture, LAYER_QUAD)
          bindQuadUniforms(s, blendProg, input.mask, MASK_QUAD)

          g.uniform1i(loc(s, blendProg, 'u_srgbLayer'), input.texture.linear ? 0 : 1)
          g.uniform1f(loc(s, blendProg, 'u_opacity'), input.opacity)
          const u = modeUniforms(input.mode)
          g.uniform1i(loc(s, blendProg, 'u_blend'), u.blend)
          g.uniform1i(loc(s, blendProg, 'u_composite'), u.composite)
          g.uniform1i(loc(s, blendProg, 'u_blendSpace'), u.blendSpace)
          g.uniform1i(loc(s, blendProg, 'u_compositeSpace'), u.compositeSpace)
          g.uniform1i(loc(s, blendProg, 'u_clip'), input.clipToBackdrop ? 1 : 0)
        }

        drawFullscreen(s)
        const tmp = read
        read = write
        write = tmp
      }

      for (const tex of temps) g.deleteTexture(tex)
      sweepTexCache(s)
      sweepInstanceCache(s)

      if (target) {
        const dst = s.targets.get(target.id)
        if (dst) blit(s, read, dst)
        return
      }

      if (!s.result || s.result.width !== s.width || s.result.height !== s.height) {
        if (s.result) freeTargetObj(s, s.result)
        s.result = makeTarget(s, s.width, s.height)
        s.resultValid = false
      }
      blit(s, read, s.result)
      if (clip) g.disable(g.SCISSOR_TEST)
      s.resultValid = true
    },

    allocTarget(w: number, h: number): FBOHandle {
      const id = s.nextHandle++
      if (s.gl) s.targets.set(id, makeTarget(s, w, h))
      return { id, width: w, height: h }
    },

    freeTarget(handle: FBOHandle): void {
      const t = s.targets.get(handle.id)
      if (t) {
        freeTargetObj(s, t)
        s.targets.delete(handle.id)
      }
    },

    targetTexture(handle: FBOHandle): WebGLTexture {
      const t = s.targets.get(handle.id)
      if (!t) {
        if (!s.gl) return {} as WebGLTexture
        throw new Error(`Unknown target: ${handle.id}`)
      }
      return t.tex
    },

    upload(source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture {
      return uploadSource(s, source)
    },

    readback(region?: Rect): ImageData {
      const empty = () => new ImageData(Math.max(1, s.width), Math.max(1, s.height))
      if (!ensureHealthy() || !s.gl || !s.ping) return empty()
      const g = s.gl

      const c = clipRect(region)
      if (c === 'empty') return new ImageData(1, 1)
      const clip = c

      presentToDefault(s, s.result ?? s.ping, clip)
      g.bindFramebuffer(g.FRAMEBUFFER, null)
      if (clip) {
        const px = new Uint8ClampedArray(clip.w * clip.h * 4)
        g.readPixels(clip.x, s.height - (clip.y + clip.h), clip.w, clip.h, g.RGBA, g.UNSIGNED_BYTE, px)
        flipRows(px, clip.w, clip.h)
        return new ImageData(px, clip.w, clip.h)
      }
      const px = new Uint8ClampedArray(s.width * s.height * 4)
      g.readPixels(0, 0, s.width, s.height, g.RGBA, g.UNSIGNED_BYTE, px)
      flipRows(px, s.width, s.height)
      return new ImageData(px, s.width, s.height)
    },

    presentCanvas(clip?: Rect | null): HTMLCanvasElement | OffscreenCanvas | null {
      if (!ensureHealthy() || !s.gl || !s.ping) return null
      const c = clipRect(clip)
      if (c === 'empty') return s.canvas
      presentToDefault(s, s.result ?? s.ping, c)
      return s.canvas
    },

    async toBlob(): Promise<Blob> {
      const data = this.readback()
      const c = document.createElement('canvas')
      c.width = data.width
      c.height = data.height
      c.getContext('2d')!.putImageData(data, 0, 0)
      return await new Promise<Blob>((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
      )
    },

    getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
      return s.canvas
    },

    debugStats() {
      const a = s.atlas?.stats() ?? { atlases: 0, residentSlots: 0, vramBytes: 0 }
      return {
        tilePasses: s.tilePasses,
        atlases: a.atlases,
        atlasSlots: a.residentSlots,
        atlasVramBytes: a.vramBytes,
        texCacheEntries: s.texCache.size,
      }
    },

    dispose(): void {
      s.disposed = true
      const gl = s.gl
      if (!gl) return
      if (s.ping) freeTargetObj(s, s.ping)
      if (s.pong) freeTargetObj(s, s.pong)
      if (s.result) freeTargetObj(s, s.result)
      for (const t of s.targets.values()) freeTargetObj(s, t)
      s.targets.clear()
      for (const entry of s.texCache.values()) gl.deleteTexture(entry.tex)
      s.texCache.clear()
      if (s.fallback) gl.deleteTexture(s.fallback)
      if (s.lutTex) gl.deleteTexture(s.lutTex)
      for (const entry of s.instanceCache.values()) gl.deleteBuffer(entry.buffer)
      s.instanceCache.clear()
      s.atlas?.dispose()
      s.atlas = null
      if (s.tileProg) gl.deleteProgram(s.tileProg)
      s.tileProg = null
      if (s.blendProg) gl.deleteProgram(s.blendProg)
      if (s.presentProg) gl.deleteProgram(s.presentProg)
      if (s.copyProg) gl.deleteProgram(s.copyProg)
      if (s.adjustProg) gl.deleteProgram(s.adjustProg)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      s.gl = null
      s.ping = s.pong = s.result = null
      s.lutTex = null
      s.fallback = s.blendProg = s.presentProg = s.copyProg = s.adjustProg = null
    },
  }
}
