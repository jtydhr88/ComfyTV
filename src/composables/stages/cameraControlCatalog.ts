export interface CameraOption {
  label: string
  phrase: string
}

export interface FocalOption {
  mm: number
  label: string
  perspective: string
}

export interface ApertureOption {
  f: string
  label: string
  effect: string
}

export const CAMERAS: CameraOption[] = [
  { label: 'Modular 8K Digital',          phrase: 'modular 8K digital cinema camera' },
  { label: 'Full-Frame Cine Digital',     phrase: 'full-frame digital cinema camera' },
  { label: 'Grand Format 70mm Film',      phrase: 'grand format 70mm film camera' },
  { label: 'Studio Digital S35',          phrase: 'Super 35 studio digital camera' },
  { label: 'Classic 16mm Film',           phrase: 'classic 16mm film camera' },
  { label: 'Premium Large Format Digital', phrase: 'premium large-format digital cinema camera' },
]

export const LENSES: CameraOption[] = [
  { label: 'Creative Tilt',       phrase: 'creative tilt lens effect' },
  { label: 'Compact Anamorphic',  phrase: 'compact anamorphic lens' },
  { label: 'Extreme Macro',       phrase: 'extreme macro lens' },
  { label: '70s Cinema Prime',    phrase: '1970s cinema prime lens' },
  { label: 'Classic Anamorphic',  phrase: 'classic anamorphic lens' },
  { label: 'Premium Modern Prime', phrase: 'premium modern prime lens' },
  { label: 'Warm Cinema Prime',   phrase: 'warm-toned cinema prime lens' },
  { label: 'Swirl Bokeh Portrait', phrase: 'swirl bokeh portrait lens' },
  { label: 'Vintage Prime',       phrase: 'vintage prime lens' },
  { label: 'Halation Diffusion',  phrase: 'halation diffusion filter' },
  { label: 'Clinical Sharp Prime', phrase: 'ultra-sharp clinical prime lens' },
]

export const FOCAL_LENGTHS: FocalOption[] = [
  { mm: 8,  label: '8mm (Ultra-Wide)',    perspective: 'ultra-wide perspective' },
  { mm: 14, label: '14mm (Wide)',         perspective: 'wide-angle perspective' },
  { mm: 24, label: '24mm (Wide Dynamic)', perspective: 'wide-angle dynamic perspective' },
  { mm: 35, label: '35mm (Human Eye)',    perspective: 'natural cinematic perspective' },
  { mm: 50, label: '50mm (Portrait)',     perspective: 'standard portrait perspective' },
  { mm: 85, label: '85mm (Tight Portrait)', perspective: 'classic portrait perspective' },
]

export const APERTURES: ApertureOption[] = [
  { f: 'f/1.4', label: 'f/1.4 (Shallow DoF)', effect: 'shallow depth of field, creamy bokeh' },
  { f: 'f/4',   label: 'f/4 (Balanced)',      effect: 'balanced depth of field' },
  { f: 'f/11',  label: 'f/11 (Deep Focus)',   effect: 'deep focus clarity, sharp foreground to background' },
]

export interface CameraSuffixParts {
  camera?: string
  lens?: string
  focalMm?: number | null
  perspective?: string
  aperture?: string
  depth?: string
}

const BASELINE = ['cinematic lighting', 'natural color science', 'high dynamic range']

export function buildCameraSuffix(p: CameraSuffixParts): string {
  const parts: string[] = []
  if (p.camera) parts.push(`shot on a ${p.camera}`)
  if (p.lens || p.focalMm) {
    const lens = p.lens ? `using a ${p.lens}` : 'shot'
    const focal = p.focalMm ? ` at ${p.focalMm}mm` : ''
    const persp = p.focalMm && p.perspective ? ` (${p.perspective})` : ''
    parts.push(`${lens}${focal}${persp}`)
  }
  if (p.aperture) parts.push(`aperture ${p.aperture}`)
  if (p.depth) parts.push(p.depth)
  if (parts.length === 0) return ''
  return [...parts, ...BASELINE].join(', ')
}

export interface CameraSelection {
  camera?: string
  lens?: string
  focal?: string
  aperture?: string
}

export function composeCamera(sel: CameraSelection): string {
  const focalMm = sel.focal ? Number(sel.focal) : null
  return buildCameraSuffix({
    camera: CAMERAS.find(c => c.label === sel.camera)?.phrase,
    lens: LENSES.find(l => l.label === sel.lens)?.phrase,
    focalMm,
    perspective: FOCAL_LENGTHS.find(f => f.mm === focalMm)?.perspective,
    aperture: sel.aperture || undefined,
    depth: APERTURES.find(a => a.f === sel.aperture)?.effect,
  })
}
