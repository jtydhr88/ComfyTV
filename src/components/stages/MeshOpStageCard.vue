<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground"
    @contextmenu.stop.prevent
  >
    <div class="ctv:group ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[240px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black">
      <ModelPreview
        v-if="previewSrc"
        ref="previewEl"
        :src="previewSrc"
        :channel="channel"
        @view-changed="scheduleCapture"
        @model-stats="onModelStats"
      />
      <div v-else
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <IconBox class="ctv:size-8 ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t(isPrimitive ? 'meshOps.runToGenerate' : 'meshOps.noInputModel') }}</div>
      </div>

      <div v-if="sourceUrl && resultUrl"
           class="ctv:absolute ctv:top-1 ctv:left-1 ctv:z-10 ctv:flex ctv:gap-1">
        <button type="button" :class="chipClass(!showResult)" @click.stop="showResult = false">
          {{ $t('meshOps.source') }}
        </button>
        <button type="button" :class="chipClass(showResult)" @click.stop="showResult = true">
          {{ $t('meshOps.result') }}
        </button>
      </div>

      <div v-if="previewSrc"
           class="ctv:absolute ctv:top-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1 ctv:opacity-0
                  ctv:group-hover:opacity-100 ctv:transition-opacity">
        <button type="button" :class="downloadBtnClass"
                :title="$t('stage.action.download')"
                @click.stop="onDownloadModel"><i class="pi pi-download" /></button>
      </div>

      <div v-if="statsLine"
           class="ctv:absolute ctv:bottom-1 ctv:left-1 ctv:z-10 ctv:px-1.5 ctv:py-0.5 ctv:rounded-sm
                  ctv:bg-black/60 ctv:text-3xs ctv:font-mono ctv:text-white/80 ctv:pointer-events-none">
        {{ statsLine }}
      </div>

      <div v-if="previewSrc"
           class="ctv:absolute ctv:bottom-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1">
        <button v-for="ch in channels" :key="ch" type="button"
                :class="chipClass(channel === ch)"
                @click.stop="channel = ch">{{ $t(`meshOps.channel.${ch}`) }}</button>
      </div>
    </div>

    <div
      v-if="hasMapsPanel && mapsUrl"
      class="ctv:relative ctv:w-full ctv:shrink-0 ctv:rounded-md ctv:overflow-hidden ctv:bg-black"
    >
      <img :src="assetUrl(mapsUrl)" :alt="mapsPanelLabel"
           class="ctv:block ctv:w-full ctv:max-h-40 ctv:object-contain" />
      <span class="ctv:absolute ctv:top-1 ctv:left-1 ctv:px-1.5 ctv:py-0.5 ctv:rounded-sm
                   ctv:bg-black/60 ctv:text-3xs ctv:text-white/80 ctv:pointer-events-none">
        {{ mapsPanelLabel }}
      </span>
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:shrink-0"
         @pointerdown.stop @mousedown.stop>
      <div v-if="isMeshOp" class="ctv:flex ctv:items-start ctv:gap-1.5">
        <span class="ctv:w-28 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground ctv:pt-0.5">
          {{ $t('meshOps.operation') }}</span>
        <div class="ctv:flex ctv:flex-wrap ctv:gap-1">
          <button v-for="op in MESH_OPERATIONS" :key="op" type="button"
                  :class="chipClass(operation === op)"
                  @click="setOperation(op)">{{ $t(`meshOps.op.${op}`) }}</button>
        </div>
      </div>

      <template v-for="c in visibleControls" :key="c.widget">
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:w-28 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground"
                :title="$t(c.labelKey)">{{ $t(c.labelKey) }}</span>

          <template v-if="c.type === 'combo'">
            <button
              v-for="opt in c.options"
              :key="opt"
              type="button"
              :class="chipClass(values[c.widget] === opt)"
              @click="setValue(c, opt)"
            >{{ $t(`meshOps.opt.${opt}`) }}</button>
          </template>

          <template v-else-if="c.type === 'bool'">
            <button
              type="button"
              :class="chipClass(Boolean(values[c.widget]))"
              @click="setValue(c, !values[c.widget])"
            >{{ Boolean(values[c.widget]) ? $t('meshOps.on') : $t('meshOps.off') }}</button>
          </template>

          <template v-else>
            <input
              type="range"
              class="ctv:flex-1 ctv:min-w-0 ctv:accent-[var(--ctv-primary-background,#4ea8ff)]"
              :min="c.min" :max="c.max" :step="c.step"
              :value="Number(values[c.widget])"
              @input="setValue(c, ($event.target as HTMLInputElement).value)"
            />
            <input
              type="number"
              class="ctv:w-20 ctv:shrink-0 ctv:py-0.5 ctv:px-1 ctv:rounded-sm ctv:outline-none ctv:box-border
                     ctv:text-2xs ctv:text-right ctv:[font-family:inherit]
                     ctv:bg-secondary-background ctv:text-base-foreground
                     ctv:border ctv:border-border-default ctv:focus:border-primary-background"
              :min="c.min" :max="c.max" :step="c.step"
              :value="Number(values[c.widget])"
              @change="setValue(c, ($event.target as HTMLInputElement).value)"
            />
          </template>
        </div>
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide ctv:shrink-0">
      <span v-if="!sourceUrl && !isPrimitive" class="ctv:text-muted-foreground">{{ $t('meshOps.noInputModel') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('meshOps.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('meshOps.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('meshOps.adjustThenRun') }}</span>
    </div>

    <div class="ctv:shrink-0">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-output
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconBox from '~icons/lucide/box'

import type { LGraphNode } from '@/lib/comfyApp'
import ModelPreview from '@/components/stages/ModelPreview.vue'
import StageCard from '@/components/stages/StageCard.vue'
import type { StageState } from '@/stores/stageStore'
import { app } from '@/lib/comfyApp'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { downloadFile } from '@/utils/download'
import { uploadCanvas } from '@/utils/uploadCanvas'
import { bindWidgetCallback, getWidget, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import type { ViewChannel } from '@/widgets/three/channelShading'

interface ControlDef {
  widget: string
  labelKey: string
  type: 'int' | 'float' | 'combo' | 'bool'
  min?: number
  max?: number
  step?: number
  options?: string[]
  showIf?: { widget: string; equals: string }
}

const MESH_OPERATIONS = ['decimate', 'remesh', 'weld', 'fill_holes', 'smooth_normals',
                         'subdivide', 'unwrap', 'export']

const OP_PARAMS: Record<string, ControlDef[]> = {
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

const NODE_CONTROLS: Record<string, ControlDef[]> = {
  'ComfyTV.MeshPrimitiveStage': [
    { widget: 'kind', labelKey: 'meshOps.primitiveKind', type: 'combo',
      options: ['cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus'] },
    { widget: 'size', labelKey: 'meshOps.primitiveSize', type: 'float', min: 0.01, max: 100, step: 0.1 },
    { widget: 'segments', labelKey: 'meshOps.segments', type: 'int', min: 1, max: 128, step: 1 },
  ],
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

const { t } = useI18n()

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string, context?: { imageUrl?: string }) => void
  node: LGraphNode
}>()

const nodeType = String((props.node as any).type ?? (props.node as any).comfyClass ?? '')
const isMeshOp = nodeType === 'ComfyTV.MeshOpStage'
const isBake = nodeType === 'ComfyTV.MeshBakeMapsStage'
const isPrimitive = nodeType === 'ComfyTV.MeshPrimitiveStage'

const operation = ref(isMeshOp ? readWidgetStr(props.node, 'operation', 'decimate') : '')

function setOperation(op: string): void {
  operation.value = op
  writeWidget(props.node, 'operation', op)
}
if (isMeshOp) {
  bindWidgetCallback(props.node, 'operation', (v) => { operation.value = String(v) })
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
  const w = getWidget(props.node, c.widget) as any
  values[c.widget] = w?.value
    ?? (c.type === 'combo' ? c.options?.[0] ?? '' : c.type === 'bool' ? true : c.min ?? 0)
  bindWidgetCallback(props.node, c.widget, (value) => {
    values[c.widget] = c.type === 'combo' ? String(value)
      : c.type === 'bool' ? Boolean(value)
      : Number(value)
  })
}

onNodeConfigure(props.node, () => {
  if (isMeshOp) operation.value = readWidgetStr(props.node, 'operation', 'decimate')
  for (const c of allControls) {
    const w = getWidget(props.node, c.widget) as any
    if (w != null) values[c.widget] = w.value
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
  writeWidget(props.node, c.widget, v)
}

const sourceUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'model'))
const resultUrl = computed(() => props.state.output || null)
const mapsUrl = computed(() => (hasMapsPanel.value ? props.state.outputs?.[1] ?? null : null))
const mapsPanelLabel = computed(() => t(isUnwrap.value ? 'meshOps.uvAtlas' : 'meshOps.bakedMaps'))

const showResult = ref(true)
watch(resultUrl, (v) => { if (v) showResult.value = true })

const previewSrc = computed(() => {
  if (isExport.value) return sourceUrl.value ?? ''
  if (showResult.value && resultUrl.value) return resultUrl.value
  return sourceUrl.value ?? resultUrl.value ?? ''
})

const sourceStats = ref<{ vertices: number; triangles: number } | null>(null)
const resultStats = ref<{ vertices: number; triangles: number } | null>(null)

function onModelStats(stats: { vertices: number; triangles: number }): void {
  if (previewSrc.value === resultUrl.value) resultStats.value = stats
  else sourceStats.value = stats
}

watch(resultUrl, () => { resultStats.value = null })
watch(sourceUrl, () => { sourceStats.value = null })

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.?0+$/, '')}K`
  return String(n)
}

const statsLine = computed(() => {
  const src = sourceStats.value
  const res = resultStats.value
  if (src && res) return `△ ${fmtCount(src.triangles)} → ${fmtCount(res.triangles)}`
  const cur = (previewSrc.value === resultUrl.value ? res : src) ?? res ?? src
  return cur ? `△ ${fmtCount(cur.triangles)} · ${fmtCount(cur.vertices)}v` : ''
})

function assetUrl(path: string): string {
  const api = (app as any).api
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

const CAPTURE_SIZE = 1024
const CAPTURE_DELAY_MS = 700

const previewEl = ref<InstanceType<typeof ModelPreview> | null>(null)
let captureTimer: number | null = null
let captureSeq = 0

function scheduleCapture(): void {
  if (hasMapsPanel.value) return
  if (captureTimer != null) window.clearTimeout(captureTimer)
  captureTimer = window.setTimeout(() => {
    captureTimer = null
    void runCapture()
  }, CAPTURE_DELAY_MS)
}

async function runCapture(): Promise<void> {
  const canvas = previewEl.value?.captureCanvas(CAPTURE_SIZE, CAPTURE_SIZE)
  if (!canvas) return
  const mySeq = ++captureSeq
  try {
    const url = await uploadCanvas(canvas, {
      subfolder: 'model3d-view',
      filename: `comfytv-mesh-op-view-${Date.now()}.png`,
    })
    if (mySeq !== captureSeq) return
    props.onAction('model-capture-view', { imageUrl: url })
  } catch (e) {
    console.error('[ComfyTV/mesh-op] capture upload failed', e)
  }
}

function chipClass(active: boolean): string {
  return 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]'
    + ' ctv:rounded-sm ctv:border ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:transition-colors'
    + (active
      ? ' ctv:border-primary-background ctv:bg-primary-background/20 ctv:text-base-foreground'
      : ' ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground'
        + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
}

const downloadBtnClass =
  'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none'
  + ' ctv:border-none ctv:transition-colors ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
  + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'
</script>
