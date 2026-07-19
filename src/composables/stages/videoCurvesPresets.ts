export type CurvePoint = [number, number]

export interface CurvesPresetChannels {
  red?: CurvePoint[]
  green?: CurvePoint[]
  blue?: CurvePoint[]
  master?: CurvePoint[]
}

export const VIDEO_CURVES_PRESETS: Record<string, CurvesPresetChannels> = {
  color_negative: {
    red: [[0.129, 1], [0.466, 0.498], [0.725, 0]],
    green: [[0.109, 1], [0.301, 0.498], [0.517, 0]],
    blue: [[0.098, 1], [0.235, 0.498], [0.423, 0]],
  },
  cross_process: {
    red: [[0, 0], [0.25, 0.156], [0.501, 0.501], [0.686, 0.745], [1, 1]],
    green: [[0, 0], [0.25, 0.188], [0.38, 0.501], [0.745, 0.815], [1, 0.815]],
    blue: [[0, 0], [0.231, 0.094], [0.709, 0.874], [1, 1]],
  },
  darker: { master: [[0, 0], [0.5, 0.4], [1, 1]] },
  increase_contrast: {
    master: [[0, 0], [0.149, 0.066], [0.831, 0.905], [0.905, 0.98], [1, 1]],
  },
  lighter: { master: [[0, 0], [0.4, 0.5], [1, 1]] },
  linear_contrast: { master: [[0, 0], [0.305, 0.286], [0.694, 0.713], [1, 1]] },
  medium_contrast: { master: [[0, 0], [0.286, 0.219], [0.639, 0.643], [1, 1]] },
  negative: { master: [[0, 1], [1, 0]] },
  strong_contrast: {
    master: [[0, 0], [0.301, 0.196], [0.592, 0.6], [0.686, 0.737], [1, 1]],
  },
  vintage: {
    red: [[0, 0.11], [0.42, 0.51], [1, 0.95]],
    green: [[0, 0], [0.5, 0.48], [1, 1]],
    blue: [[0, 0.22], [0.49, 0.44], [1, 0.8]],
  },
}

export const VIDEO_CURVES_PRESET_NAMES = [
  'none',
  ...Object.keys(VIDEO_CURVES_PRESETS),
]
