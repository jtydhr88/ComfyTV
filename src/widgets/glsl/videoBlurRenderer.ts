import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import videoBlurFrag from '@/widgets/glsl/shaders/videoBlur.frag?raw'
import {
  computeVideoBlurUniforms,
  type VideoBlurParams,
} from '@/composables/stages/videoBlurMath'
import {
  fxSourceSize,
  type FxPreviewSource,
} from '@/widgets/glsl/fxPreviewSource'

const RENDER_CONFIG = {
  maxInputs: 2,
  maxFloatUniforms: 3,
  maxIntUniforms: 2,
  maxBoolUniforms: 0,
  maxCurves: 0,
}

export class VideoBlurRenderer {
  private renderer = useGLSLRenderer(RENDER_CONFIG)
  private ready = false
  private _error: string | null = null

  get error(): string | null {
    return this._error
  }

  renderToCanvas(
    video: FxPreviewSource,
    params: Partial<VideoBlurParams>,
    target: HTMLCanvasElement,
  ): boolean {
    const { w, h } = fxSourceSize(video)

    try {
      if (!this.ready) {
        if (!this.renderer.init(w, h)) {
          this._error = 'WebGL2 not available'
          return false
        }
        this.ready = true
      }

      const compiled = this.renderer.compileFragment(videoBlurFrag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, video)

      const u = computeVideoBlurUniforms(params)
      if (u.mode === 2 || u.mode === 3) {
        this.renderer.bindInputImage(1, video)
      }
      this.renderer.setIntUniform(0, u.mode)
      this.renderer.setIntUniform(1, u.radius)
      this.renderer.setFloatUniform(0, u.decay)
      this.renderer.setFloatUniform(1, u.invSigmaR)
      this.renderer.setFloatUniform(2, u.sharpenAmount)

      this.renderer.render()

      const off = this.renderer.getCanvas()
      if (!off) {
        this._error = 'Renderer produced no output'
        return false
      }

      target.width = w
      target.height = h
      const ctx = target.getContext('2d')
      if (!ctx) {
        this._error = '2D context unavailable'
        return false
      }
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(off as unknown as CanvasImageSource, 0, 0)
      return true
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Render failed'
      this.renderer.dispose()
      this.ready = false
      return false
    }
  }

  dispose(): void {
    this.renderer.dispose()
    this.ready = false
  }
}
