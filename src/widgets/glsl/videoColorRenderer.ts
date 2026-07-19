import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import videoColorFrag from '@/widgets/glsl/shaders/videoColor.frag?raw'
import {
  computeVideoColorUniforms,
  levelsNeedsFrameMin,
  videoColorFrameMin,
  type Rgb,
  type VideoColorParams,
} from '@/composables/stages/videoColorMath'

const MIN_SAMPLE_W = 48
const MIN_SAMPLE_H = 27

const RENDER_CONFIG = {
  maxInputs: 1,
  maxFloatUniforms: 31,
  maxIntUniforms: 1,
  maxBoolUniforms: 8,
  maxCurves: 1,
}

export class VideoColorRenderer {
  private renderer = useGLSLRenderer(RENDER_CONFIG)
  private ready = false
  private _error: string | null = null
  private minCanvas: HTMLCanvasElement | null = null

  get error(): string | null {
    return this._error
  }

  private sampleFrameMin(
    video: HTMLVideoElement,
    params: Partial<VideoColorParams>,
  ): Rgb {
    if (!levelsNeedsFrameMin(params)) return [0, 0, 0]
    try {
      this.minCanvas ??= document.createElement('canvas')
      const c = this.minCanvas
      c.width = MIN_SAMPLE_W
      c.height = MIN_SAMPLE_H
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return [0, 0, 0]
      ctx.drawImage(video, 0, 0, MIN_SAMPLE_W, MIN_SAMPLE_H)
      const data = ctx.getImageData(0, 0, MIN_SAMPLE_W, MIN_SAMPLE_H).data
      const pixels: Rgb[] = []
      for (let i = 0; i < data.length; i += 4) {
        pixels.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255])
      }
      return videoColorFrameMin(pixels, params)
    } catch {
      return [0, 0, 0]
    }
  }

  renderToCanvas(
    video: HTMLVideoElement,
    params: Partial<VideoColorParams>,
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

      const compiled = this.renderer.compileFragment(videoColorFrag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, video)

      const u = computeVideoColorUniforms(params, this.sampleFrameMin(video, params))
      const floats = [
        u.black, u.scale,
        u.tempColor[0], u.tempColor[1], u.tempColor[2], u.tempMix,
        ...u.hsMatrix.map((v) => Math.round(v * 65536)),
        u.vibrance,
        u.levelsMin[0], u.levelsMin[1], u.levelsMin[2],
        u.levelsCoeff[0], u.levelsCoeff[1], u.levelsCoeff[2],
        u.shadows[0], u.shadows[1], u.shadows[2],
        u.midtones[0], u.midtones[1], u.midtones[2],
        u.highlights[0], u.highlights[1], u.highlights[2],
      ]
      floats.forEach((v, i) => this.renderer.setFloatUniform(i, v))
      const bools = [
        u.active.exposure, u.active.temperature, u.active.hueSaturation,
        u.active.vibrance, u.active.levels, u.active.balance,
        u.preserveLightness, u.floatLevels,
      ]
      bools.forEach((v, i) => this.renderer.setBoolUniform(i, v))

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
    this.minCanvas = null
  }
}
