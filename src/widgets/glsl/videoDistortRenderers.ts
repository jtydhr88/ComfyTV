import { FxPreviewRenderer } from '@/widgets/glsl/fxPreviewRenderer'
import kaleidoFrag from '@/widgets/glsl/shaders/videoKaleido.frag?raw'
import waveWarpFrag from '@/widgets/glsl/shaders/videoWaveWarp.frag?raw'
import type { FxPreviewSource } from '@/widgets/glsl/fxPreviewSource'

export interface KaleidoParams {
  segments: number
  angle: number
  sourceAngle: number
  centerX: number
  centerY: number
}

export class VideoKaleidoRenderer extends FxPreviewRenderer<KaleidoParams> {
  constructor() {
    super(kaleidoFrag, {
      maxInputs: 1,
      maxFloatUniforms: 5,
      maxIntUniforms: 0,
      maxBoolUniforms: 0,
      maxCurves: 0,
    }, (r, p) => {
      r.setFloatUniform(0, Math.max(1, Math.round(p.segments ?? 6)))
      r.setFloatUniform(1, ((p.angle ?? 0) * Math.PI) / 180)
      r.setFloatUniform(2, ((p.sourceAngle ?? 0) * Math.PI) / 180)
      r.setFloatUniform(3, p.centerX ?? 0.5)
      r.setFloatUniform(4, p.centerY ?? 0.5)
    })
  }
}

export interface WaveWarpParams {
  amplitude: number
  frequency: number
  speed: number
  axis: string
  envelope: string
  timeSec: number
}

export class VideoWaveWarpRenderer extends FxPreviewRenderer<WaveWarpParams> {
  constructor() {
    super(waveWarpFrag, {
      maxInputs: 1,
      maxFloatUniforms: 3,
      maxIntUniforms: 1,
      maxBoolUniforms: 1,
      maxCurves: 0,
    }, (r, p) => {
      r.setFloatUniform(0, p.amplitude ?? 16)
      r.setFloatUniform(1, p.frequency ?? 3)
      r.setFloatUniform(2, 2 * Math.PI * (p.speed ?? 0.5) * (p.timeSec ?? 0))
      const axis = p.axis === 'horizontal' ? 1 : p.axis === 'vertical' ? 2 : 0
      r.setIntUniform(0, axis)
      r.setBoolUniform(0, (p.envelope ?? 'parabolic') !== 'uniform')
    })
  }

  renderToCanvas(
    video: FxPreviewSource,
    params: Partial<WaveWarpParams>,
    target: HTMLCanvasElement,
    timeSec?: number,
  ): boolean {
    return super.renderToCanvas(
      video, { ...params, timeSec: timeSec ?? 0 }, target)
  }
}
