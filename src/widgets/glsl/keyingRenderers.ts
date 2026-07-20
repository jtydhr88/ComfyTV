import { FxPreviewRenderer } from '@/widgets/glsl/fxPreviewRenderer'
import despillFrag from '@/widgets/glsl/shaders/videoDespill.frag?raw'
import colorSuppressFrag from '@/widgets/glsl/shaders/videoColorSuppress.frag?raw'
import keyerFrag from '@/widgets/glsl/shaders/videoKeyer.frag?raw'
import pikFrag from '@/widgets/glsl/shaders/videoPik.frag?raw'
import {
  deriveKeyer,
  derivePik,
  type ColorSuppressParams,
  type DespillParams,
  type KeyerParams,
  type PikParams,
} from '@/composables/stages/videoKeyingMath'

const LUMA_MODE: Record<string, number> = {
  rec709: 0,
  rec2020: 1,
  ccir601: 2,
  average: 3,
  max: 4,
}

const KEYER_MODE: Record<string, number> = {
  luminance: 0,
  color: 1,
  screen: 2,
  none: 3,
}

const REPLACE_MODE: Record<string, number> = {
  none: 0,
  source: 1,
  hard: 2,
  soft: 3,
}

const OUT_MODE: Record<string, number> = {
  matte: 0,
  premult: 1,
  alpha: 2,
  composite: 2,
}

export class VideoDespillRenderer extends FxPreviewRenderer<DespillParams> {
  constructor() {
    super(despillFrag, {
      maxInputs: 1,
      maxFloatUniforms: 6,
      maxIntUniforms: 1,
      maxBoolUniforms: 4,
      maxCurves: 0,
    }, (r, p) => {
      r.setFloatUniform(0, p.spillMix ?? 0.5)
      r.setFloatUniform(1, p.expand ?? 0)
      r.setFloatUniform(2, p.redScale ?? 0)
      r.setFloatUniform(3, p.greenScale ?? -1)
      r.setFloatUniform(4, p.blueScale ?? 0)
      r.setFloatUniform(5, p.brightness ?? 0)
      r.setBoolUniform(0, p.screen === 'blue')
      r.setBoolUniform(1, p.clampBlack ?? true)
      r.setBoolUniform(2, p.clampWhite ?? false)
      r.setBoolUniform(3, p.outputSpillmap ?? false)
    })
  }
}

export class VideoColorSuppressRenderer
  extends FxPreviewRenderer<ColorSuppressParams> {
  constructor() {
    super(colorSuppressFrag, {
      maxInputs: 1,
      maxFloatUniforms: 6,
      maxIntUniforms: 1,
      maxBoolUniforms: 2,
      maxCurves: 0,
    }, (r, p) => {
      r.setFloatUniform(0, p.red ?? 0)
      r.setFloatUniform(1, p.green ?? 0)
      r.setFloatUniform(2, p.blue ?? 0)
      r.setFloatUniform(3, p.cyan ?? 0)
      r.setFloatUniform(4, p.magenta ?? 0)
      r.setFloatUniform(5, p.yellow ?? 0)
      r.setBoolUniform(0, p.preserveLuma ?? false)
      r.setBoolUniform(1, p.output === 'matte')
      r.setIntUniform(0, LUMA_MODE[p.luminanceMath ?? 'rec709'] ?? 0)
    })
  }
}

export class VideoKeyerRenderer extends FxPreviewRenderer<
  KeyerParams & { output: string }
> {
  constructor() {
    super(keyerFrag, {
      maxInputs: 1,
      maxFloatUniforms: 12,
      maxIntUniforms: 3,
      maxBoolUniforms: 1,
      maxCurves: 0,
    }, (r, p) => {
      const d = deriveKeyer(p)
      r.setFloatUniform(0, d.kc[0])
      r.setFloatUniform(1, d.kc[1])
      r.setFloatUniform(2, d.kc[2])
      r.setFloatUniform(3, d.kcSum)
      r.setFloatUniform(4, d.kcNorm2)
      r.setFloatUniform(5, d.softL)
      r.setFloatUniform(6, d.tolL)
      r.setFloatUniform(7, d.ctr)
      r.setFloatUniform(8, d.tolU)
      r.setFloatUniform(9, d.softU)
      r.setFloatUniform(10, d.desp)
      r.setFloatUniform(11, d.closing)
      r.setIntUniform(0, KEYER_MODE[d.mode] ?? 0)
      r.setIntUniform(1, LUMA_MODE[d.lumaMath] ?? 0)
      r.setIntUniform(2, OUT_MODE[p.output ?? 'matte'] ?? 0)
    })
  }
}

export class VideoPikRenderer extends FxPreviewRenderer<
  PikParams & { output: string }
> {
  constructor() {
    super(pikFrag, {
      maxInputs: 1,
      maxFloatUniforms: 16,
      maxIntUniforms: 3,
      maxBoolUniforms: 2,
      maxCurves: 0,
    }, (r, p) => {
      const d = derivePik(p)
      r.setFloatUniform(0, d.ab[0])
      r.setFloatUniform(1, d.ab[1])
      r.setFloatUniform(2, d.ab[2])
      r.setFloatUniform(3, d.db[0])
      r.setFloatUniform(4, d.db[1])
      r.setFloatUniform(5, d.db[2])
      r.setFloatUniform(6, d.constC[0])
      r.setFloatUniform(7, d.constC[1])
      r.setFloatUniform(8, d.constC[2])
      r.setFloatUniform(9, d.rw)
      r.setFloatUniform(10, d.gbw)
      r.setFloatUniform(11, d.clipMin)
      r.setFloatUniform(12, d.clipMax)
      r.setFloatUniform(13, d.repCol[0])
      r.setFloatUniform(14, d.repCol[1])
      r.setFloatUniform(15, d.repCol[2])
      r.setIntUniform(0, d.screenKind === 'blue' ? 1 : 0)
      r.setIntUniform(1, REPLACE_MODE[d.replaceMode] ?? 3)
      r.setIntUniform(2, OUT_MODE[p.output ?? 'alpha'] ?? 2)
      r.setBoolUniform(0, d.screenSubtraction)
      r.setBoolUniform(1, d.clampAlpha)
    })
  }
}
