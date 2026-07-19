import brightnessContrast from '@/widgets/glsl/shaders/brightnessContrast.frag?raw'
import colorAdjustment from '@/widgets/glsl/shaders/colorAdjustment.frag?raw'
import colorBalance from '@/widgets/glsl/shaders/colorBalance.frag?raw'
import colorCurves from '@/widgets/glsl/shaders/colorCurves.frag?raw'
import hueSaturation from '@/widgets/glsl/shaders/hueSaturation.frag?raw'
import imageLevels from '@/widgets/glsl/shaders/imageLevels.frag?raw'
import { identityCurve, type CurveData } from '@/components/widgets/curve/types'
import { isCurveData } from '@/components/widgets/curve/curveUtils'
import {
  HUE_STOPS,
  TEMP_STOPS,
  TINT_STOPS,
  LUMA_STOPS,
  GAMMA_STOPS,
  SAT_STOPS,
  CONTRAST_STOPS,
  CR_STOPS,
  MG_STOPS,
  YB_STOPS,
  type ColorStop,
} from '@/components/widgets/colorStops'

export type GradeUniformKind = 'float' | 'int' | 'bool' | 'curve'

export type GradeValue = number | boolean | CurveData

export interface GradeOption {
  labelKey: string
  value: number
}

export interface GradeUniform {
  kind: GradeUniformKind
  index: number
  key: string
  labelKey: string
  min?: number
  max?: number
  step?: number
  default: GradeValue
  options?: GradeOption[]
  gradient?: ColorStop[]
  curveColor?: string
}

export interface ColorGradeEffect {
  id: string
  labelKey: string
  frag: string
  uniforms: GradeUniform[]
}

const f = (
  index: number,
  key: string,
  labelKey: string,
  min: number,
  max: number,
  def: number,
  step = 1
): GradeUniform => ({ kind: 'float', index, key, labelKey, min, max, default: def, step })

const fg = (
  index: number,
  key: string,
  labelKey: string,
  min: number,
  max: number,
  def: number,
  gradient: ColorStop[],
  step = 1
): GradeUniform => ({ kind: 'float', index, key, labelKey, min, max, default: def, step, gradient })

const cv = (
  index: number,
  key: string,
  labelKey: string,
  curveColor: string
): GradeUniform => ({ kind: 'curve', index, key, labelKey, default: identityCurve(), curveColor })

export const COLOR_GRADE_EFFECTS: ColorGradeEffect[] = [
  {
    id: 'brightness_contrast',
    labelKey: 'colorGrade.effects.brightnessContrast',
    frag: brightnessContrast,
    uniforms: [
      fg(0, 'brightness', 'colorGrade.params.brightness', -100, 100, 0, LUMA_STOPS),
      fg(1, 'contrast', 'colorGrade.params.contrast', -100, 100, 0, CONTRAST_STOPS)
    ]
  },
  {
    id: 'color_adjustment',
    labelKey: 'colorGrade.effects.colorAdjustment',
    frag: colorAdjustment,
    uniforms: [
      fg(0, 'temperature', 'colorGrade.params.temperature', -100, 100, 0, TEMP_STOPS),
      fg(1, 'tint', 'colorGrade.params.tint', -100, 100, 0, TINT_STOPS),
      fg(2, 'vibrance', 'colorGrade.params.vibrance', -100, 100, 0, SAT_STOPS),
      fg(3, 'saturation', 'colorGrade.params.saturation', -100, 100, 0, SAT_STOPS)
    ]
  },
  {
    id: 'color_balance',
    labelKey: 'colorGrade.effects.colorBalance',
    frag: colorBalance,
    uniforms: [
      fg(0, 'shadows_r', 'colorGrade.params.shadowsR', -100, 100, 0, CR_STOPS),
      fg(1, 'shadows_g', 'colorGrade.params.shadowsG', -100, 100, 0, MG_STOPS),
      fg(2, 'shadows_b', 'colorGrade.params.shadowsB', -100, 100, 0, YB_STOPS),
      fg(3, 'midtones_r', 'colorGrade.params.midtonesR', -100, 100, 0, CR_STOPS),
      fg(4, 'midtones_g', 'colorGrade.params.midtonesG', -100, 100, 0, MG_STOPS),
      fg(5, 'midtones_b', 'colorGrade.params.midtonesB', -100, 100, 0, YB_STOPS),
      fg(6, 'highlights_r', 'colorGrade.params.highlightsR', -100, 100, 0, CR_STOPS),
      fg(7, 'highlights_g', 'colorGrade.params.highlightsG', -100, 100, 0, MG_STOPS),
      fg(8, 'highlights_b', 'colorGrade.params.highlightsB', -100, 100, 0, YB_STOPS),
      {
        kind: 'bool',
        index: 0,
        key: 'preserve_luminosity',
        labelKey: 'colorGrade.params.preserveLuminosity',
        default: true
      }
    ]
  },
  {
    id: 'hue_saturation',
    labelKey: 'colorGrade.effects.hueSaturation',
    frag: hueSaturation,
    uniforms: [
      {
        kind: 'int',
        index: 0,
        key: 'mode',
        labelKey: 'colorGrade.params.mode',
        default: 0,
        options: [
          { labelKey: 'colorGrade.options.hsMode.master', value: 0 },
          { labelKey: 'colorGrade.options.hsMode.reds', value: 1 },
          { labelKey: 'colorGrade.options.hsMode.yellows', value: 2 },
          { labelKey: 'colorGrade.options.hsMode.greens', value: 3 },
          { labelKey: 'colorGrade.options.hsMode.cyans', value: 4 },
          { labelKey: 'colorGrade.options.hsMode.blues', value: 5 },
          { labelKey: 'colorGrade.options.hsMode.magentas', value: 6 },
          { labelKey: 'colorGrade.options.hsMode.colorize', value: 7 }
        ]
      },
      {
        kind: 'int',
        index: 1,
        key: 'colorspace',
        labelKey: 'colorGrade.params.colorspace',
        default: 0,
        options: [
          { labelKey: 'colorGrade.options.colorspace.hsl', value: 0 },
          { labelKey: 'colorGrade.options.colorspace.hsv', value: 1 }
        ]
      },
      fg(0, 'hue', 'colorGrade.params.hue', -180, 180, 0, HUE_STOPS),
      fg(1, 'saturation', 'colorGrade.params.saturation', -100, 100, 0, SAT_STOPS),
      fg(2, 'lightness', 'colorGrade.params.lightness', -100, 100, 0, LUMA_STOPS),
      f(3, 'overlap', 'colorGrade.params.overlap', 0, 100, 0)
    ]
  },
  {
    id: 'color_curves',
    labelKey: 'colorGrade.effects.colorCurves',
    frag: colorCurves,
    uniforms: [
      cv(0, 'curve_master', 'colorGrade.params.curveMaster', '#ffffff'),
      cv(1, 'curve_r', 'colorGrade.params.curveRed', '#ff6b6b'),
      cv(2, 'curve_g', 'colorGrade.params.curveGreen', '#51cf66'),
      cv(3, 'curve_b', 'colorGrade.params.curveBlue', '#4d8cff')
    ]
  },
  {
    id: 'image_levels',
    labelKey: 'colorGrade.effects.imageLevels',
    frag: imageLevels,
    uniforms: [
      {
        kind: 'int',
        index: 0,
        key: 'channel',
        labelKey: 'colorGrade.params.channel',
        default: 0,
        options: [
          { labelKey: 'colorGrade.options.channel.rgb', value: 0 },
          { labelKey: 'colorGrade.options.channel.r', value: 1 },
          { labelKey: 'colorGrade.options.channel.g', value: 2 },
          { labelKey: 'colorGrade.options.channel.b', value: 3 }
        ]
      },
      fg(0, 'input_black', 'colorGrade.params.inputBlack', 0, 255, 0, LUMA_STOPS),
      fg(1, 'input_white', 'colorGrade.params.inputWhite', 0, 255, 255, LUMA_STOPS),
      fg(2, 'gamma', 'colorGrade.params.gamma', 0.01, 9.99, 1, GAMMA_STOPS, 0.01),
      fg(3, 'output_black', 'colorGrade.params.outputBlack', 0, 255, 0, LUMA_STOPS),
      fg(4, 'output_white', 'colorGrade.params.outputWhite', 0, 255, 255, LUMA_STOPS)
    ]
  }
]

export const DEFAULT_EFFECT_ID = COLOR_GRADE_EFFECTS[0].id

export function getEffect(id: string | undefined): ColorGradeEffect {
  return COLOR_GRADE_EFFECTS.find((e) => e.id === id) ?? COLOR_GRADE_EFFECTS[0]
}

export function cloneGradeValue(v: GradeValue): GradeValue {
  return isCurveData(v)
    ? { points: v.points.map((p) => [p[0], p[1]] as [number, number]), interpolation: v.interpolation }
    : v
}

export function defaultValues(effect: ColorGradeEffect): Record<string, GradeValue> {
  const out: Record<string, GradeValue> = {}
  for (const u of effect.uniforms) out[u.key] = cloneGradeValue(u.default)
  return out
}
