import videoLutFrag from '@/widgets/glsl/shaders/videoLut.frag?raw'
import {
  resolvePreviewInterp,
  type ParsedLut,
} from '@/composables/stages/videoLutMath'

export interface VideoLutRenderParams {
  lut: ParsedLut | null
  interp: string
}

const VERTEX_SHADER_SOURCE = `#version 300 es
out vec2 v_texCoord;
void main() {
    vec2 verts[3] = vec2[](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
    v_texCoord = verts[gl_VertexID] * 0.5 + 0.5;
    gl_Position = vec4(verts[gl_VertexID], 0, 1);
}
`

const INTERP_INDEX = { nearest: 0, trilinear: 1, tetrahedral: 2 } as const

const UNIFORM_NAMES = [
  'u_image0', 'u_lut', 'u_hasLut', 'u_interp', 'u_lutMax', 'u_scale',
] as const

function compile(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Shader compilation failed'
    gl.deleteShader(shader)
    throw new Error(log)
  }
  return shader
}

export class VideoLutRenderer {
  private canvas: OffscreenCanvas | null = null
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private videoTexture: WebGLTexture | null = null
  private lutTexture: WebGLTexture | null = null
  private uploadedLut: ParsedLut | null = null
  private uniforms = new Map<string, WebGLUniformLocation | null>()
  private ready = false
  private _error: string | null = null

  get error(): string | null {
    return this._error
  }

  private init(width: number, height: number): boolean {
    this.canvas = new OffscreenCanvas(width, height)
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) {
      this._error = 'WebGL2 not available'
      return false
    }
    this.gl = gl

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    const fs = compile(gl, gl.FRAGMENT_SHADER, videoLutFrag)
    const program = gl.createProgram()
    if (!program) {
      this._error = 'Failed to create program'
      return false
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      this._error = gl.getProgramInfoLog(program) ?? 'Program link failed'
      gl.deleteProgram(program)
      return false
    }
    this.program = program
    for (const name of UNIFORM_NAMES) {
      this.uniforms.set(name, gl.getUniformLocation(program, name))
    }

    this.videoTexture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    this.lutTexture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_3D, this.lutTexture)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage3D(
      gl.TEXTURE_3D, 0, gl.RGB32F, 1, 1, 1, 0, gl.RGB, gl.FLOAT,
      new Float32Array([0, 0, 0]),
    )
    return true
  }

  private uploadLut(lut: ParsedLut | null): void {
    const gl = this.gl
    if (!gl || lut === this.uploadedLut) return
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_3D, this.lutTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    if (lut) {
      gl.texImage3D(
        gl.TEXTURE_3D, 0, gl.RGB32F, lut.size, lut.size, lut.size, 0,
        gl.RGB, gl.FLOAT, lut.data,
      )
    } else {
      gl.texImage3D(
        gl.TEXTURE_3D, 0, gl.RGB32F, 1, 1, 1, 0, gl.RGB, gl.FLOAT,
        new Float32Array([0, 0, 0]),
      )
    }
    this.uploadedLut = lut
  }

  renderToCanvas(
    video: HTMLVideoElement,
    params: VideoLutRenderParams,
    target: HTMLCanvasElement,
  ): boolean {
    const w = Math.max(2, video.videoWidth)
    const h = Math.max(2, video.videoHeight)

    try {
      if (!this.ready) {
        if (!this.init(w, h)) return false
        this.ready = true
      }
      const gl = this.gl
      const canvas = this.canvas
      if (!gl || !canvas || !this.program) return false
      this._error = null

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

      this.uploadLut(params.lut)

      gl.useProgram(this.program)
      gl.disable(gl.BLEND)
      const u = (name: string) => this.uniforms.get(name) ?? null
      gl.uniform1i(u('u_image0'), 0)
      gl.uniform1i(u('u_lut'), 1)
      const lut = params.lut
      gl.uniform1i(u('u_hasLut'), lut ? 1 : 0)
      gl.uniform1i(u('u_interp'), INTERP_INDEX[resolvePreviewInterp(params.interp)])
      const lutMax = lut ? lut.size - 1 : 1
      gl.uniform1i(u('u_lutMax'), lutMax)
      const scale = lut ? lut.scale : [1, 1, 1]
      gl.uniform3f(
        u('u_scale'),
        scale[0] * lutMax, scale[1] * lutMax, scale[2] * lutMax,
      )

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      target.width = w
      target.height = h
      const ctx = target.getContext('2d')
      if (!ctx) {
        this._error = '2D context unavailable'
        return false
      }
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(canvas as unknown as CanvasImageSource, 0, 0)
      return true
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Render failed'
      this.dispose()
      return false
    }
  }

  dispose(): void {
    const gl = this.gl
    if (gl) {
      if (this.videoTexture) gl.deleteTexture(this.videoTexture)
      if (this.lutTexture) gl.deleteTexture(this.lutTexture)
      if (this.program) gl.deleteProgram(this.program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    this.videoTexture = null
    this.lutTexture = null
    this.program = null
    this.gl = null
    this.canvas = null
    this.uploadedLut = null
    this.uniforms.clear()
    this.ready = false
  }
}
