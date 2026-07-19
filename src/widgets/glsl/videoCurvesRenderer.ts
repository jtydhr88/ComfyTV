import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import videoCurvesFrag from '@/widgets/glsl/shaders/videoCurves.frag?raw'
import {
  buildCurvesLuts,
  type VideoCurvesParams,
} from '@/composables/stages/videoCurvesMath'

const RENDER_CONFIG = {
  maxInputs: 1,
  maxFloatUniforms: 1,
  maxIntUniforms: 1,
  maxBoolUniforms: 1,
  maxCurves: 3,
}

export class VideoCurvesRenderer {
  private renderer = useGLSLRenderer(RENDER_CONFIG)
  private ready = false
  private _error: string | null = null
  private lutKey: string | null = null

  get error(): string | null {
    return this._error
  }

  private uploadLuts(params: Partial<VideoCurvesParams>): void {
    const key = JSON.stringify([
      params.preset ?? 'none',
      params.master ?? '',
      params.red ?? '',
      params.green ?? '',
      params.blue ?? '',
    ])
    if (key === this.lutKey) return
    const luts = buildCurvesLuts(params)
    const channels = [luts.red, luts.green, luts.blue]
    channels.forEach((lut, i) => {
      const data = new Float32Array(256)
      for (let j = 0; j < 256; j++) data[j] = lut[j] / 255
      this.renderer.bindCurveTexture(i, data)
    })
    this.lutKey = key
  }

  renderToCanvas(
    video: HTMLVideoElement,
    params: Partial<VideoCurvesParams>,
    target: HTMLCanvasElement,
  ): boolean {
    const w = Math.max(2, video.videoWidth)
    const h = Math.max(2, video.videoHeight)

    try {
      if (!this.ready) {
        if (!this.renderer.init(w, h)) {
          this._error = 'WebGL2 not available'
          return false
        }
        this.ready = true
      }

      const compiled = this.renderer.compileFragment(videoCurvesFrag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, video)
      this.uploadLuts(params)

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
    this.lutKey = null
  }
}
