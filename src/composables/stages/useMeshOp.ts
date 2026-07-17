import { computed, reactive, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { app } from '@/lib/comfyApp'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { downloadFile } from '@/utils/download'
import { bindWidgetCallback, getWidget, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import type { ViewChannel } from '@/widgets/three/channelShading'

export interface ControlDef {
  widget: string
  labelKey: string
  type: 'int' | 'float' | 'combo' | 'bool'
  min?: number
  max?: number
  step?: number
  options?: string[]
  showIf?: { widget: string; equals: string }
}

export const MESH_OPERATIONS = ['decimate', 'remesh', 'weld', 'fill_holes', 'smooth_normals',
                                'subdivide', 'unwrap', 'export']

export const OP_PARAMS: Record<string, ControlDef[]> = {
  decimate: [
    { widget: 'target_face_count', labelKey: 'meshOps.targetFaces', type: 'int', min: 100, max: 1_000_000, step: 100 },
    { widget: 'placement_mode', labelKey: 'meshOps.placementMode', type: 'combo', options: ['midpoint', 'qem'] },
    { widget: 'feature_edge_quadric_weight', labelKey: 'meshOps.featureEdgeWeight', type: 'float', min: 0, max: 1000, step: 1,
      showIf: { widget: 'placement_mode', equals: 'qem' } },
    { widget: 'feature_edge_min_dihedral_deg', labelKey: 'meshOps.featureEdgeAngle', type: 'float', min: 0, max: 180, step: 1,
      showIf: { widget: 'placement_mode', equals: 'qem' } },
  ],
  remesh: [
    { widget: 'resolution', labelKey: 'meshOps.voxelResolution', type: 'int', min: 32, max: 1024, step: 32 },
    { widget: 'sign_mode', labelKey: 'meshOps.signMode', type: 'combo', options: ['udf', 'sdf'] },
    { widget: 'smooth_iters', labelKey: 'meshOps.smoothIters', type: 'int', min: 0, max: 20, step: 1 },
    { widget: 'project_back', labelKey: 'meshOps.projectBack', type: 'float', min: 0, max: 1, step: 0.05 },
  ],
  weld: [
    { widget: 'epsilon_rel', labelKey: 'meshOps.weldTolerance', type: 'float', min: 0, max: 0.01, step: 0.00001 },
  ],
  fill_holes: [
    { widget: 'max_perimeter', labelKey: 'meshOps.maxPerimeter', type: 'float', min: 0, max: 1, step: 0.001 },
    { widget: 'max_verts', labelKey: 'meshOps.maxHoleVerts', type: 'int', min: 3, max: 64, step: 1 },
  ],
  smooth_normals: [
    { widget: 'crease_angle', labelKey: 'meshOps.creaseAngle', type: 'float', min: 0, max: 180, step: 1 },
  ],
  subdivide: [
    { widget: 'iterations', labelKey: 'meshOps.subdivideIters', type: 'int', min: 1, max: 4, step: 1 },
    { widget: 'smooth_iters', labelKey: 'meshOps.smoothIters', type: 'int', min: 0, max: 20, step: 1 },
  ],
  unwrap: [
    { widget: 'segmenter', labelKey: 'meshOps.segmenter', type: 'combo', options: ['pec', 'adaptive'] },
    { widget: 'atlas_resolution', labelKey: 'meshOps.atlasResolution', type: 'int', min: 256, max: 8192, step: 256 },
    { widget: 'padding', labelKey: 'meshOps.padding', type: 'int', min: 0, max: 16, step: 1 },
  ],
  export: [
    { widget: 'format', labelKey: 'meshOps.exportFormat', type: 'combo', options: ['glb', 'obj', 'stl'] },
  ],
}

export const NODE_CONTROLS: Record<string, ControlDef[]> = {
  'ComfyTV.MeshBakeMapsStage': [
    { widget: 'bake_normal', labelKey: 'meshOps.bakeNormal', type: 'bool' },
    { widget: 'bake_ao', labelKey: 'meshOps.bakeAo', type: 'bool' },
    { widget: 'resolution', labelKey: 'meshOps.mapResolution', type: 'int', min: 256, max: 4096, step: 256 },
    { widget: 'cage_distance', labelKey: 'meshOps.cageDistance', type: 'float', min: 0.001, max: 0.5, step: 0.001,
      showIf: { widget: 'bake_normal', equals: 'true' } },
    { widget: 'ao_samples', labelKey: 'meshOps.aoSamples', type: 'int', min: 4, max: 512, step: 4,
      showIf: { widget: 'bake_ao', equals: 'true' } },
    { widget: 'ao_strength', labelKey: 'meshOps.aoStrength', type: 'float', min: 0, max: 2, step: 0.05,
      showIf: { widget: 'bake_ao', equals: 'true' } },
  ],
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.?0+$/, '')}K`
  return String(n)
}

export interface ModelStats {
  vertices: number
  triangles: number
}

export function useMeshOp(node: LGraphNode, stageState: StageState) {
  const host = node as LGraphNode & { type?: unknown; comfyClass?: unknown }
  const nodeType = String(host.type ?? host.comfyClass ?? '')
  const isMeshOp = nodeType === 'ComfyTV.MeshOpStage'
  const isBake = nodeType === 'ComfyTV.MeshBakeMapsStage'
  const isPrimitive = nodeType === 'ComfyTV.MeshPrimitiveStage'

  const operation = ref(isMeshOp ? readWidgetStr(node, 'operation', 'decimate') : '')

  function setOperation(op: string): void {
    operation.value = op
    writeWidget(node, 'operation', op)
  }
  if (isMeshOp) {
    bindWidgetCallback(node, 'operation', (v) => { operation.value = String(v) })
  }

  const allControls: ControlDef[] = isMeshOp
    ? [...new Map(Object.values(OP_PARAMS).flat().map((c) => [c.widget, c])).values()]
    : NODE_CONTROLS[nodeType] ?? []

  const visibleControls = computed(() => {
    const base = isMeshOp ? OP_PARAMS[operation.value] ?? [] : allControls
    return base.filter((c) => !c.showIf || String(values[c.showIf.widget]) === c.showIf.equals)
  })

  const isUnwrap = computed(() => isMeshOp && operation.value === 'unwrap')
  const isExport = computed(() => isMeshOp && operation.value === 'export')
  const hasMapsPanel = computed(() => isUnwrap.value || isBake)

  const channels = computed<ViewChannel[]>(() => [
    'material', 'clay', 'normal', 'wire',
    ...((isUnwrap.value || isBake ? ['uv'] : []) as ViewChannel[]),
  ])
  const channel = ref<ViewChannel>('material')
  watch(channels, (chs) => { if (!chs.includes(channel.value)) channel.value = 'material' })

  const values = reactive<Record<string, string | number | boolean>>({})
  for (const c of allControls) {
    const w = getWidget(node, c.widget)
    values[c.widget] = (w?.value as string | number | boolean | undefined)
      ?? (c.type === 'combo' ? c.options?.[0] ?? '' : c.type === 'bool' ? true : c.min ?? 0)
    bindWidgetCallback(node, c.widget, (value) => {
      values[c.widget] = c.type === 'combo' ? String(value)
        : c.type === 'bool' ? Boolean(value)
        : Number(value)
    })
  }

  onNodeConfigure(node, () => {
    if (isMeshOp) operation.value = readWidgetStr(node, 'operation', 'decimate')
    for (const c of allControls) {
      const w = getWidget(node, c.widget)
      if (w != null) values[c.widget] = w.value as string | number | boolean
    }
  })

  function setValue(c: ControlDef, raw: string | number | boolean): void {
    let v: string | number | boolean = raw
    if (c.type === 'bool') {
      v = Boolean(raw)
    } else if (c.type !== 'combo') {
      let n = Number(raw)
      if (!Number.isFinite(n)) return
      if (c.min != null) n = Math.max(c.min, n)
      if (c.max != null) n = Math.min(c.max ?? n, n)
      if (c.type === 'int') n = Math.round(n)
      v = n
    }
    values[c.widget] = v
    writeWidget(node, c.widget, v)
  }

  const sourceUrl = computed(() => pickSourceImageUrl(stageState.inputs, 'model'))
  const resultUrl = computed(() => stageState.output || null)
  const mapsUrl = computed(() => (hasMapsPanel.value ? stageState.outputs?.[1] ?? null : null))

  const showResult = ref(true)
  watch(resultUrl, (v) => { if (v) showResult.value = true })

  const previewSrc = computed(() => {
    if (isExport.value) return sourceUrl.value ?? ''
    if (showResult.value && resultUrl.value) return resultUrl.value
    return sourceUrl.value ?? resultUrl.value ?? ''
  })

  const sourceStats = ref<ModelStats | null>(null)
  const resultStats = ref<ModelStats | null>(null)

  function onModelStats(stats: ModelStats): void {
    if (previewSrc.value === resultUrl.value) resultStats.value = stats
    else sourceStats.value = stats
  }

  watch(resultUrl, () => { resultStats.value = null })
  watch(sourceUrl, () => { sourceStats.value = null })

  const statsLine = computed(() => {
    const src = sourceStats.value
    const res = resultStats.value
    if (src && res) return `△ ${fmtCount(src.triangles)} → ${fmtCount(res.triangles)}`
    const cur = (previewSrc.value === resultUrl.value ? res : src) ?? res ?? src
    return cur ? `△ ${fmtCount(cur.triangles)} · ${fmtCount(cur.vertices)}v` : ''
  })

  function assetUrl(path: string): string {
    const api = (app as { api?: { fileURL?: (p: string) => string } }).api
    return typeof api?.fileURL === 'function' ? api.fileURL(path) : path
  }

  async function onDownloadModel(): Promise<void> {
    const target = (isExport.value && resultUrl.value) ? resultUrl.value : previewSrc.value
    if (!target) return
    try {
      await downloadFile(target)
    } catch (e) {
      console.error('[ComfyTV/mesh-op] download failed', e)
    }
  }

  return {
    nodeType,
    isMeshOp,
    isBake,
    isPrimitive,
    operation,
    setOperation,
    allControls,
    visibleControls,
    isUnwrap,
    isExport,
    hasMapsPanel,
    channels,
    channel,
    values,
    setValue,
    sourceUrl,
    resultUrl,
    mapsUrl,
    showResult,
    previewSrc,
    sourceStats,
    resultStats,
    onModelStats,
    statsLine,
    assetUrl,
    onDownloadModel,
  }
}
