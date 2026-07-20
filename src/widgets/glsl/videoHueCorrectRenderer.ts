import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import videoHueCorrectFrag from '@/widgets/glsl/shaders/videoHueCorrect.frag?raw'
import {
  buildHueCorrectLuts,
  HUE_CHANNELS,
  lutDeviates,
  type VideoHueCorrectParams,
} from '@/composables/stages/videoHueCorrectMath'

const RENDER_CONFIG = {
  maxInputs: 1,
  maxFloatUniforms: 2,
  maxIntUniforms: 1,
  maxBoolUniforms: 1,
  maxCurves: 9,
}

export class VideoHueCorrectRenderer {
  private renderer = useGLSLRenderer(RENDER_CONFIG)
  private ready = false
  private _error: string | null = null
  private lutKey: string | null = null
  private hueActive = false

  get error(): string | null {
    return this._error
  }

  private uploadLuts(curves: string): void {
    if (curves === this.lutKey) return
    const luts = buildHueCorrectLuts(curves)
    HUE_CHANNELS.forEach((ch, i) => {
      this.renderer.bindCurveTexture(i, luts[ch])
    })
    this.hueActive = lutDeviates(luts.hue)
    this.lutKey = curves
  }

  renderToCanvas(
    video: HTMLVideoElement,
    params: Partial<VideoHueCorrectParams>,
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

      const compiled = this.renderer.compileFragment(videoHueCorrectFrag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, video)
      this.uploadLuts(params.curves ?? '')
      this.renderer.setFloatUniform(0, params.satThrsh ?? 0)
      this.renderer.setFloatUniform(1, params.luminanceMix ?? 0)
      this.renderer.setBoolUniform(0, this.hueActive)

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
