import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import videoTransitionFrag from '@/widgets/glsl/shaders/videoTransition.frag?raw'
import {
  clampProgress,
  transitionModeIndex,
} from '@/composables/stages/videoTransitionMath'

const RENDER_CONFIG = {
  maxInputs: 3,
  maxFloatUniforms: 2,
  maxIntUniforms: 2,
  maxBoolUniforms: 0,
  maxCurves: 0,
}

export interface LumaWipe {
  image: TexImageSource
  mode: number
  softness: number
}

export class VideoTransitionRenderer {
  private renderer = useGLSLRenderer(RENDER_CONFIG)
  private ready = false
  private _error: string | null = null

  get error(): string | null {
    return this._error
  }

  renderToCanvas(
    videoA: HTMLVideoElement,
    videoB: HTMLVideoElement,
    transition: string,
    progress: number,
    target: HTMLCanvasElement,
    luma?: LumaWipe | null,
  ): boolean {
    const w = Math.max(2, videoA.videoWidth)
    const h = Math.max(2, videoA.videoHeight)

    try {
      if (!this.ready) {
        if (!this.renderer.init(w, h)) {
          this._error = 'WebGL2 not available'
          return false
        }
        this.ready = true
      }

      const compiled = this.renderer.compileFragment(videoTransitionFrag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, videoA)
      this.renderer.bindInputImage(1, videoB)
      if (luma && luma.mode !== 0) {
        this.renderer.bindInputImage(2, luma.image)
        this.renderer.setFloatUniform(1, luma.softness)
        this.renderer.setIntUniform(1, luma.mode)
      } else {
        this.renderer.setIntUniform(1, 0)
      }
      this.renderer.setIntUniform(0, transitionModeIndex(transition))
      this.renderer.setFloatUniform(0, 1 - clampProgress(progress))
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
