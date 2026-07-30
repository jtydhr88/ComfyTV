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
