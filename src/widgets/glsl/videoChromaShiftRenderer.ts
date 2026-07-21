import { FxPreviewRenderer } from '@/widgets/glsl/fxPreviewRenderer'
import chromaShiftFrag from '@/widgets/glsl/shaders/videoChromaShift.frag?raw'
import type { ChromaShiftParams } from '@/composables/stages/videoChromaShiftMath'

export class VideoChromaShiftRenderer
  extends FxPreviewRenderer<ChromaShiftParams> {
  constructor() {
    super(chromaShiftFrag, {
      maxInputs: 1,
      maxFloatUniforms: 4,
      maxIntUniforms: 1,
      maxBoolUniforms: 1,
      maxCurves: 0,
    }, (r, p) => {
      r.setFloatUniform(0, p.shiftRh ?? 0)
      r.setFloatUniform(1, p.shiftRv ?? 0)
      r.setFloatUniform(2, p.shiftBh ?? 0)
      r.setFloatUniform(3, p.shiftBv ?? 0)
      r.setBoolUniform(0, p.shiftEdge === 'wrap')
    })
  }
}
