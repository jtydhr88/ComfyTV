import { detectPassCount } from '@/widgets/glsl/glslUtils'

const VERTEX_SHADER_SOURCE = `#version 300 es
out vec2 v_texCoord;
void main() {
    vec2 verts[3] = vec2[](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
    v_texCoord = verts[gl_VertexID] * 0.5 + 0.5;
    gl_Position = vec4(verts[gl_VertexID], 0, 1);
}
`

const MAX_PASSES = 32

export interface GLSLRendererConfig {
  maxInputs: number
  maxFloatUniforms: number
  maxIntUniforms: number
  maxBoolUniforms: number
  maxCurves: number
}

const DEFAULT_CONFIG: GLSLRendererConfig = {
  maxInputs: 5,
  maxFloatUniforms: 20,
  maxIntUniforms: 20,
  maxBoolUniforms: 10,
  maxCurves: 4
}

interface CompileResult {
  success: boolean
  log: string
}

export interface ProgramEntry {
  program: WebGLProgram
  passCount: number
  uniforms: Map<string, WebGLUniformLocation | null>
}

export interface SharedGL {
  id: number
  canvas: OffscreenCanvas | HTMLCanvasElement
  gl: WebGL2RenderingContext
  vertexShader: WebGLShader
  programs: Map<string, ProgramEntry>
  lost: boolean
}

let shared: SharedGL | null = null
let sharedSeq = 0
let instanceCount = 0

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Compilation failed'
    gl.deleteShader(shader)
    throw new Error(log)
  }
  return shader
}

function createShared(): SharedGL | null {
  try {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(8, 8)
        : document.createElement('canvas')
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    }) as WebGL2RenderingContext | null
    if (!gl) return null
    if (!gl.getExtension('EXT_color_buffer_float')) return null
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    const s: SharedGL = {
      id: ++sharedSeq,
      canvas,
      gl,
      vertexShader,
      programs: new Map(),
      lost: false
    }
    canvas.addEventListener('webglcontextlost', () => {
      s.lost = true
      console.warn(`[ComfyTV/glsl] shared context #${s.id} lost — `
        + 'rebuilding on next render')
    })
    console.debug(`[ComfyTV/glsl] shared context #${s.id} created `
      + `(instances=${instanceCount})`)
    return s
  } catch {
    return null
  }
}

function healthyShared(): SharedGL | null {
  if (shared && (shared.lost || shared.gl.isContextLost())) shared = null
  shared ??= createShared()
  return shared
}

function releaseSharedIfIdle(): void {
  if (instanceCount > 0 || !shared) return
  const s = shared
  shared = null
  if (!s.lost && !s.gl.isContextLost()) {
    for (const entry of s.programs.values()) s.gl.deleteProgram(entry.program)
    s.gl.deleteShader(s.vertexShader)
    s.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  console.debug(`[ComfyTV/glsl] shared context #${s.id} released`)
}

export function acquireSharedGL(): SharedGL | null {
  return healthyShared()
}

export function trackSharedInstance(): () => void {
  instanceCount++
  let done = false
  return () => {
    if (done) return
    done = true
    instanceCount--
    releaseSharedIfIdle()
  }
}

export function getSharedProgram(s: SharedGL, source: string): ProgramEntry {
  const cached = s.programs.get(source)
  if (cached) return cached
  const gl = s.gl
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, source)
  const prog = gl.createProgram()
  if (!prog) {
    gl.deleteShader(fs)
    throw new Error('Failed to create program')
  }
  gl.attachShader(prog, s.vertexShader)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? 'Link failed'
    gl.deleteProgram(prog)
    throw new Error(log)
  }
  const entry: ProgramEntry = {
    program: prog,
    passCount: Math.min(detectPassCount(source), MAX_PASSES),
    uniforms: new Map()
  }
  s.programs.set(source, entry)
  return entry
}

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
}

export function useGLSLRenderer(config: GLSLRendererConfig = DEFAULT_CONFIG) {
  const { maxInputs, maxCurves } = config

  let ref: SharedGL | null = null
  let width = 0
  let height = 0
  let program: ProgramEntry | null = null
  let lastSource: string | null = null
  let pingPong: [Target, Target] | null = null
  let fallbackTexture: WebGLTexture | null = null
  const inputTextures: (WebGLTexture | null)[] = Array.from<null>({
    length: maxInputs
  }).fill(null)
  const curveTextures: (WebGLTexture | null)[] = Array.from<null>({
    length: maxCurves
  }).fill(null)
  const curveData: (Float32Array | null)[] = Array.from<null>({
    length: maxCurves
  }).fill(null)
  let disposed = false

  instanceCount++

  function resetLocalHandles(): void {
    pingPong = null
    fallbackTexture = null
    inputTextures.fill(null)
    curveTextures.fill(null)
    program = null
  }

  function makeTarget(s: SharedGL, w: number, h: number): Target {
    const g = s.gl
    const tex = g.createTexture()
    if (!tex) throw new Error('Failed to create ping-pong texture')
    g.bindTexture(g.TEXTURE_2D, tex)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    const fbo = g.createFramebuffer()
    if (!fbo) throw new Error('Failed to create ping-pong framebuffer')
    g.bindFramebuffer(g.FRAMEBUFFER, fbo)
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0)
    const status = g.checkFramebufferStatus(g.FRAMEBUFFER)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.bindTexture(g.TEXTURE_2D, null)
    if (status !== g.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Ping-pong framebuffer incomplete: ${status}`)
    }
    return { fbo, tex }
  }

  function destroyPingPong(s: SharedGL): void {
    if (!pingPong) return
    for (const t of pingPong) {
      s.gl.deleteFramebuffer(t.fbo)
      s.gl.deleteTexture(t.tex)
    }
    pingPong = null
  }

  function uploadCurve(s: SharedGL, index: number, lut: Float32Array): void {
    const g = s.gl
    if (curveTextures[index]) g.deleteTexture(curveTextures[index])
    curveTextures[index] = null
    const texture = g.createTexture()
    if (!texture) return
    const unit = maxInputs + index
    g.activeTexture(g.TEXTURE0 + unit)
    g.bindTexture(g.TEXTURE_2D, texture)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
    g.texImage2D(g.TEXTURE_2D, 0, g.R16F, lut.length, 1, 0, g.RED, g.FLOAT, lut)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    curveTextures[index] = texture
  }

  function live(): SharedGL | null {
    if (disposed) return null
    const s = healthyShared()
    if (!s) return null
    if (ref !== s) {
      resetLocalHandles()
      ref = s
      try {
        if (lastSource) program = getSharedProgram(s, lastSource)
        for (let i = 0; i < maxCurves; i++) {
          const data = curveData[i]
          if (data) uploadCurve(s, i, data)
        }
      } catch {
        program = null
      }
    }
    return s
  }

  function ensureTargets(s: SharedGL): boolean {
    if (pingPong) return true
    if (!width || !height) return false
    try {
      pingPong = [makeTarget(s, width, height), makeTarget(s, width, height)]
      return true
    } catch {
      pingPong = null
      return false
    }
  }

  function loc(s: SharedGL, name: string): WebGLUniformLocation | null {
    if (!program) return null
    let l = program.uniforms.get(name)
    if (l === undefined) {
      l = s.gl.getUniformLocation(program.program, name)
      program.uniforms.set(name, l)
    }
    return l
  }

  function getFallback(s: SharedGL): WebGLTexture {
    if (fallbackTexture) return fallbackTexture
    const g = s.gl
    const tex = g.createTexture()
    if (!tex) throw new Error('Failed to create fallback texture')
    fallbackTexture = tex
    g.bindTexture(g.TEXTURE_2D, fallbackTexture)
    g.texImage2D(
      g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    )
    return fallbackTexture
  }

  function init(w: number, h: number): boolean {
    if (disposed) return false
    width = w
    height = h
    const s = live()
    if (!s) return false
    return ensureTargets(s)
  }

  function compileFragment(source: string): CompileResult {
    const s = live()
    if (!s) return { success: false, log: 'WebGL2 unavailable' }
    if (lastSource === source && program) return { success: true, log: '' }
    try {
      program = getSharedProgram(s, source)
      lastSource = source
      return { success: true, log: '' }
    } catch (e: unknown) {
      program = null
      lastSource = null
      return { success: false, log: e instanceof Error ? e.message : String(e) }
    }
  }

  function setResolution(w: number, h: number): void {
    if (disposed || (w === width && h === height)) return
    width = w
    height = h
    const s = live()
    if (s) destroyPingPong(s)
    pingPong = null
  }

  function setFloatUniform(index: number, value: number): void {
    const s = live()
    if (!s || !program) return
    s.gl.useProgram(program.program)
    const l = loc(s, `u_float${index}`)
    if (l != null) s.gl.uniform1f(l, value)
  }

  function setIntUniform(index: number, value: number): void {
    const s = live()
    if (!s || !program) return
    s.gl.useProgram(program.program)
    const l = loc(s, `u_int${index}`)
    if (l != null) s.gl.uniform1i(l, value)
  }

  function setBoolUniform(index: number, value: boolean): void {
    const s = live()
    if (!s || !program) return
    s.gl.useProgram(program.program)
    const l = loc(s, `u_bool${index}`)
    if (l != null) s.gl.uniform1i(l, value ? 1 : 0)
  }

  function bindCurveTexture(index: number, lut: Float32Array): void {
    if (index < 0 || index >= maxCurves) return
    curveData[index] = lut
    const s = live()
    if (!s) return
    uploadCurve(s, index, lut)
  }

  function bindInputImage(index: number, image: TexImageSource): void {
    const s = live()
    if (!s) return
    if (index < 0 || index >= maxInputs) {
      throw new Error(`Input index ${index} out of range (max ${maxInputs - 1})`)
    }
    const g = s.gl
    if (inputTextures[index]) g.deleteTexture(inputTextures[index])
    inputTextures[index] = null
    const texture = g.createTexture()
    if (!texture) return
    g.activeTexture(g.TEXTURE0 + index)
    g.bindTexture(g.TEXTURE_2D, texture)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, image)
    inputTextures[index] = texture
  }

  function render(): void {
    const s = live()
    if (!s || !program) return
    if (!ensureTargets(s)) return
    const g = s.gl
    const canvas = s.canvas
    const cw = Math.max(canvas.width, width)
    const ch = Math.max(canvas.height, height)
    if (canvas.width !== cw) canvas.width = cw
    if (canvas.height !== ch) canvas.height = ch

    g.useProgram(program.program)
    g.disable(g.BLEND)

    const resLoc = loc(s, 'u_resolution')
    if (resLoc != null) g.uniform2f(resLoc, width, height)

    for (let i = 0; i < maxInputs; i++) {
      const l = loc(s, `u_image${i}`)
      if (l != null) {
        g.activeTexture(g.TEXTURE0 + i)
        g.bindTexture(g.TEXTURE_2D, inputTextures[i] ?? getFallback(s))
        g.uniform1i(l, i)
      }
    }

    for (let i = 0; i < maxCurves; i++) {
      const l = loc(s, `u_curve${i}`)
      if (l != null && curveTextures[i]) {
        const unit = maxInputs + i
        g.activeTexture(g.TEXTURE0 + unit)
        g.bindTexture(g.TEXTURE_2D, curveTextures[i])
        g.uniform1i(l, unit)
      }
    }

    const passCount = program.passCount
    for (let pass = 0; pass < passCount; pass++) {
      const passLoc = loc(s, 'u_pass')
      if (passLoc != null) g.uniform1i(passLoc, pass)

      const isLastPass = pass === passCount - 1
      const writeIdx = pass % 2

      if (isLastPass) {
        g.bindFramebuffer(g.FRAMEBUFFER, null)
        g.drawBuffers([g.BACK])
        g.viewport(0, canvas.height - height, width, height)
      } else {
        g.bindFramebuffer(g.FRAMEBUFFER, pingPong![writeIdx].fbo)
        g.drawBuffers([g.COLOR_ATTACHMENT0])
        g.viewport(0, 0, width, height)
      }

      if (pass > 0) {
        g.activeTexture(g.TEXTURE0)
        g.bindTexture(g.TEXTURE_2D, pingPong![(pass - 1) % 2].tex)
      }

      g.clearColor(0, 0, 0, 0)
      g.clear(g.COLOR_BUFFER_BIT)
      g.drawArrays(g.TRIANGLES, 0, 3)
    }
  }

  function readPixels(): ImageData {
    const s = live()
    if (!s) throw new Error('Renderer not initialized')
    const g = s.gl
    const pixels = new Uint8ClampedArray(width * height * 4)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.pixelStorei(g.PACK_ROW_LENGTH, 0)
    g.readPixels(0, s.canvas.height - height, width, height, g.RGBA,
                 g.UNSIGNED_BYTE, pixels)
    return new ImageData(pixels, width, height)
  }

  async function toBlob(): Promise<Blob> {
    const data = readPixels()
    const c = document.createElement('canvas')
    c.width = data.width
    c.height = data.height
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')
    ctx.putImageData(data, 0, 0)
    return await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))),
               'image/webp', 0.92))
  }

  function getCanvas(): OffscreenCanvas | HTMLCanvasElement | null {
    return ref?.canvas ?? null
  }

  function isContextLost(): boolean {
    if (disposed || !ref) return false
    return ref.lost || ref.gl.isContextLost()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    instanceCount--
    const s = ref
    ref = null
    if (s && !s.lost && !s.gl.isContextLost()) {
      for (const tex of inputTextures) {
        if (tex) s.gl.deleteTexture(tex)
      }
      for (const tex of curveTextures) {
        if (tex) s.gl.deleteTexture(tex)
      }
      if (fallbackTexture) s.gl.deleteTexture(fallbackTexture)
      destroyPingPong(s)
    }
    resetLocalHandles()
    releaseSharedIfIdle()
  }

  return {
    init,
    compileFragment,
    setResolution,
    setFloatUniform,
    setIntUniform,
    setBoolUniform,
    bindCurveTexture,
    bindInputImage,
    render,
    readPixels,
    toBlob,
    getCanvas,
    isContextLost,
    dispose
  }
}
