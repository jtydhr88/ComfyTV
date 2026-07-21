import { FxPreviewRenderer } from '@/widgets/glsl/fxPreviewRenderer'
import pseudocolorFrag from '@/widgets/glsl/shaders/videoPseudocolor.frag?raw'
import luts from '@/composables/stages/pseudocolorLuts.json'
import type { PseudocolorParams } from '@/composables/stages/videoPseudocolorMath'

const LUTS = luts as Record<string, number[][]>

export class VideoPseudocolorRenderer
  extends FxPreviewRenderer<PseudocolorParams> {
  constructor() {
    super(pseudocolorFrag, {
      maxInputs: 1,
      maxFloatUniforms: 1,
      maxIntUniforms: 1,
      maxBoolUniforms: 1,
      maxCurves: 3,
    }, (r, p) => {
      const pal = LUTS[p.preset ?? ''] ?? null
      for (let ch = 0; ch < 3; ch++) {
        const arr = new Float32Array(256)
        for (let i = 0; i < 256; i++) {
          arr[i] = (pal ? pal[i][ch] : i) / 255
        }
        r.bindCurveTexture(ch, arr)
      }
      r.setFloatUniform(0, pal ? (p.opacity ?? 1) : 0)
    })
  }
}
