import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import videoTransformFrag from '@/widgets/glsl/shaders/videoTransform.frag?raw'
import {
  transformInverse,
  type VideoTransformParams,
} from '@/composables/stages/videoTransformMath'
import {
  fxSourceSize,
  type FxPreviewSource,
} from '@/widgets/glsl/fxPreviewSource'

const RENDER_CONFIG = {
  maxInputs: 1,
  maxFloatUniforms: 6,
  maxIntUniforms: 1,
  maxBoolUniforms: 1,
  maxCurves: 0,
}

export class VideoTransformRenderer {
  private renderer = useGLSLRenderer(RENDER_CONFIG)
  private ready = false
  private _error: string | null = null

  get error(): string | null {
    return this._error
  }

  renderToCanvas(
    video: FxPreviewSource,
    params: Partial<VideoTransformParams>,
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

      const compiled = this.renderer.compileFragment(videoTransformFrag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, video)
      const inv = transformInverse(params, w, h)
      const coeffs = inv ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]
      for (let i = 0; i < 6; i++) this.renderer.setFloatUniform(i, coeffs[i])

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
