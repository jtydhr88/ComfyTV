export interface ExposedWidget {
  node_id:      string
  node_title:   string
  node_type:    string
  group_title:  string | null
  widget_name:  string
  widget_type:  string
  widget_props: Record<string, any>
  current_value: any
  stage_binding: string | null
  override_value: string | null
  cast: string | null
  required?: boolean
}

export interface GuiNode {
  id: string
  type: string
  title?: string | null
  is_output?: boolean | null
  out_type?: string | null
  in_type?: string | null
}

export interface ConfigPayload {
  id: number
  kind: string
  label: string
  link_type?: number
  file_exists?: boolean
  has_api: boolean
  description: string | null
  gui_notes: Array<{ type: string; text: string }>
  exposed_widgets: ExposedWidget[]
  gui_nodes?: GuiNode[]
  result_type?: string | null
  result_node?: string | null
  meta?: Record<string, unknown>
}

export const AUTO_RESULT_NODE = '__AUTO__'

export interface CustomExposure {
  kind: string
  label: string
  prompt: boolean
}

export function customExposureIndex(config: Pick<ConfigPayload, 'kind' | 'meta'> | null | undefined): Map<string, CustomExposure> {
  const out = new Map<string, CustomExposure>()
  if (config?.kind !== 'custom') return out
  const raw = (config.meta as any)?.custom_io?.inputs
  for (const it of Array.isArray(raw) ? raw : []) {
    if (!it?.node || !it?.input) continue
    out.set(`${it.node}/${it.input}`, {
      kind: String(it.kind ?? ''), label: String(it.label ?? it.input), prompt: Boolean(it.prompt),
    })
  }
  return out
}

export function customExposedOutputs(config: Pick<ConfigPayload, 'kind' | 'meta'> | null | undefined): Array<{ kind: string; label: string }> {
  if (config?.kind !== 'custom') return []
  const raw = (config.meta as any)?.custom_io?.outputs
  return (Array.isArray(raw) ? raw : [])
    .filter((o: any) => o?.node)
    .map((o: any) => ({ kind: String(o.kind ?? ''), label: String(o.label ?? o.kind ?? '') }))
}

export type ResultType = 'graph_output_first' | 'ui_save_batch' | 'ui_save_url'

const TEXT_RESULT_KINDS = new Set(['text', 'storyboard'])
const BATCH_RESULT_KINDS = new Set(['image', 'shot-images', 'multiview', 'sequence'])

export function resultTypesForKind(kind: string | null | undefined): ResultType[] {
  if (!kind) return ['graph_output_first', 'ui_save_batch', 'ui_save_url']
  if (TEXT_RESULT_KINDS.has(kind)) return ['graph_output_first']
  if (BATCH_RESULT_KINDS.has(kind)) return ['ui_save_batch', 'ui_save_url']
  return ['ui_save_url']
}

export function isResultNodeCandidate(node: GuiNode, kind: string | null | undefined): boolean {
  if (node.is_output == null && node.out_type == null) return true
  if (node.is_output) return true
  if (!kind || TEXT_RESULT_KINDS.has(kind)) return node.out_type === 'STRING'
  return false
}

export function buildResultNodeOptions(
  guiNodes: GuiNode[] | undefined,
  autoLabel: string,
  kind?: string | null,
  keepId?: string | null,
): Array<{ value: string; label: string }> {
  const out = [{ value: AUTO_RESULT_NODE, label: autoLabel }]
  const all = guiNodes ?? []
  let nodes = all
  if (kind !== undefined) {
    nodes = all.filter(
      n => isResultNodeCandidate(n, kind) || (keepId != null && String(n.id) === String(keepId)),
    )
    if (!nodes.length) nodes = all
  }
  for (const n of nodes) {
    const id = String(n.id)
    const title = n.title && n.title !== n.type ? `${n.title} ` : ''
    out.push({ value: id, label: `${title}(${n.type}) #${id}` })
  }
  return out
}

export function isOutputRow(w: ExposedWidget): boolean {
  return w.widget_type === 'OUTPUT'
}

export function outputsTakenOver(node: NodeBlock): boolean {
  const outputs = node.widgets.filter(isOutputRow)
  return outputs.length > 0 && outputs.every(w => !!w.stage_binding)
}

export function outputBindingOptions(
  options: Array<{ value: string; label: string }>,
  outputType: string,
): Array<{ value: string; label: string }> {
  const text = outputType === 'STRING'
  return options
    .filter(o => o.value !== '__VALUE__')
    .filter(o => o.value.startsWith('option:') || o.value.startsWith('computed:')
      || (text && (o.value === 'main_prompt' || o.value.startsWith('upstream_text:'))))
}

export interface NodeBlock {
  node_id: string
  node_title: string
  node_type: string
  widgets: ExposedWidget[]
}

export interface WidgetGroup {
  title: string | null
  nodes: NodeBlock[]
}

export const ALL_GROUPS = '__ALL__'

export function groupKeyOf(group: WidgetGroup): string {
  return group.title ?? ''
}

function nodeMatches(node: NodeBlock, q: string): boolean {
  return (
    node.node_title.toLowerCase().includes(q)
    || node.node_type.toLowerCase().includes(q)
    || node.node_id.toLowerCase().includes(q)
    || node.widgets.some(w => w.widget_name.toLowerCase().includes(q))
  )
}

export function filterWidgetGroups(
  groups: WidgetGroup[],
  query: string,
  groupKey: string = ALL_GROUPS,
): WidgetGroup[] {
  let out = groups
  if (groupKey !== ALL_GROUPS) out = out.filter(g => groupKeyOf(g) === groupKey)
  const q = query.trim().toLowerCase()
  if (q) {
    out = out
      .map(g => ({ title: g.title, nodes: g.nodes.filter(n => nodeMatches(n, q)) }))
      .filter(g => g.nodes.length > 0)
  }
  return out
}

export function groupExposedWidgets(widgets: ExposedWidget[]): WidgetGroup[] {
  const groups: WidgetGroup[] = []
  const groupIdx = new Map<string, number>()
  const nodeIdx  = new Map<string, number>()
  for (const w of widgets) {
    const gkey = w.group_title ?? ''
    let gi = groupIdx.get(gkey)
    if (gi === undefined) {
      gi = groups.length
      groupIdx.set(gkey, gi)
      groups.push({ title: w.group_title, nodes: [] })
    }
    const nkey = `${gi}/${w.node_id}`
    let ni = nodeIdx.get(nkey)
    if (ni === undefined) {
      ni = groups[gi].nodes.length
      nodeIdx.set(nkey, ni)
      groups[gi].nodes.push({
        node_id:    w.node_id,
        node_title: w.node_title,
        node_type:  w.node_type,
        widgets:    [],
      })
    }
    groups[gi].nodes[ni].widgets.push(w)
  }
  return groups
}

import { reactive } from 'vue'

import { fetchCaps } from '@/api'
import { i18n, t } from '@/i18n'

export type UpstreamKind = 'image' | 'video' | 'audio' | 'text' | 'model'

export interface Caps {
  upstream_kinds: UpstreamKind[]
  option_keys:    string[]
  computed_keys:  string[]
  option_labels:  Record<string, string>
}

const STAGE_COMPUTED_LABEL_KEYS: Record<string, string> = {
  'computed:width':  'bindTo.width',
  'computed:height': 'bindTo.height',
  'computed:length': 'bindTo.length',
}

export function stageParamLabel(key: string, fallback: string): string {
  const k = `bindTo.option.${key}`
  return i18n.global.te(k) ? t(k) : fallback
}

interface CapsState {
  byKind:   Record<string, Caps>
  fallback: Caps | null
}

const capsState = reactive<CapsState>({
  byKind:   {},
  fallback: null,
})

let capsPromise: Promise<void> | null = null

export function loadCaps(): Promise<void> {
  if (!capsPromise) {
    capsPromise = fetchCaps().then((payload) => {
      capsState.byKind   = payload.caps_by_kind as Record<string, Caps>
      capsState.fallback = payload.fallback_caps as Caps
    }).catch((e) => {
      capsPromise = null
      console.error('[ComfyTV] fetchCaps failed — caps are served from the backend; fix the API', e)
      throw e
    })
  }
  return capsPromise
}

export function reloadCaps(): Promise<void> {
  capsPromise = null
  return loadCaps()
}

function maxUsedUpstreamIndex(widgets: ExposedWidget[], kind: string): number {
  const pat = new RegExp(`^upstream_${kind}:[^\\[]+\\[(\\d+)\\]$`)
  let max = -1
  for (const w of widgets) {
    if (!w.stage_binding) continue
    const m = w.stage_binding.match(pat)
    if (m) {
      const idx = parseInt(m[1], 10)
      if (idx > max) max = idx
    }
  }
  return max
}

export function buildBindingOptions(
  widgets: ExposedWidget[],
  workflowKind: string | null | undefined,
): Array<{ value: string; label: string }> {
  void loadCaps().catch(() => {})
  const caps = (workflowKind ? capsState.byKind[workflowKind] : null) ?? capsState.fallback
  const out: Array<{ value: string; label: string }> = [
    { value: '__VALUE__', label: t('bindTo.useValue') },
    { value: 'main_prompt', label: t('bindTo.prompt') },
  ]
  if (!caps) return out
  for (const k of caps.option_keys) {
    out.push({ value: k, label: stageParamLabel(k.replace(/^option:/, ''), caps.option_labels[k] ?? k) })
  }
  for (const k of caps.computed_keys) {
    out.push({ value: k, label: STAGE_COMPUTED_LABEL_KEYS[k] ? t(STAGE_COMPUTED_LABEL_KEYS[k]) : k })
  }
  for (const ukind of caps.upstream_kinds) {
    const maxUsed = maxUsedUpstreamIndex(widgets, ukind)
    const showUpTo = Math.min(8, maxUsed + 1)
    const suffix = ukind === 'text' ? 'value' : 'annotated'
    const label  = t(`bindTo.upstream.${ukind}`)
    for (let i = 0; i <= showUpTo; i++) {
      out.push({
        value: `upstream_${ukind}:${suffix}[${i}]`,
        label: `${label} ${i + 1}`,
      })
    }
    if (ukind === 'image' && caps.option_keys.includes('option:mask_data')) {
      out.push({
        value: 'upstream_image:masked[0]',
        label: t('bindTo.maskedImage'),
      })
    }
  }
  return out
}
