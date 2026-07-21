import {
  useGLSLRenderer,
  type GLSLRendererConfig,
} from '@/widgets/glsl/useGLSLRenderer'
import {
  fxSourceSize,
  type FxPreviewSource,
} from '@/widgets/glsl/fxPreviewSource'

export type GLSLRendererHandle = ReturnType<typeof useGLSLRenderer>

export class FxPreviewRenderer<TParams> {
  private renderer: GLSLRendererHandle
  private ready = false
  private _error: string | null = null

  constructor(
    private frag: string,
    config: GLSLRendererConfig,
    private applyParams: (
      renderer: GLSLRendererHandle,
      params: Partial<TParams>,
    ) => void,
  ) {
    this.renderer = useGLSLRenderer(config)
  }

  get error(): string | null {
    return this._error
  }

  renderToCanvas(
    video: FxPreviewSource,
    params: Partial<TParams>,
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

      const compiled = this.renderer.compileFragment(this.frag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, video)
      this.applyParams(this.renderer, params)

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
