import videoLutFrag from '@/widgets/glsl/shaders/videoLut.frag?raw'
import {
  resolvePreviewInterp,
  type ParsedLut,
} from '@/composables/stages/videoLutMath'
import {
  fxSourceSize,
  type FxPreviewSource,
} from '@/widgets/glsl/fxPreviewSource'
import {
  acquireSharedGL,
  getSharedProgram,
  trackSharedInstance,
  type ProgramEntry,
  type SharedGL,
} from '@/widgets/glsl/useGLSLRenderer'

export interface VideoLutRenderParams {
  lut: ParsedLut | null
  interp: string
}

const INTERP_INDEX = { nearest: 0, trilinear: 1, tetrahedral: 2 } as const

export class VideoLutRenderer {
  private ref: SharedGL | null = null
  private program: ProgramEntry | null = null
  private videoTexture: WebGLTexture | null = null
  private lutTexture: WebGLTexture | null = null
  private uploadedLut: ParsedLut | null = null
  private _error: string | null = null
  private disposed = false
  private untrack = trackSharedInstance()

  get error(): string | null {
    return this._error
  }

  isLost(): boolean {
    if (this.disposed || !this.ref) return false
    return this.ref.lost || this.ref.gl.isContextLost()
  }

  private live(): SharedGL | null {
    if (this.disposed) return null
    const s = acquireSharedGL()
    if (!s) return null
    if (this.ref !== s) {
      this.ref = s
      this.videoTexture = null
      this.lutTexture = null
      this.uploadedLut = null
      this.program = getSharedProgram(s, videoLutFrag)
      this.videoTexture = s.gl.createTexture()
      const gl = s.gl
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
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texImage3D(
        gl.TEXTURE_3D, 0, gl.RGB32F, 1, 1, 1, 0, gl.RGB, gl.FLOAT,
        new Float32Array([0, 0, 0]),
      )
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    }
    return s
  }

  private loc(name: string): WebGLUniformLocation | null {
    const s = this.ref
    const p = this.program
    if (!s || !p) return null
    let l = p.uniforms.get(name)
    if (l === undefined) {
      l = s.gl.getUniformLocation(p.program, name)
      p.uniforms.set(name, l)
    }
    return l
  }

  private uploadLut(s: SharedGL, lut: ParsedLut | null): void {
    if (lut === this.uploadedLut) return
    const gl = s.gl
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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    this.uploadedLut = lut
  }

  renderToCanvas(
    video: FxPreviewSource,
    params: VideoLutRenderParams,
    target: HTMLCanvasElement,
  ): boolean {
    const { w, h } = fxSourceSize(video)

    try {
      const s = this.live()
      if (!s || !this.program) {
        this._error = 'WebGL2 not available'
        return false
      }
      this._error = null
      const gl = s.gl
      const canvas = s.canvas
      const cw = Math.max(canvas.width, w)
      const ch = Math.max(canvas.height, h)
      if (canvas.width !== cw) canvas.width = cw
      if (canvas.height !== ch) canvas.height = ch

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

      this.uploadLut(s, params.lut)

      gl.useProgram(this.program.program)
      gl.disable(gl.BLEND)
      gl.uniform1i(this.loc('u_image0'), 0)
      gl.uniform1i(this.loc('u_lut'), 1)
      const lut = params.lut
      gl.uniform1i(this.loc('u_hasLut'), lut ? 1 : 0)
      gl.uniform1i(this.loc('u_interp'),
                   INTERP_INDEX[resolvePreviewInterp(params.interp)])
      const lutMax = lut ? lut.size - 1 : 1
      gl.uniform1i(this.loc('u_lutMax'), lutMax)
      const scale = lut ? lut.scale : [1, 1, 1]
      gl.uniform3f(
        this.loc('u_scale'),
        scale[0] * lutMax, scale[1] * lutMax, scale[2] * lutMax,
      )

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, canvas.height - h, w, h)
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
      this.ref = null
      this.program = null
      this.uploadedLut = null
      return false
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const s = this.ref
    if (s && !s.lost && !s.gl.isContextLost()) {
      if (this.videoTexture) s.gl.deleteTexture(this.videoTexture)
      if (this.lutTexture) s.gl.deleteTexture(this.lutTexture)
    }
    this.videoTexture = null
    this.lutTexture = null
    this.program = null
    this.ref = null
    this.uploadedLut = null
    this.untrack()
  }
}
