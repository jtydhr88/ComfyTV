export interface MaterialParams {
  version: 1
  color: string
  metalness: number
  roughness: number
  transmission: number
  opacity: number
  clearcoat: number
  clearcoatRoughness: number
  ior: number
  emissive: string
  emissiveIntensity: number
}

export const DEFAULT_MATERIAL: MaterialParams = {
  version: 1,
  color: '#8fbf8f',
  metalness: 0,
  roughness: 0.4,
  transmission: 0,
  opacity: 1,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  ior: 1.5,
  emissive: '#000000',
  emissiveIntensity: 0,
}

export interface MaterialPreset {
  key: string
  params: Omit<MaterialParams, 'version' | 'color' | 'emissive'>
}

const preset = (
  p: Partial<Omit<MaterialParams, 'version' | 'color' | 'emissive'>>,
): MaterialPreset['params'] => ({
  metalness: 0,
  roughness: 0.4,
  transmission: 0,
  opacity: 1,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  ior: 1.5,
  emissiveIntensity: 0,
  ...p,
})

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { key: 'plasticGlossy',  params: preset({ roughness: 0.15, clearcoat: 0.6 }) },
  { key: 'plasticMatte',   params: preset({ roughness: 0.75 }) },
  { key: 'metalPolished',  params: preset({ metalness: 1, roughness: 0.08 }) },
  { key: 'metalBrushed',   params: preset({ metalness: 1, roughness: 0.45 }) },
  { key: 'glassClear',     params: preset({ roughness: 0.05, transmission: 1 }) },
  { key: 'glassFrosted',   params: preset({ roughness: 0.45, transmission: 1 }) },
  { key: 'rubber',         params: preset({ roughness: 0.95 }) },
  { key: 'ceramic',        params: preset({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }) },
]

const clamp01 = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

const asHex = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX_RE.test(v) ? v.toLowerCase() : fallback

export function normalizeMaterial(raw: unknown): MaterialParams {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_MATERIAL
  const ior = Number(src.ior)
  return {
    version: 1,
    color: asHex(src.color, d.color),
    metalness: clamp01(src.metalness, d.metalness),
    roughness: clamp01(src.roughness, d.roughness),
    transmission: clamp01(src.transmission, d.transmission),
    opacity: clamp01(src.opacity, d.opacity),
    clearcoat: clamp01(src.clearcoat, d.clearcoat),
    clearcoatRoughness: clamp01(src.clearcoatRoughness, d.clearcoatRoughness),
    ior: Number.isFinite(ior) ? Math.min(2.333, Math.max(1, ior)) : d.ior,
    emissive: asHex(src.emissive, d.emissive),
    emissiveIntensity: clamp01(src.emissiveIntensity, d.emissiveIntensity),
  }
}

export function parseMaterialState(json: string | null | undefined): MaterialParams {
  if (!json) return { ...DEFAULT_MATERIAL }
  try {
    return normalizeMaterial(JSON.parse(json))
  } catch {
    return { ...DEFAULT_MATERIAL }
  }
}

export function serializeMaterialState(params: MaterialParams): string {
  return JSON.stringify(normalizeMaterial(params))
}
