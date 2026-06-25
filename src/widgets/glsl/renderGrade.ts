import type { ColorGradeEffect, GradeValue } from '@/widgets/glsl/effects'
import { useGLSLRenderer } from '@/widgets/glsl/useGLSLRenderer'
import { curveDataToFloatLUT, isCurveData } from '@/components/widgets/curve/curveUtils'
import { identityCurve } from '@/components/widgets/curve/types'

export type GradeValues = Record<string, GradeValue>

export class GradeRenderer {
  private renderer = useGLSLRenderer()
  private ready = false
  private _error: string | null = null

  get error(): string | null {
    return this._error
  }

  renderToCanvas(
    img: HTMLImageElement,
    effect: ColorGradeEffect,
    values: GradeValues,
    target: HTMLCanvasElement
  ): boolean {
    const w = Math.max(1, img.naturalWidth || img.width)
    const h = Math.max(1, img.naturalHeight || img.height)

    try {
      if (!this.ready) {
        if (!this.renderer.init(w, h)) {
          this._error = 'WebGL2 not available'
          return false
        }
        this.ready = true
      }

      const compiled = this.renderer.compileFragment(effect.frag)
      if (!compiled.success) {
        this._error = compiled.log || 'Shader compilation failed'
        return false
      }
      this._error = null

      this.renderer.setResolution(w, h)
      this.renderer.bindInputImage(0, img)

      for (const u of effect.uniforms) {
        const raw = u.key in values ? values[u.key] : u.default
        if (u.kind === 'curve') {
          const curve = isCurveData(raw) ? raw : identityCurve()
          this.renderer.bindCurveTexture(u.index, curveDataToFloatLUT(curve))
        } else if (u.kind === 'float') {
          this.renderer.setFloatUniform(u.index, Number(raw))
        } else if (u.kind === 'int') {
          this.renderer.setIntUniform(u.index, Math.round(Number(raw)))
        } else {
          this.renderer.setBoolUniform(u.index, Boolean(raw))
        }
      }

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
      this.renderer = useGLSLRenderer()
      this.ready = false
      return false
    }
  }

  dispose(): void {
    this.renderer.dispose()
    this.ready = false
  }
}
