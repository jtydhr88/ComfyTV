<template>
  <div class="v2-cio" @pointerdown.stop @wheel.stop @keydown.stop>
    <div class="v2-cio__head">
      <span class="v2-cio__title">{{ t('v2.custom.expose') }}</span>
      <span class="v2-cio__wf" :title="label">{{ label }}</span>
      <button type="button" class="v2-cio__x" :title="t('v2.custom.cancel')" @click.stop="emit('close')">×</button>
    </div>

    <div class="v2-cio__tabs">
      <button type="button" class="v2-cio__tab" :data-on="tab === 'inputs' ? '1' : ''" @click.stop="tab = 'inputs'">
        {{ t('v2.custom.inputs') }} <b>{{ draft.inputs.length }}</b>
      </button>
      <button type="button" class="v2-cio__tab" :data-on="tab === 'outputs' ? '1' : ''" @click.stop="tab = 'outputs'">
        {{ t('v2.custom.outputs') }} <b>{{ draft.outputs.length }}</b>
      </button>
      <input v-model="query" class="v2-cio__search" type="text" :placeholder="t('v2.custom.search')" />
    </div>

    <div v-if="entry.loading" class="v2-cio__state">…</div>
    <div v-else-if="entry.error" class="v2-cio__state v2-cio__state--err">{{ t('v2.custom.loadFailed', { detail: entry.error }) }}</div>

    <div v-else class="v2-cio__body">
      <template v-if="tab === 'inputs'">
        <div v-if="draft.inputs.length" class="v2-cio__section">
          <div class="v2-cio__sectiontitle">{{ t('v2.custom.exposed') }}</div>
          <div v-for="(it, i) in draft.inputs" :key="it.node + '/' + it.input" class="v2-cio__exposed">
            <span class="v2-cio__kind" :data-kind="it.kind">{{ kindLabel(it.kind) }}</span>
            <input
              class="v2-cio__label"
              type="text"
              :value="it.label"
              :title="t('v2.custom.label')"
              @change="(e) => renameInput(i, (e.target as HTMLInputElement).value)"
            />
            <button
              v-if="it.kind !== 'param' && it.kind !== 'text'"
              type="button"
              class="v2-cio__req"
              :data-on="it.required ? '1' : ''"
              :title="it.required ? t('v2.custom.required') : t('v2.custom.optional')"
              @click.stop="toggleRequired(i)"
            >{{ it.required ? '!' : '?' }}</button>
            <button
              v-if="it.kind === 'text'"
              type="button"
              class="v2-cio__req"
              :data-on="it.prompt ? '1' : ''"
              :title="t('v2.custom.asPrompt')"
              @click.stop="togglePrompt(i)"
            >@</button>
            <button
              v-if="it.kind === 'param' && it.ptype === 'INT'"
              type="button"
              class="v2-cio__req"
              :data-on="it.random ? '1' : ''"
              :title="t('v2.custom.asRandom')"
              @click.stop="toggleRandom(i)"
            >🎲</button>
            <button type="button" class="v2-cio__mv" :disabled="i === 0" :title="t('v2.custom.moveUp')" @click.stop="moveInput(i, -1)">↑</button>
            <button type="button" class="v2-cio__mv" :disabled="i === draft.inputs.length - 1" :title="t('v2.custom.moveDown')" @click.stop="moveInput(i, 1)">↓</button>
            <button type="button" class="v2-cio__rm" @click.stop="removeInput(i)">×</button>
          </div>
        </div>
        <div v-if="!inputGroups.length" class="v2-cio__state">{{ t('v2.custom.noCandidates', { what: t('v2.custom.inputs') }) }}</div>
        <div v-for="g in inputGroups" :key="g.title ?? ''" class="v2-cio__section">
          <div v-if="g.title" class="v2-cio__sectiontitle">{{ g.title }}</div>
          <div v-for="n in g.nodes" :key="n.node_id" class="v2-cio__node">
            <div class="v2-cio__nodehead">
              <span class="v2-cio__nodetitle">{{ n.node_title }}</span>
              <span class="v2-cio__nodetype">{{ n.node_type }} #{{ n.node_id }}</span>
            </div>
            <label v-for="w in n.widgets" :key="w.widget_name" class="v2-cio__row">
              <input type="checkbox" :checked="isInputExposed(draft, w)" @change="onToggleInput(w)" />
              <span class="v2-cio__rowname">{{ w.widget_name }}</span>
              <span class="v2-cio__kind" :data-kind="kindOf(w)">{{ kindLabel(kindOf(w)!) }}</span>
            </label>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="draft.outputs.length" class="v2-cio__section">
          <div class="v2-cio__sectiontitle">{{ t('v2.custom.exposed') }}</div>
          <div v-for="(o, i) in draft.outputs" :key="o.node" class="v2-cio__exposed">
            <span class="v2-cio__kind" :data-kind="o.kind">{{ kindLabel(o.kind) }}</span>
            <input
              class="v2-cio__label"
              type="text"
              :value="o.label"
              :title="t('v2.custom.label')"
              @change="(e) => renameOutput(i, (e.target as HTMLInputElement).value)"
            />
            <button
              v-if="o.kind === 'image' || o.kind === 'images'"
              type="button"
              class="v2-cio__req"
              :data-on="o.kind === 'images' ? '1' : ''"
              :title="t('v2.custom.batch')"
              @click.stop="toggleBatch(i)"
            >⧉</button>
            <button type="button" class="v2-cio__mv" :disabled="i === 0" :title="t('v2.custom.moveUp')" @click.stop="moveOutput(i, -1)">↑</button>
            <button type="button" class="v2-cio__mv" :disabled="i === draft.outputs.length - 1" :title="t('v2.custom.moveDown')" @click.stop="moveOutput(i, 1)">↓</button>
            <button type="button" class="v2-cio__rm" @click.stop="removeOutput(i)">×</button>
          </div>
        </div>
        <div v-if="!outputNodes.length" class="v2-cio__state">{{ t('v2.custom.noCandidates', { what: t('v2.custom.outputs') }) }}</div>
        <div v-else class="v2-cio__section">
          <label v-for="n in outputNodes" :key="n.id" class="v2-cio__row v2-cio__row--node">
            <input type="checkbox" :checked="isOutputExposed(draft, n)" @change="onToggleOutput(n)" />
            <span class="v2-cio__rowname">{{ n.title && n.title !== n.type ? n.title : n.type }}</span>
            <span class="v2-cio__nodetype">#{{ n.id }}</span>
            <span class="v2-cio__kind" :data-kind="outputKindOf(n)">{{ kindLabel(outputKindOf(n)!) }}</span>
          </label>
        </div>
      </template>
    </div>

    <div class="v2-cio__foot">
      <span class="v2-cio__summary">
        {{ t('v2.custom.summary', { inputs: draft.inputs.length, outputs: draft.outputs.length }) }}
      </span>
      <span v-if="saveError" class="v2-cio__err">{{ saveError }}</span>
      <span v-else-if="!draft.outputs.length" class="v2-cio__err">{{ t('v2.custom.needsOutput') }}</span>
      <button
        type="button"
        class="v2-cio__btn"
        :disabled="saving || !draft.outputs.length || !entry.config"
        :title="t('v2.custom.saveAsHint')"
        @click.stop="onSaveAs"
      >{{ t('v2.custom.saveAs') }}</button>
      <button type="button" class="v2-cio__btn" @click.stop="emit('close')">{{ t('v2.custom.cancel') }}</button>
      <button
        type="button"
        class="v2-cio__btn v2-cio__btn--primary"
        :disabled="saving || !draft.outputs.length || !entry.config"
        @click.stop="onSave"
      >{{ saving ? t('v2.custom.saving') : t('v2.custom.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  type ExposedWidget,
  type GuiNode,
  type WidgetGroup,
  filterWidgetGroups,
  groupExposedWidgets,
} from '@/composables/sidebar/workflowConfigCatalog'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { useCustomIoStore } from '@/stores/customIoStore'
import {
  type CustomIo,
  type InputKind,
  type OutputKind,
  classifyWidget,
  defaultInputLabel,
  isInputExposed,
  isOutputExposed,
  moveItem,
  assignSlots,
  outputKindOf,
  toggleInput,
  toggleOutput,
} from '@/v2/customIo'

const props = defineProps<{ label: string }>()
const emit = defineEmits<{ close: []; saved: [io: CustomIo]; savedAs: [label: string, io: CustomIo] }>()

const { t } = useI18n()
const store = useCustomIoStore()
const entry = computed(() => store.entry(props.label))

const tab = ref<'inputs' | 'outputs'>('inputs')
const query = ref('')
const draft = ref<CustomIo>({ inputs: [], outputs: [] })
const saving = ref(false)
const saveError = ref<string | null>(null)

function cloneIo(io: CustomIo): CustomIo {
  return JSON.parse(JSON.stringify(io))
}

onMounted(async () => {
  await store.load(props.label)
  draft.value = cloneIo(entry.value.io)
})
watch(() => entry.value.version, () => { draft.value = cloneIo(entry.value.io) })

const kindCache = new WeakMap<ExposedWidget, InputKind | null>()
function kindOf(w: ExposedWidget): InputKind | null {
  if (!kindCache.has(w)) kindCache.set(w, classifyWidget(w))
  return kindCache.get(w) ?? null
}

const inputGroups = computed<WidgetGroup[]>(() => {
  const widgets = (entry.value.config?.exposed_widgets ?? []).filter(w => kindOf(w) !== null)
  return filterWidgetGroups(groupExposedWidgets(widgets), query.value)
})

const outputNodes = computed<GuiNode[]>(() => {
  const q = query.value.trim().toLowerCase()
  return (entry.value.config?.gui_nodes ?? [])
    .filter(n => outputKindOf(n) !== null)
    .filter(n => !q || `${n.title ?? ''} ${n.type} ${n.id}`.toLowerCase().includes(q))
})

function kindLabel(kind: InputKind | OutputKind): string {
  return t(`v2.custom.kinds.${kind}`)
}

function onToggleInput(w: ExposedWidget) {
  const kind = kindOf(w)
  if (!kind) return
  const label = w.node_title && w.node_title !== w.node_type
    ? undefined
    : defaultInputLabel(draft.value, w, kind, kindLabel(kind))
  draft.value = toggleInput(draft.value, w, kind, label)
}
function toggleRandom(i: number) {
  const it = draft.value.inputs[i]
  it.random = !it.random
}
function onToggleOutput(n: GuiNode) {
  const kind = outputKindOf(n)
  if (!kind) return
  draft.value = toggleOutput(draft.value, n, kind)
}
function renameInput(i: number, label: string) {
  const v = label.trim()
  if (v) draft.value.inputs[i].label = v
}
function renameOutput(i: number, label: string) {
  const v = label.trim()
  if (v) draft.value.outputs[i].label = v
}
function toggleRequired(i: number) {
  draft.value.inputs[i].required = !draft.value.inputs[i].required
}
function togglePrompt(i: number) {
  const it = draft.value.inputs[i]
  it.prompt = !it.prompt
}
function toggleBatch(i: number) {
  const o = draft.value.outputs[i]
  const next: OutputKind = o.kind === 'images' ? 'image' : 'images'
  if (draft.value.outputs.some((x, j) => j !== i && x.kind === next)) return
  o.kind = next
}
function removeInput(i: number) {
  draft.value = assignSlots({ inputs: draft.value.inputs.filter((_, j) => j !== i), outputs: draft.value.outputs })
}
function removeOutput(i: number) {
  draft.value = { inputs: draft.value.inputs, outputs: draft.value.outputs.filter((_, j) => j !== i) }
}
function moveInput(i: number, d: number) {
  draft.value = assignSlots({ inputs: moveItem(draft.value.inputs, i, i + d), outputs: draft.value.outputs })
}
function moveOutput(i: number, d: number) {
  draft.value = { inputs: draft.value.inputs, outputs: moveItem(draft.value.outputs, i, i + d) }
}

async function onSaveAs() {
  const name = (await askText({
    title: t('v2.custom.saveAs'),
    label: t('v2.custom.saveAsPrompt'),
    initialValue: `${props.label} (2)`,
  }))?.trim()
  if (!name || name === props.label) return
  saving.value = true
  saveError.value = null
  try {
    const e = await store.saveAs(props.label, name, draft.value)
    emit('savedAs', e.label, e.io)
    emit('close')
  } catch (err: any) {
    saveError.value = t('v2.custom.saveFailed', { detail: String(err?.message || err || 'save failed') })
  } finally {
    saving.value = false
  }
}

async function onSave() {
  saving.value = true
  saveError.value = null
  try {
    const e = await store.save(props.label, draft.value)
    emit('saved', e.io)
    emit('close')
  } catch (err: any) {
    saveError.value = t('v2.custom.saveFailed', { detail: String(err?.message || err || 'save failed') })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.v2-cio {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--v2-card-bg);
  color: var(--v2-text-strong);
  font: 500 11px/1.3 system-ui, sans-serif;
  border-radius: inherit;
}
.v2-cio__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px;
}
.v2-cio__title { font-weight: 600; font-size: 12px; }
.v2-cio__wf {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--v2-text-muted);
}
.v2-cio__x,
.v2-cio__rm,
.v2-cio__mv,
.v2-cio__req {
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--v2-text-mid);
  font: 500 13px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-cio__x:hover, .v2-cio__mv:hover, .v2-cio__req:hover { background: var(--v2-hover-bg); color: var(--v2-text-strong); }
.v2-cio__mv:disabled { opacity: .3; pointer-events: none; }
.v2-cio__rm { color: #f87171; }
.v2-cio__rm:hover { background: rgba(248, 113, 113, 0.12); }
.v2-cio__req { font-size: 11px; border: 1px solid var(--v2-chip-border); }
.v2-cio__req[data-on="1"] { background: var(--v2-accent-soft); border-color: var(--v2-accent-border); color: var(--v2-accent-text); }
.v2-cio__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px 6px;
}
.v2-cio__tab {
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--v2-chip-border);
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-mid);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-cio__tab b { margin-left: 4px; color: var(--v2-text-faint); font-weight: 500; }
.v2-cio__tab[data-on="1"] { background: var(--v2-accent-soft); border-color: var(--v2-accent-border); color: var(--v2-accent-text); }
.v2-cio__tab[data-on="1"] b { color: var(--v2-accent-text); }
.v2-cio__search {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--v2-chip-border);
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-strong);
  font: 500 11px/1 system-ui, sans-serif;
  outline: none;
}
.v2-cio__search:focus { border-color: var(--v2-accent-border); }
.v2-cio__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--v2-scrollbar) transparent;
}
.v2-cio__state {
  padding: 16px 12px;
  color: var(--v2-text-muted);
  text-align: center;
}
.v2-cio__state--err { color: #f87171; }
.v2-cio__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
}
.v2-cio__sectiontitle {
  color: var(--v2-text-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .04em;
  padding: 2px 0;
}
.v2-cio__node { display: flex; flex-direction: column; gap: 2px; padding: 2px 0; }
.v2-cio__nodehead { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.v2-cio__nodetitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v2-cio__nodetype { color: var(--v2-text-faint); font-size: 10px; white-space: nowrap; }
.v2-cio__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0 2px 4px;
  border-radius: 6px;
  cursor: pointer;
}
.v2-cio__row:hover { background: var(--v2-hover-bg); }
.v2-cio__row input[type="checkbox"] { margin: 0; accent-color: var(--v2-accent); }
.v2-cio__rowname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--v2-text-mid); }
.v2-cio__row--node .v2-cio__rowname { color: var(--v2-text-strong); }
.v2-cio__kind {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 9px;
  background: var(--v2-chip-bg);
  border: 1px solid var(--v2-chip-border);
  color: var(--v2-text-muted);
}
.v2-cio__kind[data-kind="image"], .v2-cio__kind[data-kind="images"] { color: #60a5fa; }
.v2-cio__kind[data-kind="video"] { color: #f472b6; }
.v2-cio__kind[data-kind="audio"] { color: #34d399; }
.v2-cio__kind[data-kind="model"] { color: #fbbf24; }
.v2-cio__kind[data-kind="text"] { color: #a78bfa; }
.v2-cio__exposed { display: flex; align-items: center; gap: 4px; }
.v2-cio__label {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--v2-text-strong);
  font: 500 11px/1 system-ui, sans-serif;
  outline: none;
}
.v2-cio__label:hover { border-color: var(--v2-chip-border); }
.v2-cio__label:focus { border-color: var(--v2-accent-border); }
.v2-cio__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 10px;
  border-top: 1px solid var(--v2-slab-border);
}
.v2-cio__summary { flex: 1; min-width: 0; color: var(--v2-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v2-cio__err { color: #f87171; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.v2-cio__btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--v2-chip-border);
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-mid);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-cio__btn:hover { background: var(--v2-hover-bg); color: var(--v2-text-strong); }
.v2-cio__btn--primary { background: var(--v2-run-bg); color: var(--v2-run-fg); border-color: transparent; }
.v2-cio__btn--primary:hover { background: var(--v2-run-hover); }
.v2-cio__btn:disabled { opacity: .4; pointer-events: none; }
</style>
