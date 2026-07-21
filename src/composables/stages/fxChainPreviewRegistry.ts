import { VideoColorRenderer } from '@/widgets/glsl/videoColorRenderer'
import { VideoCurvesRenderer } from '@/widgets/glsl/videoCurvesRenderer'
import { VideoBlurRenderer } from '@/widgets/glsl/videoBlurRenderer'
import { VideoStylizeRenderer } from '@/widgets/glsl/videoStylizeRenderer'
import { VideoLutRenderer } from '@/widgets/glsl/videoLutRenderer'
import { VideoHueCorrectRenderer } from '@/widgets/glsl/videoHueCorrectRenderer'
import {
  VideoColorSuppressRenderer,
  VideoDespillRenderer,
  VideoKeyerRenderer,
  VideoPikRenderer,
} from '@/widgets/glsl/keyingRenderers'
import { VideoTransformRenderer } from '@/widgets/glsl/videoTransformRenderer'
import { VideoSelectiveColorRenderer } from '@/widgets/glsl/videoSelectiveColorRenderer'
import { VideoChromaShiftRenderer } from '@/widgets/glsl/videoChromaShiftRenderer'
import { VideoPseudocolorRenderer } from '@/widgets/glsl/videoPseudocolorRenderer'
import { SELECTIVE_ZONE_IDS } from '@/composables/stages/videoSelectiveColorMath'
import {
  isPreviewableLutFile,
  parseLutText,
  type ParsedLut,
} from '@/composables/stages/videoLutMath'
import {
  fxSourceSize,
  type FxPreviewSource,
} from '@/widgets/glsl/fxPreviewSource'

export interface ChainRendererLike {
  renderToCanvas(
    src: FxPreviewSource,
    params: Record<string, unknown>,
    target: HTMLCanvasElement,
  ): boolean
  dispose(): void
}

export interface ChainStageDef {
  create: () => ChainRendererLike
  paramsOf: (node: unknown) => Record<string, unknown>
}

function widgetValue(node: unknown, name: string, def: unknown): unknown {
  const widgets = (node as { widgets?: { name?: string; value?: unknown }[] })
    ?.widgets ?? []
  const found = widgets.find((x) => x?.name === name)
  return found?.value ?? def
}

function num(node: unknown, name: string, def: number): number {
  const v = Number(widgetValue(node, name, def))
  return Number.isFinite(v) ? v : def
}

function str(node: unknown, name: string, def: string): string {
  const v = widgetValue(node, name, def)
  return typeof v === 'string' ? v : def
}

function bool(node: unknown, name: string, def: boolean): boolean {
  return Boolean(widgetValue(node, name, def))
}

const lutTextCache = new Map<string, ParsedLut | null>()

export class ChainLutRenderer implements ChainRendererLike {
  private inner = new VideoLutRenderer()
  private fetching = new Set<string>()

  renderToCanvas(
    src: FxPreviewSource,
    params: Record<string, unknown>,
    target: HTMLCanvasElement,
  ): boolean {
    const lutFile = String(params.lutFile ?? '')
    const lutUrl = String(params.lutUrl ?? '')
    const interp = String(params.interp ?? 'tetrahedral')
    let lut: ParsedLut | null = null
    if (lutUrl && lutFile && isPreviewableLutFile(lutFile)) {
      if (lutTextCache.has(lutUrl)) {
        lut = lutTextCache.get(lutUrl) ?? null
      } else if (!this.fetching.has(lutUrl)) {
        this.fetching.add(lutUrl)
        void fetch(lutUrl)
          .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
          .then((text) => lutTextCache.set(lutUrl, parseLutText(lutFile, text)))
          .catch(() => lutTextCache.set(lutUrl, null))
      }
    }
    return this.inner.renderToCanvas(
      src, { lut, interp } as never, target)
  }

  dispose(): void {
    this.inner.dispose()
  }
}

export class ChainBlitRenderer implements ChainRendererLike {
  renderToCanvas(
    src: FxPreviewSource,
    _params: Record<string, unknown>,
    target: HTMLCanvasElement,
  ): boolean {
    const { w, h } = fxSourceSize(src)
    if (target.width !== w || target.height !== h) {
      target.width = w
      target.height = h
    }
    const ctx = target.getContext('2d')
    if (!ctx) return false
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(src as CanvasImageSource, 0, 0, w, h)
    return true
  }

  dispose(): void {}
}

function lutViewUrl(name: string): string {
  if (!name) return ''
  return `/comfytv/luts/${encodeURIComponent(name)}`
}

export const CHAIN_PREVIEW_STAGES: Record<string, ChainStageDef> = {
  'ComfyTV.VideoColorStage': {
    create: () => new VideoColorRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      exposure: num(n, 'exposure', 0),
      black: num(n, 'black', 0),
      temperature: num(n, 'temperature', 6500),
      tempMix: num(n, 'temp_mix', 1),
      hue: num(n, 'hue', 0),
      saturation: num(n, 'saturation', 0),
      vibrance: num(n, 'vibrance', 0),
      blackpoint: num(n, 'blackpoint', 0),
      whitepoint: num(n, 'whitepoint', 1),
      shadows: [num(n, 'shadows_r', 0), num(n, 'shadows_g', 0),
        num(n, 'shadows_b', 0)],
      midtones: [num(n, 'midtones_r', 0), num(n, 'midtones_g', 0),
        num(n, 'midtones_b', 0)],
      highlights: [num(n, 'highlights_r', 0), num(n, 'highlights_g', 0),
        num(n, 'highlights_b', 0)],
      preserveLightness: bool(n, 'preserve_lightness', true),
    }),
  },
  'ComfyTV.VideoCurvesStage': {
    create: () => new VideoCurvesRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      preset: str(n, 'preset', 'none'),
      master: str(n, 'master_pts', ''),
      red: str(n, 'red_pts', ''),
      green: str(n, 'green_pts', ''),
      blue: str(n, 'blue_pts', ''),
    }),
  },
  'ComfyTV.VideoLUTStage': {
    create: () => new ChainLutRenderer(),
    paramsOf: (n) => {
      const file = str(n, 'lut_file', '')
      return {
        lutFile: file,
        lutUrl: lutViewUrl(file),
        interp: str(n, 'interp', 'tetrahedral'),
      }
    },
  },
  'ComfyTV.VideoBlurSharpenStage': {
    create: () => new VideoBlurRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      mode: str(n, 'mode', 'gaussian'),
      amount: num(n, 'amount', 2),
      size: num(n, 'size', 5),
      edgePreserve: num(n, 'edge_preserve', 0.1),
    }),
  },
  'ComfyTV.VideoStylizeStage': {
    create: () => new VideoStylizeRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      effect: str(n, 'effect', 'vignette'),
      strength: num(n, 'strength', 0.5),
      block: num(n, 'block', 8),
    }),
  },
  'ComfyTV.HueCorrectStage': {
    create: () => new VideoHueCorrectRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      curves: str(n, 'curves', ''),
      satThrsh: num(n, 'sat_thrsh', 0),
      luminanceMix: num(n, 'luminance_mix', 0),
    }),
  },
  'ComfyTV.DespillStage': {
    create: () => new VideoDespillRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      screen: str(n, 'screen', 'green'),
      spillMix: num(n, 'spill_mix', 0.5),
      expand: num(n, 'expand', 0),
      redScale: num(n, 'red_scale', 0),
      greenScale: num(n, 'green_scale', -1),
      blueScale: num(n, 'blue_scale', 0),
      brightness: num(n, 'brightness', 0),
      outputSpillmap: bool(n, 'output_spillmap', false),
    }),
  },
  'ComfyTV.ColorSuppressStage': {
    create: () =>
      new VideoColorSuppressRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      red: num(n, 'red', 0),
      green: num(n, 'green', 0),
      blue: num(n, 'blue', 0),
      cyan: num(n, 'cyan', 0),
      magenta: num(n, 'magenta', 0),
      yellow: num(n, 'yellow', 0),
      preserveLuma: bool(n, 'preserve_luma', false),
      output: str(n, 'output', 'image'),
    }),
  },
  'ComfyTV.KeyerStage': {
    create: () => new VideoKeyerRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      mode: str(n, 'mode', 'luminance'),
      keyColor: str(n, 'key_color', '#000000'),
      softnessLower: num(n, 'softness_lower', -0.5),
      toleranceLower: num(n, 'tolerance_lower', 0),
      center: num(n, 'center', 1),
      toleranceUpper: num(n, 'tolerance_upper', 0),
      softnessUpper: num(n, 'softness_upper', 0.5),
      despill: num(n, 'despill', 1),
      despillAngle: num(n, 'despill_angle', 120),
      output: str(n, 'output', 'matte'),
    }),
  },
  'ComfyTV.SelectiveColorStage': {
    create: () =>
      new VideoSelectiveColorRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      scMethod: str(n, 'sc_method', 'absolute'),
      zones: Object.fromEntries(
        SELECTIVE_ZONE_IDS.map((z) => [z, num(n, `sc_${z}`, 0)])),
    }),
  },
  'ComfyTV.ChromaShiftStage': {
    create: () =>
      new VideoChromaShiftRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      shiftRh: num(n, 'shift_rh', 0),
      shiftRv: num(n, 'shift_rv', 0),
      shiftBh: num(n, 'shift_bh', 0),
      shiftBv: num(n, 'shift_bv', 0),
      shiftEdge: str(n, 'shift_edge', 'smear'),
    }),
  },
  'ComfyTV.PseudocolorStage': {
    create: () =>
      new VideoPseudocolorRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      preset: str(n, 'pseudo_preset', 'viridis'),
      opacity: num(n, 'pseudo_opacity', 1),
    }),
  },
  'ComfyTV.VideoTransformStage': {
    create: () => new VideoTransformRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      posX: num(n, 'pos_x', 0),
      posY: num(n, 'pos_y', 0),
      scale: num(n, 'scale', 1),
      rotation: num(n, 'rotation', 0),
      skewX: num(n, 'skew_x', 0),
    }),
  },
  'ComfyTV.PIKStage': {
    create: () => new VideoPikRenderer() as unknown as ChainRendererLike,
    paramsOf: (n) => ({
      screen: str(n, 'screen', 'green'),
      pickColor: str(n, 'pick_color', '#00FF00'),
      redWeight: num(n, 'red_weight', 0.5),
      blueGreenWeight: num(n, 'blue_green_weight', 0.5),
      alphaBias: str(n, 'alpha_bias', '#808080'),
      despillBias: str(n, 'despill_bias', '#808080'),
      useAlphaBias: bool(n, 'use_alpha_bias', true),
      screenSubtraction: bool(n, 'screen_subtraction', true),
      clipBlack: num(n, 'clip_black', 0),
      clipWhite: num(n, 'clip_white', 1),
      replaceMode: str(n, 'replace_mode', 'soft'),
      replaceColor: str(n, 'replace_color', '#808080'),
      output: str(n, 'output', 'alpha'),
    }),
  },
}
