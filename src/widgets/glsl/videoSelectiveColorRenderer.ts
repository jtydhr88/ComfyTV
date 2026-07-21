import { FxPreviewRenderer } from '@/widgets/glsl/fxPreviewRenderer'
import selectiveColorFrag from '@/widgets/glsl/shaders/videoSelectiveColor.frag?raw'
import {
  SELECTIVE_ZONE_IDS,
  type SelectiveColorParams,
} from '@/composables/stages/videoSelectiveColorMath'

export class VideoSelectiveColorRenderer
  extends FxPreviewRenderer<SelectiveColorParams> {
  constructor() {
    super(selectiveColorFrag, {
      maxInputs: 1,
      maxFloatUniforms: 9,
      maxIntUniforms: 1,
      maxBoolUniforms: 1,
      maxCurves: 0,
    }, (r, p) => {
      SELECTIVE_ZONE_IDS.forEach((zone, i) => {
        r.setFloatUniform(i, p.zones?.[zone] ?? 0)
      })
      r.setBoolUniform(0, p.scMethod === 'relative')
    })
  }
}
