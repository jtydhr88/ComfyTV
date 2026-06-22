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
}

export interface ConfigPayload {
  id: number
  kind: string
  label: string
  has_api: boolean
  description: string | null
  gui_notes: Array<{ type: string; text: string }>
  exposed_widgets: ExposedWidget[]
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

export type UpstreamKind = 'image' | 'video' | 'audio' | 'text'

export interface Caps {
  upstream_kinds: UpstreamKind[]
  option_keys:    string[]
  computed_keys:  string[]
}

export const STAGE_COMPUTED_LABELS: Record<string, string> = {
  'computed:width':  'Stage width',
  'computed:height': 'Stage height',
  'computed:length': 'Stage video length',
}

export const UPSTREAM_KIND_LABELS: Record<string, string> = {
  image: 'Upstream image', video: 'Upstream video',
  audio: 'Upstream audio', text:  'Upstream text',
}

interface CapsState {
  byKind:   Record<string, Caps>
  fallback: Caps | null
  optionLabels: Record<string, string>
}

const capsState = reactive<CapsState>({
  byKind:   {},
  fallback: null,
  optionLabels: {},
})

let capsPromise: Promise<void> | null = null

export function loadCaps(): Promise<void> {
  if (!capsPromise) {
    capsPromise = fetchCaps().then((payload) => {
      capsState.byKind   = payload.caps_by_kind as Record<string, Caps>
      capsState.fallback = payload.fallback_caps as Caps
      capsState.optionLabels = (payload.option_labels ?? {}) as Record<string, string>
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
    { value: '__VALUE__', label: '(use this value)' },
    { value: 'main_prompt', label: 'Stage prompt' },
  ]
  if (!caps) return out
  for (const k of caps.option_keys) {
    out.push({ value: k, label: capsState.optionLabels[k] ?? k })
  }
  for (const k of caps.computed_keys) {
    out.push({ value: k, label: STAGE_COMPUTED_LABELS[k] ?? k })
  }
  for (const ukind of caps.upstream_kinds) {
    const maxUsed = maxUsedUpstreamIndex(widgets, ukind)
    const showUpTo = Math.min(7, maxUsed + 1)
    const suffix = ukind === 'text' ? 'value' : 'annotated'
    const label  = UPSTREAM_KIND_LABELS[ukind]
    for (let i = 0; i <= showUpTo; i++) {
      out.push({
        value: `upstream_${ukind}:${suffix}[${i}]`,
        label: `${label} #${i + 1}`,
      })
    }
    if (ukind === 'image' && caps.option_keys.includes('option:mask_data')) {
      out.push({
        value: 'upstream_image:masked[0]',
        label: 'Upstream image + painted mask (alpha)',
      })
    }
  }
  return out
}
