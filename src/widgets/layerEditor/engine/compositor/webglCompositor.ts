import type { Rect } from '../node'
import { modeUniforms } from './modeCodes'
import type {
  Compositor,
  CompositeInput,
  CompositorInit,
  FBOHandle,
  NodeTexture,
} from '../compositor'
import LAYER_BLEND_FRAG from './shaders/layerBlend.frag?raw'

const VERT = `#version 300 es
out vec2 v_texCoord;
void main() {
  vec2 v[3] = vec2[](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  v_texCoord = v[gl_VertexID] * 0.5 + 0.5;
  gl_Position = vec4(v[gl_VertexID], 0.0, 1.0);
}`

const PRESENT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
float lin2srgb(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92*c : 1.055*pow(c,1.0/2.4)-0.055; }
void main(){
  vec4 c = texture(u_tex, v_texCoord);
  fragColor = vec4(lin2srgb(c.r), lin2srgb(c.g), lin2srgb(c.b), clamp(c.a, 0.0, 1.0));
}`

const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
void main(){ fragColor = texture(u_tex, v_texCoord); }`

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  width: number
  height: number
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'compile failed'
    gl.deleteShader(sh)
    throw new Error(log)
  }
  return sh
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? 'link failed'
    gl.deleteProgram(p)
    throw new Error(log)
  }
  return p
}

export function createWebGLCompositor(): Compositor {
  let canvas: OffscreenCanvas | HTMLCanvasElement | null = null
  let gl: WebGL2RenderingContext | null = null
  let blendProg: WebGLProgram | null = null
  let presentProg: WebGLProgram | null = null
  let copyProg: WebGLProgram | null = null
  let ping: Target | null = null
  let pong: Target | null = null
  let result: Target | null = null
  let fallback: WebGLTexture | null = null
  let width = 0
  let height = 0
  let nextHandle = 1
  const targets = new Map<number, Target>()
  const uniformCache = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>()

  function loc(prog: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = uniformCache.get(prog)
    if (!m) {
      m = new Map()
      uniformCache.set(prog, m)
    }
    if (!m.has(name)) m.set(name, gl!.getUniformLocation(prog, name))
    return m.get(name)!
  }

  function makeTarget(w: number, h: number): Target {
    const g = gl!
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

  function freeTargetObj(t: Target): void {
    gl?.deleteFramebuffer(t.fbo)
    gl?.deleteTexture(t.tex)
  }

  function drawFullscreen(): void {
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }

  function asTexture(src: NodeTexture['source']): WebGLTexture {
    if (src instanceof WebGLTexture) return src
    return uploadSource(src)
  }

  function uploadSource(src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture {
    const g = gl!
    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    return tex
  }

  function getFallback(): WebGLTexture {
    if (!fallback) {
      const g = gl!
      fallback = g.createTexture()!
      g.bindTexture(g.TEXTURE_2D, fallback)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    }
    return fallback
  }

  function clearTarget(t: Target): void {
    const g = gl!
    g.bindFramebuffer(g.FRAMEBUFFER, t.fbo)
    g.viewport(0, 0, t.width, t.height)
    g.clearColor(0, 0, 0, 0)
    g.clear(g.COLOR_BUFFER_BIT)
  }

  return {
    init(opts: CompositorInit): boolean {
      try {
        width = opts.width
        height = opts.height
        canvas =
          typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(width, height)
            : document.createElement('canvas')
        if (!(canvas instanceof OffscreenCanvas)) {
          canvas.width = width
          canvas.height = height
        }
        const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext('webgl2', {
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: true,
        }) as WebGL2RenderingContext | null
        if (!ctx) return false
        gl = ctx
        if (!gl.getExtension('EXT_color_buffer_float')) return false
        const vs = compile(gl, gl.VERTEX_SHADER, VERT)
        blendProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, LAYER_BLEND_FRAG))
        presentProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, PRESENT_FRAG))
        copyProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, COPY_FRAG))
        ping = makeTarget(width, height)
        pong = makeTarget(width, height)
        return true
      } catch {
        this.dispose()
        return false
      }
    },

    resize(w: number, h: number): void {
      if (!gl || (w === width && h === height)) return
      width = w
      height = h
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      ping = makeTarget(w, h)
      pong = makeTarget(w, h)
    },

    composite(inputs: CompositeInput[], target?: FBOHandle | null, _region?: Rect): void {
      if (!gl || !blendProg || !ping || !pong) return
      const g = gl
      let read = ping
      let write = pong
      clearTarget(read)

      g.useProgram(blendProg)
      for (const input of inputs) {
        clearTarget(write)
        g.bindFramebuffer(g.FRAMEBUFFER, write.fbo)
        g.viewport(0, 0, write.width, write.height)

        g.activeTexture(g.TEXTURE0)
        g.bindTexture(g.TEXTURE_2D, read.tex)
        g.uniform1i(loc(blendProg, 'u_backdrop'), 0)

        g.activeTexture(g.TEXTURE1)
        g.bindTexture(g.TEXTURE_2D, asTexture(input.texture.source))
        g.uniform1i(loc(blendProg, 'u_layer'), 1)

        g.activeTexture(g.TEXTURE2)
        g.bindTexture(g.TEXTURE_2D, input.mask ? asTexture(input.mask.source) : getFallback())
        g.uniform1i(loc(blendProg, 'u_mask'), 2)
        g.uniform1i(loc(blendProg, 'u_hasMask'), input.mask ? 1 : 0)

        g.uniform1i(loc(blendProg, 'u_srgbLayer'), input.texture.linear ? 0 : 1)
        g.uniform1f(loc(blendProg, 'u_opacity'), input.opacity)
        const u = modeUniforms(input.mode)
        g.uniform1i(loc(blendProg, 'u_blend'), u.blend)
        g.uniform1i(loc(blendProg, 'u_composite'), u.composite)
        g.uniform1i(loc(blendProg, 'u_blendSpace'), u.blendSpace)
        g.uniform1i(loc(blendProg, 'u_compositeSpace'), u.compositeSpace)

        drawFullscreen()
        const tmp = read
        read = write
        write = tmp
      }

      result = read
      if (target) {
        const dst = targets.get(target.id)
        if (dst) blit(read, dst)
      }
    },

    allocTarget(w: number, h: number): FBOHandle {
      const t = makeTarget(w, h)
      const id = nextHandle++
      targets.set(id, t)
      return { id, width: w, height: h }
    },

    freeTarget(handle: FBOHandle): void {
      const t = targets.get(handle.id)
      if (t) {
        freeTargetObj(t)
        targets.delete(handle.id)
      }
    },

    targetTexture(handle: FBOHandle): WebGLTexture {
      const t = targets.get(handle.id)
      if (!t) throw new Error(`Unknown target: ${handle.id}`)
      return t.tex
    },

    upload(source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture {
      return uploadSource(source)
    },

    readback(_region?: Rect): ImageData {
      const g = gl!

      presentToDefault(result ?? ping!)
      g.bindFramebuffer(g.FRAMEBUFFER, null)
      const px = new Uint8ClampedArray(width * height * 4)
      g.readPixels(0, 0, width, height, g.RGBA, g.UNSIGNED_BYTE, px)
      flipRows(px, width, height)
      return new ImageData(px, width, height)
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
      return canvas
    },

    dispose(): void {
      if (!gl) return
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      for (const t of targets.values()) freeTargetObj(t)
      targets.clear()
      if (fallback) gl.deleteTexture(fallback)
      if (blendProg) gl.deleteProgram(blendProg)
      if (presentProg) gl.deleteProgram(presentProg)
      if (copyProg) gl.deleteProgram(copyProg)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      gl = null
      ping = pong = result = null
      fallback = blendProg = presentProg = copyProg = null
    },
  }

  function presentToDefault(src: Target): void {
    const g = gl!
    g.useProgram(presentProg!)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.viewport(0, 0, width, height)
    g.clearColor(0, 0, 0, 0)
    g.clear(g.COLOR_BUFFER_BIT)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, src.tex)
    g.uniform1i(loc(presentProg!, 'u_tex'), 0)
    drawFullscreen()
  }

  function blit(src: Target, dst: Target): void {
    const g = gl!
    g.useProgram(copyProg!)
    g.bindFramebuffer(g.FRAMEBUFFER, dst.fbo)
    g.viewport(0, 0, dst.width, dst.height)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, src.tex)
    g.uniform1i(loc(copyProg!, 'u_tex'), 0)
    drawFullscreen()
  }
}

function flipRows(px: Uint8ClampedArray, w: number, h: number): void {
  const row = w * 4
  const tmp = new Uint8ClampedArray(row)
  for (let y = 0; y < h >> 1; y++) {
    const top = y * row
    const bot = (h - 1 - y) * row
    tmp.set(px.subarray(top, top + row))
    px.copyWithin(top, bot, bot + row)
    px.set(tmp, bot)
  }
}
