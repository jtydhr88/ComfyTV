import { reactive, ref } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import { useModelViewCapture } from '@/composables/stages/useModelViewCapture'
import {
  buildPrimitiveGeometry,
  normalizePrimKind,
  PRIM_KINDS,
  type PrimKind,
} from '@/widgets/three/primitiveGeometry'

export { buildPrimitiveGeometry, PRIM_KINDS }
export type { PrimKind }

export interface ParamDef {
  key: string
  labelKey: string
  type: 'int' | 'float' | 'bool'
  min?: number
  max?: number
  step?: number
  default: number | boolean
}

const TAU = Math.PI * 2

export const PRIM_PARAMS: Record<PrimKind, ParamDef[]> = {
  cube: [
    { key: 'width', labelKey: 'meshPrimitive.width', type: 'float', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'height', labelKey: 'meshPrimitive.height', type: 'float', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'depth', labelKey: 'meshPrimitive.depth', type: 'float', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'widthSegments', labelKey: 'meshPrimitive.widthSegments', type: 'int', min: 1, max: 20, step: 1, default: 1 },
    { key: 'heightSegments', labelKey: 'meshPrimitive.heightSegments', type: 'int', min: 1, max: 20, step: 1, default: 1 },
    { key: 'depthSegments', labelKey: 'meshPrimitive.depthSegments', type: 'int', min: 1, max: 20, step: 1, default: 1 },
  ],
  sphere: [
    { key: 'radius', labelKey: 'meshPrimitive.radius', type: 'float', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    { key: 'widthSegments', labelKey: 'meshPrimitive.widthSegments', type: 'int', min: 3, max: 64, step: 1, default: 32 },
    { key: 'heightSegments', labelKey: 'meshPrimitive.heightSegments', type: 'int', min: 2, max: 48, step: 1, default: 16 },
    { key: 'phiStart', labelKey: 'meshPrimitive.phiStart', type: 'float', min: 0, max: TAU, step: 0.01, default: 0 },
    { key: 'phiLength', labelKey: 'meshPrimitive.phiLength', type: 'float', min: 0, max: TAU, step: 0.01, default: TAU },
    { key: 'thetaStart', labelKey: 'meshPrimitive.thetaStart', type: 'float', min: 0, max: Math.PI, step: 0.01, default: 0 },
    { key: 'thetaLength', labelKey: 'meshPrimitive.thetaLength', type: 'float', min: 0, max: Math.PI, step: 0.01, default: Math.PI },
  ],
  cylinder: [
    { key: 'radiusTop', labelKey: 'meshPrimitive.radiusTop', type: 'float', min: 0, max: 5, step: 0.1, default: 0.5 },
    { key: 'radiusBottom', labelKey: 'meshPrimitive.radiusBottom', type: 'float', min: 0, max: 5, step: 0.1, default: 0.5 },
    { key: 'height', labelKey: 'meshPrimitive.height', type: 'float', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'radialSegments', labelKey: 'meshPrimitive.radialSegments', type: 'int', min: 3, max: 64, step: 1, default: 32 },
    { key: 'heightSegments', labelKey: 'meshPrimitive.heightSegments', type: 'int', min: 1, max: 16, step: 1, default: 1 },
    { key: 'openEnded', labelKey: 'meshPrimitive.openEnded', type: 'bool', default: false },
    { key: 'thetaStart', labelKey: 'meshPrimitive.thetaStart', type: 'float', min: 0, max: TAU, step: 0.01, default: 0 },
    { key: 'thetaLength', labelKey: 'meshPrimitive.thetaLength', type: 'float', min: 0, max: TAU, step: 0.01, default: TAU },
  ],
  cone: [
    { key: 'radius', labelKey: 'meshPrimitive.radius', type: 'float', min: 0, max: 5, step: 0.1, default: 0.5 },
    { key: 'height', labelKey: 'meshPrimitive.height', type: 'float', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'radialSegments', labelKey: 'meshPrimitive.radialSegments', type: 'int', min: 3, max: 64, step: 1, default: 32 },
    { key: 'heightSegments', labelKey: 'meshPrimitive.heightSegments', type: 'int', min: 1, max: 16, step: 1, default: 1 },
    { key: 'openEnded', labelKey: 'meshPrimitive.openEnded', type: 'bool', default: false },
    { key: 'thetaStart', labelKey: 'meshPrimitive.thetaStart', type: 'float', min: 0, max: TAU, step: 0.01, default: 0 },
    { key: 'thetaLength', labelKey: 'meshPrimitive.thetaLength', type: 'float', min: 0, max: TAU, step: 0.01, default: TAU },
  ],
  plane: [
    { key: 'width', labelKey: 'meshPrimitive.width', type: 'float', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'height', labelKey: 'meshPrimitive.height', type: 'float', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'widthSegments', labelKey: 'meshPrimitive.widthSegments', type: 'int', min: 1, max: 20, step: 1, default: 1 },
    { key: 'heightSegments', labelKey: 'meshPrimitive.heightSegments', type: 'int', min: 1, max: 20, step: 1, default: 1 },
  ],
  torus: [
    { key: 'radius', labelKey: 'meshPrimitive.radius', type: 'float', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    { key: 'tube', labelKey: 'meshPrimitive.tube', type: 'float', min: 0.01, max: 2, step: 0.01, default: 0.2 },
    { key: 'radialSegments', labelKey: 'meshPrimitive.radialSegments', type: 'int', min: 3, max: 64, step: 1, default: 12 },
    { key: 'tubularSegments', labelKey: 'meshPrimitive.tubularSegments', type: 'int', min: 3, max: 128, step: 1, default: 48 },
    { key: 'arc', labelKey: 'meshPrimitive.arc', type: 'float', min: 0.01, max: TAU, step: 0.01, default: TAU },
  ],
}

export function primitiveRecipeJson(kind: PrimKind, params: Record<string, number | boolean>): string {
  const geom = buildPrimitiveGeometry(kind, params)
  const full = ((geom as unknown as { parameters?: Record<string, unknown> }).parameters
    ?? {}) as Record<string, unknown>
  geom.dispose()
  const out: Record<string, number | boolean> = {}
  for (const def of PRIM_PARAMS[kind]) {
    if (full[def.key] == null) continue
    out[def.key] = def.type === 'bool' ? Boolean(full[def.key]) : Number(full[def.key])
  }
  return JSON.stringify(out)
}

export function useMeshPrimitive(
  node: LGraphNode,
  opts: { captureCanvas: () => HTMLCanvasElement | null },
) {
  const kind = ref<PrimKind>(normalizePrimKind(readWidgetStr(node, 'kind', 'cube')))
  const params = reactive<Record<string, number | boolean>>({})

  function loadDefaultsFor(k: PrimKind): void {
    for (const key of Object.keys(params)) delete params[key]
    for (const def of PRIM_PARAMS[k]) params[def.key] = def.default
  }

  function readStateFor(k: PrimKind): void {
    loadDefaultsFor(k)
    const raw = readWidgetStr(node, 'recipe', '')
    if (!raw.trim()) return
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      parsed = null
    }
    if (!parsed) return
    for (const def of PRIM_PARAMS[k]) {
      if (parsed[def.key] == null) continue
      params[def.key] = def.type === 'bool' ? Boolean(parsed[def.key]) : Number(parsed[def.key])
    }
  }

  readStateFor(kind.value)

  const capture = useModelViewCapture({
    getCanvas: () => opts.captureCanvas(),
    filenamePrefix: 'comfytv-primitive-view',
    logTag: 'mesh-primitive',
    onCaptured: (url) => { writeWidget(node, 'captured_image', url) },
  })

  function syncRecipe(): void {
    writeWidget(node, 'recipe', primitiveRecipeJson(kind.value, params))
  }

  function setKind(k: PrimKind): void {
    if (k === kind.value) return
    kind.value = k
    writeWidget(node, 'kind', k)
    loadDefaultsFor(k)
    syncRecipe()
    capture.scheduleCapture()
  }

  function setParam(def: ParamDef, raw: number | boolean): void {
    let v: number | boolean = raw
    if (def.type === 'bool') {
      v = Boolean(raw)
    } else {
      let num = Number(raw)
      if (!Number.isFinite(num)) return
      if (def.min != null) num = Math.max(def.min, num)
      if (def.max != null) num = Math.min(def.max, num)
      if (def.type === 'int') num = Math.round(num)
      v = num
    }
    params[def.key] = v
    syncRecipe()
    capture.scheduleCapture()
  }

  onNodeConfigure(node, () => {
    kind.value = normalizePrimKind(readWidgetStr(node, 'kind', 'cube'))
    readStateFor(kind.value)
  })

  syncRecipe()

  return {
    kind,
    params,
    setKind,
    setParam,
    scheduleCapture: capture.scheduleCapture,
    cancelCapture: capture.cancelCapture,
  }
}
