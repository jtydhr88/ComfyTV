import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import videoStylizeFrag from '@/widgets/glsl/shaders/videoStylize.frag?raw'
import {
  computeStylizeUniforms,
  oldFilmLuts,
  stylizeUsesCurves,
  stylizeUsesTemporalNoise,
  type VideoStylizeParams,
} from '@/composables/stages/videoStylizeMath'
import {
  fxSourceSize,
  type FxPreviewSource,
} from '@/widgets/glsl/fxPreviewSource'

const RENDER_CONFIG = {
  maxInputs: 2,
  maxFloatUniforms: 3,
  maxIntUniforms: 4,
  maxBoolUniforms: 0,
  maxCurves: 3,
}

export class VideoStylizeRenderer {
  private renderer = useGLSLRenderer(RENDER_CONFIG)
  private ready = false
  private _error: string | null = null
  private lutsUploaded = false
  private frame = 0

  get error(): string | null {
    return this._error
  }

  private uploadLuts(): void {
    if (this.lutsUploaded) return
    const luts = oldFilmLuts()
    const channels = [luts.red, luts.green, luts.blue]
    channels.forEach((lut, i) => {
      const data = new Float32Array(256)
      for (let j = 0; j < 256; j++) data[j] = lut[j] / 255
      this.renderer.bindCurveTexture(i, data)
    })
    this.lutsUploaded = true
  }

  renderToCanvas(
    video: FxPreviewSource,
    params: Partial<VideoStylizeParams>,
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

      const compiled = this.renderer.compileFragment(videoStylizeFrag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, video)
      this.renderer.bindInputImage(1, video)
      if (stylizeUsesCurves(params)) this.uploadLuts()

      const u = computeStylizeUniforms(params)
      if (stylizeUsesTemporalNoise(params)) this.frame = (this.frame + 1) % 100000
      this.renderer.setIntUniform(0, u.effect)
      this.renderer.setIntUniform(1, u.block)
      this.renderer.setIntUniform(2, u.grain)
      this.renderer.setIntUniform(3, this.frame)
      this.renderer.setFloatUniform(0, u.angle)
      this.renderer.setFloatUniform(1, u.edgeLow)
      this.renderer.setFloatUniform(2, u.edgeHigh)

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
    this.lutsUploaded = false
  }
}
