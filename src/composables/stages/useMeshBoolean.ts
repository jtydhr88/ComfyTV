import { computed, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { bindWidgetCallback, getWidget, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import type { ViewChannel } from '@/widgets/three/channelShading'

export type BooleanGizmoMode = 'translate' | 'rotate' | 'scale'
export const BOOLEAN_GIZMO_MODES: BooleanGizmoMode[] = ['translate', 'rotate', 'scale']
export const BOOLEAN_OPERATIONS = ['union', 'difference', 'intersect']
export const BOOLEAN_CHANNELS: ViewChannel[] = ['material', 'clay', 'normal', 'wire']

export interface TransformArrays {
  position?: number[]
  quaternion?: number[]
  scale?: number[]
}

export function parseTransformB(raw: string): TransformArrays | null {
  if (!raw) return null
  try {
    const t = JSON.parse(raw) as Record<string, unknown>
    const out: TransformArrays = {}
    if (Array.isArray(t.position)) out.position = t.position as number[]
    if (Array.isArray(t.quaternion)) out.quaternion = t.quaternion as number[]
    if (Array.isArray(t.scale)) out.scale = t.scale as number[]
    return out
  } catch {
    return null
  }
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5

export function serializeTransformB(t: {
  position: number[]
  quaternion: number[]
  scale: number[]
}): string {
  return JSON.stringify({
    position: t.position.map(r5),
    quaternion: t.quaternion.map(r5),
    scale: t.scale.map(r5),
  })
}

export function clampResolution(raw: string | number): number {
  return Math.max(32, Math.min(1024, Math.round(Number(raw) / 32) * 32))
}

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface FrameFit {
  position: Vec3Like
  near: number
  far: number
}

export function computeFrameFit(center: Vec3Like, size: Vec3Like): FrameFit {
  let maxDim = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(maxDim) || maxDim <= 0) maxDim = 2
  const dist = maxDim * 1.8
  return {
    position: {
      x: center.x + dist * 0.7,
      y: center.y + dist * 0.55,
      z: center.z + dist * 0.7,
    },
    near: Math.max(maxDim / 1000, 0.001),
    far: Math.max(maxDim * 100, 100),
  }
}

export function useMeshBoolean(node: LGraphNode, stageState: StageState) {
  const operation = ref(readWidgetStr(node, 'operation', 'union'))
  const resolution = ref(Number(getWidget(node, 'resolution')?.value ?? 256))

  function setOperation(v: string): void {
    operation.value = v
    writeWidget(node, 'operation', v)
  }

  function setResolution(raw: string): void {
    const n = clampResolution(raw)
    resolution.value = n
    writeWidget(node, 'resolution', n)
  }

  bindWidgetCallback(node, 'operation', (v) => { operation.value = String(v) })
  bindWidgetCallback(node, 'resolution', (v) => { resolution.value = Number(v) || 256 })

  onNodeConfigure(node, () => {
    operation.value = readWidgetStr(node, 'operation', 'union')
    resolution.value = Number(getWidget(node, 'resolution')?.value ?? 256)
  })

  const modelAUrl = computed(() => pickSourceImageUrl(stageState.inputs, 'model'))
  const modelBUrl = computed(() => pickSourceImageUrl(stageState.inputs, 'model_b'))
  const resultUrl = computed(() => stageState.output || null)

  const showResult = ref(true)
  const viewingResult = computed(() => Boolean(showResult.value && resultUrl.value))
  watch(resultUrl, (url) => {
    if (url) showResult.value = true
  })

  function readTransformWidget(): TransformArrays | null {
    return parseTransformB(readWidgetStr(node, 'transform_b', ''))
  }

  function writeTransformWidget(t: {
    position: number[]
    quaternion: number[]
    scale: number[]
  }): void {
    writeWidget(node, 'transform_b', serializeTransformB(t))
  }

  function clearTransformWidget(): void {
    writeWidget(node, 'transform_b', '')
  }

  return {
    operation,
    resolution,
    setOperation,
    setResolution,
    modelAUrl,
    modelBUrl,
    resultUrl,
    showResult,
    viewingResult,
    readTransformWidget,
    writeTransformWidget,
    clearTransformWidget,
  }
}
