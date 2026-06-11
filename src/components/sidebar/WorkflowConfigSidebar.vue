<template>
  <div class="wf-config-sidebar">
    <div class="header">
      <span class="title">{{ $t('configSidebar.title') }}</span>
    </div>

    <div v-if="!selected" class="empty">
      {{ $t('configSidebar.empty') }}
    </div>

    <div v-else-if="!selected.workflowLabel" class="empty">
      {{ $t('configSidebar.noWorkflowPicked') }}
    </div>

    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <div v-else-if="config" class="body">
      <div class="header-meta">
        <span class="kind">{{ config.kind }}</span>
        <span class="lbl">{{ config.label }}</span>
        <span v-if="!config.has_api" class="cache-warn">
          {{ $t('configSidebar.pickWorkflowFirst') }}
        </span>
      </div>

      <section v-if="config.gui_notes?.length" class="notes-block">
        <button
          class="notes-header"
          :class="{ 'is-collapsed': notesCollapsed }"
          :aria-expanded="!notesCollapsed"
          @click="toggleNotesCollapsed"
        >
          <span class="notes-caret">{{ notesCollapsed ? '▸' : '▾' }}</span>
          <span class="notes-title">{{ $t('configSidebar.section.notes') }}</span>
          <span class="notes-count">{{ config.gui_notes.length }}</span>
        </button>
        <div v-if="!notesCollapsed" class="notes-body">
          <div v-for="(note, i) in config.gui_notes" :key="i" class="workflow-note">
            <pre class="workflow-note-text">{{ note.text }}</pre>
          </div>
        </div>
      </section>

      <section v-if="config.exposed_widgets?.length" class="widgets-block">
        <h3>{{ $t('configSidebar.section.widgets') }}</h3>
        <div v-for="(grp, gi) in groupedWidgets" :key="gi" class="widget-group">
          <div v-if="grp.title" class="group-head">{{ grp.title }}</div>

          <div v-for="node in grp.nodes" :key="node.node_id" class="node-block">
            <button
              class="node-header"
              :class="{ 'is-collapsed': isCollapsed(node.node_id) }"
              :aria-expanded="!isCollapsed(node.node_id)"
              @click="toggleCollapsed(node.node_id)"
            >
              <span class="node-caret">{{ isCollapsed(node.node_id) ? '▸' : '▾' }}</span>
              <span class="node-header-title">{{ node.node_title }}</span>
              <span v-if="node.node_title !== node.node_type" class="node-header-class mono">
                ({{ node.node_type }})
              </span>
              <span class="node-header-id mono">#{{ node.node_id }}</span>
              <span class="node-header-spacer"></span>
              <span class="node-header-count">
                {{ boundCountFor(node) }} / {{ node.widgets.length }}
              </span>
            </button>

            <div v-if="!isCollapsed(node.node_id)" class="node-body">
              <div
                v-for="w in node.widgets"
                :key="`${w.node_id}/${w.widget_name}`"
                class="widget-row"
              >
                <div class="widget-name-row">
                  <span class="widget-name mono">.{{ w.widget_name }}</span>
                </div>
                <ComfyTVWidget
                  :kind="w.widget_type"
                  :model-value="effectiveValue(w)"
                  :options="comboOptions(w)"
                  :min="numProp(w, 'min')"
                  :max="numProp(w, 'max')"
                  :step="numProp(w, 'step')"
                  :precision="numProp(w, 'precision')"
                  :multiline="!!w.widget_props?.multiline"
                  :disabled="isStageBound(w)"
                  @update:model-value="onValueChange(w, $event)"
                />
                <div class="widget-bind-row">
                  <span class="lbl">{{ $t('configSidebar.bindTo') }}</span>
                  <ComfyTVSelect
                    :model-value="dropdownValueFor(w)"
                    :options="bindingOptions"
                    @update:model-value="onBindingChange(w, $event as string)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-else class="empty-sub">
        {{ $t('configSidebar.noExposedWidgets') }}
      </div>

      <section v-if="config.description" class="desc-block">
        <h3>{{ $t('configSidebar.section.description') }}</h3>
        <p class="desc-text">{{ config.description }}</p>
      </section>

      <div class="export-row">
        <button
          class="export-button"
          :disabled="!config.has_api || exportBusy"
          :title="$t('configSidebar.exportPresetTooltip')"
          @click="onExportPreset"
        >
          ⇩ {{ $t('configSidebar.exportPreset') }}
        </button>
        <button
          class="reset-button"
          :disabled="resetBusy"
          :title="$t('configSidebar.resetToPresetTooltip')"
          @click="onResetToPreset"
        >
          {{ $t('configSidebar.resetToPreset') }}
        </button>
        <span v-if="exportError" class="export-error">{{ exportError }}</span>
        <span v-if="resetError" class="export-error">{{ resetError }}</span>
      </div>
    </div>

    <div v-else class="empty">{{ $t('configSidebar.loading') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSelectionStore } from '@/stores/selectionStore'
import { invalidateWorkflowInfo } from '@/composables/stages/useWorkflowValidator'
import { prepareWorkflow } from '@/composables/stages/useWorkflowPrep'
import { app } from '@/lib/comfyApp'

import ComfyTVWidget from '@/components/widgets/ComfyTVWidget.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'

const { t } = useI18n()

interface ExposedWidget {
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
interface ConfigPayload {
  id: number
  kind: string
  label: string
  has_api: boolean
  description: string | null
  gui_notes: Array<{ type: string; text: string }>
  exposed_widgets: ExposedWidget[]
}

const selection = useSelectionStore()
const selected  = computed(() => selection.selected)
const config    = ref<ConfigPayload | null>(null)
const loadError = ref<string | null>(null)

const exportBusy = ref(false)
const exportError = ref<string | null>(null)

const resetBusy = ref(false)
const resetError = ref<string | null>(null)

type Caps = {
  upstream_kinds: Array<'image' | 'video' | 'audio' | 'text'>
  option_keys:    string[]
  computed_keys:  string[]
}

const CAPS_BY_KIND: Record<string, Caps> = {
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

const STAGE_OPTION_LABELS: Record<string, string> = {
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
const STAGE_COMPUTED_LABELS: Record<string, string> = {
  'computed:width':  'Stage width',
  'computed:height': 'Stage height',
  'computed:length': 'Stage video length',
}
const UPSTREAM_KIND_LABELS: Record<string, string> = {
  image: 'Upstream image', video: 'Upstream video',
  audio: 'Upstream audio', text:  'Upstream text',
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

const bindingOptions = computed<Array<{ value: string; label: string }>>(() => {
  const sel = selection.selected
  const widgets = config.value?.exposed_widgets ?? []
  const caps = (sel ? CAPS_BY_KIND[sel.workflowKind] : null) ?? {
    upstream_kinds: ['image', 'video', 'audio', 'text'],
    option_keys:    ['option:negative', 'option:seed', 'option:batch_size'],
    computed_keys:  ['computed:width', 'computed:height', 'computed:length'],
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
})

async function fetchJson(path: string, init?: RequestInit) {
  const resp = await (app as any).api.fetchApi(path, init)
  if (resp.status >= 400) {
    let detail = `${resp.status} ${resp.statusText}`
    try { const j = await resp.json(); if (j?.error) detail += ` — ${j.error}` } catch {}
    throw new Error(detail)
  }
  return resp.json()
}

async function loadConfig(kind: string, label: string) {
  loadError.value = null
  config.value = null
  try {
    try { await prepareWorkflow(kind, label) } catch {}
    config.value = await fetchJson(
      `/comfytv/workflows/config?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`
    )
  } catch (e: any) {
    loadError.value = String(e?.message || e || 'load failed')
  }
}

async function onExportPreset() {
  if (!selected.value || !config.value) return
  exportError.value = null
  exportBusy.value = true
  try {
    const kind  = selected.value.workflowKind
    const label = selected.value.workflowLabel
    const resp = await (app as any).api.fetchApi(
      `/comfytv/workflows/preset?kind=${encodeURIComponent(kind)}` +
      `&label=${encodeURIComponent(label)}`,
    )
    if (resp.status >= 400) {
      let detail = `${resp.status} ${resp.statusText}`
      try { const j = await resp.json(); if (j?.error) detail += ` — ${j.error}` } catch {}
      throw new Error(detail)
    }
    const cd = resp.headers.get('Content-Disposition') || ''
    const m  = cd.match(/filename="?([^"]+)"?/i)
    const filename = m ? m[1] : 'preset.json'
    const blob = await resp.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e: any) {
    const detail = String(e?.message || e || 'export failed')
    exportError.value = t('configSidebar.exportPresetFailed', { detail })
  } finally {
    exportBusy.value = false
  }
}

async function onResetToPreset() {
  if (!config.value) return
  if (!window.confirm(t('configSidebar.resetToPresetConfirm'))) return
  resetBusy.value = true
  resetError.value = null
  try {
    const resp = await (app as any).api.fetchApi(
      `/comfytv/workflows/${config.value.id}/reset_to_preset`,
      { method: 'POST' },
    )
    if (resp.status >= 400) {
      let detail = `${resp.status} ${resp.statusText}`
      try { const j = await resp.json(); if (j?.error) detail += ` — ${j.error}` } catch {}
      throw new Error(detail)
    }
    const sel = selection.selected
    if (sel?.workflowKind && sel?.workflowLabel) {
      await loadConfig(sel.workflowKind, sel.workflowLabel)
    }
    invalidateWorkflowInfo()
  } catch (e: any) {
    const detail = String(e?.message || e || 'reset failed')
    resetError.value = t('configSidebar.resetToPresetFailed', { detail })
  } finally {
    resetBusy.value = false
  }
}

watch(
  () => selection.selectedKey,
  () => {
    const sel = selection.selected
    if (!sel || !sel.workflowLabel) { config.value = null; return }
    void loadConfig(sel.workflowKind, sel.workflowLabel)
  },
  { immediate: true },
)

let _pollTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  selection.refreshFromCanvas()
  _pollTimer = setInterval(() => selection.refreshFromCanvas(), 400)
})
onBeforeUnmount(() => {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
})

interface NodeBlock {
  node_id: string
  node_title: string
  node_type: string
  widgets: ExposedWidget[]
}
const groupedWidgets = computed(() => {
  const groups: Array<{ title: string | null; nodes: NodeBlock[] }> = []
  const groupIdx = new Map<string, number>()
  const nodeIdx  = new Map<string, number>()   // key: `${groupIdx}/${node_id}`
  for (const w of config.value?.exposed_widgets ?? []) {
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
})

const collapsedNodes = ref<Set<string>>(new Set())

function storageKeyForCollapsed(workflowId: number): string {
  return `comfytv:sidebar:collapsed:${workflowId}`
}
function loadCollapsedFor(workflowId: number) {
  try {
    const raw = localStorage.getItem(storageKeyForCollapsed(workflowId))
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) collapsedNodes.value = new Set(arr.map(String))
      return
    }
  } catch {}
  collapsedNodes.value = new Set()
}
function saveCollapsed(workflowId: number) {
  try {
    localStorage.setItem(
      storageKeyForCollapsed(workflowId),
      JSON.stringify(Array.from(collapsedNodes.value)),
    )
  } catch {}
}
watch(
  () => config.value?.id,
  (wid) => { if (wid != null) loadCollapsedFor(wid) },
)

function isCollapsed(nodeId: string): boolean {
  return collapsedNodes.value.has(nodeId)
}
function toggleCollapsed(nodeId: string) {
  if (collapsedNodes.value.has(nodeId)) collapsedNodes.value.delete(nodeId)
  else collapsedNodes.value.add(nodeId)
  collapsedNodes.value = new Set(collapsedNodes.value)
  if (config.value?.id != null) saveCollapsed(config.value.id)
}

function boundCountFor(node: NodeBlock): number {
  return node.widgets.filter(w => isStageBound(w) || w.stage_binding?.startsWith('literal:')).length
}

const notesCollapsed = ref(false)
function storageKeyForNotes(workflowId: number): string {
  return `comfytv:sidebar:notes-collapsed:${workflowId}`
}
function loadNotesCollapsedFor(workflowId: number) {
  try {
    const raw = localStorage.getItem(storageKeyForNotes(workflowId))
    notesCollapsed.value = raw === '1'
  } catch { notesCollapsed.value = false }
}
function toggleNotesCollapsed() {
  notesCollapsed.value = !notesCollapsed.value
  const wid = config.value?.id
  if (wid != null) {
    try { localStorage.setItem(storageKeyForNotes(wid), notesCollapsed.value ? '1' : '0') } catch {}
  }
}
watch(
  () => config.value?.id,
  (wid) => { if (wid != null) loadNotesCollapsedFor(wid) },
)

function comboOptions(w: ExposedWidget): string[] {
  if (w.widget_type !== 'COMBO') return []
  const vals = w.widget_props?.values
  return Array.isArray(vals) ? vals.map((x: any) => String(x)) : []
}
function numProp(w: ExposedWidget, key: string): number | undefined {
  const v = w.widget_props?.[key]
  return typeof v === 'number' ? v : undefined
}
function isStageBound(w: ExposedWidget): boolean {
  if (!w.stage_binding) return false
  if (w.stage_binding.startsWith('literal:')) return false
  return true
}

function dropdownValueFor(w: ExposedWidget): string {
  if (!w.stage_binding) return '__VALUE__'
  if (w.stage_binding.startsWith('literal:')) return '__VALUE__'
  return w.stage_binding
}
function effectiveValue(w: ExposedWidget): any {
  if (typeof w.stage_binding === 'string' && w.stage_binding.startsWith('literal:')) {
    const lit = w.stage_binding.slice('literal:'.length)
    if (lit !== '') return coerceForWidget(w, lit)
  }
  if (w.override_value !== null && w.override_value !== undefined && w.override_value !== '') {
    return coerceForWidget(w, w.override_value)
  }
  return w.current_value
}

function coerceForWidget(w: ExposedWidget, raw: any): any {
  if (w.widget_type === 'INT' || w.widget_type === 'FLOAT') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : w.current_value
  }
  if (w.widget_type === 'BOOLEAN') {
    if (typeof raw === 'boolean') return raw
    const s = String(raw).toLowerCase()
    return s === 'true' || s === '1' || s === 'on' || s === 'yes'
  }
  return raw
}

function notifyValidatorOfBindingChange() {
  invalidateWorkflowInfo()
  selection.bumpBindings()
}

async function postBinding(payload: any) {
  if (!config.value) return
  try {
    await fetchJson('/comfytv/workflows/config/binding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: config.value.id, ...payload }),
    })
    notifyValidatorOfBindingChange()
  } catch (e: any) {
    loadError.value = `save failed: ${e?.message || e}`
  }
}
async function deleteBinding(node_id: string, widget_name: string) {
  if (!config.value) return
  try {
    await fetchJson('/comfytv/workflows/config/binding', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: config.value.id,
        node_id, input_name: widget_name,
      }),
    })
    notifyValidatorOfBindingChange()
  } catch (e: any) {
    loadError.value = `delete failed: ${e?.message || e}`
  }
}

function inferCast(widgetType: string): string | null {
  switch (widgetType) {
    case 'INT':     return 'int'
    case 'FLOAT':   return 'float'
    case 'BOOLEAN': return 'bool'
    default:        return null
  }
}

async function onValueChange(w: ExposedWidget, newVal: any) {
  if (isStageBound(w)) return  // shouldn't happen — UI disables it

  const isCleared =
    newVal === null || newVal === undefined ||
    (typeof newVal === 'string' && newVal === '')
  if (isCleared) {
    w.override_value = null
    w.stage_binding  = null
    await deleteBinding(w.node_id, w.widget_name)
    return
  }

  w.override_value = String(newVal)
  w.stage_binding  = `literal:${w.override_value}`
  w.cast           = inferCast(w.widget_type)

  await postBinding({
    node_id:    w.node_id,
    input_name: w.widget_name,
    from:       w.stage_binding,
    default:    w.override_value,
    cast:       w.cast,
    required:   false,
  })
}

async function onBindingChange(w: ExposedWidget, newBinding: string) {
  if (newBinding === '__VALUE__') {
    if (w.stage_binding) {
      await deleteBinding(w.node_id, w.widget_name)
    }
    w.stage_binding  = null
    w.override_value = null
    return
  }
  let cast: string | null = null
  let defaultValue: string | null = null
  if (newBinding === 'option:seed') {
    cast = 'int'
    defaultValue = 'random_int31'
  } else if (newBinding === 'option:batch_size' ||
             newBinding === 'computed:width' ||
             newBinding === 'computed:height' ||
             newBinding === 'computed:length') {
    cast = 'int'
  }
  const isUpstream = newBinding.startsWith('upstream_')
  w.stage_binding  = newBinding
  w.override_value = defaultValue
  w.cast           = cast

  await postBinding({
    node_id:    w.node_id,
    input_name: w.widget_name,
    from:       newBinding,
    default:    defaultValue,
    cast:       cast,
    required:   isUpstream,
  })
}
</script>

<style scoped>
.wf-config-sidebar {
  display: flex; flex-direction: column;
  width: 100%; height: 100%;
  padding: 8px 10px 24px;
  box-sizing: border-box;
  overflow: auto;
  color: var(--input-text, #ddd);
  font-size: 12px;
}
.header {
  position: sticky; top: -8px;
  margin: -8px -10px 8px;
  padding: 6px 10px;
  background: var(--comfy-input-bg, #1e1e1e);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  z-index: 1;
}
.title { font-weight: 600; font-size: 13px; }
.empty, .empty-sub {
  padding: 20px 6px;
  text-align: center;
  color: rgba(255,255,255,0.45);
  font-style: italic;
  font-size: 11px;
}
.empty-sub { padding: 8px; text-align: left; }
.error {
  padding: 6px 8px; margin: 6px 0;
  background: rgba(220, 80, 80, 0.15);
  border: 1px solid rgba(220, 80, 80, 0.5);
  border-radius: 4px;
  color: #ffb0b0;
  font-size: 11px;
}
.body { display: flex; flex-direction: column; gap: 12px; }
.header-meta {
  display: flex; flex-direction: column; gap: 2px;
  padding: 4px 0 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.header-meta .kind {
  font-size: 9px; text-transform: uppercase; letter-spacing: .4px;
  color: rgba(255,255,255,0.5);
}
.header-meta .lbl { font-size: 12px; font-weight: 600; }
.cache-warn {
  margin-top: 4px;
  font-size: 10px;
  color: rgba(255, 200, 100, 0.85);
  font-style: italic;
}

section h3 {
  margin: 4px 0 6px;
  font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
  color: rgba(255,255,255,0.6);
}

.widget-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.group-head {
  font-size: 9px; text-transform: uppercase; letter-spacing: .5px;
  color: rgba(255, 200, 100, 0.85);
  padding: 4px 0 2px;
  border-bottom: 1px dashed rgba(255, 200, 100, 0.25);
}

.node-block {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
}
.node-header {
  display: flex; align-items: center; gap: 6px;
  width: 100%;
  background: rgba(255,255,255,0.03);
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 6px 8px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.node-header:hover { background: rgba(78,168,255,0.08); }
.node-header.is-collapsed { border-bottom-color: transparent; }
.node-caret {
  width: 10px;
  font-size: 10px;
  color: rgba(255,255,255,0.55);
}
.node-header-title { font-weight: 600; color: #cfe6ff; font-size: 11px; }
.node-header-class { color: rgba(255,255,255,0.4); font-size: 10px; }
.node-header-id { color: rgba(255,255,255,0.4); font-size: 10px; }
.node-header-spacer { flex: 1; }
.node-header-count {
  font-size: 9px;
  color: rgba(255,255,255,0.5);
  font-family: ui-monospace, SFMono-Regular, monospace;
  padding: 1px 6px;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
}

.node-body {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px;
}
.widget-row {
  display: flex; flex-direction: column; gap: 4px;
}
.widget-row + .widget-row {
  padding-top: 6px;
  border-top: 1px dashed rgba(255,255,255,0.06);
}
.widget-name-row {
  font-size: 10px;
}
.widget-name { color: rgba(255,255,255,0.7); }
.mono { font-family: ui-monospace, SFMono-Regular, monospace; }

.widget-bind-row {
  display: grid; grid-template-columns: 60px 1fr; align-items: center; gap: 6px;
  margin-top: 2px;
}
.widget-bind-row .lbl {
  font-size: 9px; text-transform: uppercase; letter-spacing: .4px;
  color: rgba(255,255,255,0.5);
}

.notes-block {
  background: rgba(255, 235, 150, 0.03);
  border: 1px solid rgba(255, 235, 150, 0.25);
  border-radius: 4px;
  overflow: hidden;
}
.notes-header {
  display: flex; align-items: center; gap: 6px;
  width: 100%;
  background: rgba(255, 235, 150, 0.06);
  border: none;
  border-bottom: 1px solid rgba(255, 235, 150, 0.15);
  padding: 5px 8px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.notes-header:hover { background: rgba(255, 235, 150, 0.12); }
.notes-header.is-collapsed { border-bottom-color: transparent; }
.notes-caret { width: 10px; font-size: 10px; color: rgba(255, 235, 150, 0.75); }
.notes-title {
  font-size: 10px; text-transform: uppercase; letter-spacing: .5px;
  color: rgba(255, 235, 150, 0.85);
  font-weight: 600;
  flex: 1;
}
.notes-count {
  font-size: 9px;
  color: rgba(255, 235, 150, 0.7);
  font-family: ui-monospace, SFMono-Regular, monospace;
  padding: 1px 6px;
  background: rgba(255, 235, 150, 0.08);
  border-radius: 8px;
}
.notes-body {
  padding: 6px 8px;
  display: flex; flex-direction: column; gap: 4px;
}
.notes-block .workflow-note {
  background: rgba(255, 235, 150, 0.04);
  border-left: 2px solid rgba(255, 235, 150, 0.5);
  border-radius: 2px;
  padding: 4px 8px;
}
.notes-block .workflow-note-text {
  margin: 0;
  font-family: inherit;
  font-size: 11px;
  white-space: pre-wrap;
  color: rgba(255,255,255,0.75);
}

.desc-block .desc-text {
  margin: 0;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  white-space: pre-wrap;
}

.export-row {
  margin-top: 16px;
  padding: 10px 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.export-button {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 11px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  cursor: pointer;
}
.export-button:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
}
.export-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.export-error {
  font-size: 11px;
  color: rgb(255, 110, 110);
}

/* Reset button — same shape as export, slightly muted so the primary
 * action remains Export. */
.reset-button {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 11px;
  background: transparent;
  color: rgba(255,255,255,0.65);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.reset-button:hover:not(:disabled) {
  background: rgba(255,200,100,0.08);
  border-color: rgba(255,200,100,0.3);
  color: rgba(255,200,100,0.95);
}
.reset-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
