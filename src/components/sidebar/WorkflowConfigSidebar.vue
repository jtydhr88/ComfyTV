<template>
  <div class="flex flex-col size-full box-border overflow-auto text-xs
              pt-2 pb-6 px-2.5 text-base-foreground">
    <div class="sticky -top-2 z-[1] -mx-2.5 -mt-2 mb-2 py-1.5 px-2.5
                bg-interface-panel-surface border-b border-border-subtle">
      <span class="font-semibold text-sm">{{ $t('configSidebar.title') }}</span>
    </div>

    <div v-if="!selected" :class="emptyClass">
      {{ $t('configSidebar.empty') }}
    </div>

    <div v-else-if="!selected.workflowLabel" :class="emptyClass">
      {{ $t('configSidebar.noWorkflowPicked') }}
    </div>

    <div v-else-if="loadError"
         class="my-1.5 py-1.5 px-2 text-xs rounded
                bg-destructive-background/15 border border-destructive-background/50 text-destructive-background">
      {{ loadError }}
    </div>

    <div v-else-if="config" class="flex flex-col gap-3">
      <div class="flex flex-col gap-0.5 pt-1 pb-2 border-b border-border-subtle">
        <span class="text-3xs uppercase tracking-wide text-muted-foreground">{{ config.kind }}</span>
        <span class="text-xs font-semibold">{{ config.label }}</span>
        <span v-if="!config.has_api" class="mt-1 text-2xs italic text-warning-background">
          {{ $t('configSidebar.pickWorkflowFirst') }}
        </span>
      </div>

      <section v-if="config.gui_notes?.length"
               class="rounded overflow-hidden
                      bg-warning-background/[0.03] border border-warning-background/25">
        <button
          :class="[
            'flex items-center gap-1.5 w-full py-[5px] px-2 text-left cursor-pointer [font-family:inherit]',
            'bg-warning-background/5 border-0 border-b text-inherit',
            'hover:bg-warning-background/10',
            notesCollapsed ? 'border-b-transparent' : 'border-b-warning-background/15',
          ]"
          :aria-expanded="!notesCollapsed"
          @click="toggleNotesCollapsed"
        >
          <span class="w-2.5 text-2xs text-warning-background/75">{{ notesCollapsed ? '▸' : '▾' }}</span>
          <span class="flex-1 text-2xs uppercase tracking-wide font-semibold text-warning-background">
            {{ $t('configSidebar.section.notes') }}
          </span>
          <span class="text-3xs font-mono py-px px-1.5 rounded-lg
                       bg-warning-background/10 text-warning-background/70">
            {{ config.gui_notes.length }}
          </span>
        </button>
        <div v-if="!notesCollapsed" class="flex flex-col gap-1 py-1.5 px-2">
          <div v-for="(note, i) in config.gui_notes" :key="i"
               class="py-1 px-2 rounded-sm border-l-2
                      bg-warning-background/5 border-warning-background/50">
            <pre class="m-0 text-xs whitespace-pre-wrap [font-family:inherit] text-base-foreground">{{ note.text }}</pre>
          </div>
        </div>
      </section>

      <section v-if="config.exposed_widgets?.length">
        <h3 :class="sectionHeading">{{ $t('configSidebar.section.widgets') }}</h3>
        <div v-for="(grp, gi) in groupedWidgets" :key="gi"
             class="flex flex-col gap-1.5 mb-2.5">
          <div v-if="grp.title"
               class="py-1 text-3xs uppercase tracking-wide
                      text-muted-foreground border-b border-border-subtle">
            {{ grp.title }}
          </div>

          <div v-for="node in grp.nodes" :key="node.node_id"
               class="rounded-lg overflow-hidden bg-base-foreground/[0.03]">
            <button
              :class="[
                'flex items-center gap-1.5 w-full py-1.5 px-2 text-left cursor-pointer text-inherit [font-family:inherit]',
                'bg-transparent border-none hover:bg-secondary-background-hover',
              ]"
              :aria-expanded="!isCollapsed(node.node_id)"
              @click="toggleCollapsed(node.node_id)"
            >
              <span class="w-2.5 text-2xs text-muted-foreground">{{ isCollapsed(node.node_id) ? '▸' : '▾' }}</span>
              <span class="text-xs font-semibold text-base-foreground">{{ node.node_title }}</span>
              <span v-if="node.node_title !== node.node_type"
                    class="text-2xs font-mono text-muted-foreground/60">
                ({{ node.node_type }})
              </span>
              <span class="text-2xs font-mono text-muted-foreground/60">#{{ node.node_id }}</span>
              <span class="flex-1"></span>
              <span class="text-3xs font-mono py-px px-1.5 rounded-lg bg-base-foreground/5 text-muted-foreground">
                {{ boundCountFor(node) }} / {{ node.widgets.length }}
              </span>
            </button>

            <div v-if="!isCollapsed(node.node_id)" class="flex flex-col gap-1.5 p-2">
              <div
                v-for="w in node.widgets"
                :key="`${w.node_id}/${w.widget_name}`"
                class="flex flex-col gap-1 [&_+_&]:pt-1.5 [&_+_&]:border-t [&_+_&]:border-solid [&_+_&]:border-border-subtle"
              >
                <div class="text-2xs">
                  <span class="font-mono text-muted-foreground">.{{ w.widget_name }}</span>
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
                <div class="grid grid-cols-[60px_1fr] items-center gap-1.5 mt-0.5">
                  <span class="text-3xs uppercase tracking-wide text-muted-foreground">{{ $t('configSidebar.bindTo') }}</span>
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

      <div v-else class="p-2 text-xs text-left italic text-muted-foreground/60">
        {{ $t('configSidebar.noExposedWidgets') }}
      </div>

      <section v-if="config.description">
        <h3 :class="sectionHeading">{{ $t('configSidebar.section.description') }}</h3>
        <p class="m-0 text-xs whitespace-pre-wrap text-muted-foreground">{{ config.description }}</p>
      </section>

      <div class="mt-4 pt-2.5 pb-3.5 px-3 flex flex-col gap-1 border-t border-border-subtle">
        <button
          :class="exportBtn"
          :disabled="!config.has_api || exportBusy"
          :title="$t('configSidebar.exportPresetTooltip')"
          @click="onExportPreset"
        >⇩ {{ $t('configSidebar.exportPreset') }}</button>
        <button
          :class="resetBtn"
          :disabled="resetBusy"
          :title="$t('configSidebar.resetToPresetTooltip')"
          @click="onResetToPreset"
        >{{ $t('configSidebar.resetToPreset') }}</button>
        <span v-if="exportError" class="text-xs text-destructive-background">{{ exportError }}</span>
        <span v-if="resetError" class="text-xs text-destructive-background">{{ resetError }}</span>
      </div>
    </div>

    <div v-else :class="emptyClass">{{ $t('configSidebar.loading') }}</div>
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
  loadCaps,
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
  void loadCaps()
  selection.refreshFromCanvas()
  _pollTimer = setInterval(() => selection.refreshFromCanvas(), 400)
})
onBeforeUnmount(() => {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
})

const emptyClass     = 'py-5 px-1.5 text-center italic text-xs text-muted-foreground/60'
const sectionHeading = 'mt-1 mb-1.5 text-xs uppercase tracking-wide text-muted-foreground'

const COMFY_BTN_SM = [
  'inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap appearance-none',
  'border-none transition-colors focus-visible:outline-none',
  'disabled:pointer-events-none disabled:opacity-50',
  'h-6 rounded-sm px-2 py-1 text-xs font-medium',
].join(' ')

const exportBtn = COMFY_BTN_SM
  + ' self-start text-secondary-foreground bg-secondary-background hover:bg-secondary-background-hover'

const resetBtn = COMFY_BTN_SM
  + ' self-start bg-transparent text-muted-foreground hover:bg-warning-background/10 hover:text-warning-background'
</script>
