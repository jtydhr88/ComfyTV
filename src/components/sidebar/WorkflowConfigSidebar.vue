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
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVWidget from '@/components/widgets/ComfyTVWidget.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { useBindingWriter } from '@/composables/sidebar/useBindingWriter'
import { useCollapsedFlag, useCollapsedNodeIds } from '@/composables/sidebar/useCollapsedState'
import { useWorkflowConfig } from '@/composables/sidebar/useWorkflowConfig'
import {
  buildBindingOptions,
  type ExposedWidget,
  type NodeBlock,
} from '@/composables/sidebar/workflowConfigCatalog'
import { useSelectionStore } from '@/stores/selectionStore'

const { t } = useI18n()

const selection = useSelectionStore()
const selected  = computed(() => selection.selected)

const {
  config, loadError,
  exportBusy, exportError,
  resetBusy,  resetError,
  loadConfig,
  onExportPreset,
  onResetToPreset,
  postBinding,
  deleteBinding,
} = useWorkflowConfig(t)

const workflowId = computed(() => config.value?.id ?? null)
const { isCollapsed, toggle: toggleCollapsed } = useCollapsedNodeIds(workflowId)
const { collapsed: notesCollapsed, toggle: toggleNotesCollapsed } =
  useCollapsedFlag(workflowId, 'comfytv:sidebar:notes-collapsed:')

const bindingOptions = computed(() =>
  buildBindingOptions(
    config.value?.exposed_widgets ?? [],
    selection.selected?.workflowKind,
  ),
)

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

const {
  isStageBound,
  dropdownValueFor,
  effectiveValue,
  comboOptions,
  numProp,
  onValueChange,
  onBindingChange,
} = useBindingWriter(postBinding, deleteBinding)

function boundCountFor(node: NodeBlock): number {
  return node.widgets.filter(w => isStageBound(w) || w.stage_binding?.startsWith('literal:')).length
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
