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

const ADJUST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_backdrop;
uniform sampler2D u_mask;
uniform bool u_hasMask;
uniform float u_opacity;
uniform int u_op;
uniform vec4 u_p0;
in vec2 v_texCoord;
out vec4 fragColor;

float s2l(float c){ return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float l2s(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92*c : 1.055*pow(c,1.0/2.4)-0.055; }
vec3 s2l(vec3 c){ return vec3(s2l(c.r), s2l(c.g), s2l(c.b)); }
vec3 l2s(vec3 c){ return vec3(l2s(c.r), l2s(c.g), l2s(c.b)); }

float bc(float v, float b, float c){
  float hb = b * 0.5;
  float o = hb < 0.0 ? v * (1.0 + hb) : v + (1.0 - v) * hb;
  return (o - 0.5) * tan((c + 1.0) * 0.78539816) + 0.5;
}

vec3 rgb2hsl(vec3 c){
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  if (mx == mn) return vec3(0.0, 0.0, l);
  float d = mx - mn;
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}

float hue2rgb(float p, float q, float t){
  float x = t;
  if (x < 0.0) x += 1.0;
  if (x > 1.0) x -= 1.0;
  if (x < 1.0/6.0) return p + (q - p) * 6.0 * x;
  if (x < 0.5) return q;
  if (x < 2.0/3.0) return p + (q - p) * (2.0/3.0 - x) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl){
  if (hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(hue2rgb(p, q, hsl.x + 1.0/3.0), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 1.0/3.0));
}

void main(){
  vec4 bg = texture(u_backdrop, v_texCoord);
  vec3 adjusted;
  if (u_op == 0) {
    adjusted = vec3(bc(bg.r, u_p0.x, u_p0.y), bc(bg.g, u_p0.x, u_p0.y), bc(bg.b, u_p0.x, u_p0.y));
  } else {
    vec3 g = l2s(clamp(bg.rgb, 0.0, 1.0));
    vec3 o;
    if (u_op == 1) {
      vec3 hsl = rgb2hsl(g);
      hsl.x = fract(hsl.x + u_p0.x + 1.0);
      hsl.y = clamp(hsl.y * (1.0 + u_p0.y), 0.0, 1.0);
      hsl.z = clamp(u_p0.z > 0.0 ? hsl.z + u_p0.z * (1.0 - hsl.z) : hsl.z + u_p0.z * hsl.z, 0.0, 1.0);
      o = hsl2rgb(hsl);
    } else {
      o = vec3(1.0) - g;
    }
    adjusted = s2l(o);
  }
  float t = u_opacity * (u_hasMask ? texture(u_mask, v_texCoord).r : 1.0);
  fragColor = vec4(mix(bg.rgb, adjusted, t), bg.a);
}`

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
  let adjustProg: WebGLProgram | null = null
  let ping: Target | null = null
  let pong: Target | null = null
  let result: Target | null = null
  let fallback: WebGLTexture | null = null
  let width = 0
  let height = 0
  let nextHandle = 1
  let generation = 0
  let contextLost = false
  let disposed = false
  let lastRecover = -Infinity
  let onRestored: (() => void) | undefined
  const targets = new Map<number, Target>()
  const texCache = new Map<string, { tex: WebGLTexture; gen: number }>()
  let uniformCache = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>()

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

  function resolveTexture(nt: NodeTexture, temps: WebGLTexture[]): WebGLTexture {
    if (nt.source instanceof WebGLTexture) return nt.source
    if (nt.key) {
      const hit = texCache.get(nt.key)
      if (hit) {
        hit.gen = generation
        return hit.tex
      }
      const tex = uploadSource(nt.source)
      texCache.set(nt.key, { tex, gen: generation })
      return tex
    }
    const tex = uploadSource(nt.source)
    temps.push(tex)
    return tex
  }

  function sweepTexCache(): void {
    for (const [key, entry] of texCache) {
      if (entry.gen < generation - 3) {
        gl?.deleteTexture(entry.tex)
        texCache.delete(key)
      }
    }
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

  function dropContextState(): void {
    targets.clear()
    texCache.clear()
    uniformCache = new WeakMap()
    ping = pong = result = null
    fallback = null
    blendProg = presentProg = copyProg = adjustProg = null
    gl = null
    canvas = null
  }

  function setupContext(): boolean {
    try {
      const c =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(width, height)
          : document.createElement('canvas')
      if (!(c instanceof OffscreenCanvas)) {
        c.width = width
        c.height = height
      }
      const ctx = (c as HTMLCanvasElement | OffscreenCanvas).getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      }) as WebGL2RenderingContext | null
      if (!ctx) return false
      if (!ctx.getExtension('EXT_color_buffer_float')) return false
      canvas = c
      gl = ctx
      contextLost = false
      c.addEventListener('webglcontextlost', (e: Event) => {
        e.preventDefault()
        contextLost = true
        if (disposed) return
        console.warn('[ComfyTV/layerEditor] WebGL context lost — recreating')
        queueMicrotask(() => {
          if (recover()) onRestored?.()
        })
      })
      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      blendProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, LAYER_BLEND_FRAG))
      presentProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, PRESENT_FRAG))
      copyProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, COPY_FRAG))
      adjustProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, ADJUST_FRAG))
      ping = makeTarget(width, height)
      pong = makeTarget(width, height)
      return true
    } catch {
      dropContextState()
      return false
    }
  }

  function recover(): boolean {
    if (disposed) return false
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    if (now - lastRecover < 1000) return false
    lastRecover = now
    dropContextState()
    return setupContext()
  }

  function ensureHealthy(): boolean {
    if (disposed) return false
    if (gl && !contextLost && !gl.isContextLost()) return true
    contextLost = true
    if (!recover()) return false
    if (onRestored) queueMicrotask(onRestored)
    return true
  }

  return {
    init(opts: CompositorInit): boolean {
      width = opts.width
      height = opts.height
      onRestored = opts.onContextRestored
      disposed = false
      if (setupContext()) return true
      dropContextState()
      return false
    },

    beginFrame(): void {
      generation += 1
    },

    resize(w: number, h: number): void {
      if (w === width && h === height) return
      width = w
      height = h
      if (!ensureHealthy() || !gl) return
      if (canvas) {
        canvas.width = w
        canvas.height = h
      }
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      ping = makeTarget(w, h)
      pong = makeTarget(w, h)
      result = null
    },

    composite(inputs: CompositeInput[], target?: FBOHandle | null, _region?: Rect): void {
      if (!ensureHealthy()) return
      if (!gl || !blendProg || !ping || !pong) return
      const g = gl
      let read = ping
      let write = pong
      clearTarget(read)
      const temps: WebGLTexture[] = []

      for (const input of inputs) {
        clearTarget(write)
        g.bindFramebuffer(g.FRAMEBUFFER, write.fbo)
        g.viewport(0, 0, write.width, write.height)

        if ('adjust' in input) {
          if (!adjustProg) continue
          g.useProgram(adjustProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(adjustProg, 'u_backdrop'), 0)
          g.activeTexture(g.TEXTURE2)
          g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(input.mask, temps) : getFallback())
          g.uniform1i(loc(adjustProg, 'u_mask'), 2)
          g.uniform1i(loc(adjustProg, 'u_hasMask'), input.mask ? 1 : 0)
          g.uniform1f(loc(adjustProg, 'u_opacity'), input.opacity)
          g.uniform1i(loc(adjustProg, 'u_op'), input.adjust.op)
          const p = input.adjust.params
          g.uniform4f(loc(adjustProg, 'u_p0'), p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0)
        } else {
          g.useProgram(blendProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(blendProg, 'u_backdrop'), 0)

          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, resolveTexture(input.texture, temps))
          g.uniform1i(loc(blendProg, 'u_layer'), 1)

          g.activeTexture(g.TEXTURE2)
          g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(input.mask, temps) : getFallback())
          g.uniform1i(loc(blendProg, 'u_mask'), 2)
          g.uniform1i(loc(blendProg, 'u_hasMask'), input.mask ? 1 : 0)

          g.uniform1i(loc(blendProg, 'u_srgbLayer'), input.texture.linear ? 0 : 1)
          g.uniform1f(loc(blendProg, 'u_opacity'), input.opacity)
          const u = modeUniforms(input.mode)
          g.uniform1i(loc(blendProg, 'u_blend'), u.blend)
          g.uniform1i(loc(blendProg, 'u_composite'), u.composite)
          g.uniform1i(loc(blendProg, 'u_blendSpace'), u.blendSpace)
          g.uniform1i(loc(blendProg, 'u_compositeSpace'), u.compositeSpace)
        }

        drawFullscreen()
        const tmp = read
        read = write
        write = tmp
      }

      for (const tex of temps) g.deleteTexture(tex)
      sweepTexCache()

      result = read
      if (target) {
        const dst = targets.get(target.id)
        if (dst) blit(read, dst)
      }
    },

    allocTarget(w: number, h: number): FBOHandle {
      const id = nextHandle++
      if (gl) targets.set(id, makeTarget(w, h))
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
      if (!t) {
        if (!gl) return {} as WebGLTexture
        throw new Error(`Unknown target: ${handle.id}`)
      }
      return t.tex
    },

    upload(source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture {
      return uploadSource(source)
    },

    readback(_region?: Rect): ImageData {
      const empty = () => new ImageData(Math.max(1, width), Math.max(1, height))
      if (!ensureHealthy() || !gl || !ping) return empty()
      const g = gl

      presentToDefault(result ?? ping)
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
      disposed = true
      if (!gl) return
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      for (const t of targets.values()) freeTargetObj(t)
      targets.clear()
      for (const entry of texCache.values()) gl.deleteTexture(entry.tex)
      texCache.clear()
      if (fallback) gl.deleteTexture(fallback)
      if (blendProg) gl.deleteProgram(blendProg)
      if (presentProg) gl.deleteProgram(presentProg)
      if (copyProg) gl.deleteProgram(copyProg)
      if (adjustProg) gl.deleteProgram(adjustProg)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      gl = null
      ping = pong = result = null
      fallback = blendProg = presentProg = copyProg = adjustProg = null
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
