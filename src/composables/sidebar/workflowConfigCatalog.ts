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

import { reactive } from 'vue'

import { fetchCaps } from '@/api'

export type UpstreamKind = 'image' | 'video' | 'audio' | 'text'

export interface Caps {
  upstream_kinds: UpstreamKind[]
  option_keys:    string[]
  computed_keys:  string[]
}

export const DEFAULT_CAPS_BY_KIND: Record<string, Caps> = {
  text:          { upstream_kinds: ['text'],                       option_keys: [],
                                                                   computed_keys: [] },
  image:         { upstream_kinds: ['image', 'text'],              option_keys: ['option:negative', 'option:seed', 'option:batch_size'],
                                                                   computed_keys: ['computed:width', 'computed:height'] },
  'shot-images': { upstream_kinds: ['image', 'text'],              option_keys: ['option:negative', 'option:seed', 'option:batch_size'],
                                                                   computed_keys: ['computed:width', 'computed:height'] },
  video:         { upstream_kinds: ['image', 'video', 'text'],     option_keys: ['option:negative', 'option:seed', 'option:duration_s', 'option:generate_audio'],
                                                                   computed_keys: ['computed:width', 'computed:height', 'computed:length'] },
  audio:         { upstream_kinds: ['text', 'audio'],              option_keys: ['option:seed', 'option:duration_s', 'option:lyrics'],
                                                                   computed_keys: ['computed:length'] },
  storyboard:    { upstream_kinds: ['text'],                       option_keys: ['option:max_length'],
                                                                   computed_keys: [] },
  panorama:      { upstream_kinds: ['image', 'text'],              option_keys: ['option:seed'],
                                                                   computed_keys: [] },
  upscale:       { upstream_kinds: ['image'],                      option_keys: ['option:seed', 'option:scale'],
                                                                   computed_keys: [] },
  outpaint:      { upstream_kinds: ['image'],                      option_keys: ['option:seed', 'option:negative', 'option:pad_left', 'option:pad_top', 'option:pad_right', 'option:pad_bottom', 'option:feathering'],
                                                                   computed_keys: [] },
  inpaint:       { upstream_kinds: ['image'],                      option_keys: ['option:seed', 'option:negative', 'option:mask_data'],
                                                                   computed_keys: [] },
  erase:         { upstream_kinds: ['image'],                      option_keys: ['option:seed', 'option:mask_data'],
                                                                   computed_keys: [] },
  cutout:        { upstream_kinds: ['image'],                      option_keys: [],
                                                                   computed_keys: [] },
  relight:       { upstream_kinds: ['image'],                      option_keys: ['option:seed', 'option:negative'],
                                                                   computed_keys: [] },
  multiangle:    { upstream_kinds: ['image'],                      option_keys: ['option:seed'],
                                                                   computed_keys: [] },
  'image-edit':  { upstream_kinds: ['image'],                      option_keys: ['option:seed'],
                                                                   computed_keys: [] },
  multiview:     { upstream_kinds: ['image'],                      option_keys: ['option:seed'],
                                                                   computed_keys: [] },
  sequence:      { upstream_kinds: ['image'],                      option_keys: ['option:seed'],
                                                                   computed_keys: [] },
  timeline:      { upstream_kinds: [],                             option_keys: [],
                                                                   computed_keys: [] },
  'audio-vocal': { upstream_kinds: ['audio'],                      option_keys: [],
                                                                   computed_keys: [] },
  'audio-bg':    { upstream_kinds: ['audio'],                      option_keys: [],
                                                                   computed_keys: [] },
}

export const STAGE_OPTION_LABELS: Record<string, string> = {
  'option:negative':       'Stage negative prompt',
  'option:seed':           'Stage seed',
  'option:batch_size':     'Stage batch size',
  'option:pad_left':       'Stage pad left',
  'option:pad_top':        'Stage pad top',
  'option:pad_right':      'Stage pad right',
  'option:pad_bottom':     'Stage pad bottom',
  'option:feathering':     'Stage feathering',
  'option:duration_s':     'Stage duration (s)',
  'option:generate_audio': 'Stage generate audio',
  'option:lyrics':         'Stage lyrics',
  'option:scale':          'Stage scale',
  'option:mask_data':      'Stage mask (painter output)',
  'option:max_length':     'Stage LLM max output length',
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

export const DEFAULT_FALLBACK_CAPS: Caps = {
  upstream_kinds: ['image', 'video', 'audio', 'text'],
  option_keys:    ['option:negative', 'option:seed', 'option:batch_size'],
  computed_keys:  ['computed:width', 'computed:height', 'computed:length'],
}

interface CapsState {
  byKind:   Record<string, Caps>
  fallback: Caps
}

const capsState = reactive<CapsState>({
  byKind:   { ...DEFAULT_CAPS_BY_KIND },
  fallback: { ...DEFAULT_FALLBACK_CAPS },
})

let capsPromise: Promise<void> | null = null

export function loadCaps(): Promise<void> {
  if (!capsPromise) {
    capsPromise = fetchCaps()
      .then((payload) => {
        capsState.byKind   = payload.caps_by_kind as Record<string, Caps>
        capsState.fallback = payload.fallback_caps as Caps
      })
      .catch((e) => {
        console.warn('[ComfyTV] fetchCaps failed; using baked-in default caps table', e)
      })
  }
  return capsPromise
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
  void loadCaps()
  let caps = workflowKind ? capsState.byKind[workflowKind] : null
  if (!caps) {
    if (workflowKind) {
      console.warn(
        `[ComfyTV] no caps entry for workflow kind "${workflowKind}"; using permissive fallback caps`,
      )
    }
    caps = capsState.fallback
  }
  const out: Array<{ value: string; label: string }> = [
    { value: '__VALUE__', label: '(use this value)' },
    { value: 'main_prompt', label: 'Stage prompt' },
  ]
  for (const k of caps.option_keys) {
    out.push({ value: k, label: STAGE_OPTION_LABELS[k] ?? k })
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
  }
  return out
}
